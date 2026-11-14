/**
 * `@antdv/common-ui/im` —— IM 即时通讯能力。
 *
 * 分层与依赖口径：
 * - `core/*` 是纯 TypeScript 运行时：`types` 是词汇表、`store` 是 reducer、`transport` 是帧流适配、
 *   `use-im` 是状态机。这一层不认识 `@antdv/shadcn-ui`，也不认识 DOM，可以被 Node 侧
 *   （消息校验、离线脚本、服务端回放）直接复用；
 * - `components/*` 只画在 core 的形状上，全部基础控件来自 `@antdv/shadcn-ui`，不引入任何其他 UI 库，
 *   表情面板、上传、虚拟列表都属于宿主插槽或别的包；
 * - **实时通信仍然只住在 `@antdv/request`**：本包只有 `core/transport.ts` 一个文件允许 import 它，
 *   且只调 `useWebSocket`，不 `new WebSocket`（两处各起心跳与重连是线上最难查的那类故障）；
 * - 本包不 import 宿主的 `~/api` / `~/stores` / `~/views` / `~/locales`：需要宿主能力
 *   （当前登录人、附件预览地址、时钟、限额）时走 `configureIm()` 注入。
 */

// ==================== 组件 ====================
export { ConversationList } from './components/ConversationList';

export { ImPanel } from './components/ImPanel';

export { MessageComposer } from './components/MessageComposer';

export { MessagePane } from './components/MessagePane';

// ==================== 宿主注入点 ====================
export {
  type ConfiguredIm,
  configureIm,
  createConfiguredIm,
  type CreateConfiguredImOptions,
  getImRuntime,
  type ImRuntimeConfig,
  type ImRuntimeObjectUrl,
  type ImRuntimePatch,
  resetImRuntime,
} from './config';

// ==================== 附件 / 提及 ====================
export {
  type AttachmentCheck,
  type AttachmentInput,
  type AttachmentRules,
  type BlobLike,
  formatFileSize,
  isAcceptable,
  normalizeAttachment,
  resolvePreviewUrl,
  validateAttachment,
  validateAttachments,
} from './core/attachment';

// ==================== 限额 ====================
export {
  DEFAULT_LIMITS,
  type ImLimits,
  MESSAGE_BOTTOM_SETTLE_FRAMES,
  MESSAGE_BOTTOM_TOLERANCE_PX,
  MESSAGE_LIST_PADDING_PX,
  MESSAGE_OVERSCAN_ROWS,
  MESSAGE_ROW_ESTIMATE_PX,
  MESSAGE_ROW_GAP_PX,
  MESSAGE_VIRTUALIZE_THRESHOLD,
  withLimits,
} from './core/limits';

export {
  applyMention,
  detectMentionTrigger,
  extractMentions,
  highlightSegments,
  MENTION_QUERY_MAX,
  type MentionMember,
  type MentionSegment,
  type MentionTriggerState,
  type SegmentType,
} from './core/mention';

// ==================== 状态层 ====================
export {
  appendOutbox,
  createImStore,
  createInitialState,
  historyCursor,
  type ImSeed,
  type ImState,
  type ImStore,
  markRead,
  mergeMessages,
  type MergeMessagesOptions,
  messagesOf,
  messagesToText,
  type OutboxEntry,
  patchMessage,
  removeConversation,
  removeOutbox,
  renameMessage,
  selectConversationList,
  setUnread,
  sortMessages,
  upsertConversation,
} from './core/store';

// ==================== 传输层 ====================
export {
  createMemoryTransport,
  createSendQueue,
  createSocketTransport,
  decodeFrame,
  encodeFrame,
  type FrameDecodeResult,
  HEARTBEAT_PING,
  type MemoryTransport,
  type MemoryTransportOptions,
  OFFLINE_QUEUE_LIMIT,
  type SendQueue,
  SOCKET_HEARTBEAT,
  SOCKET_RECONNECT,
  type SocketTransport,
  type SocketTransportOptions,
} from './core/transport';
// ==================== 词汇表 ====================
export type {
  AckFramePayload,
  Attachment,
  Conversation,
  ConversationKind,
  FrameByDirection,
  HistoryFramePayload,
  ImConnectionStatus,
  ImDirection,
  ImFrame,
  ImFrameOf,
  ImFrameType,
  ImMessage,
  ImTransport,
  ImTransportEvent,
  MessageFramePayload,
  MessageKind,
  MessageStatus,
  Presence,
  PresenceFramePayload,
  ReadFramePayload,
  RecallFramePayload,
  SendFramePayload,
  TypingFramePayload,
} from './core/types';
// ==================== 状态机 ====================
export {
  FRAME_LOG_LIMIT,
  type ImActionOutcome,
  type ImConnection,
  RECALLED_TEXT,
  type SendMessageInput,
  useIm,
  type UseImOptions,
  type UseImReturn,
} from './core/use-im';
// ==================== 时间口径 ====================
export {
  dayKey,
  formatClock,
  formatDayDivider,
  formatListTime,
} from './utils/time';
