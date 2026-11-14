import type {
  WorkflowActionName,
  WorkflowInstance,
  WorkflowTask,
} from '../core/types';

/**
 * 状态文案的兜底映射。
 *
 * 只做兜底，不做 i18n：组件一律接受 `labelOf` / `*Label` prop 覆盖，
 * 因为"待办/待阅"这类词在不同业务里叫法不同，而子包不许 import 宿主的 `~/locales`
 * （会造成 turbo 建不出的依赖环）。宿主接自己的词条时传函数进来即可。
 */

export const TASK_STATUS_LABELS: Record<WorkflowTask['status'], string> = {
  canceled: '已作废',
  done: '已办理',
  pending: '待办理',
  queued: '未轮到',
  skipped: '已跳过',
  transferred: '已转办',
};

export const INSTANCE_STATUS_LABELS: Record<
  WorkflowInstance['status'],
  string
> = {
  canceled: '已撤回',
  completed: '已通过',
  failed: '异常终止',
  rejected: '已驳回',
  running: '进行中',
  suspended: '已挂起',
};

export const ACTION_LABELS: Record<WorkflowActionName, string> = {
  addSign: '加签',
  approve: '同意',
  reject: '驳回',
  skip: '跳过',
  transfer: '转办',
  withdraw: '撤回',
};

/** 状态到 Badge variant 的映射：只有 shadcn-ui 的四档，不自定义配色 */
export const TASK_STATUS_VARIANTS: Record<
  WorkflowTask['status'],
  'default' | 'destructive' | 'outline' | 'secondary'
> = {
  canceled: 'outline',
  done: 'default',
  pending: 'secondary',
  queued: 'outline',
  skipped: 'outline',
  transferred: 'secondary',
};
