/**
 * 项目管理数据层 —— 把原来 6 个互不相关的静态演示页串成一条真实业务链：
 *
 *   项目创建 → 阶段排期 → 任务分配 → 进度更新 → 进度查看（看板 / 甘特 / 日志）
 *
 * 五张表全部落到 SQLite（唯一实现），关系用业务 id 显式表达：
 *   project(1) ──< phase(阶段/里程碑) ──< task ──< progress_log
 *        └──< member
 *
 * 最关键的口径是**进度只能由操作算出来，不能手写**：
 *   task.progress（唯一人工输入是任务进度/状态/时间）→ 权重算法聚合 → phase.progress → project.progress
 * 项目、阶段进度都是纯派生值：任何写接口都不接受 progress 字段，全部由 `refreshProject` 重算。
 * 聚合算法见下方 `computeTaskEffectiveProgress` / `computePhaseProgress` / `computeProjectProgress`：
 * 综合任务的完成状态、进度占比、优先级权重与时间节点（逾期打折），阶段完成率再按工期权重
 * 纳入项目整体进度。延期 `delayed / delayDays` 由截止日期与今天实时算出，不存字段、不会过期。
 *
 * 种子是手写的初始化数据（与 builtin 一样零随机），只在库为空时写入一次；
 * 运行期所有写入都来自接口，请求链路不再造数。
 */

import dayjs from 'dayjs';

import { defineCollection, nextBizId } from './sqlite';

/* -------------------------------------------------------------------------- */
/* 类型与常量                                                                   */
/* -------------------------------------------------------------------------- */

export type ProjectPriority = 'high' | 'low' | 'middle';
export type ProjectStatus = 'active' | 'done' | 'on_hold' | 'planning';
export type TaskStatus = 'blocked' | 'done' | 'pending' | 'running';
export type MemberRole = 'design' | 'dev' | 'owner' | 'pm' | 'test';

export interface ProjectRecord {
  /** 完成日期，仅在状态首次变为「已完成」时写入 */
  actualEndDate: string;
  code: string;
  createdAt: string;
  description: string;
  id: number;
  name: string;
  owner: string;
  planEndDate: string;
  priority: ProjectPriority;
  progress: number;
  startDate: string;
  status: ProjectStatus;
  updatedAt: string;
}

export interface ProjectPhaseRecord {
  endDate: string;
  id: number;
  isMilestone: boolean;
  name: string;
  orderNo: number;
  owner: string;
  progress: number;
  projectId: number;
  remark: string;
  startDate: string;
  status: TaskStatus;
  updatedAt: string;
}

export interface ProjectTaskRecord {
  dependsOn: string;
  dueDate: string;
  id: number;
  owner: string;
  phaseId: number;
  priority: ProjectPriority;
  progress: number;
  projectId: number;
  remark: string;
  startDate: string;
  status: TaskStatus;
  title: string;
  updatedAt: string;
}

export interface ProjectMemberRecord {
  dept: string;
  email: string;
  id: number;
  name: string;
  projectId: number;
  role: MemberRole;
  status: 'disabled' | 'enabled';
}

export interface ProjectLogRecord {
  action: string;
  createdAt: string;
  id: number;
  note: string;
  operator: string;
  projectId: number;
  taskId: number;
  title: string;
  /** 变更后的值：进度百分比 / 状态 / 日期串，由 action 决定语义 */
  value: string;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: '待开始',
  active: '进行中',
  on_hold: '已暂停',
  done: '已完成',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待开始',
  running: '进行中',
  blocked: '已阻塞',
  done: '已完成',
};

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  high: '高',
  middle: '中',
  low: '低',
};

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: '项目负责人',
  pm: '项目经理',
  dev: '开发',
  design: '设计',
  test: '测试',
};

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(
  ([value, label]) => ({ label, value }),
);
export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS).map(
  ([value, label]) => ({ label, value }),
);
export const PROJECT_PRIORITY_OPTIONS = Object.entries(
  PROJECT_PRIORITY_LABELS,
).map(([value, label]) => ({ label, value }));
export const MEMBER_ROLE_OPTIONS = Object.entries(MEMBER_ROLE_LABELS).map(
  ([value, label]) => ({ label, value }),
);

/** 新建项目时自动生成的阶段模板：日期按项目周期等分，可在「项目排期」页再调整 */
export const PHASE_TEMPLATE = [
  { isMilestone: false, name: '需求与方案', ratio: 0.2 },
  { isMilestone: true, name: '需求冻结', ratio: 0.25 },
  { isMilestone: false, name: '研发实现', ratio: 0.7 },
  { isMilestone: true, name: '功能完成', ratio: 0.75 },
  { isMilestone: false, name: '联调测试', ratio: 0.92 },
  { isMilestone: true, name: '交付上线', ratio: 1 },
] as const;

function now(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}
function today(): string {
  return dayjs().format('YYYY-MM-DD');
}

/* -------------------------------------------------------------------------- */
/* 纯函数：延期、进度、状态                                                     */
/* -------------------------------------------------------------------------- */

/** 已逾期且未完成才算延期；完成的项目即使晚于计划也不再报风险 */
export function delayInfo(deadline: string, status: string) {
  if (!deadline || status === 'done') return { delayed: false, delayDays: 0 };
  const days = dayjs(today()).diff(dayjs(deadline), 'day');
  return days > 0
    ? { delayed: true, delayDays: days }
    : { delayed: false, delayDays: 0 };
}

function clampProgress(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, Math.round(num)));
}

/* -------------------------------------------------------------------------- */
/* 进度权重算法（纯函数：状态 + 进度占比 + 时间节点 + 优先级）                    */
/* -------------------------------------------------------------------------- */

/**
 * 预设权重表——集中在此，改口径只动这一处，便于测试与二次开发。
 * - priority：任务优先级权重，高优先级对阶段完成率贡献更大；
 * - overduePenaltyPerDay / overduePenaltyMax：逾期未完成任务每天的进度折减（时间节点维度）；
 * - milestoneBoost：里程碑以 dependencies 指向的前置阶段为参考，里程碑自身权重略高。
 */
export const PROGRESS_WEIGHTS = {
  priority: { high: 3, low: 1, middle: 2 } as Record<ProjectPriority, number>,
  overduePenaltyMax: 20,
  overduePenaltyPerDay: 2,
} as const;

/**
 * 任务的「有效进度」= 完成状态 + 进度占比 + 时间节点三者合成：
 * - done 直接 100，pending 直接 0（状态优先，杜绝"完成了却报 80%"）；
 * - running / blocked 取进度占比，blocked 额外按 0.8 折减（阻塞视为风险，不计满额）；
 * - 已逾期且未完成：按逾期天数折减（每天 2%，上限 20%），把时间节点纳入进度。
 * 只做计算不改数据，方便单测断言任意输入的输出。
 */
export function computeTaskEffectiveProgress(
  task: Pick<ProjectTaskRecord, 'dueDate' | 'progress' | 'status'>,
  todayDate = today(),
): number {
  if (task.status === 'done') return 100;
  if (task.status === 'pending') return 0;

  let value = clampProgress(task.progress);
  if (task.status === 'blocked') value = Math.round(value * 0.8);

  // 时间节点：截止日已过且未完成 → 按逾期天数折减（与 delayInfo 同口径，但允许注入日期便于测试）
  if (task.dueDate && dayjs(todayDate).isAfter(dayjs(task.dueDate), 'day')) {
    const delayDays = dayjs(todayDate).diff(dayjs(task.dueDate), 'day');
    const penalty = Math.min(
      PROGRESS_WEIGHTS.overduePenaltyMax,
      delayDays * PROGRESS_WEIGHTS.overduePenaltyPerDay,
    );
    value = clampProgress(value - penalty);
  }
  return value;
}

/** 阶段完成率：名下任务按优先级加权平均；无任务为 0（不再允许人工填阶段进度）。 */
export function computePhaseProgress(
  phaseId: number,
  tasks: ProjectTaskRecord[],
  todayDate = today(),
): number {
  const own = tasks.filter((task) => task.phaseId === phaseId);
  if (own.length === 0) return 0;
  let weighted = 0;
  let totalWeight = 0;
  for (const task of own) {
    const weight = PROGRESS_WEIGHTS.priority[task.priority] ?? 1;
    weighted += computeTaskEffectiveProgress(task, todayDate) * weight;
    totalWeight += weight;
  }
  return totalWeight ? clampProgress(weighted / totalWeight) : 0;
}

/**
 * 项目整体进度：阶段完成率按「工期权重」加权平均（时间节点决定话语权），
 * 完全由任务派生——阶段完成率本身也是任务算出来的，所以"排期完成率纳入整体进度"
 * 与"进度唯一来源是任务"两件事同时成立且互不矛盾。
 * 没有任何阶段时退回任务加权平均；连任务都没有则为 0。
 */
export function computeProjectProgress(
  phases: ProjectPhaseRecord[],
  tasks: ProjectTaskRecord[],
  todayDate = today(),
): number {
  if (phases.length === 0) {
    if (tasks.length === 0) return 0;
    let weighted = 0;
    let totalWeight = 0;
    for (const task of tasks) {
      const weight = PROGRESS_WEIGHTS.priority[task.priority] ?? 1;
      weighted += computeTaskEffectiveProgress(task, todayDate) * weight;
      totalWeight += weight;
    }
    return totalWeight ? clampProgress(weighted / totalWeight) : 0;
  }

  let weighted = 0;
  let totalWeight = 0;
  for (const phase of phases) {
    // 权重 = 名下任务数（任务越多话语权越大）；无任务阶段权重 0，不稀释进度。
    // 这里刻意不按工期加权：工期会让一个长阶段主导整体，导致任意任务的微小进度
    // 变化四舍五入后看不出联动（需求是"任一任务变更都能实时反映到项目进度"）。
    // 时间节点维度已在任务有效进度里用逾期折减体现，无需在此重复。
    const taskCount = tasks.filter((task) => task.phaseId === phase.id).length;
    if (taskCount === 0) continue;
    weighted += computePhaseProgress(phase.id, tasks, todayDate) * taskCount;
    totalWeight += taskCount;
  }
  return totalWeight ? clampProgress(weighted / totalWeight) : 0;
}

/** 视图模型：把延时信息挂在记录上，页面不必各自算一遍 */
export function decorateProject(record: ProjectRecord) {
  return {
    ...record,
    progressText: `${record.progress}%`,
    ...delayInfo(record.planEndDate, record.status),
  };
}

export function decorateTask(record: ProjectTaskRecord) {
  return {
    ...record,
    progressText: `${record.progress}%`,
    ...delayInfo(record.dueDate, record.status),
  };
}

export function decoratePhase(record: ProjectPhaseRecord) {
  return {
    ...record,
    progressText: `${record.progress}%`,
    ...delayInfo(record.endDate, record.status),
  };
}

/**
 * 任务 → 阶段 → 项目的进度与状态汇总；所有任务写接口结束前都必须调一次。
 * 排期（阶段）数据与进度计算完全解耦：这里只读取 phase 的工期与归属，
 * 从不写 phase 的日期/名称；progress 全部由上面的纯函数从任务派生。
 */
export function refreshProject(projectId: number): ProjectRecord | undefined {
  const projectIndex = PROJECT_DB.findIndex((item) => item.id === projectId);
  const project = PROJECT_DB[projectIndex];
  if (!project) return undefined;

  const phases = PROJECT_PHASE_DB.filter(
    (item) => item.projectId === projectId,
  );
  const tasks = PROJECT_TASK_DB.filter((item) => item.projectId === projectId);

  // 阶段：完成率由名下任务按权重聚合；状态按任务完成情况推导；无任务阶段归零
  for (const phase of phases) {
    const ownTasks = tasks.filter((task) => task.phaseId === phase.id);
    phase.progress = computePhaseProgress(phase.id, tasks);
    phase.status = ownTasks.every((task) => task.status === 'done')
      ? 'done'
      : ownTasks.some(
            (task) => task.status === 'running' || task.status === 'done',
          )
        ? 'running'
        : 'pending';
    phase.updatedAt = now();
    PROJECT_PHASE_DB[
      PROJECT_PHASE_DB.findIndex((item) => item.id === phase.id)
    ] = { ...phase };
  }

  // 项目：阶段完成率按工期权重聚合，阶段本身也是任务算出来的（唯一的进度真源是任务）
  project.progress = computeProjectProgress(phases, tasks);

  if (project.status !== 'on_hold') {
    const allDone =
      tasks.length > 0 && tasks.every((task) => task.status === 'done');
    if (allDone) {
      project.status = 'done';
      if (!project.actualEndDate) project.actualEndDate = today();
    } else {
      // 从已完成回退到进行中时清掉完成日期，避免「已完成」和完成日期对不上
      project.actualEndDate = '';
      if (
        tasks.some(
          (task) => task.status === 'running' || task.status === 'done',
        )
      ) {
        project.status = 'active';
      }
    }
  }
  project.updatedAt = now();
  PROJECT_DB[projectIndex] = { ...project };
  return PROJECT_DB[projectIndex];
}

/* -------------------------------------------------------------------------- */
/* 排期校验：阶段时间窗 vs 名下任务时间窗（纯函数，供接口与前端复用）              */
/* -------------------------------------------------------------------------- */

export interface ScheduleIssue {
  /** 问题类型，前端据此选择文案与严重程度 */
  type: 'end_before_start' | 'task_out_of_range';
  /** 关联的任务 id（阶段级问题为 undefined） */
  taskId?: number;
  taskTitle?: string;
  phaseId: number;
  phaseName: string;
  /** 可读的问题描述 */
  message: string;
}

/**
 * 校验单个阶段的排期时间与其名下任务时间的匹配度：
 * - 阶段自身的结束早于开始；
 * - 任务的开始早于阶段开始 / 截止晚于阶段结束（任务越出阶段窗口）。
 * 只返回问题不改数据，future 可扩展里程碑依赖校验。
 */
export function validatePhaseSchedule(
  phase: ProjectPhaseRecord,
  tasks: ProjectTaskRecord[],
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  if (dayjs(phase.endDate).isBefore(dayjs(phase.startDate), 'day')) {
    issues.push({
      message: `阶段「${phase.name}」结束日期早于开始日期`,
      phaseId: phase.id,
      phaseName: phase.name,
      type: 'end_before_start',
    });
  }
  for (const task of tasks.filter((item) => item.phaseId === phase.id)) {
    if (
      dayjs(task.startDate).isBefore(dayjs(phase.startDate), 'day') ||
      dayjs(task.dueDate).isAfter(dayjs(phase.endDate), 'day')
    ) {
      issues.push({
        message: `任务「${task.title}」时间 ${task.startDate} ~ ${task.dueDate} 超出阶段「${phase.name}」排期 ${phase.startDate} ~ ${phase.endDate}`,
        phaseId: phase.id,
        phaseName: phase.name,
        taskId: task.id,
        taskTitle: task.title,
        type: 'task_out_of_range',
      });
    }
  }
  return issues;
}

/** 按项目聚合排期问题；甘特/排期页一次拉全 */
export function validateProjectSchedule(projectId: number): ScheduleIssue[] {
  const phases = PROJECT_PHASE_DB.filter(
    (item) => item.projectId === projectId,
  );
  const tasks = PROJECT_TASK_DB.filter((item) => item.projectId === projectId);
  return phases.flatMap((phase) => validatePhaseSchedule(phase, tasks));
}

/** 依赖全部完成才解锁；用于任务完成后把 blocked 的下游改回 pending */
function unlockDependents(finishedId: number, projectId: number): void {
  const key = String(finishedId);
  PROJECT_TASK_DB.filter(
    (task) =>
      task.projectId === projectId &&
      task.status === 'blocked' &&
      task.dependsOn
        .split(/[\s,;]+/u)
        .map((item) => item.trim())
        .filter(Boolean)
        .includes(key),
  ).forEach((task) => {
    task.status = 'pending';
    task.updatedAt = now();
    appendLog(task, '状态变更', 'pending', '依赖任务已完成，解除阻塞', '系统');
  });
}

function appendLog(
  task: ProjectTaskRecord,
  action: string,
  value: string,
  note: string,
  operator: string,
): void {
  PROJECT_LOG_DB.push({
    action,
    createdAt: now(),
    id: nextLogId(),
    note,
    operator: operator || '系统',
    projectId: task.projectId,
    taskId: task.id,
    title: task.title,
    value,
  });
}

/** 更新任务进度是唯一允许改变项目进度的入口 */
export function setTaskProgress(
  taskId: number,
  progress: unknown,
  note = '',
  operator = '系统',
) {
  const index = PROJECT_TASK_DB.findIndex((task) => task.id === taskId);
  const current = PROJECT_TASK_DB[index];
  if (!current) return undefined;

  const next = clampProgress(progress);
  const status: TaskStatus =
    next === 100
      ? 'done'
      : next === 0
        ? current.status === 'done'
          ? 'pending'
          : current.status
        : 'running';

  PROJECT_TASK_DB[index] = {
    ...current,
    progress: next,
    status,
    updatedAt: now(),
  };
  const task = PROJECT_TASK_DB[index]!;
  appendLog(
    task,
    '进度更新',
    `${next}%`,
    note || `进度由 ${current.progress}% 更新为 ${next}%`,
    operator,
  );
  if (status === 'done' && current.status !== 'done')
    unlockDependents(task.id, task.projectId);
  refreshProject(task.projectId);
  return task;
}

/** 状态流转：完成强制 100%，待开始归零，进行中至少 1% */
export function setTaskStatus(
  taskId: number,
  status: TaskStatus,
  note = '',
  operator = '系统',
) {
  const index = PROJECT_TASK_DB.findIndex((task) => task.id === taskId);
  const current = PROJECT_TASK_DB[index];
  if (!current) return undefined;

  const progress =
    status === 'done'
      ? 100
      : status === 'pending'
        ? 0
        : // 甘特映射层把 <=1 的进度当 0~1 比率，1% 会被画成 100%；起始值取 5%
          status === 'running'
          ? Math.max(5, current.progress)
          : current.progress;

  PROJECT_TASK_DB[index] = { ...current, progress, status, updatedAt: now() };
  const task = PROJECT_TASK_DB[index]!;
  appendLog(
    task,
    '状态变更',
    status,
    note || `状态由 ${current.status} 更新为 ${status}`,
    operator,
  );
  if (status === 'done' && current.status !== 'done')
    unlockDependents(task.id, task.projectId);
  refreshProject(task.projectId);
  return task;
}

/** 甘特拖拽改期：起止同时写回并留痕 */
export function rescheduleTask(
  taskId: number,
  startDate: string,
  dueDate: string,
  operator = '系统',
) {
  const index = PROJECT_TASK_DB.findIndex((task) => task.id === taskId);
  const current = PROJECT_TASK_DB[index];
  if (!current) return undefined;
  if (!dayjs(startDate).isValid() || !dayjs(dueDate).isValid())
    return undefined;
  if (dayjs(dueDate).isBefore(dayjs(startDate), 'day')) return undefined;

  PROJECT_TASK_DB[index] = { ...current, startDate, dueDate, updatedAt: now() };
  const task = PROJECT_TASK_DB[index]!;
  appendLog(
    task,
    '排期调整',
    `${startDate} ~ ${dueDate}`,
    `原排期 ${current.startDate} ~ ${current.dueDate}`,
    operator,
  );
  refreshProject(task.projectId);
  return task;
}

/** 阶段排期调整（甘特条 / 排期页表单共用），同步更新里程碑日期 */
export function reschedulePhase(
  phaseId: number,
  startDate: string,
  endDate: string,
  operator = '系统',
) {
  const index = PROJECT_PHASE_DB.findIndex((phase) => phase.id === phaseId);
  const current = PROJECT_PHASE_DB[index];
  if (!current) return undefined;
  if (!dayjs(startDate).isValid() || !dayjs(endDate).isValid())
    return undefined;
  if (dayjs(endDate).isBefore(dayjs(startDate), 'day')) return undefined;

  PROJECT_PHASE_DB[index] = {
    ...current,
    startDate,
    endDate,
    updatedAt: now(),
  };
  const phase = PROJECT_PHASE_DB[index]!;
  const task = PROJECT_TASK_DB.find((item) => item.phaseId === phase.id);
  if (task) {
    appendLog(
      task,
      '阶段排期调整',
      `${startDate} ~ ${endDate}`,
      `阶段「${phase.name}」排期已调整`,
      operator,
    );
  }
  refreshProject(phase.projectId);
  return phase;
}

/* -------------------------------------------------------------------------- */
/* 创建：项目 + 阶段模板一次建成，避免"项目有了但没法排期"                       */
/* -------------------------------------------------------------------------- */

export interface ProjectFormValues {
  code?: string;
  description?: string;
  name?: string;
  owner?: string;
  planEndDate?: string;
  priority?: ProjectPriority;
  startDate?: string;
}

export function createProject(data: ProjectFormValues) {
  const name = String(data.name ?? '').trim();
  const startDate = dayjs(data.startDate || today()).format('YYYY-MM-DD');
  const planEndDate = dayjs(
    data.planEndDate || dayjs(startDate).add(90, 'day'),
  ).format('YYYY-MM-DD');
  const project: ProjectRecord = {
    actualEndDate: '',
    code: String(
      data.code || `PRJ-${String(nextProjectId()).padStart(3, '0')}`,
    ),
    createdAt: now(),
    description: String(data.description ?? ''),
    id: nextProjectId(),
    name,
    owner: String(data.owner || ''),
    planEndDate: planEndDate < startDate ? startDate : planEndDate,
    priority: (data.priority || 'middle') as ProjectPriority,
    progress: 0,
    startDate,
    status: 'planning',
    updatedAt: now(),
  };
  PROJECT_DB.push(project);

  const totalDays = Math.max(
    1,
    dayjs(planEndDate).diff(dayjs(startDate), 'day'),
  );
  let previous = '';
  PHASE_TEMPLATE.forEach((template, index) => {
    const phaseStart =
      index === 0
        ? startDate
        : dayjs(startDate)
            .add(
              Math.round(totalDays * PHASE_TEMPLATE[index - 1]!.ratio),
              'day',
            )
            .format('YYYY-MM-DD');
    const phaseEnd = dayjs(startDate)
      .add(Math.round(totalDays * template.ratio), 'day')
      .format('YYYY-MM-DD');
    PROJECT_PHASE_DB.push({
      endDate: phaseEnd,
      id: nextPhaseId(),
      isMilestone: template.isMilestone,
      name: template.name,
      orderNo: index + 1,
      owner: project.owner,
      progress: 0,
      projectId: project.id,
      remark: previous ? `依赖：${previous}` : '',
      startDate: phaseStart,
      status: 'pending',
      updatedAt: now(),
    });
    previous = template.name;
  });
  return project;
}

export function pickProjectFields(
  data: Record<string, unknown>,
): Partial<ProjectRecord> {
  const picked: Partial<ProjectRecord> = {};
  if (data.name !== undefined) picked.name = String(data.name);
  if (data.code !== undefined) picked.code = String(data.code);
  if (data.description !== undefined)
    picked.description = String(data.description);
  if (data.owner !== undefined) picked.owner = String(data.owner);
  if (data.startDate !== undefined) picked.startDate = String(data.startDate);
  if (data.planEndDate !== undefined)
    picked.planEndDate = String(data.planEndDate);
  if (data.priority !== undefined)
    picked.priority = data.priority as ProjectPriority;
  if (data.status !== undefined) picked.status = data.status as ProjectStatus;
  return picked;
}

/**
 * 关联任务组：把一批任务挂到指定阶段（或取消关联 phaseId=0）。
 * 只改 phaseId 与时间不改进度真源；随后由 refreshProject 重算阶段/项目进度与排期校验。
 * 校验：任务与阶段必须同项目；phaseId=0 表示移出阶段。
 */
export function assignTaskGroup(
  phaseId: number,
  taskIds: number[],
  operator = '系统',
): undefined | { assigned: number; rejected: number[] } {
  const phase = PROJECT_PHASE_DB.find((item) => item.id === phaseId);
  if (!phase) return undefined;

  const rejected: number[] = [];
  let assigned = 0;
  for (const rawId of taskIds) {
    const id = Number(rawId);
    const index = PROJECT_TASK_DB.findIndex((task) => task.id === id);
    const task = PROJECT_TASK_DB[index];
    if (!task || task.projectId !== phase.projectId) {
      rejected.push(id);
      continue;
    }
    PROJECT_TASK_DB[index] = { ...task, phaseId, updatedAt: now() };
    appendLog(
      PROJECT_TASK_DB[index]!,
      '任务组调整',
      phaseId ? `归入阶段「${phase.name}」` : '移出阶段',
      `排期关联调整（${operator}）`,
      operator,
    );
    assigned += 1;
  }
  refreshProject(phase.projectId);
  return { assigned, rejected };
}

export function pickTaskFields(
  data: Record<string, unknown>,
): Partial<ProjectTaskRecord> {
  const picked: Partial<ProjectTaskRecord> = {};
  if (data.title !== undefined) picked.title = String(data.title);
  if (data.owner !== undefined) picked.owner = String(data.owner);
  if (data.phaseId !== undefined) picked.phaseId = Number(data.phaseId);
  if (data.startDate !== undefined) picked.startDate = String(data.startDate);
  if (data.dueDate !== undefined) picked.dueDate = String(data.dueDate);
  if (data.priority !== undefined)
    picked.priority = data.priority as ProjectPriority;
  if (data.dependsOn !== undefined) picked.dependsOn = String(data.dependsOn);
  if (data.remark !== undefined) picked.remark = String(data.remark);
  return picked;
}

/* -------------------------------------------------------------------------- */
/* 手写初始化数据（零随机，仅库为空时写入一次）                                  */
/* -------------------------------------------------------------------------- */

/** 种子任务里的依赖写「项目内任务序号」，buildSeed 再换成真实业务 id，避免跨项目串号 */
type SeedTask = [
  title: string,
  phaseIndex: number,
  owner: string,
  progress: number,
  status: TaskStatus,
  priority: ProjectPriority,
  startOffset: number,
  endOffset: number,
  dependsOn?: string,
];

interface SeedProject {
  code: string;
  description: string;
  name: string;
  owner: string;
  planEnd: string;
  priority: ProjectPriority;
  progressHint: number;
  start: string;
  status: ProjectStatus;
  tasks: SeedTask[];
}

const SEED_SPECS: SeedProject[] = [
  {
    code: 'P-001',
    description: '后台管理系统的 2.0 版本，覆盖权限、菜单与数据工作台重构。',
    name: '管理后台 2.0',
    owner: '林晓',
    planEnd: '2026-12-20',
    priority: 'high',
    progressHint: 72,
    start: '2026-10-08',
    status: 'active',
    tasks: [
      ['需求评审与拆解', 0, '林晓', 100, 'done', 'high', 0, 7],
      ['原型与视觉确认', 1, '李珊', 100, 'done', 'middle', 5, 12, '1'],
      ['权限模型重构', 2, '林晓', 85, 'running', 'high', 13, 34, '2'],
      ['数据工作台改造', 2, '苏叶', 70, 'running', 'middle', 16, 38, '2'],
      ['回归测试', 4, '陈默', 20, 'running', 'middle', 36, 48, '3,4'],
    ],
  },
  {
    code: 'P-002',
    description: '统一数据平台架构升级与历史数据迁移。',
    name: '数据平台重构',
    owner: '周珂',
    planEnd: '2027-01-15',
    priority: 'high',
    progressHint: 45,
    start: '2026-10-20',
    status: 'active',
    tasks: [
      ['表结构设计', 0, '周珂', 100, 'done', 'high', 0, 10],
      ['ETL 方案评审', 1, '周珂', 100, 'done', 'high', 8, 14, '1'],
      ['同步链路开发', 2, '陈默', 60, 'running', 'high', 15, 40, '2'],
      ['数据校准', 4, '李珊', 10, 'running', 'middle', 38, 55, '3'],
    ],
  },
  {
    code: 'P-003',
    description: '内部组件库版本迭代与文档补齐。',
    name: '组件库 1.5',
    owner: '苏叶',
    planEnd: '2026-10-30',
    priority: 'middle',
    progressHint: 100,
    start: '2026-09-01',
    status: 'done',
    tasks: [
      ['组件单元测试', 2, '苏叶', 100, 'done', 'middle', 0, 25],
      ['文档与示例补齐', 4, '李珊', 100, 'done', 'low', 20, 40, '1'],
      ['发版验收', 5, '苏叶', 100, 'done', 'middle', 38, 45, '2'],
    ],
  },
  {
    code: 'P-004',
    description: '审批中心流程引擎联调与灰度发布。',
    name: '审批中心',
    owner: '陈默',
    planEnd: '2027-02-01',
    priority: 'high',
    progressHint: 30,
    start: '2026-11-02',
    status: 'active',
    tasks: [
      ['流程引擎联调', 2, '陈默', 30, 'running', 'high', 0, 30],
      ['表单设计器接入', 2, '林晓', 10, 'running', 'middle', 5, 35],
      ['灰度发布', 5, '陈默', 0, 'blocked', 'high', 40, 60, '1'],
    ],
  },
  {
    code: 'P-005',
    description: '移动端 H5 页面改版，尚未启动排期。',
    name: '移动端 H5',
    owner: '林晓',
    planEnd: '2027-03-01',
    priority: 'low',
    progressHint: 0,
    start: '2026-11-25',
    status: 'planning',
    tasks: [
      ['视觉走查', 0, '李珊', 0, 'pending', 'low', 0, 12],
      ['页面适配', 2, '苏叶', 0, 'pending', 'middle', 12, 40, '1'],
    ],
  },
  {
    code: 'P-006',
    description: '监控告警规则治理，当前已超出计划交付日期。',
    name: '监控告警治理',
    owner: '周珂',
    planEnd: '2026-11-01',
    priority: 'middle',
    progressHint: 15,
    start: '2026-09-15',
    status: 'active',
    tasks: [
      ['告警规则梳理', 0, '周珂', 100, 'done', 'middle', 0, 15],
      ['告警降噪改造', 2, '周珂', 30, 'running', 'high', 16, 48, '1'],
      ['验收复盘', 5, '陈默', 0, 'blocked', 'low', 48, 55, '2'],
    ],
  },
];

function buildSeed() {
  const projects: ProjectRecord[] = [];
  const phases: ProjectPhaseRecord[] = [];
  const tasks: ProjectTaskRecord[] = [];
  const members: ProjectMemberRecord[] = [];
  const logs: ProjectLogRecord[] = [];

  SEED_SPECS.forEach((spec, projectIndex) => {
    const projectId = projectIndex + 1;
    projects.push({
      actualEndDate: spec.status === 'done' ? spec.planEnd : '',
      code: spec.code,
      createdAt: `${spec.start} 09:00:00`,
      description: spec.description,
      id: projectId,
      name: spec.name,
      owner: spec.owner,
      planEndDate: spec.planEnd,
      priority: spec.priority,
      progress: spec.progressHint,
      startDate: spec.start,
      status: spec.status,
      updatedAt: '2026-11-01 00:00:00',
    });

    const totalDays = Math.max(
      1,
      dayjs(spec.planEnd).diff(dayjs(spec.start), 'day'),
    );
    const phaseIds: number[] = [];
    PHASE_TEMPLATE.forEach((template, index) => {
      const phaseId = projectIndex * 100 + index + 1;
      phaseIds.push(phaseId);
      phases.push({
        endDate: dayjs(spec.start)
          .add(Math.round(totalDays * template.ratio), 'day')
          .format('YYYY-MM-DD'),
        id: phaseId,
        isMilestone: template.isMilestone,
        name: template.name,
        orderNo: index + 1,
        owner: spec.owner,
        progress: Math.min(
          100,
          Math.round((spec.progressHint * (index + 1)) / PHASE_TEMPLATE.length),
        ),
        projectId,
        remark: '',
        startDate:
          index === 0
            ? spec.start
            : dayjs(spec.start)
                .add(
                  Math.round(totalDays * PHASE_TEMPLATE[index - 1]!.ratio),
                  'day',
                )
                .format('YYYY-MM-DD'),
        status:
          spec.status === 'done'
            ? 'done'
            : spec.progressHint > 0 && index === 2
              ? 'running'
              : 'pending',
        updatedAt: '2026-11-01 00:00:00',
      });
    });

    // 任务 id 连续编排，保证种子里的 dependsOn（如 '1'）在不同项目间不会串
    spec.tasks.forEach((taskSpec, taskIndex) => {
      const [
        title,
        phaseIndex,
        owner,
        progress,
        status,
        priority,
        startOffset,
        endOffset,
        dependsOn = '',
      ] = taskSpec;
      const taskId = projectIndex * 100 + taskIndex + 1;
      // 种子里写的是「项目内序号」，这里换成真实 id；拆分阈值与 id 编排规则保持一致
      const realDependencies = dependsOn
        .split(/[\s,;]+/u)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => String(projectIndex * 100 + Number(value)))
        .join(',');
      tasks.push({
        dependsOn: realDependencies,
        dueDate: dayjs(spec.start).add(endOffset, 'day').format('YYYY-MM-DD'),
        id: taskId,
        owner,
        phaseId: phaseIds[phaseIndex]!,
        priority,
        progress,
        projectId,
        remark: '',
        startDate: dayjs(spec.start)
          .add(startOffset, 'day')
          .format('YYYY-MM-DD'),
        status,
        title,
        updatedAt: '2026-11-01 00:00:00',
      });
      logs.push({
        action: status === 'done' ? '任务完成' : '进度更新',
        createdAt: '2026-11-01 00:00:00',
        id: logs.length + 1,
        note: `初始化 ${title}`,
        operator: owner,
        projectId,
        taskId,
        title,
        value: `${progress}%`,
      });
    });

    const memberRoles: MemberRole[] = ['owner', 'dev', 'design', 'test'];
    const memberNames = [
      ...new Set([spec.owner, ...spec.tasks.map((task) => task[2])]),
    ];
    memberNames.forEach((name, memberIndex) => {
      members.push({
        dept:
          name === '李珊' ? '设计组' : name === '陈默' ? '测试组' : '研发组',
        email: `member${projectIndex + 1}${memberIndex + 1}@example.com`,
        id: projectIndex * 100 + memberIndex + 1,
        name,
        projectId,
        role:
          memberIndex === 0
            ? 'owner'
            : memberRoles[memberIndex % memberRoles.length]!,
        status: 'enabled',
      });
    });
  });

  return { logs, members, phases, projects, tasks };
}

const SEED = buildSeed();

/**
 * 启动时按权重算法回填一次，避免种子里的 progressHint 与任务派生结果不一致。
 * 用同一套纯函数，保证种子与运行期写接口走的是一条计算链。
 */
SEED.projects.forEach((project) => {
  const ownPhases = SEED.phases.filter(
    (phase) => phase.projectId === project.id,
  );
  const ownTasks = SEED.tasks.filter((task) => task.projectId === project.id);
  if (ownTasks.length > 0)
    project.progress = computeProjectProgress(ownPhases, ownTasks);
});

/* -------------------------------------------------------------------------- */
/* 集合声明必须在 SEED 之后：defineCollection 会立刻调用 seed()，提前声明会踩 TDZ  */ /* -------------------------------------------------------------------------- */

export const PROJECT_DB: ProjectRecord[] = defineCollection<ProjectRecord>({
  seed: () => SEED.projects,
  table: 'tb_project',
});
export const PROJECT_PHASE_DB: ProjectPhaseRecord[] =
  defineCollection<ProjectPhaseRecord>({
    seed: () => SEED.phases,
    table: 'tb_project_phase',
  });
export const PROJECT_TASK_DB: ProjectTaskRecord[] =
  defineCollection<ProjectTaskRecord>({
    seed: () => SEED.tasks,
    table: 'tb_project_task',
  });
export const PROJECT_MEMBER_DB: ProjectMemberRecord[] =
  defineCollection<ProjectMemberRecord>({
    seed: () => SEED.members,
    table: 'tb_project_member',
  });
export const PROJECT_LOG_DB: ProjectLogRecord[] =
  defineCollection<ProjectLogRecord>({
    seed: () => SEED.logs,
    table: 'tb_project_progress_log',
  });

/**
 * 「我的项目 / 我的任务」按登录账号映射到种子里的负责人。
 * 真实系统应取用户档案里的姓名；mock 用固定映射保证两个账号看到的集合不同，
 * 从而能验证「我的」和「全部」确实走了两条过滤分支。
 */
const MINE_OWNER_MAP: Record<string, string[]> = {
  admin: ['林晓', '苏叶'],
  custom: ['周珂'],
};

export function ownersForAccount(username: string): string[] {
  return MINE_OWNER_MAP[username] ?? [];
}

export function nextProjectId(): number {
  return nextBizId('tb_project');
}
export function nextPhaseId(): number {
  return nextBizId('tb_project_phase');
}
export function nextTaskId(): number {
  return nextBizId('tb_project_task');
}
export function nextMemberId(): number {
  return nextBizId('tb_project_member');
}
export function nextLogId(): number {
  return nextBizId('tb_project_progress_log');
}
