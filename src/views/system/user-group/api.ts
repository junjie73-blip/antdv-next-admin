import { http } from '~/utils'

/* ============================================================
 * 类型
 * ============================================================ */
export type UserGroupType = 'custom' | 'department' | 'project'

export interface UserGroupRecord {
  groupId: string
  groupCode: string
  groupName: string
  description: string | null
  groupType: UserGroupType
  sortOrder: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface GroupMember {
  userId: string
  username: string
  realName: string | null
  joinedAt: string
}

export interface GroupRole {
  roleId: string
  roleCode: string
  roleName: string
}

export interface UserGroupDetail extends UserGroupRecord {
  members: GroupMember[]
  roles: GroupRole[]
  memberCount: number
  roleCount: number
}

export interface UserGroupListParams {
  pageNum?: number
  pageSize?: number
  keyword?: string
  groupType?: UserGroupType
  status?: string
}

export interface UserGroupCreateParams {
  groupCode: string
  groupName: string
  description?: string
  groupType: UserGroupType
  sortOrder: number
  status: string
}

export type UserGroupUpdateParams = Partial<Omit<UserGroupCreateParams, 'groupCode'>>

/* ============================================================
 * 用户组 CRUD
 * ============================================================ */
export function getUserGroupList(params: UserGroupListParams) {
  return http.Get<{ list: UserGroupRecord[]; total: number }>('/user-group/list', { params })
}

export function getUserGroupOptions() {
  return http.Get<{ label: string; value: string; code: string }[]>('/user-group/options')
}

export function getUserGroupDetail(groupId: string) {
  return http.Get<UserGroupDetail>(`/user-group/${groupId}`)
}

export function createUserGroup(data: UserGroupCreateParams) {
  return http.Post<{ groupId: string }>('/user-group', data)
}

export function updateUserGroup(groupId: string, data: UserGroupUpdateParams) {
  return http.Put(`/user-group/${groupId}`, data)
}

export function deleteUserGroup(groupId: string) {
  return http.Delete(`/user-group/${groupId}`)
}

/* ============================================================
 * 成员管理
 * ============================================================ */
export function addGroupMembers(groupId: string, userIds: string[]) {
  return http.Post<{ added: number }>(`/user-group/${groupId}/members`, { userIds })
}

export function removeGroupMembers(groupId: string, userIds: string[]) {
  return http.Delete<{ removed: number }>(`/user-group/${groupId}/members`, {
    data: { userIds },
  })
}

/* ============================================================
 * 角色绑定
 * ============================================================ */
export function assignGroupRoles(groupId: string, roleIds: string[]) {
  return http.Put<{ added: number; removed: number }>(`/user-group/${groupId}/roles`, { roleIds })
}
