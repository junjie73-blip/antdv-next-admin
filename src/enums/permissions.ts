/**
 * 按钮权限枚举
 *
 * 与后端 sys_menu (menu_type=3) 的 permission 字段一一对应。
 * 用法：
 *   - actions.ts:  { auth: PERMS.system.user.create }
 *   - 模板:        v-permission="PERMS.approval.flow.approve"
 *   - 判断:        hasPermission(PERMS.tool.file.delete)
 *
 * ⚠️ 修改权限码时，务必同步后端 sys_menu 表。
 */

/* ============================================================
 * 系统设置
 * ============================================================ */

export const SYSTEM_PERMS = {
  /** 用户管理 */
  user: {
    create: 'system:user:create',
    update: 'system:user:update',
    delete: 'system:user:delete',
    deleteBatch: 'system:user:deleteBatch',
    export: 'system:user:export',
    import: 'system:user:import',
    downloadTpl: 'system:user:downloadTpl',
    print: 'system:user:print',
    resetPwd: 'system:user:resetPwd',
    sensitive: 'system:user:sensitive',
  },

  /** 角色管理 */
  role: {
    create: 'system:role:create',
    update: 'system:role:update',
    delete: 'system:role:delete',
    authorize: 'system:role:authorize',
    export: 'system:role:export',
  },

  /** 部门管理 */
  dept: {
    create: 'system:dept:create',
    update: 'system:dept:update',
    delete: 'system:dept:delete',
    assignUser: 'system:dept:assignUser',
  },

  /** 菜单设置 */
  menu: {
    create: 'system:menu:create',
    createPerm: 'system:menu:createPerm',
    update: 'system:menu:update',
    delete: 'system:menu:delete',
  },

  /** 租户管理 */
  tenant: {
    create: 'system:tenant:create',
    update: 'system:tenant:update',
    delete: 'system:tenant:delete',
    deleteBatch: 'system:tenant:deleteBatch',
    detail: 'system:tenant:detail',
  },

  /** IP 白/黑名单 */
  ipRule: {
    create: 'system:ip-rule:create',
    update: 'system:ip-rule:update',
    delete: 'system:ip-rule:delete',
  },

  /** 权限管理 */
  permission: {
    create: 'system:permission:create',
    update: 'system:permission:update',
    delete: 'system:permission:delete',
    detail: 'system:permission:detail',
  },

  /** 系统配置 */
  settings: {
    create: 'system:settings:create',
    update: 'system:settings:update',
    delete: 'system:settings:delete',
    deleteBatch: 'system:settings:deleteBatch',
    detail: 'system:settings:detail',
  },
  userGroup: {
    list: 'user-group:list',
    create: 'user-group:create',
    update: 'user-group:update',
    delete: 'user-group:delete',
    members: 'user-group:manage-member',
    roles: 'user-group:manage-role',
  },
  storage: {
    list: 'system:storage:list',
    manage: 'system:storage:manage',
  },
  fieldMask: {
    list: 'system:field-mask:list',
    manage: 'system:field-mask:manage',
  },
  genTemplate: {
    list: 'tool:gen:template:list',
    manage: 'tool:gen:template:manage',
  },
  archivePolicy: {
    list: 'system:archive-policy:list',
    manage: 'system:archive-policy:manage',
  },
} as const

/* ============================================================
 * 系统监控
 * ============================================================ */

export const MONITOR_PERMS = {
  /** 在线用户 */
  online: {
    detail: 'monitor:online:detail',
    forceLogout: 'monitor:online:forceLogout',
    forceLogoutAll: 'monitor:online:forceLogoutAll',
  },

  /** 定时任务 */
  job: {
    create: 'monitor:job:create',
    update: 'monitor:job:update',
    delete: 'monitor:job:delete',
    run: 'monitor:job:run',
    log: 'monitor:job:log',
    paused: 'monitor:job:paused',
    resume: 'monitor:job:resume',
  },

  /** 缓存监控 */
  cache: {
    delete: 'monitor:cache:delete',
    list: 'system:cache:manage',
    manage: 'system:cache:manage',
  },

  /** 服务监控 */
  server: {
    detail: 'monitor:server:detail',
    export: 'monitor:server:export',
  },

  /** 系统日志 */
  log: {
    detail: 'monitor:log:detail',
    export: 'monitor:log:export',
  },

  /** 登录日志 */
  loginLog: {
    detail: 'monitor:login-log:detail',
    export: 'monitor:login-log:export',
  },
  slowQuery: {
    list: 'monitor:slow-query:list',
    review: 'monitor:slow-query:review',
  },
  logs: {
    list: 'monitor:logs:list',
    query: 'monitor:logs:query',
  },
  queue: {
    list: 'monitor:queue:list',
    manage: 'monitor:queue:manage',
  },
} as const

/* ============================================================
 * 消息中心
 * ============================================================ */

export const MESSAGE_PERMS = {
  /** 通知公告 */
  notice: {
    create: 'message:notice:create',
    update: 'message:notice:update',
    delete: 'message:notice:delete',
    send: 'message:notice:send',
    revoke: 'message:notice:revoke',
    channel: 'message:notice:channel',
  },

  /** 我的消息 */
  my: {
    read: 'message:my:read',
    readAll: 'message:my:readAll',
  },

  /** 代办事项 */
  todo: {
    create: 'message:todo:create',
    update: 'message:todo:update',
    delete: 'message:todo:delete',
    complete: 'message:todo:complete',
    group: 'message:todo:group',
    groupCreate: 'message:todo:groupCreate',
    groupUpdate: 'message:todo:groupUpdate',
    groupDelete: 'message:todo:groupDelete',
  },
  /** 模板管理 */
  template: {
    create: 'message:template:create',
    update: 'message:template:update',
    delete: 'message:template:delete',
    detail: 'message:template:detail',
    test: 'message:template:test',
  },
} as const

/* ============================================================
 * 审批管理
 * ============================================================ */

export const APPROVAL_PERMS = {
  /** 审批流程 */
  flow: {
    create: 'approval:flow:create',
    update: 'approval:flow:update',
    delete: 'approval:flow:delete',
    approve: 'approval:flow:approve',
    reject: 'approval:flow:reject',
    detail: 'approval:flow:detail',
  },

  /** 审批记录 */
  log: {
    detail: 'approval:log:detail',
    export: 'approval:log:export',
  },
} as const

/* ============================================================
 * 系统工具
 * ============================================================ */

export const TOOL_PERMS = {
  /** 数据字典 */
  dict: {
    create: 'tool:dict:create',
    update: 'tool:dict:update',
    delete: 'tool:dict:delete',
    deleteBatch: 'tool:dict:deleteBatch',
    export: 'tool:dict:export',
  },

  /** 代码生成器 */
  code: {
    create: 'tool:code:create',
    update: 'tool:code:update',
    delete: 'tool:code:delete',
    generate: 'tool:code:generate',
    preview: 'tool:code:preview',
    sync: 'tool:code:sync',
  },

  /** 文件管理 */
  file: {
    upload: 'tool:file:upload',
    bigUpload: 'tool:file:bigUpload',
    uploadTask: 'tool:file:uploadTask',
    preview: 'tool:file:preview',
    download: 'tool:file:download',
    delete: 'tool:file:delete',
  },
} as const
export const WORKFLOW_PERMS = {
  center: {
    list: 'workflow:center:todo',
    complete: 'workflow:center:complete',
    batch: 'workflow:center:batch',
    detail: 'workflow:center:detail',
    initiated: 'workflow:center:initiated',
    done: 'workflow:center:done',
  },
  cc: {
    list: 'workflow:cc:list',
    read: 'workflow:cc:read',
  },
  delegate: {
    list: 'workflow:delegate:list',
    create: 'workflow:delegate:create',
    update: 'workflow:delegate:update',
    delete: 'workflow:delegate:delete',
    revoke: 'workflow:delegate:revoke',
  },
  task: {
    addSign: 'workflow:task:add-sign',
    transfer: 'workflow:task:transfer',
    rollback: 'workflow:task:rollback',
  },
  instance: {
    suspend: 'workflow:instance:suspend',
    resume: 'workflow:instance:resume',
    terminate: 'workflow:instance:terminate',
  },
  definition: {
    list: 'workflow:definition:list',
    create: 'workflow:definition:create',
    update: 'workflow:definition:update',
    publish: 'workflow:definition:publish',
    newVersion: 'workflow:definition:new-version',
    delete: 'workflow:definition:delete',
    validate: 'workflow:definition:validate',
    importXml: 'workflow:definition:import-xml',
  },
} as const

export const REPORT_PERMS = {
  list: {
    view: 'report:list:view',
  },
  viewer: {
    execute: 'report:viewer:execute',
    export: 'report:viewer:export',
  },
  dataset: {
    list: 'report:dataset:list',
    create: 'report:dataset:create',
    update: 'report:dataset:update',
    delete: 'report:dataset:delete',
    test: 'report:dataset:test',
  },
  exportTask: {
    list: 'report:export-task:list',
    download: 'report:export-task:download',
    cancel: 'report:export-task:cancel',
  },
} as const
/* ============================================================
 * 汇总
 * ============================================================ */

export const PERMS = {
  system: SYSTEM_PERMS,
  monitor: MONITOR_PERMS,
  message: MESSAGE_PERMS,
  approval: APPROVAL_PERMS,
  tool: TOOL_PERMS,
  workflow: WORKFLOW_PERMS,
  report: REPORT_PERMS,
} as const

/* ============================================================
 * 类型工具
 * ============================================================ */

/** 从嵌套常量对象中递归提取所有叶子字符串值 */
type LeafValues<T> = T extends string ? T : { [K in keyof T]: LeafValues<T[K]> }[keyof T]

/** 所有权限码的联合类型，如 'system:user:create' | 'system:user:update' | ... */
export type PermissionCode = LeafValues<typeof PERMS>

/** 所有权限码的数组，供遍历使用 */
export const ALL_PERMISSION_CODES: PermissionCode[] = (() => {
  const result: string[] = []
  const walk = (obj: Record<string, unknown>) => {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string') {
        result.push(value)
      } else if (value && typeof value === 'object') {
        walk(value as Record<string, unknown>)
      }
    }
  }
  walk(PERMS)
  return result as PermissionCode[]
})()

/** 按模块取权限码 */
export type SystemPerm = LeafValues<typeof SYSTEM_PERMS>
export type MonitorPerm = LeafValues<typeof MONITOR_PERMS>
export type MessagePerm = LeafValues<typeof MESSAGE_PERMS>
export type ApprovalPerm = LeafValues<typeof APPROVAL_PERMS>
export type ToolPerm = LeafValues<typeof TOOL_PERMS>
