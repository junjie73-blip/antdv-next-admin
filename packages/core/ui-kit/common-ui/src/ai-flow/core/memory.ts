import type { AiMessage, AiMessageRole } from './types';

import { errorText } from './errors';

/**
 * 会话记忆的窗口化。
 *
 * 分层位置：`core/memory.ts`，纯 TS，不 import vue，也不持有任何跨进程状态。
 *
 * **预算口径是字符（`maxChars`），不是 token。** 原因很实在：本包不绑供应商，
 * 没有 tokenizer 就没有可信的 token 数，而各家 BPE 的差异在中文上能到 3 倍。
 * 这里的换算写清楚供宿主换算：英文约 4 字符/token，中文约 1.5 字符/token，
 * 混合文本按 2 估 —— `estimateTokens` 就是这个口径，想精确请宿主注一个自己的计数器进来
 * 直接把 `maxChars` 当 token 预算传也一样成立（把换算系数当 1 用）。
 *
 * 这里**不做**的事：不做向量召回、不做「重要记忆永久保留」这类分层存储。
 * 超窗只做两件事：把被裁掉的轮次压成一条摘要、把最近若干轮留在窗口里。
 */

export interface MemoryTurn {
  at?: number;
  content: string;
  role: AiMessageRole;
}

/** 一条消息的固定开销（角色标记与分隔符），让预算不至于差在框架上 */
const FRAMING_CHARS = 8;

export function turnChars(turn: MemoryTurn): number {
  return (turn.content ?? '').length + FRAMING_CHARS;
}

export function totalChars(turns: readonly MemoryTurn[]): number {
  return turns.reduce((sum, turn) => sum + turnChars(turn), 0);
}

/** 粗略 token 估算：中英混合按 2 字符/token，向上取整 —— 宁可少给也别超上下文 */
export function estimateTokens(turns: readonly MemoryTurn[]): number {
  return Math.ceil(totalChars(turns) / 2);
}

export interface WindowOptions {
  maxChars: number;
  /** 允许单条消息自己超预算时保留它（缺省 true：裁掉最新一条等于丢答案） */
  keepLatest?: boolean;
}

export interface WindowResult {
  chars: number;
  dropped: MemoryTurn[];
  kept: MemoryTurn[];
}

/**
 * 从后往前取满预算为止。
 * 返回值是新数组而不是原地截断：调用方多数是响应式的，改原数组会惊动一份不该动的历史。
 */
export function selectWindow(
  turns: readonly MemoryTurn[],
  options: WindowOptions,
): WindowResult {
  const maxChars = Math.max(0, Math.trunc(options.maxChars));
  const keepLatest = options.keepLatest ?? true;
  const kept: MemoryTurn[] = [];
  let chars = 0;

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]!;
    const cost = turnChars(turn);
    if (chars + cost > maxChars) {
      // 最新一条即便超预算也留下：裁掉它意味着这一轮问答根本进不了上下文
      if (kept.length === 0 && keepLatest) {
        kept.unshift(turn);
        chars += cost;
      }
      break;
    }
    kept.unshift(turn);
    chars += cost;
  }

  const keptIds = new Set(kept);
  return {
    chars,
    dropped: turns.filter((turn) => !keptIds.has(turn)),
    kept,
  };
}

/** 默认摘要器：不接大模型，纯拼接。宿主想让它真的「总结」，注一个调 llm 的实现进来即可 */
export function defaultSummarize(
  turns: readonly MemoryTurn[],
  carryover?: string,
): MemoryTurn {
  const lines = turns.map((turn) => `${turn.role}: ${firstLine(turn.content)}`);
  const head = carryover ? `${carryover} ` : '';
  return {
    content:
      `${head}【历史摘要 · ${turns.length} 轮】${lines.join(' / ')}`.slice(
        0,
        600,
      ),
    role: 'system',
  };
}

function firstLine(content: string): string {
  const line = (content ?? '').split('\n')[0]?.trim() ?? '';
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

/** 新摘要还没生成前先按这个额度给它留位，避免「摘要挤掉正文、正文又生成更长的摘要」的振荡 */
const SUMMARY_RESERVE = 120;

export interface AppendOptions extends WindowOptions {
  summarize?: (
    dropped: readonly MemoryTurn[],
    carryover?: string,
  ) => MemoryTurn | undefined;
}

/**
 * 追加一轮并顺手裁窗。
 *
 * 顺序是「先落摘要、再裁旧轮」：反过来做就会有一段历史既不在窗口里也没进摘要，
 * 模型会一脸正经地否认你们聊过 —— 这种丢法比超上下文难查得多。
 * 已有的摘要（首条 system）会被并进新摘要的 carryover，不会滚成两条摘要。
 */
export function appendTurn(
  turns: readonly MemoryTurn[],
  turn: MemoryTurn,
  options: AppendOptions,
): MemoryTurn[] {
  const previous = [...turns, turn];
  const summaryTurn = previous[0]?.role === 'system' ? previous[0] : undefined;
  const body = summaryTurn ? previous.slice(1) : previous;
  // 摘要自己也要占预算：先给它扣掉额度（没有旧摘要时预留一段），再决定正文能留几轮
  const reserved = summaryTurn ? turnChars(summaryTurn) : SUMMARY_RESERVE;
  const affordable = Math.max(0, options.maxChars - reserved);

  // 没超就原样返回：不生成摘要、不换数组身份，调用方的响应式依赖不会被无谓惊动
  if (totalChars(body) <= affordable) return previous;

  const window = selectWindow(body, { keepLatest: true, maxChars: affordable });
  const summarize = options.summarize ?? defaultSummarize;
  const summary = summarize(window.dropped, summaryTurn?.content);
  return summary ? [summary, ...window.kept] : window.kept;
}

export interface SessionMemoryOptions extends AppendOptions {
  load: () => MemoryTurn[] | Promise<MemoryTurn[]>;
  save: (turns: MemoryTurn[]) => Promise<void> | void;
}

export interface SessionMemory {
  /** 追加一轮；返回写入后的窗口快照 */
  append: (
    role: AiMessageRole,
    content: string,
    at?: number,
  ) => Promise<MemoryTurn[]>;
  appendTurn: (turn: MemoryTurn) => Promise<MemoryTurn[]>;
  clear: () => Promise<void>;
  /** 直接给 provider 用的消息序列 */
  messages: () => AiMessage[];
  /** 等首次 load 完成；未调用过也安全 */
  ready: () => Promise<void>;
  /** 当前窗口（未 load 完时为空数组） */
  turns: () => MemoryTurn[];
}

/**
 * 带持久化的一轮窗口记忆。
 *
 * `load` / `save` 是宿主接自己的会话存储（接口、IndexedDB、Redis 都行）的唯一入口 ——
 * 本包按仓库规矩不许 import 宿主的 `~/api` / `~/stores`，所以内存里绝不假装持久化。
 */
export function createSessionMemory(
  options: SessionMemoryOptions,
): SessionMemory {
  let current: MemoryTurn[] = [];
  let loading: Promise<void> | undefined;

  async function ensureLoaded(): Promise<void> {
    loading ??= (async () => {
      try {
        current = [...(await options.load())];
      } catch (error) {
        // 读历史失败不该让整个流程崩掉：退化成空窗口，但把原因留在控制台上是必须的
        console.warn(
          '[ai-flow] 会话记忆读取失败，按空历史继续：',
          errorText(error),
        );
        current = [];
      }
    })();
    await loading;
  }

  async function appendTurnToMemory(turn: MemoryTurn): Promise<MemoryTurn[]> {
    await ensureLoaded();
    current = appendTurn(current, turn, options);
    await options.save(current.map((item) => ({ ...item })));
    return [...current];
  }

  return {
    append: (role, content, at) => appendTurnToMemory({ at, content, role }),
    appendTurn: appendTurnToMemory,
    clear: async () => {
      current = [];
      await options.save([]);
    },
    messages: () =>
      current.map((turn) => ({ content: turn.content, role: turn.role })),
    ready: ensureLoaded,
    turns: () => [...current],
  };
}
