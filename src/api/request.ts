import type { Response } from '@/utils/request'
import { get, post } from '@/utils/request'

interface LoginParams {
  username: string
  password: string
}

interface LoginResponse {
  user: {
    id: string
    username: string
    token: string
    role: string
    permissions: string[]
    roles?: string[]
  }
}

interface UserInfoResponse {
  user: {
    id: string
    username: string
    role: string
    permissions: string[]
    roles?: string[]
  }
}

export function login(params: LoginParams): Promise<Response<LoginResponse>> {
  return post('/auth/login', params)
}

export function logout(): Promise<Response<null>> {
  return post('/auth/logout')
}

export function getUserInfo(): Promise<Response<UserInfoResponse>> {
  return get('/auth/user-info')
}
