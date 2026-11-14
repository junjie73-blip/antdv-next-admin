<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { MentionMember } from '../../core/mention';
import type { Attachment, ImMessage, MessageStatus } from '../../core/types';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { IconifyIcon } from '@antdv/icons';
import {
  Attachment as AttachmentCard,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Bubble,
  BubbleContent,
  Button,
  Marker,
  MarkerContent,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  ScrollArea,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { useElementSize } from '@vueuse/core';

import {
  MESSAGE_BOTTOM_SETTLE_FRAMES,
  MESSAGE_BOTTOM_TOLERANCE_PX,
  MESSAGE_LIST_PADDING_PX,
  MESSAGE_OVERSCAN_ROWS,
  MESSAGE_ROW_ESTIMATE_PX,
  MESSAGE_ROW_GAP_PX,
  MESSAGE_VIRTUALIZE_THRESHOLD,
} from '../../core/limits';
import { highlightSegments } from '../../core/mention';
import { dayKey, formatClock, formatDayDivider } from '../../utils/time';

/**
 * 消息流：画消息 + 守住滚动位置 + 长列表虚拟化。
 *
 * 分层位置：`components/`，纯展示 + 回抛事件。它不认识 store、不认识 transport，
 * 所以任何一份 `ImMessage[]` 都能画（宿主页面、演示页、单测夹具走的是同一套代码）。
 *
 * 虚拟化口径（数字全部来自 `core/limits.ts`，组件里不写裸数字）：
 * - 条数不超过 `MESSAGE_VIRTUALIZE_THRESHOLD` 时**整表直接渲染**：短列表上虚拟是负收益，
 *   可视窗口比总数还大，只会反复增删同一批 DOM，翻页与收消息时反而抖；
 * - 超过阈值才交给 `@tanstack/vue-virtual`。它是 headless 的，基础 UI 仍然只来自
 *   `@antdv/shadcn-ui`，没有引入第二个组件库；
 * - 行高不假定固定值：每行走 `measureElement` 的 ref 回调实测，
 *   `MESSAGE_ROW_ESTIMATE_PX` 只用来撑首帧的滚动条长度。
 *
 * 滚动策略与**实际行为边界**（做不到的一律写在注释里，不假装解决）：
 * 1. 初始贴底：整表渲染时一次 `scrollTop = scrollHeight` 就到位；虚拟模式下总高是「估的」，
 *    要等真实行高被测完才收敛，所以用 `MESSAGE_BOTTOM_SETTLE_FRAMES` 帧有限次追底，
 *    并且**总高每变一次就再钉一次**（见下面 `watch(totalSize)` 那条）—— 只靠帧预算会在
 *    真浏览器里停在离底一截的地方不动。两条都不抢用户的位置：帧数用完就停手，
 *    重钉的前提是 `stickToBottom` 仍然为真，而它由真实 scroll 事件维护。
 * 2. 新消息到达：贴底才跟随到底，已经上翻就不动（`stickToBottom` 由真实 scroll 事件维护）；
 * 3. 上翻翻页（前插历史）：请求由**滚到顶**触发 —— 更早的消息在列表上方，
 *    `loadHistory` 带的是 `before` 游标（已加载最早一条的 createdAt），在底部请求只会不断往前插。
 *    位置补偿两种模式各走一条：
 *    - 整表渲染：没有虚拟器可依赖，用「内容高度差」把视窗推回去（`applyPrependCompensation`）；
 *    - 虚拟渲染：用「视窗上沿那条消息」的 key + 视觉偏移算一个**绝对落点**写回去
 *      （`snapshotTopAnchor` / `restoreTopAnchor`）。
 *      这里刻意不指望 `anchorTo: 'end'` 自己补：它锚的是"上沿那一行"，而聊天列表的上沿
 *      常常是**日期分隔条** —— 同一天前插一整页时分隔条纹丝不动，算出来的补量≈0，
 *      真浏览器里实测就是"翻页成功、窗口落在新一页最上面"。我们的补偿写的是绝对目标而非增量，
 *      所以虚拟器若补到位就落在同一个值上（差 ≤1px 不写），两套同时在场也不会互相抵消。
 * 4. 跨过阈值（默认 100 条上下）时坐标系整个换掉，位置只能近似：贴底则回到底部，
 *    正在上翻则保持当前 scrollTop，下一次滚动事件会把贴底状态纠正回来。
 *
 * 附件区与表情回应是插槽：上传、预览大图、emoji 面板都属于宿主（或别的包），本包不自己长出来。
 */
const props = defineProps<{
  /** 头像地址规则由宿主给：包不知道宿主的文件存在哪 */
  avatarOf?: (userId: string) => string | undefined;
  class?: HTMLAttributes['class'];
  /** 距底部多少像素内还算"贴在底部"；不留容差就会差 1px 再也不跟随 */
  bottomThreshold?: number;
  emptyText?: string;
  loadingHistory?: boolean;
  /** 成员表：给了才做 @ 高亮 */
  members?: MentionMember[];
  messages: ImMessage[];
  nameOf?: (userId: string) => string;
  /** 自己是谁：只决定左右归属，不参与任何数据筛选 */
  selfId: string;
  /** 超过多少条才走虚拟：默认 `MESSAGE_VIRTUALIZE_THRESHOLD`，宿主可按面板覆盖 */
  virtualizeThreshold?: number;
}>();

const emit = defineEmits<{
  (event: 'loadHistory'): void;
  (event: 'openAttachment', attachment: Attachment, message: ImMessage): void;
  (event: 'recall', message: ImMessage): void;
  (event: 'retry', message: ImMessage): void;
}>();

const STATUS_ICON: Record<MessageStatus, string> = {
  failed: 'lucide:triangle-alert',
  pending: 'lucide:clock',
  read: 'lucide:check-check',
  received: 'lucide:circle-dashed',
  sent: 'lucide:check',
};

const STATUS_TEXT: Record<MessageStatus, string> = {
  failed: '发送失败',
  pending: '发送中',
  read: '已读',
  received: '已送达',
  sent: '已发送',
};

/**
 * 距顶部多少像素内算"翻到顶"，触发 `loadHistory`。
 *
 * 刻意不复用 `bottomThreshold` / `MESSAGE_BOTTOM_TOLERANCE_PX`：那个容差服务的是"贴底要不要跟随"，
 * 方向相反、语义不同，宿主调它不该顺带把翻页点也挪走。留一个组件内的固定档位，
 * 24px 与底部容差同量级 —— 一次滚轮（约 100px）就足够跨过它。
 */
const HISTORY_TRIGGER_PX = 24;

/** 一行的渲染单元：消息本体，或按天插入的分隔条 */
interface MessageRow {
  key: string;
  label?: string;
  message?: ImMessage;
  type: 'day' | 'message';
}

/** 送进模板的一行：`start` 有值才说明这一行是被虚拟器定位的 */
interface RenderRow {
  entryKey: string;
  index: number;
  row: MessageRow;
  start?: number;
}

const root = ref<HTMLElement>();
/** 滚动容器：必须是 ref 而不是普通变量，虚拟器要能响应式地拿到它 */
const viewport = ref<HTMLElement>();
/** 是否贴在底部：由真实滚动事件维护，而不是每条消息都无脑滚到底 */
const stickToBottom = ref(true);
/**
 * 上一次滚动事件时是否已经在顶部：翻页请求只在"进到顶"那一次发，
 * 停在顶上抖一下滚轮不该连发五页。初值是 true —— 面板就是从顶部打开的，
 * 首帧那次滚动不算"用户翻到顶"。
 */
let wasAtTop = true;
/** 前插历史时的高度快照，DOM 更新后用来把视窗推回原位（只有整表渲染那条路用得上） */
let prependSnapshot: undefined | { height: number; top: number };
/**
 * 视窗上沿那条**消息**的位置快照（虚拟模式专用）：`{ id, offset }`，
 * offset 是它当时相对视窗上沿的位移（负数 = 被沿裁掉半条）。
 *
 * 只能在 scroll 事件里采：前插落地时虚拟器的 measurements 已经是新表的了，
 * 事后再也问不出"合并前那一行在哪"。而翻页请求本来就是 scroll 事件发的，
 * 所以每一次滚动都顺手记一发，合并时手里一定有最近的位置。
 */
let topAnchor: undefined | { id: string; offset: number };
/** 追底的取消句柄：卸载时必须取消，否则组件都没了还在改 scrollTop */
let cancelSettleFrame: (() => void) | undefined;

const rows = computed(() => withDividers(props.messages));

/** 决定要不要虚拟的是**消息条数**：分隔条只是视觉副产品，不该把短列表推进虚拟模式 */
const isVirtual = computed(
  () =>
    props.messages.length >
    (props.virtualizeThreshold ?? MESSAGE_VIRTUALIZE_THRESHOLD),
);

const virtualizer = useVirtualizer<HTMLElement, HTMLElement>(
  computed(() => ({
    // `anchorTo: 'end'` 管的是"列表往上长"这一侧：底部行高收敛时把差额折算进 scrollTop，
    // 于是贴底能一直贴住。**它不负责前插不跳位**（上沿往往是分隔条，锚它等于没锚），
    // 那条由下面的 `snapshotTopAnchor` / `restoreTopAnchor` 按消息 key 自己补。
    anchorTo: 'end',
    // 整表渲染模式下计数给 0：虚拟器继续存在但不产出任何行，两种模式共用一条代码路径
    count: isVirtual.value ? rows.value.length : 0,
    estimateSize: () => MESSAGE_ROW_ESTIMATE_PX,
    gap: MESSAGE_ROW_GAP_PX,
    getItemKey: (index: number) => rows.value[index]?.key ?? index,
    getScrollElement: () => viewport.value ?? null,
    overscan: MESSAGE_OVERSCAN_ROWS,
    paddingEnd: MESSAGE_LIST_PADDING_PX,
    paddingStart: MESSAGE_LIST_PADDING_PX,
    scrollEndThreshold: props.bottomThreshold ?? MESSAGE_BOTTOM_TOLERANCE_PX,
  })),
);

const virtualItems = computed(() =>
  isVirtual.value ? virtualizer.value.getVirtualItems() : [],
);

/** 占位总高：整表渲染模式没有它，虚拟模式靠它把滚动条撑出真实长度 */
const totalSize = computed(() =>
  isVirtual.value ? virtualizer.value.getTotalSize() : 0,
);

const listStyle = computed<HTMLAttributes['style']>(() =>
  isVirtual.value ? { height: `${totalSize.value}px` } : undefined,
);

/** 两种模式共用同一个循环体：`start` 有没有值就是唯一的区别，模板里不复制两份消息气泡 */
const visibleRows = computed<RenderRow[]>(() => {
  if (!isVirtual.value) {
    return rows.value.map((row, index) => ({ entryKey: row.key, index, row }));
  }
  const out: RenderRow[] = [];
  for (const item of virtualItems.value) {
    const row = rows.value[item.index];
    if (row === undefined) continue;
    out.push({
      entryKey: String(item.key),
      index: item.index,
      row,
      start: item.start,
    });
  }
  return out;
});

/**
 * `measureElement` 的 ref 回调：动态高度就靠这一句。
 *
 * 每行渲染出来后被虚拟器实测（它自己再挂 ResizeObserver 继续跟），组件既不读 `offsetHeight`
 * 也不假定固定行高。整表渲染模式必须原样返回 —— 那些行没有 `data-index`，
 * 喂给 `measureElement` 只会刷警告。
 */
function measureRow(element: unknown): void {
  if (!isVirtual.value) return;
  virtualizer.value.measureElement(element as HTMLElement | null);
}

function rowClass(entry: RenderRow): string {
  return entry.start === undefined
    ? 'min-w-0'
    : // 绝对定位的子元素不受容器 padding 约束，所以横向内边距挂在自己身上
      'absolute inset-x-0 top-0 min-w-0 px-3 will-change-transform';
}

function rowStyle(entry: RenderRow): HTMLAttributes['style'] {
  return entry.start === undefined
    ? undefined
    : { transform: `translateY(${entry.start}px)` };
}

function isOwn(message: ImMessage): boolean {
  return message.senderId === props.selfId;
}

function displayName(userId: string): string {
  return props.nameOf?.(userId) ?? userId;
}

/** 同 `ConversationList`：`AvatarImage` 的 `src` 要 `string`，把"有没有"与"是什么"拆开 */
function hasAvatar(message: ImMessage): boolean {
  return props.avatarOf?.(message.senderId) !== undefined;
}

function avatarSrc(message: ImMessage): string {
  return props.avatarOf?.(message.senderId) ?? '';
}

function textOf(message: ImMessage): string {
  if (typeof message.body === 'string') return message.body;
  return message.body.text ?? '';
}

function attachmentsOf(message: ImMessage): Attachment[] {
  if (typeof message.body === 'string') return [];
  return message.body.attachments ?? [];
}

/** 没给成员表就不高亮：没有依据的 `@xxx` 只当普通文本，不能凭空染色 */
function segmentsOf(message: ImMessage) {
  if (props.members === undefined || props.members.length === 0)
    return undefined;
  return highlightSegments(textOf(message), props.members);
}

/** 按天插分隔条：消息表本身升序（store 保证），所以只需两两比较日期键 */
function withDividers(list: readonly ImMessage[]): MessageRow[] {
  const out: MessageRow[] = [];
  let previous: string | undefined;
  for (const message of list) {
    const key = dayKey(message.createdAt);
    if (key !== previous) {
      out.push({
        key: `day:${key}`,
        label: formatDayDivider(message.createdAt),
        type: 'day',
      });
      previous = key;
    }
    out.push({ key: `msg:${message.id}`, message, type: 'message' });
  }
  return out;
}

function findViewport(): HTMLElement | undefined {
  return (
    root.value?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    ) ?? root.value
  );
}

function scrollToEnd(): void {
  const el = viewport.value;
  if (el === undefined) return;
  // 直接赋值而不是 `scrollTo`：jsdom 没实现 scrollTo，而赋值在浏览器和测试里语义相同
  el.scrollTop = el.scrollHeight;
}

function onViewportScroll(): void {
  const el = viewport.value;
  if (el === undefined) return;
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  stickToBottom.value =
    distance <= (props.bottomThreshold ?? MESSAGE_BOTTOM_TOLERANCE_PX);
  // 每次滚动都更新"视窗上沿那条消息"的位置：翻页落地时靠它把原位找回（见 `topAnchor`）
  snapshotTopAnchor();
  // 翻到**顶**才请求上一页：更早的消息在列表上方，`loadHistory` 带的是 `before` 游标
  // （已加载最早一条的 createdAt）。在底部请求历史会让视窗上方不断前插，用户永远够不到最新一条。
  // `canScrollUp` 是必需的第二个条件：短列表的 `scrollTop` 天生就是 0，
  // 没有它，刚打开面板就会打一次历史请求。
  const atTop =
    el.scrollTop <= HISTORY_TRIGGER_PX &&
    el.scrollHeight - el.clientHeight > HISTORY_TRIGGER_PX;
  if (!wasAtTop && atTop && props.loadingHistory !== true) emit('loadHistory');
  wasAtTop = atTop;
}

/**
 * 下一帧跑 `callback`，返回它的取消句柄。
 *
 * 没有 rAF 的环境（SSR 探针、老 jsdom）退回宏任务：只影响追底节奏，不影响正确性。
 * 写成返回取消句柄而不是存 id，是因为 `setTimeout` 在 Node 类型里返回的不是 `number`。
 */
function nextFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(handle);
  }
  const handle = setTimeout(callback, 16);
  return () => clearTimeout(handle);
}

function cancelSettle(): void {
  if (cancelSettleFrame === undefined) return;
  cancelSettleFrame();
  cancelSettleFrame = undefined;
}

/**
 * 虚拟模式的首屏贴底：总高是「估算 → 实测」逐步收敛的，一次贴底只能贴到"当时的底"。
 *
 * 每帧重看一次：仍然贴底且离底有距离就再贴一次，最多 `frames` 帧；
 * 中途用户上翻（scroll 事件把 `stickToBottom` 改回去）立刻收手 —— 抢滚动位置不可接受。
 */
function settleToEnd(frames = MESSAGE_BOTTOM_SETTLE_FRAMES): void {
  if (!isVirtual.value) {
    scrollToEnd();
    return;
  }
  scrollToEnd();
  cancelSettle();
  if (frames <= 0) return;
  cancelSettleFrame = nextFrame(() => {
    cancelSettleFrame = undefined;
    const el = viewport.value;
    if (!stickToBottom.value || el === undefined) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance > (props.bottomThreshold ?? MESSAGE_BOTTOM_TOLERANCE_PX)) {
      settleToEnd(frames - 1);
    }
  });
}

/**
 * 这次消息表变化属于哪一种 —— 三种的滚动后果完全不同，所以先分诊再动视窗。
 *
 * - `append`：末条 id 变了，且上一条的末条还在表里（新消息来了）；
 * - `replace`：末条 id 变了，且上一条的末条已经不在表里（切会话，整表换掉）；
 * - `prepend`：末条没动、首条变了并且条数变多（历史前插）；
 * - `none`：原地更新（发送态、撤回、@ 高亮），一律不许动视窗。
 *
 * 判定用 id 而不是长度，因为一次 flush 里"前插一页 + 来一条新消息"是会同时发生的。
 */
function classifyChange(
  next: readonly ImMessage[],
  previous: readonly ImMessage[],
): 'append' | 'none' | 'prepend' | 'replace' {
  if (next.length === 0 || previous.length === 0) return 'none';
  const previousLast = previous.at(-1)?.id;
  if (next.at(-1)?.id !== previousLast) {
    // 全表扫的代价与 `withDividers` 同阶，不额外制造性能话题
    return previousLast !== undefined &&
      next.some((item) => item.id === previousLast)
      ? 'append'
      : 'replace';
  }
  if (next.length > previous.length && next[0]?.id !== previous[0]?.id)
    return 'prepend';
  return 'none';
}

/** 整表渲染模式下的"前插不跳位"：内容多出来多少，scrollTop 就补多少 */
function applyPrependCompensation(): void {
  const snapshot = prependSnapshot;
  prependSnapshot = undefined;
  const el = viewport.value;
  if (snapshot === undefined || el === undefined) return;
  const delta = el.scrollHeight - snapshot.height;
  if (delta > 0) el.scrollTop = snapshot.top + delta;
}

/**
 * 采下"视窗上沿那条消息"的位置（虚拟模式）。
 *
 * 读数只信 DOM 的 `scrollTop`：虚拟器内部的 scrollOffset 是异步追上来的，事件这一侧拿到的
 * 还是上一帧的位置 —— 拿它当锚点，补出来的落点会跑到半年前那一行上（单测里实测补到底）。
 *
 * 只认消息行不认分隔条：同一天里前插一页，分隔条还是 index 0、start 还是 paddingStart，
 * 锚在它身上算出来的补量接近 0 —— 真浏览器里就是这样：翻页后窗口落在**新一页的最上面**，
 * 用户以为列表跳回了半年前。
 */
function snapshotTopAnchor(): void {
  if (!isVirtual.value) return;
  const el = viewport.value;
  if (el === undefined) return;
  const offset = el.scrollTop;
  let index = virtualizer.value.getVirtualItemForOffset(offset)?.index ?? 0;
  const list = rows.value;
  // 跨过沿的第一行若是分隔条就往下走：锚点要落在不会被合并挪走的东西上
  while (index < list.length && list[index]?.type !== 'message') index += 1;
  const row = list[index];
  if (row?.type !== 'message' || row.message === undefined) return;
  const start = virtualizer.value.getOffsetForIndex(index)?.[0];
  if (start === undefined) return;
  topAnchor = { id: row.message.id, offset: start - offset };
}

/**
 * 前插落地后把快照那条消息放回原来的视觉位置。
 *
 * 写的是**绝对目标**（`start - offset`）而不是增量，所以与虚拟器自己的按键锚定天然不叠加：
 * 它补到位了这里就落在同一个值上，差 ≤1px 直接不写。
 * 锚点行不在新表里（切会话、被合并掉）时一律不动视窗 —— 猜一个位置比不补更糟。
 */
function restoreTopAnchor(): void {
  const anchor = topAnchor;
  topAnchor = undefined;
  const el = viewport.value;
  if (anchor === undefined || el === undefined || !isVirtual.value) return;
  const index = rows.value.findIndex(
    (row) => row.type === 'message' && row.message?.id === anchor.id,
  );
  if (index === -1) return;
  const start = virtualizer.value.getOffsetForIndex(index)?.[0];
  if (start === undefined) return;
  const target = start - anchor.offset;
  if (Math.abs(target - el.scrollTop) <= 1) return;
  el.scrollTop = target;
}

onMounted(() => {
  const el = findViewport();
  viewport.value = el;
  el?.addEventListener('scroll', onViewportScroll, { passive: true });
  // 首帧滚到底：打开面板看到的是最新消息，而不是半年前的一页
  if (isVirtual.value) void nextTick(() => settleToEnd());
  else scrollToEnd();
});

onBeforeUnmount(() => {
  cancelSettle();
  viewport.value?.removeEventListener('scroll', onViewportScroll);
  viewport.value = undefined;
});

/**
 * 视窗只跟三件事有关：追加（贴底才跟随）、前插（不许跳）、整表换掉（当新会话打开）。
 * 原地更新（状态、撤回）一律不进这里，否则一条 ack 就把用户从历史里拽回底部。
 */
watch(
  () => props.messages,
  (next, previous) => {
    const before = previous ?? [];
    const change = classifyChange(next, before);
    // 视窗上方多出行 = 前插。虚拟模式**不看 `classifyChange`**：用户上翻时对方发了消息，
    // 同一次 flush 里"前插一页 + 追加一条"会被判成 append，可视窗上方照样多了 30 行 ——
    // 只在 append 分支补，就成了"翻页成功但整屏被顶走"。
    const headGrew =
      next.length > before.length && next[0]?.id !== before[0]?.id;
    if (headGrew && isVirtual.value) {
      if (topAnchor !== undefined) void nextTick(restoreTopAnchor);
    } else if (change === 'prepend') {
      // 快照必须在 DOM 更新前取：这个 watcher 是 pre-flush 的，正好站在"旧高度还在"那一侧
      if (!isVirtual.value && viewport.value !== undefined) {
        prependSnapshot = {
          height: viewport.value.scrollHeight,
          top: viewport.value.scrollTop,
        };
      }
    } else if (change === 'replace') {
      // 切会话等于重新打开面板：贴底状态归位，视窗回到最新消息
      stickToBottom.value = true;
    }

    if (change === 'append' || change === 'replace') {
      // 用户上滑看历史时，新消息不许把视窗抢回底部
      if (!stickToBottom.value) return;
      void nextTick(() => (isVirtual.value ? settleToEnd() : scrollToEnd()));
      return;
    }
    if (prependSnapshot !== undefined) void nextTick(applyPrependCompensation);
  },
);

// 跨过阈值那一次坐标系整个换掉（行为边界见文件头注释第 4 条）：贴底就回到底部，
// 正在上翻则保持当前 scrollTop，等下一次滚动事件把贴底状态纠正回来。
watch(isVirtual, (virtual, before) => {
  if (virtual === before) return;
  if (!virtual) {
    if (stickToBottom.value) void nextTick(scrollToEnd);
    return;
  }
  void nextTick(() => {
    if (stickToBottom.value) settleToEnd();
  });
});

// 容器尺寸变化要重算：虚拟器自己会盯滚动容器的矩形，这里再补一层是因为宿主常把面板塞进
// 可拖拽的分栏里 —— 尺寸一变，行高缓存与贴底得一起归位。
const viewportBox = useElementSize(viewport);
watch(
  () => viewportBox.height,
  () => {
    if (!isVirtual.value) return;
    void nextTick(() => {
      virtualizer.value.measure();
      if (stickToBottom.value) settleToEnd(1);
    });
  },
);

/**
 * 贴底时"底"自己会动，动一次就再钉一次。
 *
 * 首帧那次追底只能贴到**当时**的底：行高要从估算收敛到实测，而收敛是分帧发生的 ——
 * 视窗钉在旧底 → 底部附近的行进入渲染 → 实测比估算高 → 总高继续涨 → 旧的 scrollTop
 * 就成了"差一截"。真浏览器里实测停在离底 190px（约两条消息）不动了：最新消息被压在视线外，
 * 而滚动条看起来到底了 —— 用户只会认为"这列表坏了"，最难复现的正是这种"差一点"。
 *
 * 判据用 `totalSize` 而不是把帧预算调大：帧数是猜的，总高是算出来的。
 *
 * 两道闸，缺一不可：
 * 1. `stickToBottom` —— 用户一上滑，`onViewportScroll` 就把它关掉，这里就彻底不碰视窗。
 *    它是"用户最后一次观察到的意图"，几何量替代不了：翻页时前插的 30 行全在视窗上方，
 *    距离恰好等于涨幅，只看几何会把"用户自己滚上去"误读成"底自己走了"（真浏览器里踩过：
 *    一把拖到顶、页面回来，整屏被拽回最新消息）。
 * 2. `distance <= 涨幅 + 容差` —— 旗标由 scroll 事件维护，而事件异步且会被浏览器合并，
 *    单靠它会在"底确实动了"和"用户也动了"之间误判；再量一次现场距离把它收紧成
 *    "只有这次长出来的那一截挡在底下"。
 *
 * 两条同时成立才钉：底收敛（钉）、新消息到达（另有 watcher 管）、上翻翻页（旗标已关，
 * 位置由 `restoreTopAnchor` 那条路负责，这里不掺和）。
 */
watch(
  totalSize,
  (size, previous) => {
    if (!isVirtual.value || !stickToBottom.value) return;
    const el = viewport.value;
    if (el === undefined) return;
    const growth = size - (previous ?? 0);
    if (growth <= 0) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (
      distance >
      growth + (props.bottomThreshold ?? MESSAGE_BOTTOM_TOLERANCE_PX)
    )
      return;
    settleToEnd(1);
  },
  // post：钉底部要读的是新 DOM 的 scrollHeight，pre-flush 时容器高度还没写下去
  { flush: 'post' },
);
</script>

<template>
  <div
    ref="root"
    :class="cn('relative flex min-h-0 w-full flex-col', props.class)"
    data-slot="im-message-pane"
  >
    <!--
      「正在加载更早的消息」刻意放在滚动容器之外：它一旦挂在虚拟容器上方，出现或消失就会移动
      虚拟容器的原点，翻页时整列表跟着跳一格 —— 正是"上翻不跳位"要防的那类问题。
    -->
    <p
      v-if="props.loadingHistory && rows.length > 0"
      class="px-3 py-1 text-center text-muted-foreground text-xs"
      data-history-loading
    >
      正在加载更早的消息…
    </p>
    <ScrollArea class="min-h-0 flex-1" viewport-class="outline-none">
      <div
        v-if="rows.length === 0"
        class="p-6 text-center text-muted-foreground text-sm"
      >
        {{ props.emptyText ?? '还没有消息' }}
      </div>
      <div
        v-else
        :class="
          cn(
            'min-w-0',
            isVirtual ? 'relative' : 'flex flex-col gap-3 px-3 py-4',
          )
        "
        :data-message-list="isVirtual ? 'virtual' : 'static'"
        :data-total-size="isVirtual ? totalSize : undefined"
        :style="listStyle"
      >
        <div
          v-for="entry in visibleRows"
          :key="entry.entryKey"
          :ref="measureRow"
          :class="cn(rowClass(entry))"
          :data-index="entry.start === undefined ? undefined : entry.index"
          :style="rowStyle(entry)"
        >
          <Marker v-if="entry.row.type === 'day'" variant="separator">
            <MarkerContent>{{ entry.row.label }}</MarkerContent>
          </Marker>
          <template v-else-if="entry.row.message">
            <!-- 系统消息居中：它既不是自己发的也不是对方发的，站左右任何一边都会读成对话 -->
            <p
              v-if="entry.row.message.kind === 'system'"
              :data-message-id="entry.row.message.id"
              class="text-center text-muted-foreground text-xs"
              data-message-kind="system"
            >
              {{ textOf(entry.row.message) }}
            </p>
            <Message
              v-else
              :align="isOwn(entry.row.message) ? 'end' : 'start'"
              :data-message-id="entry.row.message.id"
              :data-own="isOwn(entry.row.message) ? 'true' : 'false'"
            >
              <MessageAvatar v-if="!isOwn(entry.row.message)">
                <Avatar class="size-8">
                  <AvatarImage
                    v-if="hasAvatar(entry.row.message)"
                    :src="avatarSrc(entry.row.message)"
                  />
                  <AvatarFallback>
                    {{ displayName(entry.row.message.senderId).slice(0, 1) }}
                  </AvatarFallback>
                </Avatar>
              </MessageAvatar>
              <MessageContent>
                <MessageFooter v-if="!isOwn(entry.row.message)">
                  <span data-sender-name>{{
                    displayName(entry.row.message.senderId)
                  }}</span>
                </MessageFooter>
                <div
                  v-if="entry.row.message.replyTo !== undefined"
                  class="border-border text-muted-foreground border-l-2 pl-2 text-xs"
                  data-reply-preview
                >
                  {{
                    entry.row.message.replyTo.text ??
                    entry.row.message.replyTo.body ??
                    '引用消息'
                  }}
                </div>
                <Bubble
                  :align="isOwn(entry.row.message) ? 'end' : 'start'"
                  :variant="isOwn(entry.row.message) ? 'default' : 'muted'"
                >
                  <BubbleContent>
                    <template
                      v-if="segmentsOf(entry.row.message) !== undefined"
                    >
                      <span
                        v-for="(segment, index) in segmentsOf(
                          entry.row.message,
                        )"
                        :key="index"
                        :class="
                          segment.type === 'mention'
                            ? 'text-primary font-medium'
                            : ''
                        "
                        :data-segment-type="segment.type"
                        >{{ segment.text }}</span>
                    </template>
                    <template v-else>{{ textOf(entry.row.message) }}</template>
                    <slot
                      v-if="attachmentsOf(entry.row.message).length > 0"
                      :attachment="attachmentsOf(entry.row.message)[0]"
                      :attachments="attachmentsOf(entry.row.message)"
                      :message="entry.row.message"
                      name="attachment"
                    >
                      <!-- 兜底渲染：宿主没接附件区时至少看得见文件名，图片预览要宿主给 createObjectUrl -->
                      <AttachmentGroup>
                        <AttachmentCard
                          v-for="attachment in attachmentsOf(entry.row.message)"
                          :key="attachment.name"
                          :data-attachment-name="attachment.name"
                        >
                          <AttachmentMedia>
                            <IconifyIcon
                              :icon="
                                attachment.url === undefined
                                  ? 'lucide:file'
                                  : 'lucide:image'
                              "
                            />
                          </AttachmentMedia>
                          <AttachmentContent>
                            <AttachmentTitle>
{{
                              attachment.name
                            }}
</AttachmentTitle>
                            <AttachmentDescription>
{{
                              attachment.type ?? '文件'
                            }}
</AttachmentDescription>
                          </AttachmentContent>
                          <Button
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                            @click="
                              emit(
                                'openAttachment',
                                attachment,
                                entry.row.message,
                              )
                            "
                          >
                            <IconifyIcon icon="lucide:download" />
                            <span class="sr-only">下载附件</span>
                          </Button>
                        </AttachmentCard>
                      </AttachmentGroup>
                    </slot>
                  </BubbleContent>
                </Bubble>
                <MessageFooter>
                  <span class="text-muted-foreground tabular-nums">
                    {{ formatClock(entry.row.message.createdAt) }}
                  </span>
                  <span
                    v-if="
                      isOwn(entry.row.message) &&
                      entry.row.message.status !== undefined
                    "
                    :class="
                      entry.row.message.status === 'failed'
                        ? 'text-destructive'
                        : ''
                    "
                    :data-message-status="entry.row.message.status"
                  >
                    <IconifyIcon
                      :icon="STATUS_ICON[entry.row.message.status]"
                    />
                    <span>{{ STATUS_TEXT[entry.row.message.status] }}</span>
                  </span>
                  <Button
                    v-if="
                      isOwn(entry.row.message) &&
                      entry.row.message.status === 'failed'
                    "
                    :data-message-id="entry.row.message.id"
                    data-action="retry"
                    size="xs"
                    type="button"
                    variant="outline"
                    @click="emit('retry', entry.row.message)"
                  >
                    重发
                  </Button>
                  <!-- 系统消息不给撤回：它在上面 `kind === 'system'` 那一支就已经走出这个分支了 -->
                  <Button
                    v-if="isOwn(entry.row.message)"
                    data-action="recall"
                    size="xs"
                    type="button"
                    variant="ghost"
                    @click="emit('recall', entry.row.message)"
                  >
                    撤回
                  </Button>
                  <slot
                    name="message-actions"
                    :message="entry.row.message"
                  ></slot>
                </MessageFooter>
              </MessageContent>
            </Message>
          </template>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
