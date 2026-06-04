import { del, get, post, put } from './request'

// ======================== 用户管理 ========================

/** 用户列表分页 */
export function getUserList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/user/list', params)
}

/** 用户详情 */
export function getUserDetail(id: number) {
  return get<any>(`/system/user/${id}`)
}

/** 新增用户 */
export function addUser(data: Record<string, unknown>) {
  return post<any>('/system/user', data)
}

/** 编辑用户 */
export function updateUser(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/user/${id}`, data)
}

/** 删除用户 */
export function deleteUser(id: number) {
  return del<void>(`/system/user/${id}`)
}

/** 用户下拉选项 */
export function getUserOptions() {
  return get<any[]>('/system/user/options')
}

// ======================== 角色管理 ========================

/** 角色列表 */
export function getRoleList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/role/list', params)
}

/** 新增角色 */
export function addRole(data: Record<string, unknown>) {
  return post<any>('/system/role', data)
}

/** 编辑角色 */
export function updateRole(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/role/${id}`, data)
}

/** 删除角色 */
export function deleteRole(id: number) {
  return del<void>(`/system/role/${id}`)
}

/** 角色关联的用户选项 */
export function getRoleUserOptions() {
  return get<any[]>('/system/user/options')
}

// ======================== 部门管理 ========================

/** 部门树形结构 */
export function getDeptTree() {
  return get<any[]>('/system/dept/tree')
}

/** 部门列表（扁平） */
export function getDeptList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/dept/list', params)
}

/** 新增部门 */
export function addDept(data: Record<string, unknown>) {
  return post<any>('/system/dept', data)
}

/** 编辑部门 */
export function updateDept(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/dept/${id}`, data)
}

/** 删除部门 */
export function deleteDept(id: number) {
  return del<void>(`/system/dept/${id}`)
}

// ======================== 登录日志 ========================

/** 登录日志列表（分页） */
export function getLoginLogList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/login-log/list', params)
}

/** 登录日志统计 */
export function getLoginLogStats() {
  return get<{
    todayCount: number
    weekCount: number
    monthCount: number
    todayFailCount: number
  }>('/system/login-log/stats')
}

// ======================== 岗位管理 ========================

/** 岗位列表 */
export function getPostList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/post/list', params)
}

/** 新增岗位 */
export function addPost(data: Record<string, unknown>) {
  return post<any>('/system/post', data)
}

/** 编辑岗位 */
export function updatePost(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/post/${id}`, data)
}

/** 删除岗位 */
export function deletePost(id: number) {
  return del<void>(`/system/post/${id}`)
}

/** 岗位关联的用户列表 */
export function getPostUsers(postId: number) {
  return get<{ list: any[], total: number }>(`/system/post/users/${postId}`)
}

// ======================== 文件管理 ========================

/** 文件列表（分页） */
export function getFileList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/file/list', params)
}

/** 文件夹树形结构 */
export function getFileTree() {
  return get<any[]>('/system/file/tree')
}

/** 上传文件 */
export function uploadFile(data: Record<string, unknown>) {
  return post<any>('/system/file/upload', data)
}

/** 删除文件 */
export function deleteFile(id: number) {
  return del<void>(`/system/file/${id}`)
}

/** 新建文件夹 */
export function createFolder(data: Record<string, unknown>, parentId?: number) {
  return post<any>('/system/file/folder', data, parentId ? { parentId } : undefined)
}

/** 重命名文件 */
export function renameFile(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/file/${id}`, data)
}

// ======================== 系统配置 ========================

/** 配置列表分页 */
export function getSettingsList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/settings/list', params)
}

/** 新增配置 */
export function addSetting(data: Record<string, unknown>) {
  return post<any>('/system/settings', data)
}

/** 编辑配置 */
export function updateSetting(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/settings/${id}`, data)
}

/** 删除配置 */
export function deleteSetting(id: number) {
  return del<void>(`/system/settings/${id}`)
}

// ======================== 字典管理 ========================

/** 字典类型列表（分页） */
export function getDictList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/dict/list', params)
}

/** 获取某字典类型的字典项 */
export function getDictItems(typeId: number) {
  return get<any[]>(`/system/dict/items/${typeId}`)
}

/** 新增字典类型 */
export function addDict(data: Record<string, unknown>) {
  return post<any>('/system/dict', data)
}

/** 编辑字典类型 */
export function updateDict(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/dict/${id}`, data)
}

/** 删除字典类型 */
export function deleteDict(id: number) {
  return del<void>(`/system/dict/${id}`)
}

/** 新增字典项 */
export function addDictItem(data: Record<string, unknown>) {
  return post<any>('/system/dict/item', data)
}

/** 编辑字典项 */
export function updateDictItem(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/dict/item/${id}`, data)
}

/** 删除字典项 */
export function deleteDictItem(id: number) {
  return del<void>(`/system/dict/item/${id}`)
}

// ======================== 操作日志 ========================

/** 操作日志列表（分页） */
export function getOperLogList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/log/list', params)
}

/** 删除操作日志 */
export function deleteOperLog(id: number) {
  return del<void>(`/system/log/${id}`)
}

// ======================== 在线用户 ========================

/** 在线用户列表（分页） */
export function getOnlineUserList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/online/list', params)
}

/** 强制退出（踢出）在线用户 */
export function forceLogout(tokenId: string) {
  return del<void>(`/system/online/${tokenId}`)
}

// ======================== 消息通知 ========================

/** 消息通知列表（分页） */
export function getNoticeList(params?: Record<string, unknown>) {
  return get<{ list: any[], total: number }>('/system/notice/list', params)
}

/** 标记消息已读 */
export function markNoticeRead(id: number) {
  return put<void>(`/system/notice/read/${id}`)
}

/** 全部标记已读 */
export function markAllNoticeRead() {
  return put<void>('/system/notice/read-all')
}

/** 删除消息 */
export function deleteNotice(id: number) {
  return del<void>(`/system/notice/${id}`)
}
