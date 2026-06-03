import { get, post } from '@/api/request'

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

export function login(params: LoginParams): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login', params as unknown as Record<string, unknown>)
}

export function logout(): Promise<null> {
  return post<null>('/auth/logout')
}

export function getUserInfo(): Promise<UserInfoResponse> {
  return get<UserInfoResponse>('/auth/user-info')
}
