import { request } from '~/composables'

// ============================================================
// 待办事项
// ============================================================

export const getTodoList = (params: any): any => request.get('/todo/list', params)

export const getTodoStats = (): any => request.get('/todo/stats')

export const createTodo = (data: any) => request.post('/todo', data)

export const updateTodo = (id: string, data: any) => request.put(`/todo/${id}`, data)

export const deleteTodo = (id: string) => request.delete(`/todo/${id}`)

export const completeTodo = (id: string) => request.put(`/todo/${id}/complete`)
