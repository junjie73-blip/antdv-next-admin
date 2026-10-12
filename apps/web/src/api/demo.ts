import { del, get, post, put } from './request';

/**
 * 「表格增删改查」示例的数据接口（对应 mock 的 `server/api/demo/task`）。
 *
 * 单开一个 `demo.ts` 而不是塞进 `system.ts`：示例页要演示的是"接口层该长什么样"，
 * 和真实业务（用户/角色/部门）混在一个文件里，读示例的人会以为任务接口
 * 也是系统管理的一部分。
 */

export type TaskPriority = 'high' | 'low' | 'middle';
export type TaskStatus = 'blocked' | 'done' | 'pending' | 'running';

export interface TaskRecord {
  createdAt: string;
  dueDate: string;
  id: number;
  owner: string;
  priority: TaskPriority;
  progress: number;
  remark: string;
  status: TaskStatus;
  title: string;
  updatedAt: string;
}

/** 表单值：`id` 只在编辑时带上，新增交给服务端自增 */
export interface TaskFormValues {
  dueDate?: string;
  id?: number;
  owner?: string;
  priority?: TaskPriority;
  progress?: number;
  remark?: string;
  status?: TaskStatus;
  title?: string;
}

export interface TaskOption<T extends string = TaskStatus> {
  label: string;
  value: T;
}

/** 任务列表（分页 + 关键词/状态/优先级筛选） */
export function getTaskList(params?: Record<string, unknown>) {
  return get<{ list: TaskRecord[]; total: number }>('/demo/task/list', params);
}

/** 任务详情：编辑前拉全量字段，避免用被裁过的行数据回填表单 */
export function getTaskDetail(id: number) {
  return get<TaskRecord>(`/demo/task/${id}`);
}

/** 新增任务 */
export function addTask(data: TaskFormValues) {
  return post<TaskRecord>('/demo/task', data as Record<string, unknown>);
}

/** 编辑任务 */
export function updateTask(id: number, data: TaskFormValues) {
  return put<TaskRecord>(`/demo/task/${id}`, data as Record<string, unknown>);
}

/** 删除任务 */
export function deleteTask(id: number) {
  return del<null>(`/demo/task/${id}`);
}

/** 状态与优先级选项（筛选控件用同一份，不在页面里抄常量） */
export function getTaskOptions() {
  return get<{
    priority: TaskOption<TaskPriority>[];
    status: TaskOption[];
  }>('/demo/task/options');
}
