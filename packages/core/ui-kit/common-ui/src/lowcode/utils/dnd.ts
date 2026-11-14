/**
 * 原生拖放（HTML5 DnD）的载荷编解码。
 *
 * 分层位置：`utils/`，服务 `LowCodePalette`（拖出物料）与 `LowCodeOutline`（落点）。
 *
 * 为什么用原生 DnD 而不是拖拽库：本包允许的依赖里虽然有 `vue-draggable-plus`，
 * 但它背后是 SortableJS，擅长「列表内排序」，不擅长「从面板拖进另一棵树」，
 * 而搭建器要的正是后者；原生 `dragstart`/`drop` 加上这一小张编解码表就够了，
 * 少一个运行时依赖也让大纲的键盘可达性不用去迁就库的手势实现。
 *
 * 本文件**不做**的事：不做拖拽动画、不算落点矩形（那是大纲按行自己判的）、
 * 不直接读 `event.target`（只吃最小形状，方便单测传一个假对象）。
 */

/** 载荷 MIME：自定义类型读不到时还会兜一次 `text/plain`，Safari 对自定义类型有限制 */
export const LOWCODE_DND_MIME = 'application/x-antdv-lowcode';

/** 拖拽载体：`DataTransfer` 的最小可用子集，jsdom 里没有 DataTransfer，单测传等价对象即可 */
export interface DndCarrier {
  dataTransfer?: null | {
    getData: (format: string) => string;
    setData: (format: string, data: string) => void;
  };
}

/** 从物料面板拖出来的（还没有节点），或者从大纲里拖出来的（已有节点） */
export type DndPayload =
  | { kind: 'material'; type: string }
  | { kind: 'node'; nodeId: string };

function encode(payload: DndPayload): string {
  return JSON.stringify(payload);
}

/**
 * 写入载荷。
 * 同时写两份格式：自定义 MIME 给同页的接收方（可靠、不会被别的拖拽源污染），
 * `text/plain` 给需要跨窗口/浏览器的兜底读法。
 */
export function writeDndData(carrier: DndCarrier, payload: DndPayload): void {
  const transfer = carrier.dataTransfer;
  if (!transfer) return;
  transfer.setData(LOWCODE_DND_MIME, encode(payload));
  transfer.setData('text/plain', encode(payload));
}

function parse(text: string): DndPayload | undefined {
  if (!text.trim()) return undefined;
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (raw?.kind === 'material' && typeof raw.type === 'string')
      return { kind: 'material', type: raw.type };
    if (raw?.kind === 'node' && typeof raw.nodeId === 'string')
      return { kind: 'node', nodeId: raw.nodeId };
    return undefined;
  } catch {
    // 拖进来的可能是别的页面的普通文本：不是我们的载荷就当没有，不要让页面因为一次误拖崩掉
    return undefined;
  }
}

/** 读取载荷；解析失败返回 `undefined`，由调用方决定是忽略还是提示 */
export function readDndPayload(carrier: DndCarrier): DndPayload | undefined {
  const transfer = carrier.dataTransfer;
  if (!transfer) return undefined;
  return (
    parse(transfer.getData(LOWCODE_DND_MIME)) ??
    parse(transfer.getData('text/plain'))
  );
}
