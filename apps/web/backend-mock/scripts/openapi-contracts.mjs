/**
 * OpenAPI 契约注册表（文档侧真值源）
 *
 * server/contracts/models.ts 是代码侧 DTO 真值源，本文件把同一批模型写成标准
 * JSON Schema 供 OpenAPI 使用。test/openapi-contract.test.ts 会对两边的关键字段做对账，
 * 避免文档与实现悄悄漂移。
 */

export const INFO = {
  title: 'Backend Mock API',
  version: '1.0.0',
  description:
    '企业级前端联调服务：统一 R<T> 信封、集中状态码、zod 参数校验、服务端权限标识与审计操作日志。接口路径与真实后端保持一一对应，可无缝替换 baseURL 完成联调。',
};

export const TAG_META = {
  auth: '认证与会话',
  system: '系统管理',
  demo: '示例业务',
  security: '安全中心',
  ai: 'AI 配置',
  approval: '审批流',
  dashboard: '数据看板',
  enterprise: '企业能力',
  'mock-center': 'Mock 控制面',
  upload: '文件上传',
  table: '表格示例',
  screen: '大屏示例',
  menus: '菜单',
};

/** 与 server/contracts/codes.ts 的 CODE_CATALOG 对齐（测试会校验） */
export const CODES = [
  [200, 'ok', '成功', true],
  [400, '请求参数错误', '客户端错误', false],
  [401, '未登录或登录已过期', '客户端错误', false],
  [403, '没有操作权限', '客户端错误', false],
  [404, '请求的资源不存在', '客户端错误', false],
  [405, '请求方法不被允许', '客户端错误', false],
  [409, '资源状态冲突', '客户端错误', false],
  [422, '请求语义错误', '客户端错误', false],
  [429, '请求过于频繁', '客户端错误', false],
  [500, '服务器内部错误', '服务端错误', false],
  [503, '服务暂不可用', '服务端错误', false],
];

/** 与 server/contracts/permissions.ts 的 PermissionCode 对齐（测试会校验） */
export const PERMISSIONS = [
  ['system:user:list', '查看用户列表'],
  ['system:user:query', '查询用户详情'],
  ['system:user:add', '新增用户'],
  ['system:user:edit', '编辑用户'],
  ['system:user:remove', '删除用户'],
  ['system:role:list', '查看角色列表'],
  ['system:role:add', '新增角色'],
  ['system:role:remove', '删除角色'],
  ['demo:task:list', '查看任务列表'],
  ['demo:task:add', '新增任务'],
  ['demo:task:edit', '编辑任务'],
  ['demo:task:remove', '删除任务'],
  ['security:audit:list', '查看审计台账'],
  ['approval:mine:list', '查看我的审批'],
  ['approval:mine:save', '发起审批'],
  ['approval:mine:action', '审批操作'],
];

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

/** 标准信封：真实后端 R<T>，固定三字段 */
export const SCHEMAS = {
  ApiEnvelope: {
    type: 'object',
    required: ['code', 'data', 'message'],
    properties: {
      code: { type: 'integer', description: '业务码，200 表示成功', example: 200 },
      data: { description: '业务数据；失败时恒为 null' },
      message: { type: 'string', description: '面向调用方的描述', example: 'ok' },
    },
  },
  ErrorEnvelope: {
    type: 'object',
    required: ['code', 'data', 'message'],
    properties: {
      code: { type: 'integer', enum: [400, 401, 403, 404, 405, 409, 422, 429, 500, 503] },
      data: { nullable: true, example: null },
      message: { type: 'string', example: '参数校验失败：query.pageNum 必须大于 0' },
    },
  },
  PageQuery: {
    type: 'object',
    properties: {
      pageNum: { type: 'integer', minimum: 1, default: 1, description: '页码，从 1 开始' },
      page: { type: 'integer', minimum: 1, description: 'pageNum 的兼容别名' },
      pageSize: { type: 'integer', minimum: 1, maximum: 200, default: 10, description: '每页条数' },
    },
  },
  LoginRequestDto: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string', minLength: 1, maxLength: 64, example: 'admin' },
      password: { type: 'string', minLength: 1, maxLength: 128, example: 'admin123' },
      rememberMe: { type: 'boolean', example: true },
    },
  },
  LoginUserVo: {
    type: 'object',
    properties: {
      id: { type: 'string', example: '1' },
      username: { type: 'string', example: 'admin' },
      nickname: { type: 'string', example: '管理员' },
      avatar: { type: 'string', format: 'uri' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      permissions: { type: 'array', items: { type: 'string' }, example: ['*'] },
      roles: { type: 'array', items: { type: 'string' }, example: ['admin'] },
      token: { type: 'string', example: 'mock_token_admin_1730000000000' },
    },
  },
  LoginResultVo: {
    type: 'object',
    properties: { user: ref('LoginUserVo') },
  },
  UserVo: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      username: { type: 'string', example: 'admin' },
      nickname: { type: 'string', example: '超级管理员' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', example: '13800000001' },
      gender: { type: 'integer', enum: [0, 1], description: '0 女 / 1 男' },
      avatar: { type: 'string', format: 'uri' },
      status: { type: 'integer', enum: [0, 1], description: '0 停用 / 1 启用' },
      deptId: { type: 'integer' },
      deptName: { type: 'string', example: '总公司' },
      roles: { type: 'array', items: { type: 'string' } },
      remark: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  UserSaveRequestDto: {
    type: 'object',
    required: ['username', 'nickname'],
    properties: {
      username: { type: 'string', minLength: 1, maxLength: 64 },
      nickname: { type: 'string', minLength: 1, maxLength: 64 },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', pattern: '^[\\d\\-+() ]{5,20}$' },
      gender: { type: 'integer', enum: [0, 1] },
      status: { type: 'integer', enum: [0, 1] },
      deptId: { type: 'integer', minimum: 1 },
      roleId: { type: 'integer', minimum: 1 },
      remark: { type: 'string', maxLength: 500 },
    },
  },
  TaskVo: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'running', 'done', 'blocked'] },
      priority: { type: 'string', enum: ['low', 'middle', 'high'] },
      owner: { type: 'string' },
      progress: { type: 'integer', minimum: 0, maximum: 100 },
      dueDate: { type: 'string', format: 'date' },
      remark: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  TaskSaveRequestDto: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 100 },
      status: { type: 'string', enum: ['pending', 'running', 'done', 'blocked'] },
      priority: { type: 'string', enum: ['low', 'middle', 'high'] },
      owner: { type: 'string', maxLength: 64 },
      progress: { type: 'integer', minimum: 0, maximum: 100 },
      dueDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      remark: { type: 'string', maxLength: 500 },
    },
  },
  ApprovalVo: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      code: { type: 'string' },
      title: { type: 'string' },
      type: { type: 'string' },
      applicant: { type: 'string' },
      approver: { type: 'string' },
      amount: { type: 'string' },
      reason: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled'] },
      date: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  AuditRecordVo: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      action: { type: 'string', example: 'POST /system/user' },
      actor: { type: 'string', example: 'admin' },
      detail: { type: 'string', description: '脱敏后的请求明细 + 标准操作日志字段' },
      ip: { type: 'string' },
      method: { type: 'string' },
      path: { type: 'string' },
      result: { type: 'string', enum: ['success', 'error', 'denied'] },
      risk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      traceId: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  OperationLog: {
    type: 'object',
    description: '真实后端 tb_operation_log 的标准字段集合',
    properties: {
      actor: { type: 'string' },
      action: { type: 'string' },
      module: { type: 'string' },
      bizType: { type: 'string' },
      bizId: { type: 'string' },
      method: { type: 'string' },
      path: { type: 'string' },
      ip: { type: 'string' },
      detail: { type: 'string' },
      result: { type: 'string', enum: ['success', 'error', 'denied'] },
      risk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      traceId: { type: 'string' },
      durationMs: { type: 'integer', minimum: 0 },
      startTime: { type: 'string', format: 'date-time' },
      endTime: { type: 'string', format: 'date-time' },
      errorMessage: { type: 'string' },
    },
  },
  PagedUserVo: {
    type: 'object',
    required: ['list', 'total'],
    properties: {
      list: { type: 'array', items: ref('UserVo') },
      total: { type: 'integer', minimum: 0 },
    },
  },
  PagedTaskVo: {
    type: 'object',
    required: ['list', 'total'],
    properties: {
      list: { type: 'array', items: ref('TaskVo') },
      total: { type: 'integer', minimum: 0 },
    },
  },
  PagedApprovalVo: {
    type: 'object',
    required: ['list', 'total'],
    properties: {
      list: { type: 'array', items: ref('ApprovalVo') },
      total: { type: 'integer', minimum: 0 },
    },
  },
  PagedAuditRecordVo: {
    type: 'object',
    required: ['list', 'total'],
    properties: {
      list: { type: 'array', items: ref('AuditRecordVo') },
      total: { type: 'integer', minimum: 0 },
    },
  },
};

/** 按 `METHOD /path` 精确增强；未命中的路由仍会生成通用操作（保证全量覆盖） */
export const ENDPOINTS = {
  'POST /auth/login': {
    requestBody: ref('LoginRequestDto'),
    response: ref('LoginResultVo'),
    requestExample: { username: 'admin', password: 'admin123', rememberMe: true },
    responseExample: {
      code: 200,
      data: { user: { id: '1', username: 'admin', token: 'mock_token_admin_1730000000000' } },
      message: '登录成功',
    },
  },
  'GET /system/user/list': {
    query: [
      ['pageNum', 'integer', '页码，从 1 开始'],
      ['page', 'integer', 'pageNum 的兼容别名'],
      ['pageSize', 'integer', '每页条数，上限 200'],
      ['keyword', 'string', '用户名 / 昵称 / 邮箱 / 手机号模糊匹配'],
      ['status', 'integer', '状态：0 停用 / 1 启用'],
      ['deptId', 'integer', '部门 id'],
    ],
    response: ref('PagedUserVo'),
    responseExample: {
      code: 200,
      data: { list: [{ id: 1, username: 'admin', status: 1 }], total: 50 },
      message: '获取用户列表成功',
    },
  },
  'POST /system/user': {
    requestBody: ref('UserSaveRequestDto'),
    response: ref('UserVo'),
    requestExample: {
      username: 'zhangsan',
      nickname: '张三',
      email: 'zhangsan@example.com',
      deptId: 2,
      roleId: 3,
      status: 1,
    },
  },
  'POST /demo/task': {
    requestBody: ref('TaskSaveRequestDto'),
    response: ref('TaskVo'),
    requestExample: { title: '补齐表格列宽', owner: '张三', priority: 'high', progress: 0 },
  },
  'GET /security/audit/list': {
    query: [
      ['pageNum', 'integer', '页码'],
      ['pageSize', 'integer', '每页条数'],
    ],
    response: ref('PagedAuditRecordVo'),
  },
};
