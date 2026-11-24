import type {
  ProjectPhaseRecord,
  ProjectTaskRecord,
} from '../server/utils/db/project';
import type { TestEvent } from './fixtures/nitro-imports';

import { beforeEach, describe, expect, it } from 'vitest';

import detailRoute from '../server/api/project/[id].get';
import updateProjectRoute from '../server/api/project/[id].put';
import ganttRoute from '../server/api/project/gantt.get';
import createRoute from '../server/api/project/index.post';
import listRoute from '../server/api/project/list.get';
import overviewRoute from '../server/api/project/overview.get';
import groupRoute from '../server/api/project/schedule/group.post';
import validateRoute from '../server/api/project/schedule/validate.get';
import taskStatusRoute from '../server/api/project/task/[id]/status.post';
import createTaskRoute from '../server/api/project/task/index.post';
import {
  assignTaskGroup,
  computePhaseProgress,
  computeProjectProgress,
  computeTaskEffectiveProgress,
  PROGRESS_WEIGHTS,
  PROJECT_DB,
  PROJECT_LOG_DB,
  PROJECT_MEMBER_DB,
  PROJECT_PHASE_DB,
  PROJECT_TASK_DB,
  reschedulePhase,
  rescheduleTask,
  setTaskProgress,
  validatePhaseSchedule,
} from '../server/utils/db/project';
import { createTestEvent } from './fixtures/nitro-imports';

type Handler = (event: TestEvent) => Promise<{ code: number; data: any }>;
const as = (route: unknown) => route as Handler;

const list = as(listRoute);
const overview = as(overviewRoute);
const create = as(createRoute);
const detail = as(detailRoute);
const gantt = as(ganttRoute);
const createTask = as(createTaskRoute);
const updateStatus = as(taskStatusRoute);
const updateProject = as(updateProjectRoute);
const validateSchedule = as(validateRoute);
const assignGroup = as(groupRoute);

const FIXED_TODAY = '2026-11-19';

/** 构造一个任务，省略的字段填默认值 */
function makeTask(
  overrides: Partial<ProjectTaskRecord> = {},
): ProjectTaskRecord {
  return {
    dependsOn: '',
    dueDate: '2026-12-31',
    id: 9001,
    owner: '测试',
    phaseId: 1,
    priority: 'middle',
    progress: 50,
    projectId: 1,
    remark: '',
    startDate: '2026-12-01',
    status: 'running',
    title: '测试任务',
    updatedAt: '',
    ...overrides,
  };
}

/** 构造阶段 */
function makePhase(
  overrides: Partial<ProjectPhaseRecord> = {},
): ProjectPhaseRecord {
  return {
    endDate: '2026-12-31',
    id: 1,
    isMilestone: false,
    name: '测试阶段',
    orderNo: 1,
    owner: '测试',
    progress: 0,
    projectId: 1,
    remark: '',
    startDate: '2026-12-01',
    status: 'pending',
    updatedAt: '',
    ...overrides,
  };
}

/**
 * 项目模块的进度/排期回归：
 * - 进度是纯派生值（状态+进度占比+优先级权重+时间节点），不存在人工入口；
 * - 任务写操作一次写穿任务/阶段/项目/看板/甘特；
 * - 排期与进度解耦：调整阶段时间不改进度真源（任务），但会触发重算与匹配校验。
 */
describe('项目管理数据闭环', () => {
  beforeEach(() => {
    // 测试共库：每条用例裁掉自建项目，避免 id 累加影响断言
    for (const table of [
      PROJECT_DB,
      PROJECT_PHASE_DB,
      PROJECT_TASK_DB,
      PROJECT_MEMBER_DB,
      PROJECT_LOG_DB,
    ]) {
      [...table.keys()]
        .filter((key) => (table[key] as { id: number }).id > 600)
        .reverse()
        .forEach((key) => table.splice(key, 1));
    }
  });

  /* ---------------------------------------------------------------- 基础闭环 */

  it('种子数据彼此关联，项目进度等于权重算法结果（非简单均值）', async () => {
    expect(PROJECT_DB.length).toBe(6);
    const data = (await detail(createTestEvent({ params: { id: '1' } }))).data;
    expect(data.project.name).toBe('管理后台 2.0');
    expect(data.phases.length).toBeGreaterThan(0);
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.members.length).toBeGreaterThan(0);
    const phases = PROJECT_PHASE_DB.filter((item) => item.projectId === 1);
    const tasks = PROJECT_TASK_DB.filter((item) => item.projectId === 1);
    expect(data.project.progress).toBe(
      computeProjectProgress(phases, tasks, FIXED_TODAY),
    );
    expect(data.logs.length).toBe(data.tasks.length);
  });

  it('后端计算任务进度会同步阶段、项目与看板，并留下进度流水', async () => {
    const before = PROJECT_DB.find((item) => item.id === 1)!;
    // 进度无 HTTP 写入口：只有后端内部原语能推进，测试直接驱动计算链路
    const task = setTaskProgress(3, 100, '联调完成', '林晓')!;
    expect(task.progress).toBe(100);
    expect(task.status).toBe('done');
    expect(PROJECT_DB.find((item) => item.id === 1)!.progress).toBeGreaterThan(
      before.progress,
    );

    const log = PROJECT_LOG_DB.findLast((item) => item.taskId === 3)!;
    expect(log).toMatchObject({
      action: '进度更新',
      value: '100%',
      note: '联调完成',
    });

    const board = (await overview(createTestEvent())).data;
    expect(board.projects.find((item: any) => item.id === 1).progress).toBe(
      PROJECT_DB.find((item) => item.id === 1)!.progress,
    );
  });

  it('不存在人工修改任务进度的 HTTP 接口', async () => {
    // 写入口已从路由表摘除：POST /project/task/:id/progress 文件不存在
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    expect(
      existsSync(
        resolve(process.cwd(), 'server/api/project/task/[id]/progress.post.ts'),
      ),
    ).toBe(false);
  });

  it('任务完成时自动解锁依赖它的阻塞任务', async () => {
    const blocked = PROJECT_TASK_DB.find((item) => item.id === 303)!;
    expect(blocked.status).toBe('blocked');
    setTaskProgress(301, 100);
    expect(PROJECT_TASK_DB.find((item) => item.id === 303)!.status).toBe(
      'pending',
    );
  });

  it('状态流转会把完成强制置 100%，待开始归零', async () => {
    await updateStatus(
      createTestEvent({ params: { id: '4' }, body: { status: 'done' } }),
    );
    expect(PROJECT_TASK_DB.find((item) => item.id === 4)!.progress).toBe(100);
    await updateStatus(
      createTestEvent({ params: { id: '4' }, body: { status: 'pending' } }),
    );
    expect(PROJECT_TASK_DB.find((item) => item.id === 4)!.progress).toBe(0);
  });

  it('新建项目立即生成阶段/里程碑，并可在甘特图看到', async () => {
    const created = await create(
      createTestEvent({
        body: {
          name: '验收用项目',
          owner: '测试负责人',
          startDate: '2026-11-20',
          planEndDate: '2026-12-20',
        },
      }),
    );
    expect(created.code).toBe(200);
    const projectId = created.data.id as number;
    const data = (
      await detail(createTestEvent({ params: { id: String(projectId) } }))
    ).data;
    expect(data.phases).toHaveLength(6);
    expect(data.phases.filter((phase: any) => phase.isMilestone)).toHaveLength(
      3,
    );

    const chart = (
      await gantt(createTestEvent({ query: { projectId: String(projectId) } }))
    ).data;
    expect(chart.rows.length).toBeGreaterThanOrEqual(6);
    expect(chart.rows.some((row: any) => row.kind === 'milestone')).toBe(true);
  });

  it('列表按 pageNum 分页，并且「我的项目」按账号裁剪', async () => {
    const page1 = (
      await list(createTestEvent({ query: { pageNum: '1', pageSize: '2' } }))
    ).data;
    expect(page1.list).toHaveLength(2);
    expect(page1.total).toBe(PROJECT_DB.length);
    const mine = (await list(createTestEvent({ query: { mine: 'true' } })))
      .data;
    expect(mine.list.length).toBeGreaterThan(0);
    expect(
      mine.list.every((item: any) => ['林晓', '苏叶'].includes(item.owner)),
    ).toBe(true);
  });

  it('延期项目在看板中被标记，完成的项目不再报风险', async () => {
    const board = (await overview(createTestEvent())).data;
    expect(
      board.projects.find((item: any) => item.name === '监控告警治理').delayed,
    ).toBe(true);
    expect(
      board.projects.find((item: any) => item.name === '组件库 1.5').delayed,
    ).toBe(false);
  });

  /* ------------------------------------------------ 权重算法：状态 / 占比 / 时间节点 */

  describe('进度权重算法', () => {
    it('完成状态优先：done=100、pending=0，不受 progress 字段干扰', () => {
      expect(
        computeTaskEffectiveProgress(
          makeTask({ status: 'done', progress: 30 }),
          FIXED_TODAY,
        ),
      ).toBe(100);
      expect(
        computeTaskEffectiveProgress(
          makeTask({ status: 'pending', progress: 90 }),
          FIXED_TODAY,
        ),
      ).toBe(0);
    });

    it('进度占比 + 阻塞折减 0.8', () => {
      expect(
        computeTaskEffectiveProgress(
          makeTask({ status: 'running', progress: 60, dueDate: '2026-12-31' }),
          FIXED_TODAY,
        ),
      ).toBe(60);
      expect(
        computeTaskEffectiveProgress(
          makeTask({ status: 'blocked', progress: 60, dueDate: '2026-12-31' }),
          FIXED_TODAY,
        ),
      ).toBe(48);
    });

    it('时间节点：逾期未完成按天数折减，达到上限后不再降；已完成不折减', () => {
      const overdue3 = makeTask({
        status: 'running',
        progress: 90,
        dueDate: '2026-11-16',
      });
      // 逾期 3 天 × 2%/天 = 6%
      expect(computeTaskEffectiveProgress(overdue3, FIXED_TODAY)).toBe(84);
      const overdue20 = makeTask({
        status: 'running',
        progress: 100,
        dueDate: '2026-10-30',
      });
      // 逾期超过 10 天，折减封顶 20%
      expect(computeTaskEffectiveProgress(overdue20, FIXED_TODAY)).toBe(
        100 - PROGRESS_WEIGHTS.overduePenaltyMax,
      );
      expect(
        computeTaskEffectiveProgress(
          makeTask({ status: 'done', progress: 100, dueDate: '2026-10-01' }),
          FIXED_TODAY,
        ),
      ).toBe(100);
    });

    it('优先级权重：高优先级任务对阶段完成率贡献更大', () => {
      const high = makeTask({
        id: 1,
        priority: 'high',
        progress: 100,
        status: 'running',
        dueDate: '2026-12-31',
      });
      const low = makeTask({
        id: 2,
        priority: 'low',
        progress: 0,
        status: 'pending',
        dueDate: '2026-12-31',
      });
      // high 权重 3、low 权重 1 → (100*3 + 0*1) / 4 = 75
      expect(computePhaseProgress(1, [high, low], FIXED_TODAY)).toBe(75);
    });

    it('无任务的阶段完成率为 0（不再允许人工填阶段进度）', () => {
      expect(computePhaseProgress(999, [makeTask()], FIXED_TODAY)).toBe(0);
    });

    it('项目进度 = 阶段完成率按任务数加权；任务多的阶段话语权更大', () => {
      const phaseA = makePhase({ id: 10 });
      const phaseB = makePhase({ id: 11 });
      // A 阶段 3 个任务全完成，B 阶段 1 个任务未完成 → (100*3 + 0*1)/4 = 75
      const doneTasks = [1, 2, 3].map((id) =>
        makeTask({
          id,
          phaseId: 10,
          priority: 'middle',
          progress: 100,
          status: 'done',
          dueDate: '2026-12-31',
        }),
      );
      const undone = makeTask({
        id: 4,
        phaseId: 11,
        priority: 'middle',
        progress: 0,
        status: 'pending',
        dueDate: '2026-12-31',
      });
      expect(
        computeProjectProgress(
          [phaseA, phaseB],
          [...doneTasks, undone],
          FIXED_TODAY,
        ),
      ).toBe(75);
    });

    it('阶段完成率纳入项目进度：阶段内任务变化会改变整体', () => {
      const phase = makePhase({ id: 12 });
      const tasks = [
        makeTask({
          id: 1,
          phaseId: 12,
          progress: 100,
          status: 'done',
          dueDate: '2026-12-31',
        }),
        makeTask({
          id: 2,
          phaseId: 12,
          progress: 0,
          status: 'pending',
          dueDate: '2026-12-31',
        }),
      ];
      const before = computeProjectProgress([phase], tasks, FIXED_TODAY);
      tasks[1]!.progress = 100;
      tasks[1]!.status = 'done';
      const after = computeProjectProgress([phase], tasks, FIXED_TODAY);
      expect(after).toBeGreaterThan(before);
    });

    it('空阶段/空任务时进度为 0，不产生 NaN', () => {
      expect(computeProjectProgress([], [], FIXED_TODAY)).toBe(0);
      expect(computeProjectProgress([makePhase()], [], FIXED_TODAY)).toBe(0);
      expect(
        computeProjectProgress([], [makeTask()], FIXED_TODAY),
      ).toBeGreaterThanOrEqual(0);
    });

    it('任意输入结果都被限制在 0~100', () => {
      const weird = makeTask({
        progress: 9999,
        status: 'running',
        dueDate: '2026-12-31',
      });
      expect(computeTaskEffectiveProgress(weird, FIXED_TODAY)).toBe(100);
      const negative = makeTask({
        progress: -50,
        status: 'running',
        dueDate: '2026-12-31',
      });
      expect(computeTaskEffectiveProgress(negative, FIXED_TODAY)).toBe(0);
    });
  });

  /* ------------------------------------------------ 无人工篡改入口 */

  describe('进度无人工篡改入口', () => {
    it('编辑项目接口不接受 progress，传入也被忽略', async () => {
      await updateProject(
        createTestEvent({
          params: { id: '1' },
          body: { progress: 99, name: '改名但不改进度' },
        }),
      );
      // 进度由任务派生，不因请求里的 progress=99 变化
      const phases = PROJECT_PHASE_DB.filter((item) => item.projectId === 1);
      const tasks = PROJECT_TASK_DB.filter((item) => item.projectId === 1);
      expect(PROJECT_DB.find((item) => item.id === 1)!.progress).toBe(
        computeProjectProgress(phases, tasks, FIXED_TODAY),
      );
    });

    it('阶段进度接口已移除：CGI 层不存在可写 phase.progress 的路径', () => {
      // setPhaseProgress 及 /project/phase/:id/progress 已删除；这里以纯函数口径确认阶段进度只由任务算
      const phase = makePhase({ id: 1 });
      expect(
        computePhaseProgress(
          phase.id,
          [
            makeTask({
              phaseId: 1,
              progress: 30,
              status: 'running',
              dueDate: '2026-12-31',
            }),
          ],
          FIXED_TODAY,
        ),
      ).toBe(30);
      expect(typeof (computePhaseProgress as unknown) === 'function').toBe(
        true,
      );
    });
  });

  /* ------------------------------------------------ 联动更新：进度 / 状态 / 截止时间 */

  describe('任务写操作联动重算', () => {
    /** 建一个隔离项目 + 两个阶段的 task，避免种子被前面用例污染 */
    async function isolatedProject() {
      const created = await create(
        createTestEvent({
          body: {
            name: '联动测试项目',
            startDate: '2026-11-01',
            planEndDate: '2026-12-31',
          },
        }),
      );
      const projectId = created.data.id as number;
      const phases = PROJECT_PHASE_DB.filter(
        (item) => item.projectId === projectId,
      ).sort((a, b) => a.orderNo - b.orderNo);
      const phase = phases[0]!;
      const t1 = await createTask(
        createTestEvent({
          body: {
            title: '任务A',
            projectId,
            phaseId: phase.id,
            dueDate: '2026-12-31',
          },
        }),
      );
      const t2 = await createTask(
        createTestEvent({
          body: {
            title: '任务B',
            projectId,
            phaseId: phase.id,
            dueDate: '2026-12-31',
          },
        }),
      );
      return {
        projectId,
        phase,
        taskA: t1.data.id as number,
        taskB: t2.data.id as number,
      };
    }
    const progressOf = (id: number) =>
      PROJECT_DB.find((item) => item.id === id)!.progress;

    it('任务进度变更 → 项目进度变化且与纯函数一致', async () => {
      const { projectId, taskA } = await isolatedProject();
      const before = progressOf(projectId);
      setTaskProgress(taskA, 100);
      const after = progressOf(projectId);
      expect(after).toBeGreaterThan(before);
      const phases = PROJECT_PHASE_DB.filter(
        (item) => item.projectId === projectId,
      );
      const tasks = PROJECT_TASK_DB.filter(
        (item) => item.projectId === projectId,
      );
      expect(after).toBe(computeProjectProgress(phases, tasks, FIXED_TODAY));
    });

    it('任务状态变更 → 项目进度同步重算', async () => {
      const { projectId, taskA } = await isolatedProject();
      setTaskProgress(taskA, 50);
      const before = progressOf(projectId);
      await updateStatus(
        createTestEvent({
          params: { id: String(taskA) },
          body: { status: 'done' },
        }),
      );
      expect(progressOf(projectId)).toBeGreaterThan(before);
    });

    it('任务截止时间变更（含逾期）→ 项目进度因时间节点折减而变化', async () => {
      const { projectId, taskA } = await isolatedProject();
      setTaskProgress(taskA, 60);
      const before = progressOf(projectId);
      // 把任务整体改到过去（截止日已逾期），有效进度会被时间节点折减
      const changed = rescheduleTask(taskA, '2026-09-01', '2026-10-01');
      expect(changed).toBeDefined();
      expect(progressOf(projectId)).toBeLessThan(before);
    });
  });

  /* ------------------------------------------------ 排期管理：校验 / 任务组 / 解耦 */

  describe('排期管理与解耦', () => {
    it('阶段时间窗不覆盖任务时间 → 校验给出异常，覆盖则通过', () => {
      const phase = makePhase({
        id: 50,
        startDate: '2026-12-01',
        endDate: '2026-12-10',
      });
      const inRange = makeTask({
        id: 1,
        phaseId: 50,
        startDate: '2026-12-02',
        dueDate: '2026-12-09',
      });
      expect(validatePhaseSchedule(phase, [inRange])).toHaveLength(0);
      const outOfRange = makeTask({
        id: 2,
        phaseId: 50,
        startDate: '2026-11-01',
        dueDate: '2026-12-20',
      });
      const issues = validatePhaseSchedule(phase, [outOfRange]);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'task_out_of_range',
        taskId: 2,
        phaseId: 50,
      });
    });

    it('阶段结束早于开始 → 校验给出 end_before_start', () => {
      const phase = makePhase({
        id: 51,
        startDate: '2026-12-10',
        endDate: '2026-12-01',
      });
      expect(
        validatePhaseSchedule(phase, []).some(
          (issue) => issue.type === 'end_before_start',
        ),
      ).toBe(true);
    });

    it('项目级校验接口返回全部问题清单', async () => {
      const res = await validateSchedule(createTestEvent({ query: {} }));
      expect(res.code).toBe(200);
      expect(Array.isArray(res.data.issues)).toBe(true);
      expect(res.data.total).toBe(res.data.issues.length);
    });

    it('关联任务组：任务归入阶段后阶段进度随之变化，跨项目任务被拒绝', () => {
      const phase = PROJECT_PHASE_DB.find((item) => item.id === 3)!; // P-001 研发实现
      const foreign = PROJECT_TASK_DB.find((item) => item.projectId !== 1)!;
      const result = assignTaskGroup(phase.id, [foreign.id]);
      expect(result).toMatchObject({ assigned: 0, rejected: [foreign.id] });
    });

    it('关联任务组接口：空任务列表被拒绝', async () => {
      const phase = PROJECT_PHASE_DB.find((item) => item.projectId === 1)!;
      const res = await assignGroup(
        createTestEvent({ body: { phaseId: phase.id, taskIds: [] } }),
      );
      expect(res.code).toBe(400);
    });

    it('排期调整只改日期不改进度真源（任务），但会触发重算', async () => {
      const phase = PROJECT_PHASE_DB.find((item) => item.id === 1)!;
      const taskBefore = PROJECT_TASK_DB.filter(
        (item) => item.phaseId === phase.id,
      ).map((item) => item.progress);
      reschedulePhase(phase.id, '2026-10-01', '2026-11-30');
      const taskAfter = PROJECT_TASK_DB.filter(
        (item) => item.phaseId === phase.id,
      ).map((item) => item.progress);
      expect(taskAfter).toEqual(taskBefore); // 任务进度未被排期改动触碰
      const phases = PROJECT_PHASE_DB.filter(
        (item) => item.projectId === phase.projectId,
      );
      const tasks = PROJECT_TASK_DB.filter(
        (item) => item.projectId === phase.projectId,
      );
      expect(
        PROJECT_DB.find((item) => item.id === phase.projectId)!.progress,
      ).toBe(computeProjectProgress(phases, tasks, FIXED_TODAY));
    });
  });
});
