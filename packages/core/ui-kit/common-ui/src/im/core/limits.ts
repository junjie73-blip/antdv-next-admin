/**
 * 运行限额的词汇表与出厂值。
 *
 * 分层位置：`core/`，纯常量。单独成文件的理由只有一个：**避免环**。
 * 限额既被 `config.ts`（宿主注入）用，又被 `use-im.ts`（节流窗口、撤回窗口）用；
 * 把默认值放进 config 就会形成 `config -> use-im -> config` 的循环依赖 ——
 * 打包阶段侥幸能跑，按源码消费的宿主拿到的是 `undefined`，排查成本极高。
 *
 * 这一层不做什么：不读全局配置、不做校验（校验在 `attachment.ts` 与各组件里），只是数字与类型。
 */

export interface ImLimits {
  /** 附件类型白名单：`.png` / `image/*` / 完整 MIME 三种写法都接受，空数组表示不限 */
  accept: string[];
  /** 历史一页多少条：翻页请求只带 `before` 游标，不带 offset */
  historyPageSize: number;
  /** 单个附件体积上限（MB），十进制口径，与 IM/网盘的显示一致 */
  maxAttachmentSizeMb: number;
  /** 单条消息最多几个附件 */
  maxAttachmentsPerMessage: number;
  /** 正文长度上限：超限由输入区禁用发送并给出原因，而不是发出去让服务端拒 */
  maxMessageLength: number;
  /** 撤回时间窗（ms），默认 2 分钟；配合注入的 `now()` 测试可以精确跨窗 */
  recallWindowMs: number;
  /** 对端 typing 多久没刷新就自动清除（ms） */
  typingTimeoutMs: number;
  /** typing 上行节流（ms）：默认 2s，再小就不是"正在输入"而是刷屏 */
  typingThrottleMs: number;
}

/**
 * 出厂值。
 *
 * 每一项都取"业界 IM 客户端的默认观感"而不是"我们服务的配置"，
 * 因为子包不认识后端；宿主认为不合适就在 `configureIm({ limits })` 里覆盖，增量合并。
 */
export const DEFAULT_LIMITS: ImLimits = {
  accept: [],
  historyPageSize: 30,
  maxAttachmentSizeMb: 20,
  maxAttachmentsPerMessage: 4,
  maxMessageLength: 2000,
  recallWindowMs: 120_000,
  typingThrottleMs: 2000,
  typingTimeoutMs: 6000,
};

export function withLimits(partial: Partial<ImLimits> | undefined): ImLimits {
  return { ...DEFAULT_LIMITS, ...partial };
}

// ==================== 消息流虚拟化的口径 ====================

/**
 * 消息列表开始走虚拟渲染的条数阈值。
 *
 * 为什么不"永远虚拟"：几十条消息时可视窗口比总数还大，虚拟列表只是在反复增删同一批 DOM，
 * 翻页与收到新消息时反而会抖 —— 短列表直接整表渲染更快也更稳。
 * `MessagePane` 用它做默认值，宿主可以按实例用 `virtualize-threshold` 覆盖。
 */
export const MESSAGE_VIRTUALIZE_THRESHOLD = 100;

/**
 * 虚拟模式首帧的单行高度预估（px）。
 *
 * 它只决定"滚动条一开始多长"，真实高度由 `measureElement` 逐行覆盖，
 * 所以这里允许不准；估得越接近，首屏追底与翻页补位要修正的 delta 越小。
 */
export const MESSAGE_ROW_ESTIMATE_PX = 72;

/** 虚拟行间距（px）：与整表渲染的 `gap-3` 对齐，切换两种模式时视觉不断档 */
export const MESSAGE_ROW_GAP_PX = 12;

/** 虚拟列表上下内边距（px）：与整表渲染的 `py-4` 对齐（`paddingStart` / `paddingEnd`） */
export const MESSAGE_LIST_PADDING_PX = 16;

/** 视口上下各多渲染几行：滚进新行时它已经在 DOM 里，真实高度也才来得及被测到 */
export const MESSAGE_OVERSCAN_ROWS = 6;

/**
 * 距底部多少像素还算"贴在底部"（组件默认容差，宿主可用 `bottom-threshold` 覆盖）。
 * 不留容差就会出现差 1px 再也不跟随的经典故障。
 */
export const MESSAGE_BOTTOM_TOLERANCE_PX = 24;

/**
 * 首屏（以及刚切进虚拟模式）最多追底几帧。
 *
 * 行为边界写清楚：虚拟模式的总高是「估的」，之后随每行被测才逐渐变准，
 * 一次 `scrollTop = scrollHeight` 只能滚到当时的底部而不是真正的底部，所以要追几帧。
 * 用完这几帧仍未贴底（超长历史 + 首屏没测完）时**就此停手，不再抢滚动位置**，
 * 用户手动滚动会走正常的贴底与 `loadHistory` 路径 —— 这是刻意的取舍，不是漏实现。
 */
export const MESSAGE_BOTTOM_SETTLE_FRAMES = 4;
