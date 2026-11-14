/**
 * @ 提及的纯函数层。
 *
 * 分层位置：`core/`，不依赖 vue、不依赖 DOM，也不依赖任何 emoji/成员选择组件 ——
 * 选人 UI 属于宿主，本包只负责"给定文本与成员表，哪些字符是被 @ 的、@ 了谁"。
 *
 * 这一层不做什么：不改文本、不发消息、不判断权限；也不猜"用户是不是想 @ 这个人"，
 * 匹配不上就当普通文本，宁可少算一次提及，也不要在正文里凭空高亮出一段假名字。
 */

/** 参与匹配的最小成员形状；宿主的成员对象字段更多也能直接传 */
export interface MentionMember {
  id: string;
  /** 展示名，匹配用它：IM 里 @ 的就是人看到的字 */
  name: string;
}

export type SegmentType = 'mention' | 'text';

export interface MentionSegment {
  type: SegmentType;
  text: string;
  memberId?: string;
  memberName?: string;
}

/**
 * 过滤串长度上限。
 * 取 32 而不是"跟正文一样长"：一个昵称没人能打到 32 字还没选，
 * 超过它说明那个 `@` 只是正文里的一个字符（比如邮箱），继续挂着面板只会碍事。
 */
export const MENTION_QUERY_MAX = 32;

/** 触发词与姓名之间允许的分隔符（含中文标点：中文句子不会给你留空格） */
const DELIMITER = new Set([
  ' ',
  '\n',
  '\r',
  '\t',
  '，',
  '、',
  '；',
  '：',
  '！',
  '？',
  '。',
  '"',
  "'",
  '(',
  '（',
  ')',
  '）',
  '[',
  ']',
]);

/** 名字里允许出现的字符（CJK、字母数字下划线、连字符、空格）——用于判定"名字后面是不是还有字" */
function isNameChar(char: string): boolean {
  return !DELIMITER.has(char);
}

/** 英文/数字形态的"词内字符"：只有它会让人怀疑这是邮箱而不是提及 */
const ASCII_WORD_CHAR = /[A-Za-z0-9_]/;

/**
 * `@` 处是否算词边界（能触发提及的形状）。
 *
 * 判据只排除一种情况：**前一个字符是 ASCII 字母 / 数字**（`me@example`、`13800138000@163.com`）。
 * 早先的写法是"前面必须是空白或标点"，那条在中文里直接失效 ——
 * 中文句子不会给你留空格，`麻烦@张三 看一下` 的 `@` 前面是汉字，
 * 于是输入法打出的 @ 永远弹不出选人面板（渲染侧同样认不出，@ 完人也没有高亮）。
 * 反过来，CJK / 标点 / 另一个 `@` / 句首 都不像邮箱，应当放行。
 */
function isMentionBoundary(text: string, at: number): boolean {
  if (at === 0) return true;
  return !ASCII_WORD_CHAR.test(text[at - 1]!);
}

/**
 * 切出文本片段。
 *
 * 三条容易写错、所以专门测的规则：
 * 1. **句首与中文后的 @** 都算触发（`i === 0` 时前面没有字符，而中文句子不给空格，
 *    只认"前面是空白/标点"会让 `麻烦@张三` 认不出来，见 `isMentionBoundary`）；
 * 2. **带空格 / 中文的昵称**用最长匹配，`@王 小 二 你好` 命中成员「王 小 二」而不是「王」；
 * 3. **@ 后紧跟非分隔符**（`@李雷刚` 里其实没有「李雷」这个人）不算命中，避免半截名字。
 */
export function highlightSegments(
  text: string,
  members: readonly MentionMember[],
): MentionSegment[] {
  const names = uniqueNames(members);
  const segments: MentionSegment[] = [];
  let bufferStart = 0;
  let index = 0;

  const pushText = (end: number) => {
    if (end > bufferStart)
      segments.push({ text: text.slice(bufferStart, end), type: 'text' });
  };

  while (index < text.length) {
    const char = text[index]!;
    if (char !== '@') {
      index += 1;
      continue;
    }
    // 词边界：见 `isMentionBoundary` —— 只有前面是 ASCII 字母数字（邮箱形状）才跳过
    if (!isMentionBoundary(text, index)) {
      index += 1;
      continue;
    }
    const rest = text.slice(index + 1);
    const matched = longestMatch(rest, names);
    if (matched === undefined) {
      index += 1;
      continue;
    }
    // 命中后必须紧跟分隔符或到串尾，否则是"@李雷刚"这种半截名字
    const after = text[index + 1 + matched.name.length];
    if (after !== undefined && isNameChar(after)) {
      index += 1;
      continue;
    }
    pushText(index);
    segments.push({
      memberId: matched.id,
      memberName: matched.name,
      text: text.slice(index, index + 1 + matched.name.length),
      type: 'mention',
    });
    index += 1 + matched.name.length;
    bufferStart = index;
  }
  pushText(text.length);
  return segments;
}

/** 被 @ 的成员 id（去重、按出现顺序）；同一个人 @ 两次只算一次，服务端只需知道"通知谁" */
export function extractMentions(
  text: string,
  members: readonly MentionMember[],
): string[] {
  return [
    ...new Set(
      highlightSegments(text, members)
        .filter((segment) => segment.type === 'mention')
        .map((segment) => segment.memberId ?? ''),
    ),
  ].filter((id) => id !== '');
}

export interface MentionTriggerState {
  active: boolean;
  /** `@` 与光标之间的过滤串，喂给宿主的候选人列表 */
  query: string;
  /** 触发用的 `@` 下标；宿主选定成员后据此替换文本 */
  start: number;
}

/**
 * 从"当前输入 + 光标位置"判断是否处于 @ 输入态。
 *
 * 只在 `@` 之后到光标之间没有分隔符时算激活 —— 用户已经打完名字继续敲字时，
 * 选择面板该收起来了，否则会在每次输入时重新弹出。
 */
export function detectMentionTrigger(
  text: string,
  caret: number,
): MentionTriggerState {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const start = before.lastIndexOf('@');
  if (start === -1) return { active: false, query: '', start: -1 };
  // 与 `highlightSegments` 同一个判据：输入法里 `你好@` 必须能弹面板，
  // `me@example` 必须不能 —— 两处规则不一致时，"打得出来但渲染不认"就是最常见的抱怨。
  if (!isMentionBoundary(before, start)) {
    return { active: false, query: '', start: -1 };
  }
  const query = before.slice(start + 1);
  // 允许 query 中间有空格：成员昵称本身就带空格时（「王 小 二」），
  // 按"遇到空格就收起"会永远选不到这类人；只有**结尾**是分隔符才说明这个 @ 已经打完了。
  if (query.includes('\n') || query.length > MENTION_QUERY_MAX)
    return { active: false, query: '', start: -1 };
  const last = query.at(-1);
  if (last !== undefined && DELIMITER.has(last))
    return { active: false, query: '', start: -1 };
  return { active: true, query, start };
}

/** 选中成员后写回的文本：替换掉 `@` 到已输入过滤串这一段，并补一个空格方便连续 @ */
export function applyMention(
  text: string,
  state: MentionTriggerState,
  name: string,
): string {
  if (!state.active) return text;
  const end = state.start + 1 + state.query.length;
  return `${text.slice(0, state.start)}@${name} ${text.slice(end)}`;
}

function uniqueNames(members: readonly MentionMember[]): MentionMember[] {
  const seen = new Set<string>();
  const out: MentionMember[] = [];
  for (const member of members) {
    const name = member.name.trim();
    if (name === '' || seen.has(name)) continue;
    seen.add(name);
    out.push({ id: member.id, name });
  }
  // 长的先试：一次遍历里拿到最长匹配，比"每个位置枚举所有成员再取最长"更直观也更好测
  return out.toSorted((a, b) => b.name.length - a.name.length);
}

function longestMatch(
  rest: string,
  members: readonly MentionMember[],
): MentionMember | undefined {
  for (const member of members) {
    if (rest.startsWith(member.name)) return member;
  }
  return undefined;
}
