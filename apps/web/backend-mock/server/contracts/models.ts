/**
 * 业务模型定义（DTO / VO / 枚举）—— 单一真源
 *
 * 每个 schema 同时服务于三处：handler 入参校验、TypeScript 类型推导、OpenAPI 组件生成。
 * 字段注释会原样进入接口文档，前端可直接据此生成类型，不需要再手工比对 mock 返回值。
 *
 * 命名约定（与真实后端一致）：
 * - XxxDto：请求体 / 查询条件
 * - XxxVo：响应体中的业务对象
 * - XxxQuery：查询参数
 */

import { z } from 'zod';

import { optionalString, positiveInt, requiredString, statusFlagSchema } from './validation';

/* ------------------------------------------------------------------ */
/* 通用信封与分页                                                        */
/* ------------------------------------------------------------------ */

/** 与后端 R<T> 对齐的统一响应信封：只有 code / data / message 三个字段 */
export interface ApiEnvelopeShape<T> {
  code: number;
  data: T;
  message: string;
}

/** 统一分页返回结构：真实后端同样使用 list + total */
export interface PageResultVo<T> {
  /** 当前页数据 */
  list: T[];
  /** 符合筛选条件的总条数（不是当前页条数） */
  total: number;
}

export function pageResultOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    list: z.array(item).describe('当前页数据'),
    total: z.number().int().nonnegative().describe('总条数'),
  });
}

/* ------------------------------------------------------------------ */
/* 认证域                                                              */
/* ------------------------------------------------------------------ */

export const loginRequestSchema = z.object({
  /** 用户名 */
  username: requiredString('用户名', 64),
  /** 密码（mock 为明文账号表，真实后端由调用方自行加密传输） */
  password: requiredString('密码', 128),
  /** 是否记住登录态 */
  rememberMe: z.boolean().optional(),
});
export type LoginRequestDto = z.infer<typeof loginRequestSchema>;

export const loginUserVoSchema = z.object({
  id: z.string().describe('用户 id'),
  username: z.string().describe('登录账号'),
  nickname: z.string().describe('昵称'),
  avatar: z.string().describe('头像地址'),
  email: z.string().describe('邮箱'),
  phone: z.string().describe('手机号'),
  permissions: z.array(z.string()).describe('按钮级权限码，* 表示全通'),
  roles: z.array(z.string()).describe('角色标识'),
  token: z.string().describe('访问令牌'),
});
export type LoginUserVo = z.infer<typeof loginUserVoSchema>;

export const loginResultVoSchema = z.object({
  user: loginUserVoSchema,
});
export type LoginResultVo = z.infer<typeof loginResultVoSchema>;

/* ------------------------------------------------------------------ */
/* 系统管理域                                                           */
/* ------------------------------------------------------------------ */

/** 用户状态：1 启用 / 0 停用 */
export const userStatusSchema = statusFlagSchema;

export const userVoSchema = z
  .object({
    id: positiveInt('用户 id'),
    username: z.string().describe('登录账号'),
    nickname: z.string().describe('用户昵称'),
    email: z.string().describe('邮箱'),
    phone: z.string().describe('手机号'),
    gender: z.number().int().describe('性别：0 女 / 1 男'),
    avatar: z.string().describe('头像地址'),
    status: z.union([z.literal(0), z.literal(1)]).describe('状态：0 停用 / 1 启用'),
    deptId: z.number().int().describe('部门 id'),
    deptName: z.string().describe('部门名称'),
    roles: z.array(z.string()).describe('角色名称列表'),
    remark: z.string().describe('备注'),
    createdAt: z.string().describe('创建时间 ISO-8601'),
    updatedAt: z.string().describe('更新时间 ISO-8601'),
  })
  .passthrough();
export type UserVo = z.infer<typeof userVoSchema>;

export const userSaveRequestSchema = z.object({
  id: positiveInt('用户 id').optional(),
  username: requiredString('用户名', 64),
  nickname: requiredString('用户昵称', 64),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^[\d\-+() ]{5,20}$/, '手机号格式不正确')
    .optional()
    .or(z.literal('')),
  gender: z.union([z.literal(0), z.literal(1)]).optional(),
  status: z.union([z.literal(0), z.literal(1)]).optional(),
  deptId: z.number().int().positive('部门 id 必须大于 0').optional(),
  /** 角色 id（前端下拉传值，服务端据此解析角色名称） */
  roleId: z.number().int().positive('角色 id 必须大于 0').optional(),
  roles: z.array(z.string()).optional(),
  remark: optionalString('备注', 500),
});
export type UserSaveRequestDto = z.infer<typeof userSaveRequestSchema>;

export const userQuerySchema = z.object({
  /** 关键字：匹配用户名 / 昵称 / 邮箱 / 手机号 */
  keyword: optionalString('关键字', 64),
  /** 状态筛选 */
  status: statusFlagSchema.optional(),
  /** 部门筛选 */
  deptId: positiveInt('部门 id').optional(),
});
export type UserQueryDto = z.infer<typeof userQuerySchema>;

/* ------------------------------------------------------------------ */
/* 示例业务域：任务                                                      */
/* ------------------------------------------------------------------ */

export const taskStatusSchema = z.enum(['pending', 'running', 'done', 'blocked']);
export const taskPrioritySchema = z.enum(['low', 'middle', 'high']);

export const taskVoSchema = z.object({
  id: positiveInt('任务 id'),
  title: z.string().describe('任务标题'),
  status: taskStatusSchema.describe('任务状态'),
  priority: taskPrioritySchema.describe('优先级'),
  owner: z.string().describe('负责人'),
  progress: z.number().int().min(0).max(100).describe('进度百分比'),
  dueDate: z.string().describe('截止日期'),
  remark: z.string().describe('备注'),
  createdAt: z.string().describe('创建时间'),
  updatedAt: z.string().describe('更新时间'),
});
export type TaskVo = z.infer<typeof taskVoSchema>;

export const taskSaveRequestSchema = z.object({
  title: requiredString('任务标题', 100),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  owner: optionalString('负责人', 64),
  progress: z.number().int().min(0, '进度不能小于 0').max(100, '进度不能超过 100').optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '截止日期格式应为 YYYY-MM-DD')
    .optional(),
  remark: optionalString('备注', 500),
});
export type TaskSaveRequestDto = z.infer<typeof taskSaveRequestSchema>;

/* ------------------------------------------------------------------ */
/* 审批域                                                              */
/* ------------------------------------------------------------------ */

export const approvalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const approvalVoSchema = z.object({
  id: positiveInt('审批单 id'),
  code: z.string().describe('审批单编号'),
  title: z.string().describe('标题'),
  type: z.string().describe('审批类型'),
  applicant: z.string().describe('发起人'),
  approver: z.string().describe('当前审批人'),
  amount: z.string().describe('金额或天数展示串'),
  reason: z.string().describe('申请事由'),
  status: approvalStatusSchema.describe('审批状态'),
  date: z.string().describe('提交时间'),
  updatedAt: z.string().describe('更新时间'),
});
export type ApprovalVo = z.infer<typeof approvalVoSchema>;

/* ------------------------------------------------------------------ */
/* 审计 / 操作日志                                                       */
/* ------------------------------------------------------------------ */

/** 操作日志：真实后端写入 tb_operation_log 的标准字段集合 */
export const operationLogSchema = z.object({
  /** 操作人账号 */
  actor: z.string().describe('操作人账号'),
  /** 操作动作，形如 `POST /system/user` */
  action: z.string().describe('操作动作'),
  /** 业务模块，取路由前两段 */
  module: z.string().describe('业务模块'),
  /** 业务对象类型 */
  bizType: z.string().describe('业务对象类型'),
  /** 业务对象 id */
  bizId: z.string().optional().describe('业务对象 id'),
  /** 请求方法 */
  method: z.string().describe('HTTP 方法'),
  /** 请求路径 */
  path: z.string().describe('请求路径'),
  /** 客户端 IP（优先取代理头） */
  ip: z.string().describe('客户端 IP'),
  /** 请求参数脱敏后的 JSON 串 */
  detail: z.string().describe('请求参数（已脱敏）'),
  /** 结果 */
  result: z.enum(['success', 'error', 'denied']).describe('操作结果'),
  /** 风险等级 */
  risk: z.enum(['low', 'medium', 'high', 'critical']).describe('风险等级'),
  /** 链路追踪号，与响应头 x-request-id 一致 */
  traceId: z.string().describe('链路追踪号'),
  /** 耗时毫秒 */
  durationMs: z.number().int().nonnegative().describe('耗时毫秒'),
  /** 开始时间 ISO-8601 */
  startTime: z.string().describe('开始时间'),
  /** 结束时间 ISO-8601 */
  endTime: z.string().describe('结束时间'),
  /** 错误信息（失败时非空） */
  errorMessage: z.string().optional().describe('错误信息'),
});
export type OperationLog = z.infer<typeof operationLogSchema>;

/** 审计台账对外返回结构（字段与安全中心保持一致） */
export const auditRecordVoSchema = z.object({
  id: z.string().describe('审计记录 id'),
  action: z.string().describe('操作动作'),
  actor: z.string().describe('操作人'),
  detail: z.string().describe('请求明细（已脱敏）'),
  ip: z.string().describe('来源 IP'),
  method: z.string().describe('HTTP 方法'),
  path: z.string().describe('请求路径'),
  result: z.enum(['success', 'error', 'denied']).describe('结果'),
  risk: z.enum(['low', 'medium', 'high', 'critical']).describe('风险等级'),
  traceId: z.string().describe('链路追踪号'),
  createdAt: z.string().describe('发生时间'),
});
export type AuditRecordVo = z.infer<typeof auditRecordVoSchema>;
