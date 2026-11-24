import { del, get, post, put } from './request';

/**
 * 项目管理接口层（对应 backend-mock 的 `server/api/project/**`）。
 *
 * 与 `demo.ts` 的区别：这里的进度、状态、延期都不是页面算出来的展示值，
 * 而是后端按「任务 → 阶段 → 项目」汇总后的结果；任何写入都要重新读接口，
 * 不能在前端自己改数字，否则看板 / 甘特 / 列表三处会立刻不一致。
 */

export type ProjectStatus = 'active' | 'done' | 'on_hold' | 'planning';
export type TaskStatus = 'blocked' | 'done' | 'pending' | 'running';
export type Priority = 'high' | 'low' | 'middle';
export type MemberRole = 'design' | 'dev' | 'owner' | 'pm' | 'test';

export interface ProjectRecord {
  actualEndDate: string;
  code: string;
  createdAt: string;
  delayed: boolean;
  delayDays: number;
  description: string;
  id: number;
  name: string;
  owner: string;
  planEndDate: string;
  priority: Priority;
  progress: number;
  progressText: string;
  startDate: string;
  status: ProjectStatus;
  updatedAt: string;
}

export interface ProjectPhase {
  delayed: boolean;
  delayDays: number;
  endDate: string;
  id: number;
  isMilestone: boolean;
  name: string;
  orderNo: number;
  owner: string;
  progress: number;
  progressText: string;
  projectId: number;
  projectName?: string;
  remark: string;
  startDate: string;
  status: TaskStatus;
}

export interface ProjectTask {
  delayed: boolean;
  delayDays: number;
  dependsOn: string;
  dueDate: string;
  id: number;
  owner: string;
  phaseId: number;
  priority: Priority;
  progress: number;
  progressText: string;
  projectId: number;
  projectName?: string;
  remark: string;
  startDate: string;
  status: TaskStatus;
  title: string;
}

export interface ProjectMember {
  dept: string;
  email: string;
  id: number;
  name: string;
  projectId: number;
  projectName?: string;
  role: MemberRole;
  roleLabel?: string;
  status: 'disabled' | 'enabled';
}

export interface ProjectLog {
  action: string;
  createdAt: string;
  id: number;
  note: string;
  operator: string;
  projectId: number;
  taskId: number;
  title: string;
  value: string;
}

export interface ProjectDetail {
  logs: ProjectLog[];
  members: ProjectMember[];
  phases: ProjectPhase[];
  project: ProjectRecord;
  tasks: ProjectTask[];
}

export interface GanttRow {
  delayed: boolean;
  deps: string;
  end: string;
  id: string;
  kind: 'milestone' | 'phase' | 'task';
  name: string;
  owner: string;
  phase: string;
  progress: number;
  projectId: number;
  start: string;
  status: string;
}

/** 排期时间窗与任务时间不匹配的问题（阶段编辑、甘特图据此提示） */
export interface ScheduleIssue {
  message: string;
  phaseId: number;
  phaseName: string;
  taskId?: number;
  taskTitle?: string;
  type: 'end_before_start' | 'task_out_of_range';
}

export interface ProjectOverview {
  delayedProjects: ProjectRecord[];
  delayedTasks: ProjectTask[];
  milestones: { delayed: number; done: number; total: number };
  projects: Array<
    Pick<
      ProjectRecord,
      | 'delayDays'
      | 'delayed'
      | 'id'
      | 'name'
      | 'owner'
      | 'planEndDate'
      | 'progress'
      | 'status'
    >
  >;
  recentLogs: ProjectLog[];
  stats: {
    projectActive: number;
    projectDelayed: number;
    projectDone: number;
    projectTotal: number;
    taskDelayed: number;
    taskDone: number;
    taskPending: number;
    taskRunning: number;
    taskTotal: number;
  };
}

export interface ProjectOptions {
  memberRoles: Array<{ label: string; value: string }>;
  phaseTemplate: Array<{ isMilestone: boolean; name: string }>;
  priorities: Array<{ label: string; value: string }>;
  projectStatuses: Array<{ label: string; value: string }>;
  taskStatuses: Array<{ label: string; value: string }>;
}

type ListResult<T> = { list: T[]; total: number };
type Params = Record<string, unknown>;

/* ------------------------------- 项目 ------------------------------- */

export function getProjectList(params?: Params) {
  return get<ListResult<ProjectRecord>>('/project/list', params);
}
export function getProjectDetail(id: number) {
  return get<ProjectDetail>(`/project/${id}`);
}
export function createProject(data: Params) {
  return post<ProjectRecord>('/project', data);
}
export function updateProject(id: number, data: Params) {
  return put<ProjectRecord>(`/project/${id}`, data);
}
export function deleteProject(id: number) {
  return del<null>(`/project/${id}`);
}

/* ------------------------------- 排期 ------------------------------- */

export function getProjectGantt(params?: Params) {
  return get<{ projectName: string; rows: GanttRow[] }>(
    '/project/gantt',
    params,
  );
}
export function getProjectPhases(params?: Params) {
  return get<ListResult<ProjectPhase>>('/project/phase/list', params);
}
export function createProjectPhase(data: Params) {
  return post<ProjectPhase>('/project/phase', data);
}
/** 阶段排期编辑：响应带回排期与任务时间的匹配问题 */
export function updateProjectPhase(id: number, data: Params) {
  return put<ProjectPhase & { scheduleIssues: ScheduleIssue[] }>(
    `/project/phase/${id}`,
    data,
  );
}

/** 排期校验：阶段时间窗是否覆盖名下任务时间 */
export function validateProjectSchedule(params?: Params) {
  return get<{ issues: ScheduleIssue[]; total: number }>(
    '/project/schedule/validate',
    params,
  );
}

/** 关联任务组：把一批任务挂到阶段 */
export function assignTaskGroup(
  phaseId: number,
  taskIds: number[],
  operator?: string,
) {
  return post<{ assigned: number; rejected: number[] }>(
    '/project/schedule/group',
    {
      operator,
      phaseId,
      taskIds,
    },
  );
}

/* ------------------------------- 任务 ------------------------------- */

export function getProjectTasks(params?: Params) {
  return get<ListResult<ProjectTask>>('/project/task/list', params);
}
export function getProjectTaskDetail(id: number) {
  return get<{ logs: ProjectLog[]; task: ProjectTask }>(`/project/task/${id}`);
}
export function createProjectTask(data: Params) {
  return post<ProjectTask>('/project/task', data);
}
export function updateProjectTask(id: number, data: Params) {
  return put<ProjectTask>(`/project/task/${id}`, data);
}
export function deleteProjectTask(id: number) {
  return del<null>(`/project/task/${id}`);
}
/** 甘特拖拽改期：后端按 startDate/dueDate 写回并留痕 */
export function rescheduleTask(id: number, data: Params) {
  return put<ProjectTask>(`/project/task/${id}`, data);
}
export function updateTaskStatus(id: number, data: Params) {
  return post<ProjectTask>(`/project/task/${id}/status`, data);
}

/* ------------------------------- 成员 ------------------------------- */

export function getProjectMembers(params?: Params) {
  return get<ListResult<ProjectMember>>('/project/member/list', params);
}
export function addProjectMember(data: Params) {
  return post<ProjectMember>('/project/member', data);
}
export function updateProjectMember(id: number, data: Params) {
  return put<ProjectMember>(`/project/member/${id}`, data);
}
export function removeProjectMember(id: number) {
  return del<null>(`/project/member/${id}`);
}

/* ------------------------------- 看板 ------------------------------- */

export function getProjectOverview() {
  return get<ProjectOverview>('/project/overview');
}
export function getProjectOptions() {
  return get<ProjectOptions>('/project/options');
}
