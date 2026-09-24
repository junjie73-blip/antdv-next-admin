import { del, get, post, put } from '~/api/request'

import type { ChannelType } from './notice-channel'

export interface TodoGroup {
  groupId: string
  name: string
  color?: string
  sortOrder: number
}

export function getTodoGroups() {
  return get<TodoGroup[]>('/todo-group/list')
}
export function getTodoGroup(id: string) {
  return get<TodoGroup>(`/todo-group/${id}`)
}
export function createTodoGroup(data: Omit<TodoGroup, 'groupId'>) {
  return post<void>('/todo-group', data)
}
export function updateTodoGroup(id: string, data: Partial<TodoGroup>) {
  return put<void>(`/todo-group/${id}`, data)
}
export function deleteTodoGroup(id: string) {
  return del<void>(`/todo-group/${id}`)
}
