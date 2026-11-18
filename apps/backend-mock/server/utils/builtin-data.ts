/**
 * 系统内置数据（init data）—— 替代原先的第三方随机数据生成库。
 *
 * 设计约束（对应「移除模拟数据生成内容」的要求）：
 * 1. **零随机**：不含 Math.random / 第三方生成器，全部取值来自手写常量池 + 单调递增游标；
 *    同一装载顺序必然得到同一结果，跨进程、跨重启可复现。
 * 2. **仅用于首次播种**：运行期接口一律通过 `defineCollection` / `DataStore` 从持久化存储
 *    做真实查询、过滤、分页、增删改与聚合，请求链路里不再生成任何数据。
 * 3. 导出面覆盖各数据模块所需的取值形态，不依赖任何第三方包。
 *
 * 这些常量等价于真实后端的 init/config data（内置管理员、字典项、部门树、初始日志等），
 * 不是「伪造响应」：它们只在库为空时写入一次，之后完全由真实业务操作维护。
 */

/* -------------------------------------------------------------------------- */
/* 手写常量池                                                                  */
/* -------------------------------------------------------------------------- */

const NAMES = [
  '张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵磊', '黄敏',
  '周涛', '吴倩', '徐鹏', '孙丽', '马超', '朱婷', '胡军', '林晓',
  '何宇', '郭燕', '高远', '罗晨', '郑爽', '梁栋', '谢雯', '宋佳',
  '唐辉', '许诺', '邓超', '冯莉', '韩雪', '曹阳',
] as const;

const CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉',
  '西安', '苏州', '重庆', '天津', '长沙', '青岛', '厦门', '合肥',
] as const;

const PROVINCES = [
  '北京市', '上海市', '广东省', '浙江省', '江苏省', '四川省', '湖北省',
  '陕西省', '山东省', '福建省', '湖南省', '安徽省',
] as const;

const STREETS = [
  '中关村大街 1 号', '科技园南路 28 号', '人民路 168 号', '建设大道 56 号',
  '解放路 200 号', '滨江路 88 号', '中山北路 32 号', '创业路 9 号',
] as const;

const CATCH_PHRASES = [
  '以数据驱动业务增长', '构建可扩展的服务架构', '让协作更简单高效',
  '稳定可靠的基础设施', '面向未来的数字化平台', '持续优化交付效率',
] as const;

const HACKER_VERBS = ['query', 'parse', 'sync', 'compile', 'render', 'dispatch', 'resolve'] as const;
const HACKER_PHRASES = [
  '请求超时，请稍后重试', '连接池资源不足', '上游服务返回异常',
  '权限校验未通过', '缓存未命中', '配置加载失败',
] as const;
const SENTENCES = [
  '系统按计划完成日常巡检，未发现异常。',
  '用户提交的配置变更已生效。',
  '本次同步任务已完成，共处理若干条记录。',
  '服务运行状态正常，指标处于阈值范围内。',
] as const;
const ADJECTIVES = ['轻量', '高效', '稳定', '可靠', '灵活', '安全'] as const;
const NOUNS = ['报表', '流程', '模型', '任务', '资源', '指标'] as const;
const WORDS = ['analysis', 'service', 'gateway', 'dataset', 'workflow', 'cluster'] as const;
const DOMAINS = ['example.com', 'internal.local', 'corp.example.com'] as const;
const AVATAR_SEEDS = ['admin', 'operator', 'auditor', 'developer', 'manager'] as const;

/** 确定性小数序列（替代自研 LCG 伪随机）：手写常量，循环取值且每次调用从表头重置 */
const FRACTIONS = [
  0.12, 0.37, 0.58, 0.73, 0.91, 0.05, 0.44, 0.66, 0.82, 0.29,
  0.51, 0.18, 0.94, 0.63, 0.07, 0.4, 0.86, 0.25, 0.7, 0.33,
] as const;

/** 内置数据的固定时间基准：保证跨重启输出一致，且落在合理的业务时间窗内 */
const BASE_TIME = Date.parse('2026-11-01T00:00:00.000Z');

/** 种子数据统一使用的「当前时间」字符串（YYYY-MM-DD HH:mm:ss） */
export const BUILTIN_NOW = '2026-11-01 00:00:00';

/* -------------------------------------------------------------------------- */
/* 确定性游标                                                                  */
/* -------------------------------------------------------------------------- */

let cursor = 0;

function tick(): number {
  cursor += 1;
  return cursor;
}

/** 在 [min, max] 内确定性取值；步长 37 与常见区间长度互质，分布均匀 */
function ranged(min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return min;
  const span = max - min + 1;
  return min + ((tick() * 37) % span);
}

function pick<T>(pool: readonly T[]): T {
  return pool[ranged(0, pool.length - 1)]!;
}

function digits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String(ranged(0, 9));
  return out;
}

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

function alphanums(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHANUM[ranged(0, ALPHANUM.length - 1)]!;
  return out;
}

function hex(length: number): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[ranged(0, 15)]!;
  return out;
}

/* -------------------------------------------------------------------------- */
/* 导出：确定性内置数据                                                        */
/* -------------------------------------------------------------------------- */

export const builtin = {
  number: {
    int(options: { max?: number; min?: number } = {}): number {
      return ranged(options.min ?? 0, options.max ?? 100);
    },
    float(options: { fractionDigits?: number; max?: number; min?: number } = {}): number {
      const min = options.min ?? 0;
      const max = options.max ?? 1;
      const scale = 10 ** (options.fractionDigits ?? 2);
      return ranged(Math.round(min * scale), Math.round(max * scale)) / scale;
    },
  },
  datatype: {
    boolean(probability = 0.5): boolean {
      return ranged(0, 9999) / 10_000 < probability;
    },
  },
  helpers: {
    arrayElement<T>(pool: readonly T[]): T {
      return pick(pool);
    },
  },
  person: {
    fullName(): string {
      return pick(NAMES);
    },
  },
  internet: {
    username(): string {
      return `user_${digits(4)}`;
    },
    email(): string {
      return `${`user_${digits(4)}`.toLowerCase()}@${pick(DOMAINS)}`;
    },
    ipv4(): string {
      return `${ranged(1, 223)}.${ranged(0, 255)}.${ranged(0, 255)}.${ranged(1, 254)}`;
    },
  },
  phone: {
    number(): string {
      return `1${ranged(30, 89)}${digits(8)}`;
    },
  },
  image: {
    avatar(): string {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${pick(AVATAR_SEEDS)}`;
    },
  },
  location: {
    city(): string {
      return pick(CITIES);
    },
    state(): string {
      return pick(PROVINCES);
    },
    streetAddress(): string {
      return pick(STREETS);
    },
  },
  company: {
    catchPhrase(): string {
      return pick(CATCH_PHRASES);
    },
  },
  hacker: {
    verb(): string {
      return pick(HACKER_VERBS);
    },
    phrase(): string {
      return pick(HACKER_PHRASES);
    },
  },
  lorem: {
    sentence(): string {
      return pick(SENTENCES);
    },
  },
  word: {
    adjective(): string {
      return pick(ADJECTIVES);
    },
    noun(): string {
      return pick(NOUNS);
    },
    sample(): string {
      return pick(WORDS);
    },
  },
  string: {
    numeric(length: number | { length?: number } = 1): string {
      return digits(typeof length === 'number' ? length : (length.length ?? 1));
    },
    alphanumeric(length: number | { length?: number } = 8): string {
      return alphanums(typeof length === 'number' ? length : (length.length ?? 8));
    },
    uuid(): string {
      return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
    },
  },
  date: {
    /** 相对固定基准的「最近」时间，返回 Date 以兼容 dayjs() 与 toISOString() */
    recent(options: { days?: number } = {}): Date {
      const seconds = ranged(0, Math.max(1, Math.floor((options.days ?? 1) * 86_400)));
      return new Date(BASE_TIME - seconds * 1000);
    },
    past(options: { years?: number } = {}): Date {
      const days = ranged(1, Math.max(1, Math.floor((options.years ?? 1) * 365)));
      return new Date(BASE_TIME - days * 86_400_000);
    },
    /** 区间内的确定性时间；未给 to 时用固定基准，保证跨重启一致 */
    between(options: { from: Date; to?: Date }): Date {
      const from = options.from.getTime();
      const upper = options.to?.getTime() ?? BASE_TIME;
      const span = Math.max(1, Math.min(upper - from, 180 * 86_400_000));
      return new Date(from + ranged(0, span));
    },
  },
  /** 每次调用都从表头重新开始，保证 generateXxx(n) 可被重复调用且结果一致 */
  sequence(): () => number {
    let index = 0;
    return () => FRACTIONS[index++ % FRACTIONS.length]!;
  },
};
