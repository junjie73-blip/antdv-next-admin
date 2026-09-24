import { http } from '~/utils'

// ============================================================
// 待办事项
// ============================================================

export const getTodoList = (params: any): any => http.Get('/todo/list', { params }).send(true)

export const getTodoStats = (): any => http.Get('/todo/stats').send(true)

export const createTodo = (data: any) => http.Post('/todo', data)

export const updateTodo = (id: string, data: any) => http.Put(`/todo/${id}`, data)

export const deleteTodo = (id: string) => http.Delete(`/todo/${id}`)

export const completeTodo = (id: string) => http.Put(`/todo/${id}/complete`)
