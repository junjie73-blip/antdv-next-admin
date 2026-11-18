import { builtin } from '../builtin-data';
import { defineCollection, defineKVMap } from './sqlite';

/**
 * 系统管理补集演示数据：服务监控快照 / 客户端日志 / 验证码日志 / 系统配置 / 详情分组。
 *
 * 数据全部来自确定性内置表与固定日期表，不含随机数生成器，
 * 监控面板可被单测断言，日志可被筛选函数稳定分页。
 */

export type Tone = 'error' | 'info' | 'success' | 'warning';

export interface MonitorMetric {
  detail: string;
  key: string;
  label: string;
  tone: Tone;
  unit: string;
  value: number;
}

export interface MonitorProcess {
  cpu: number;
  id: string;
  memory: number;
  name: string;
  threads: number;
  uptime: string;
  version: string;
}

export interface MonitorSnapshot {
  database: {
    activeConnections: number;
    name: string;
    qps: number;
    replicas: number;
    slowQueries: number;
  };
  healthScore: number;
  hostname: string;
  processes: MonitorProcess[];
  rabbitmq: {
    consumers: number;
    name: string;
    ready: number;
    unacked: number;
    vhost: string;
  };
  redis: {
    hitRate: number;
    keys: number;
    memory: string;
    name: string;
    ops: number;
  };
  region: string;
  resources: MonitorMetric[];
  updatedAt: string;
}

export const MONITOR_SNAPSHOT: MonitorSnapshot = {
  healthScore: 92,
  hostname: 'app-node-01',
  region: '华东 1 区',
  updatedAt: '2026-11-10 09:20:00',
  resources: [
    {
      key: 'cpu',
      label: 'CPU 使用率',
      value: 38.6,
      unit: '%',
      tone: 'success',
      detail: '8 核 · 负载 3.09',
    },
    {
      key: 'memory',
      label: '内存使用率',
      value: 64.2,
      unit: '%',
      tone: 'warning',
      detail: '20.5 GB / 32 GB',
    },
    {
      key: 'disk',
      label: '磁盘使用率',
      value: 72.4,
      unit: '%',
      tone: 'error',
      detail: '724 GB / 1 TB',
    },
    {
      key: 'network',
      label: '网络吞吐',
      value: 46.8,
      unit: 'MB/s',
      tone: 'info',
      detail: '入 28.1 · 出 18.7',
    },
  ],
  processes: [
    {
      id: 'P-1001',
      name: 'web-gateway',
      version: '2.8.1',
      uptime: '18 天 4 小时',
      cpu: 12.4,
      memory: 1024,
      threads: 48,
    },
    {
      id: 'P-1002',
      name: 'auth-service',
      version: '1.9.6',
      uptime: '18 天 4 小时',
      cpu: 8.2,
      memory: 768,
      threads: 32,
    },
    {
      id: 'P-1003',
      name: 'workflow-engine',
      version: '3.2.0',
      uptime: '6 天 12 小时',
      cpu: 24.6,
      memory: 2048,
      threads: 64,
    },
    {
      id: 'P-1004',
      name: 'report-worker',
      version: '1.4.3',
      uptime: '6 天 12 小时',
      cpu: 16.8,
      memory: 1536,
      threads: 24,
    },
  ],
  database: {
    name: 'primary-mysql',
    replicas: 2,
    activeConnections: 86,
    qps: 1420,
    slowQueries: 3,
  },
  redis: {
    name: 'cache-redis',
    hitRate: 98.6,
    keys: 24_860,
    memory: '1.8 GB',
    ops: 9420,
  },
  rabbitmq: {
    name: 'event-bus',
    vhost: '/prod',
    ready: 12,
    unacked: 3,
    consumers: 8,
  },
};

export function healthOf(score: number): { label: string; tone: Tone } {
  if (score >= 90) return { label: '运行正常', tone: 'success' };
  if (score >= 70) return { label: '需要关注', tone: 'warning' };
  return { label: '存在风险', tone: 'error' };
}

/* --------------------------------- 日志 --------------------------------- */

/** 确定性内置序列：每次调用从常量表头重置，保证生成函数可重复调用 */
function deterministicSequence(): () => number {
  return builtin.sequence();
}

const CITIES = [
  '北京市海淀区',
  '上海市浦东新区',
  '杭州市西湖区',
  '深圳市南山区',
  '成都市武侯区',
  '广州市天河区',
  '武汉市洪山区',
  '南京市鼓楼区',
];
const USERS = [
  'admin',
  'zhangsan',
  'lisi',
  'wangwu',
  'zhaoliu',
  'sunqi',
  'zhouba',
  'wujiu',
];
function pick<T>(items: T[], random: () => number): T {
  const value = items[Math.floor(random() * items.length)] ?? items[0];
  if (value === undefined) throw new Error('pick() 需要非空数组');
  return value;
}

function timeAt(index: number): string {
  const minutes = index * 17;
  const hours = 8 + Math.floor(minutes / 60);
  const minute = minutes % 60;
  const day = 10 - Math.floor(hours / 24);
  const hour = hours % 24;
  return `2026-11-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

export interface ClientLogRecord {
  id: number;
  level: 'debug' | 'error' | 'info' | 'warn';
  message: string;
  page: string;
  source: string;
  time: string;
  traceId: string;
  username: string;
}

const CLIENT_MESSAGES = [
  '请求 /system/user/list 超时，已触发重试',
  '表格数据源加载完成，共 50 条记录',
  '路由切换：/dashboard/analysis → /system/user',
  '表单校验未通过：手机号格式不正确',
  '组件 ErrorBoundary 捕获到渲染异常，已降级展示',
  '字典缓存命中，跳过远程请求',
  'WebSocket 心跳超时，尝试重连',
  '导出 Excel 完成，文件大小 128 KB',
];

function clientLogLevel(roll: number): ClientLogRecord['level'] {
  if (roll < 0.1) return 'error';
  if (roll < 0.28) return 'warn';
  if (roll < 0.42) return 'debug';
  return 'info';
}

export function generateClientLogs(count = 88): ClientLogRecord[] {
  const random = deterministicSequence();
  return Array.from({ length: count }, (_, index) => {
    const level = clientLogLevel(random());
    return {
      id: index + 1,
      level,
      message: pick(CLIENT_MESSAGES, random),
      page: pick(
        [
          '/system/user',
          '/system/role',
          '/dashboard/analysis',
          '/enterprise/workflow',
        ],
        random,
      ),
      source: pick(['request', 'router', 'table', 'form', 'websocket'], random),
      time: timeAt(index),
      traceId: `tr_${(index + 10_001).toString(16).padStart(8, '0')}`,
      username: pick(USERS, random),
    };
  });
}

export const CLIENT_LOG_DB = defineCollection({ seed: generateClientLogs, table: 'tb_client_log' });

export interface CaptchaLogRecord {
  code: string;
  id: number;
  ip: string;
  location: string;
  receiver: string;
  result: 'failed' | 'passed';
  scene: string;
  time: string;
  type: 'email' | 'image' | 'sms';
}

const CAPTCHA_SCENES = [
  '账号登录',
  '注册验证',
  '找回密码',
  '修改手机号',
  '敏感操作',
];

function captchaLogType(roll: number): CaptchaLogRecord['type'] {
  if (roll < 0.4) return 'image';
  if (roll < 0.8) return 'sms';
  return 'email';
}

export function generateCaptchaLogs(count = 88): CaptchaLogRecord[] {
  const random = deterministicSequence();
  return Array.from({ length: count }, (_, index) => {
    const type = captchaLogType(random());
    return {
      code: String(100_000 + Math.floor(random() * 899_999)),
      id: index + 1,
      ip: `10.${20 + (index % 8)}.${index % 255}.${(index * 7) % 255}`,
      location: pick(CITIES, random),
      receiver:
        type === 'email'
          ? `user${index}@example.com`
          : `138****${String(1000 + (index % 9000)).padStart(4, '0')}`,
      result: random() < 0.82 ? 'passed' : 'failed',
      scene: pick(CAPTCHA_SCENES, random),
      time: timeAt(index),
      type,
    };
  });
}

export const CAPTCHA_LOG_DB = defineCollection({ seed: generateCaptchaLogs, table: 'tb_captcha_log' });

/** 通用日志筛选：关键字 + 枚举 + 时间倒序，客户端日志与验证码日志共用口径 */
export function selectLogs<T extends { id: number; time: string }>(
  items: T[],
  filters: Record<string, unknown>,
  match: (item: T, filters: Record<string, unknown>) => boolean,
): T[] {
  return items
    .filter((item) => match(item, filters))
    .toSorted((a, b) => b.time.localeCompare(a.time) || b.id - a.id);
}

/* ------------------------------- 系统配置 ------------------------------- */

export type ConfigFieldType =
  | 'number'
  | 'password'
  | 'select'
  | 'switch'
  | 'text';
export type ConfigValue = boolean | number | string;

export interface ConfigField {
  key: string;
  label: string;
  options?: string[];
  placeholder?: string;
  type: ConfigFieldType;
}

export interface ConfigPanel {
  description: string;
  fields: ConfigField[];
  icon: string;
  key: string;
  title: string;
}

/** 7 个配置面板，对齐参考实现的「系统配置」左侧菜单 */
export const CONFIG_PANELS: ConfigPanel[] = [
  {
    key: 'site',
    title: '网站配置',
    icon: 'carbon:dashboard',
    description: '站点名称、备案与维护模式',
    fields: [
      {
        key: 'siteName',
        label: '站点名称',
        type: 'text',
        placeholder: '请输入站点名称',
      },
      {
        key: 'siteUrl',
        label: '站点地址',
        type: 'text',
        placeholder: 'https://junjie73-blip.github.io/antdv-next-admin/',
      },
      {
        key: 'supportEmail',
        label: '支持邮箱',
        type: 'text',
        placeholder: '请输入本站支持邮箱',
      },
      {
        key: 'icp',
        label: '备案号',
        type: 'text',
        placeholder: '请输入备案号',
      },
      {
        key: 'copyright',
        label: '版权信息',
        type: 'text',
        placeholder: '请输入版权信息',
      },
      { key: 'enabled', label: '启用站点', type: 'switch' },
      { key: 'maintenance', label: '维护模式', type: 'switch' },
      {
        key: 'maintenanceTip',
        label: '维护提示',
        type: 'text',
        placeholder: '系统维护中，请稍后访问',
      },
    ],
  },
  {
    key: 'security',
    title: '安全配置',
    icon: 'carbon:security',
    description: '密码策略、锁定与可信 IP',
    fields: [
      { key: 'minPasswordLength', label: '密码最小长度', type: 'number' },
      { key: 'passwordExpireDays', label: '密码有效期（天）', type: 'number' },
      { key: 'maxFailedAttempts', label: '最大连续失败次数', type: 'number' },
      { key: 'lockMinutes', label: '锁定时长（分钟）', type: 'number' },
      { key: 'captchaEnabled', label: '登录验证码', type: 'switch' },
      { key: 'singleSession', label: '限制单端登录', type: 'switch' },
      {
        key: 'trustedIps',
        label: '受信任 IP',
        type: 'text',
        placeholder: '多个 IP 用逗号分隔',
      },
    ],
  },
  {
    key: 'login',
    title: '登录配置',
    icon: 'carbon:login',
    description: '注册、登录方式与登录页文案',
    fields: [
      { key: 'openRegister', label: '开放用户注册', type: 'switch' },
      { key: 'rememberDays', label: '记住登录时长（天）', type: 'number' },
      {
        key: 'defaultRole',
        label: '默认角色',
        type: 'select',
        options: ['普通用户', '管理员', '访客'],
      },
      {
        key: 'loginMethods',
        label: '可用登录方式',
        type: 'select',
        options: ['账号密码', '手机号', '扫码登录'],
      },
      { key: 'loginTitle', label: '登录页标题', type: 'text' },
      { key: 'loginSubtitle', label: '登录页副标题', type: 'text' },
    ],
  },
  {
    key: 'mail',
    title: '邮箱配置',
    icon: 'carbon:email',
    description: 'SMTP 服务与发件人信息',
    fields: [
      {
        key: 'provider',
        label: '邮件服务商',
        type: 'select',
        options: ['腾讯企业邮', '阿里云邮', 'SMTP 自建'],
      },
      {
        key: 'encryption',
        label: '加密方式',
        type: 'select',
        options: ['SSL', 'TLS', '无'],
      },
      { key: 'smtpHost', label: 'SMTP 主机', type: 'text' },
      { key: 'smtpPort', label: '端口', type: 'number' },
      { key: 'smtpUser', label: '登录账号', type: 'text' },
      { key: 'smtpPassword', label: '登录密码或授权码', type: 'password' },
      { key: 'fromName', label: '发件人名称', type: 'text' },
      { key: 'fromEmail', label: '发件人邮箱', type: 'text' },
    ],
  },
  {
    key: 'sms',
    title: '短信配置',
    icon: 'carbon:chat',
    description: '短信签名、密钥与模板',
    fields: [
      {
        key: 'provider',
        label: '短信服务商',
        type: 'select',
        options: ['腾讯云短信', '阿里云短信', '自建网关'],
      },
      { key: 'signature', label: '短信签名', type: 'text' },
      { key: 'accessKey', label: 'Access Key', type: 'text' },
      { key: 'accessSecret', label: 'Access Secret', type: 'password' },
      { key: 'loginTemplate', label: '登录验证码模板 ID', type: 'text' },
      { key: 'noticeTemplate', label: '通知短信模板 ID', type: 'text' },
    ],
  },
  {
    key: 'storage',
    title: '存储配置',
    icon: 'carbon:data-base',
    description: '对象存储与访问域名',
    fields: [
      {
        key: 'provider',
        label: '对象存储服务商',
        type: 'select',
        options: ['MinIO', '腾讯云 COS', '阿里云 OSS'],
      },
      { key: 'region', label: '区域', type: 'text' },
      { key: 'endpoint', label: 'Endpoint', type: 'text' },
      { key: 'bucket', label: 'Bucket', type: 'text' },
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text' },
      { key: 'accessKeySecret', label: 'Access Key Secret', type: 'password' },
      { key: 'publicDomain', label: '公开访问域名', type: 'text' },
      { key: 'pathPrefix', label: '文件路径前缀', type: 'text' },
    ],
  },
  {
    key: 'client',
    title: '客户端配置',
    icon: 'carbon:application',
    description: '会话、上传与分页默认值',
    fields: [
      { key: 'sessionTimeout', label: '会话超时（分钟）', type: 'number' },
      { key: 'maxFileSize', label: '单文件大小上限（MB）', type: 'number' },
      { key: 'defaultPageSize', label: '默认分页条数', type: 'number' },
      { key: 'compressImage', label: '上传时压缩图片', type: 'switch' },
      { key: 'clientVersion', label: '客户端版本', type: 'text' },
      { key: 'updateUrl', label: '更新地址', type: 'text' },
      { key: 'allowedTypes', label: '允许上传的文件类型', type: 'text' },
    ],
  },
];

/** 面板默认值：页面「恢复默认」与后端保存都从这里取 */
export const CONFIG_DEFAULTS: Record<string, Record<string, ConfigValue>> = {
  site: {
    siteName: 'Antdv Admin',
    siteUrl: 'https://junjie73-blip.github.io/antdv-next-admin/',
    supportEmail: '',
    // 本站为开源项目，无备案主体信息，避免再放占位备案号
    icp: '',
    copyright: '© 2026 Antdv Admin',
    enabled: true,
    maintenance: false,
    maintenanceTip: '系统维护中，请稍后访问',
  },
  security: {
    minPasswordLength: 8,
    passwordExpireDays: 90,
    maxFailedAttempts: 5,
    lockMinutes: 30,
    captchaEnabled: true,
    singleSession: false,
    trustedIps: '10.0.0.0/8',
  },
  login: {
    openRegister: false,
    rememberDays: 7,
    defaultRole: '普通用户',
    loginMethods: '账号密码',
    loginTitle: '欢迎回来',
    loginSubtitle: '企业级应用快速开发平台',
  },
  mail: {
    provider: '腾讯企业邮',
    encryption: 'SSL',
    smtpHost: 'smtp.exmail.qq.com',
    smtpPort: 465,
    smtpUser: '',
    smtpPassword: '',
    fromName: 'Antdv Admin 通知',
    fromEmail: '',
  },
  sms: {
    provider: '腾讯云短信',
    signature: 'Antdv Admin',
    accessKey: '',
    accessSecret: '',
    loginTemplate: '',
    noticeTemplate: '',
  },
  storage: {
    provider: 'MinIO',
    region: '',
    endpoint: '',
    bucket: 'antdv-next-admin',
    accessKeyId: '',
    accessKeySecret: '',
    publicDomain: '',
    pathPrefix: 'uploads/',
  },
  client: {
    sessionTimeout: 30,
    maxFileSize: 10,
    defaultPageSize: 20,
    compressImage: true,
    clientVersion: '0.1.0',
    updateUrl: 'https://github.com/junjie73-blip/antdv-next-admin/releases',
    allowedTypes: '.jpg,.png,.pdf,.xlsx',
  },
};

/**
 * 系统配置当前值（SQLite 迁移 P2 · config）。
 * 每个面板在 `tb_config` 存一行，save/reset handler 的
 * `CONFIG_VALUES[panel] = next` 写法由 defineKVMap 代理落库，handler 零改动；
 * memory 模式下退化为普通对象副本，行为与改造前一致。
 */
export const CONFIG_VALUES: Record<
  string,
  Record<string, ConfigValue>
> = defineKVMap('tb_config', CONFIG_DEFAULTS);

/* ------------------------------- 记录详情 ------------------------------- */

export interface RecordField {
  key: string;
  label: string;
}

export interface RecordSection {
  fields: RecordField[];
  title: string;
}

export interface RecordModuleMeta {
  icon: string;
  sections: RecordSection[];
  title: string;
}

/** 详情分组定义：列表页「详情」跳到通用详情页时按模块取分组 */
export const RECORD_MODULES: Record<string, RecordModuleMeta> = {
  user: {
    title: '用户详情',
    icon: 'carbon:user',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'username', label: '登录账号' },
          { key: 'nickname', label: '用户昵称' },
          { key: 'phone', label: '手机号' },
          { key: 'email', label: '邮箱' },
        ],
      },
      {
        title: '组织与角色',
        fields: [
          { key: 'deptName', label: '所属部门' },
          { key: 'roles', label: '角色' },
          { key: 'status', label: '状态' },
        ],
      },
      {
        title: '其他信息',
        fields: [
          { key: 'remark', label: '备注' },
          { key: 'createdAt', label: '创建时间' },
          { key: 'updatedAt', label: '更新时间' },
        ],
      },
    ],
  },
  role: {
    title: '角色详情',
    icon: 'carbon:user-role',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'name', label: '角色名称' },
          { key: 'code', label: '角色编码' },
          { key: 'status', label: '状态' },
        ],
      },
      {
        title: '权限与说明',
        fields: [
          { key: 'dataScope', label: '数据权限' },
          { key: 'remark', label: '备注' },
          { key: 'createdAt', label: '创建时间' },
        ],
      },
    ],
  },
  dept: {
    title: '部门详情',
    icon: 'carbon:tree',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'name', label: '部门名称' },
          { key: 'code', label: '部门编码' },
          { key: 'leader', label: '负责人' },
        ],
      },
      {
        title: '其他信息',
        fields: [
          { key: 'phone', label: '联系电话' },
          { key: 'email', label: '联系邮箱' },
          { key: 'remark', label: '备注' },
        ],
      },
    ],
  },
  post: {
    title: '岗位详情',
    icon: 'carbon:category',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'name', label: '岗位名称' },
          { key: 'code', label: '岗位编码' },
          { key: 'deptName', label: '所属部门' },
        ],
      },
      {
        title: '其他信息',
        fields: [
          { key: 'status', label: '状态' },
          { key: 'remark', label: '备注' },
          { key: 'createdAt', label: '创建时间' },
        ],
      },
    ],
  },
  notice: {
    title: '公告详情',
    icon: 'carbon:notification',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'title', label: '通知标题' },
          { key: 'type', label: '通知类型' },
          { key: 'status', label: '状态' },
        ],
      },
      {
        title: '内容与时间',
        fields: [
          { key: 'content', label: '通知内容' },
          { key: 'createdAt', label: '创建时间' },
          { key: 'updatedAt', label: '更新时间' },
        ],
      },
    ],
  },
  settings: {
    title: '配置详情',
    icon: 'carbon:settings-adjust',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'name', label: '配置名称' },
          { key: 'key', label: '配置键' },
          { key: 'value', label: '配置值' },
        ],
      },
      {
        title: '其他信息',
        fields: [
          { key: 'group', label: '所属分组' },
          { key: 'description', label: '说明' },
          { key: 'updatedAt', label: '更新时间' },
        ],
      },
    ],
  },
  file: {
    title: '文件详情',
    icon: 'carbon:folder',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'name', label: '文件名' },
          { key: 'type', label: '文件类型' },
          { key: 'size', label: '大小' },
        ],
      },
      {
        title: '其他信息',
        fields: [
          { key: 'uploader', label: '上传人' },
          { key: 'createdAt', label: '上传时间' },
        ],
      },
    ],
  },
  log: {
    title: '操作日志详情',
    icon: 'carbon:document',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'title', label: '操作描述' },
          { key: 'username', label: '操作人' },
          { key: 'method', label: '请求方法' },
        ],
      },
      {
        title: '请求信息',
        fields: [
          { key: 'url', label: '请求地址' },
          { key: 'ip', label: '来源 IP' },
          { key: 'time', label: '操作时间' },
        ],
      },
    ],
  },
  loginLog: {
    title: '登录日志详情',
    icon: 'carbon:login',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'username', label: '登录账号' },
          { key: 'ip', label: '来源 IP' },
          { key: 'status', label: '登录结果' },
        ],
      },
      {
        title: '设备信息',
        fields: [
          { key: 'browser', label: '浏览器' },
          { key: 'os', label: '操作系统' },
          { key: 'loginTime', label: '登录时间' },
        ],
      },
    ],
  },
  online: {
    title: '在线用户详情',
    icon: 'carbon:activity',
    sections: [
      {
        title: '基础信息',
        fields: [
          { key: 'username', label: '登录账号' },
          { key: 'ip', label: '来源 IP' },
          { key: 'browser', label: '浏览器' },
        ],
      },
      {
        title: '会话信息',
        fields: [
          { key: 'loginTime', label: '登录时间' },
          { key: 'lastAccessTime', label: '最后访问' },
        ],
      },
    ],
  },
};

/** 值格式化：数组、布尔、缺失值统一成界面可读文本，避免 DOM 里出现 undefined / NaN */
export function formatRecordValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.length > 0 ? value.join('、') : '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * 通用详情页「完整记录」分组的字段中文名映射。
 *
 * 各业务表的字段名不完全统一，与其在详情页里逐个模块写 if，
 * 不如在源头给一张字典；没收录的键原样显示，也不会丢数据。
 */
export const FIELD_LABELS: Record<string, string> = {
  browser: '浏览器',
  code: '编码',
  createdAt: '创建时间',
  dataScope: '数据权限',
  deptId: '部门 ID',
  deptName: '所属部门',
  description: '说明',
  duration: '耗时(ms)',
  email: '邮箱',
  enabled: '是否启用',
  gender: '性别',
  group: '所属分组',
  id: '记录 ID',
  ip: '来源 IP',
  key: '配置键',
  lastAccessTime: '最后访问时间',
  location: '归属地',
  loginTime: '登录时间',
  message: '消息',
  method: '请求方法',
  name: '名称',
  nickname: '昵称',
  operator: '操作人',
  os: '操作系统',
  phone: '联系电话',
  remark: '备注',
  roleName: '角色名称',
  roles: '角色',
  size: '大小',
  status: '状态',
  time: '时间',
  title: '标题',
  type: '类型',
  updatedAt: '更新时间',
  uploader: '上传人',
  url: '请求地址',
  userAgent: 'User-Agent',
  username: '登录账号',
  value: '配置值',
};
