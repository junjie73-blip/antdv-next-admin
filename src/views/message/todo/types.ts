/** 待办记录 */
export interface TodoRecord {
  todoId: string;
  title: string;
  content?: string;
  /** 0-普通 1-重要 2-紧急 */
  priority: number;
  /** '0'-未完成 '1'-已完成 */
  status: string;
  dueTime?: string | null;
  createdAt: string;
}

/** 待办统计 */
export interface TodoStats {
  all: number;
  uncompleted: number;
  completed: number;
  overdue: number;
}

/** 过滤类型 */
export type TodoFilterKey = "all" | "uncompleted" | "completed" | "overdue";

/** 过滤器配置项 */
export interface TodoFilterOption {
  key: TodoFilterKey;
  label: string;
  icon: string;
  count: number;
  color: string;
}
