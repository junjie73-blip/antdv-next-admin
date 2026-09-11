import { http } from "@/utils";
import { del, get, post, put } from "./request";
import type { FetchParams } from "@/components/business/Table";

// ======================== 用户管理 ========================

/** 用户列表分页 */
export function getUserList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/user/list", params);
}

/** 用户详情 */
export function getUserDetail(id: string) {
  return get<any>(`/user/detail/${id}`);
}

/** 新增用户 */
export function addUser(data: Record<string, unknown>) {
  return post<any>("/user", data);
}

/** 编辑用户 */
export function updateUser(id: string, data: Record<string, unknown>) {
  return post<any>(`/user/update/${id}`, data);
}

/** 删除用户 */
export function deleteUser(id: string) {
  return del<void>(`/user/remove/${id}`);
}

/** 用户下拉选项 */
export function getUserOptions() {
  return get<any[]>("/dept/tree");
}
// 批量删除用户
export function batchDeleteUser(ids: string[]) {
  return post<void>("/user/batch-delete", { data: { ids } });
}

// ======================== 角色管理 ========================

/** 角色列表 */
export function getRoleList(params?: FetchParams) {
  return get<any[]>("/role/list", params as any);
}

/** 新增角色 */
export function addRole(data: Record<string, unknown>) {
  return post<any>("/role", data);
}

/** 编辑角色 */
export function updateRole(id: string, data: Record<string, unknown>) {
  return put<any>(`/role/${id}`, data);
}

/** 删除角色 */
export function deleteRole(id: string) {
  return del<void>(`/role/${id}`);
}

// ======================== 部门管理 ========================

/** 部门树形结构 */
export function getDeptTree() {
  return get<any[]>("/dept/tree");
}

/** 部门列表（扁平） */
export function getDeptList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/dept/list", params);
}

/** 新增部门 */
export function addDept(data: Record<string, unknown>) {
  return post<any>("/dept", data);
}

/** 编辑部门 */
export function updateDept(id: string, data: Record<string, unknown>) {
  return put<any>(`/dept/${id}`, data);
}

/** 删除部门 */
export function deleteDept(id: string) {
  return del<void>(`/dept/${id}`);
}

// ======================== 登录日志 ========================

/** 登录日志列表（分页） */
export function getLoginLogList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/login-log/list", params);
}

// 导出登录日志
export function exportLoginLog(params?: Record<string, unknown>) {
  return get<any>("/login-log/export", { params });
}

// ======================== 岗位管理 ========================

/** 岗位列表 */
export function getPostList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/system/post/list", params);
}

/** 新增岗位 */
export function addPost(data: Record<string, unknown>) {
  return post<any>("/system/post", data);
}

/** 编辑岗位 */
export function updatePost(id: string, data: Record<string, unknown>) {
  return put<any>(`/system/post/${id}`, data);
}

/** 删除岗位 */
export function deletePost(id: string) {
  return del<void>(`/system/post/${id}`);
}

/** 岗位关联的用户列表 */
export function getPostUsers(postId: string) {
  return get<{ list: any[]; total: number }>(`/system/post/users/${postId}`);
}

// ======================== 文件管理 ========================

/** 文件列表（分页） */
export function getFileList(params?: FetchParams) {
  return get<any>("/file/list", params as any);
}

/** 上传文件 */
export function uploadFile(data: Record<string, unknown>) {
  return post<any>("/upload/file", data);
}

/** 删除文件 */
export function deleteFile(id: string) {
  return del<void>(`/file/${id}`);
}

// ======================== 字典管理 ========================

/** 字典类型列表（分页） */
export function getDictList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/dict-type/list", params);
}

/** 获取某字典类型的字典项 */
export function getDictItems(params?: Record<string, unknown>) {
  return get<any>("/dict-data/list", params);
}

/** 新增字典类型 */
export function addDict(data: Record<string, unknown>) {
  return post<any>("/dict-type", data);
}

/** 编辑字典类型 */
export function updateDict(id: string, data: Record<string, unknown>) {
  return put<any>(`/dict-type/${id}`, data);
}

/** 删除字典类型 */
export function deleteDict(id: string) {
  return del<void>(`/dict-type/${id}`);
}

/** 新增字典项 */
export function addDictItem(data: Record<string, unknown>) {
  return post<any>("/dict-data", data);
}

/** 编辑字典项 */
export function updateDictItem(id: string, data: Record<string, unknown>) {
  return put<any>(`/dict-data/${id}`, data);
}

/** 删除字典项 */
export function deleteDictItem(id: string) {
  return del<void>(`/dict-data/${id}`);
}
// 获取字典树
export function getDictTree(params?: Record<string, unknown>) {
  return get<any[]>("/dict-data/code/tree", params);
}

// ======================== 操作日志 ========================

/** 操作日志列表（分页） */
export function getOperLogList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/audit-log/list", params);
}

/** 导出操作日志 */
export function exportOperLog(params?: Record<string, unknown>) {
  return get<any>("/audit-log/export", { params });
}

// ======================== 在线用户 ========================

/** 在线用户列表（分页） */
export function getOnlineUserList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/system/online/list", params);
}

/** 强制退出（踢出）在线用户 */
export function forceLogout(tokenId: string) {
  return del<void>(`/system/online/${tokenId}`);
}

// ======================== 消息通知 ========================

/** 消息通知列表（分页） */
export function getNoticeList(params?: FetchParams) {
  return get<{ list: any[]; total: number }>("/notice/list", params as any);
}

/** 标记消息已读 */
export function markNoticeRead(id: string) {
  return put<void>(`/notice/${id}/read`);
}

/** 全部标记已读 */
export function markAllNoticeRead() {
  return put<void>("/notice/read-all");
}

/** 删除消息 */
export function deleteNotice(id: string) {
  return del<void>(`/notice/remove/${id}`);
}

/** 新增/编辑消息 */
export function saveNotice(data: Record<string, any>) {
  return post<void>("/notice", data);
}
// 编辑消息
export function updateNotice(id: string, data: Record<string, any>) {
  return post<void>(`/notice/${id}`, data);
}
// 详情
export function getNoticeDetail(id: string) {
  return get<any>(`/notice/detail/${id}`);
}
// 我的通知
export function getMyNoticeList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/notice/my", params);
}
// 发送通知
export function sendNotice(id: string) {
  return post<void>(`/notice/${id}/send`);
}

export function getUserAllOptions() {
  return get<any>("/user/all/options");
}
// 审计日至
export function getAuditLogList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>("/audit-log/list", params);
}

export function exportAuditLog(params?: Record<string, unknown>) {
  return get<any>("/audit-log/export", { params });
}
// 仪表盘
export const getDashboardKpi = () => get<any>("/dashboard/kpi");
export const getActivityTrend = (range: string) =>
  get<any>("/dashboard/activity-trend", { params: { range } });
export const getTrafficDistribution = () => get<any>("/dashboard/traffic-distribution");
export const getSystemHealth = () => get<any>("/dashboard/system-health");
export const getResourceUsage = () => get<any>("/dashboard/resource-usage");
export const getErrorRateTrend = () => get<any>("/dashboard/error-rate");
export const getUserJourney = () => get<any>("/dashboard/user-journey");
export const getModuleRank = () => get<any>("/dashboard/module-rank");
// 系统配置
export const getSettingsList = (params: any) => http.Get("/config/list", { params }).send(true);
export const addSetting = (data: any) => http.Post("/config", data);
export const updateSetting = (id: string, data: any) => http.Put(`/config/${id}`, data);
export const deleteSetting = (id: string) => http.Delete(`/config/${id}`);
export const batchDeleteSetting = (ids: string[]) => http.Post("/config/batch-delete", { ids });
export const getSettingByKey = (key: string) => http.Get(`/config/value/${key}`);
// 租户管理
export const getTenantList = (params: any) => http.Get("/tenant/list", { params }).send(true);
export const createTenant = (data: any) => http.Post("/tenant/save", data);
export const updateTenant = (id: string, data: any) => http.Post(`/tenant/update/${id}`, data);
export const deleteTenant = (id: string) => http.Get(`/tenant/remove/${id}`);
export const batchDeleteTenant = (ids: string[]) => http.Post("/tenant/batch-delete", { ids });
// 权限管理
export const getPermissionList = (params: any) =>
  http.Get("/permission/list", { params }).send(true);
export const getPermissionDetail = (id: string) => http.Get(`/permission/${id}`);
export const createPermission = (data: any) => http.Post("/permission", data);
export const updatePermission = (id: string, data: any) => http.Put(`/permission/${id}`, data);
export const deletePermission = (id: string) => http.Delete(`/permission/${id}`);
// 在线用户
export const getOnlineList = () => http.Get("/online/list");
export const kickOnline = (userId: string) => http.Delete(`/online/${userId}`);
export const kickAllOnline = () => http.Post("/online/kick-all");

// 缓存监控
export const getCacheInfo = (): any => http.Get("/monitor/cache/info").send(true);
export const getCacheKeys = (params: any) => http.Get("/monitor/cache/keys", { params });
export const deleteCacheKey = (key: string) =>
  http.Delete(`/monitor/cache/key/${encodeURIComponent(key)}`);
export const clearCache = () => http.Post("/monitor/cache/clear");

// 待办
export const getTodoList = (params: any): any => http.Get("/todo/list", { params });
export const getTodoStats = (): any => http.Get("/todo/stats");
export const createTodo = (data: any) => http.Post("/todo", data);
export const updateTodo = (id: string, data: any) => http.Put(`/todo/${id}`, data);
export const deleteTodo = (id: string) => http.Delete(`/todo/${id}`);
export const completeTodo = (id: string) => http.Put(`/todo/${id}/complete`);

// 工作台
export const getWorkbenchSummary = (): any => http.Get("/workbench/summary");

// 定时任务
export const getJobList = (params: any) => http.Get("/job/list", { params });
export const createJob = (data: any) => http.Post("/job", data);
export const updateJob = (id: string, data: any) => http.Put(`/job/${id}`, data);
export const deleteJob = (id: string) => http.Delete(`/job/${id}`);
export const toggleJobStatus = (id: string, status: string) =>
  http.Put(`/job/${id}/status`, { status });
export const runJobOnce = (id: string) => http.Post(`/job/${id}/run`);
export const getJobLogList = (params: any) => http.Get("/job/log/list", { params });
export const clearJobLog = (jobId?: string) => http.Delete("/job/log/clear", { params: { jobId } });

// 服务监控
export const getServerInfo = () => http.Get("/monitor/server/info");

// IP 规则
export const getIpRuleList = (params: any) => http.Get("/ip-rule/list", { params });
export const createIpRule = (data: any) => http.Post("/ip-rule", data);
export const updateIpRule = (id: string, data: any) => http.Put(`/ip-rule/${id}`, data);
export const deleteIpRule = (id: string) => http.Delete(`/ip-rule/${id}`);
export const checkIpRule = (ip: string) => http.Post("/ip-rule/check", { ip });
