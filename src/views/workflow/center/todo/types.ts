import type { TodoItem } from '~/api/workflow'

export type { TodoItem }

export interface TodoActionContext {
  onApprove: (item: TodoItem) => void
  onReject: (item: TodoItem) => void
  onDetail: (item: TodoItem) => void
}
