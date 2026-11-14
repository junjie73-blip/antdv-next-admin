import type { MentionMember } from '../../src/im/index';

import { describe, expect, it } from 'vitest';

import {
  applyMention,
  detectMentionTrigger,
  extractMentions,
  highlightSegments,
  MENTION_QUERY_MAX,
} from '../../src/im/index';

/**
 * 测试口径：@ 这件事的失败形态全是"打扰"，而且都是很难靠肉眼回归的。
 *
 * 三条最容易写错、因此专门测的规则（`core/mention.ts` 头注释里也列了）：
 * 1. **句首的 @** 必须算触发 —— 少了 `i === 0` 那一支，第一条提及就永远选不出来；
 * 2. **带空格 / 中文的昵称**走最长匹配 —— 否则「@王 小 二」只命中「王」，剩下半截变普通文本；
 * 3. **@ 后紧跟非分隔符**不算命中 —— 「@李雷刚」里高亮「李雷」等于凭空 @ 了一个不存在的人。
 *
 * 选人面板属于宿主，所以这里只测"该不该弹、弹了之后文本怎么改"，不测任何 UI。
 */

const MEMBERS: MentionMember[] = [
  { id: 'u1', name: '李雷' },
  { id: 'u2', name: '王 小 二' },
  { id: 'u3', name: '韩梅梅' },
];

/** 把切分结果拼回原文，用来验证"渲染时少字符"这类错位 */
function joinSegments(segments: ReturnType<typeof highlightSegments>): string {
  return segments.map((segment) => segment.text).join('');
}

describe('触发判定', () => {
  it('句首的 @ 也算触发：naive 实现会把它判成"前面没字符所以不在词边界"', () => {
    expect(detectMentionTrigger('@李雷 帮我看下', 2)).toStrictEqual({
      active: true,
      query: '李',
      start: 0,
    });
    expect(detectMentionTrigger('@', 1)).toStrictEqual({
      active: true,
      query: '',
      start: 0,
    });
  });

  it('中文与标点之后都算词边界，只有邮箱那种 ASCII 前缀不算提及', () => {
    // 中文句子不会留空格：这条判错就是"输入法里 @ 永远弹不出面板"
    expect(detectMentionTrigger('你好@', 3).active).toBe(true);
    expect(detectMentionTrigger('（@', 2).active).toBe(true);
    expect(detectMentionTrigger('me@example', 10).active).toBe(false);
    expect(detectMentionTrigger('没有 at 符号', 5)).toStrictEqual({
      active: false,
      query: '',
      start: -1,
    });
  });

  it('过滤串中间允许空格、结尾不许：昵称本身带空格时"遇空格就收起"会永远选不到那个人', () => {
    expect(detectMentionTrigger('@王 小', 4)).toStrictEqual({
      active: true,
      query: '王 小',
      start: 0,
    });
    expect(detectMentionTrigger('@王 小 ', 5).active).toBe(false);
    // 换行说明这个 @ 已经打完并且要开始说正文了
    expect(detectMentionTrigger('@王 小\n继续打字', 5).active).toBe(false);
  });

  it(`过滤串超过 ${MENTION_QUERY_MAX} 字就不再挂面板：那说明 @ 只是正文里的字符，继续弹只会碍事`, () => {
    const long = `@${'问'.repeat(MENTION_QUERY_MAX)}`;
    expect(detectMentionTrigger(long, long.length).active).toBe(true);
    const longer = `@${'问'.repeat(MENTION_QUERY_MAX + 1)}`;
    expect(detectMentionTrigger(longer, longer.length).active).toBe(false);
  });

  it('光标越界与负数都按字符串边界夹住：输入法合成期间 textarea 会给出离谱的 selectionStart', () => {
    const text = '@李雷';
    expect(detectMentionTrigger(text, text.length + 50)).toStrictEqual({
      active: true,
      query: '李雷',
      start: 0,
    });
    expect(detectMentionTrigger(text, -1).active).toBe(false);
    expect(() => detectMentionTrigger('', 0)).not.toThrow();
  });

  it('已打完名字并接了标点时收起面板，并给出 @ 的下标：位置差一格就会留下半个 @ 或多删一个字', () => {
    const text = '麻烦 @韩梅梅 看一下，谢谢';
    const state = detectMentionTrigger(text, 7);
    expect(state).toStrictEqual({ active: true, query: '韩梅梅', start: 3 });
    expect(text.slice(state.start, state.start + 1 + state.query.length)).toBe(
      '@韩梅梅',
    );
    // 光标越过名字后面那个空格就不该再挂着面板：名字已经打完了
    expect(detectMentionTrigger(text, 8).active).toBe(false);
    // 只打了一半时 query 就是那半截，宿主的候选人列表按它过滤
    expect(detectMentionTrigger(text, 5)).toStrictEqual({
      active: true,
      query: '韩',
      start: 3,
    });
  });
});

describe('选中成员后写回文本', () => {
  it('替换掉 @ 到过滤串这一段并补一个空格，尾部原文保留：不补空格就没法连着 @ 第二个人', () => {
    const text = '麻烦 @韩看一下，谢谢';
    const state = detectMentionTrigger(text, 5);
    expect(applyMention(text, state, '韩梅梅')).toBe(
      '麻烦 @韩梅梅 看一下，谢谢',
    );
  });

  it('非激活状态下原样返回：面板已经收起了还改文本，就是把用户已打的字吃掉', () => {
    const text = 'me@example';
    expect(
      applyMention(text, detectMentionTrigger(text, text.length), '李雷'),
    ).toBe(text);
  });

  it('连续两次 @ 的位置基于第一次结果重算，两次都插对：一次性算下标会串位', () => {
    let text = '@';
    text = applyMention(text, detectMentionTrigger(text, 1), '李雷');
    text = `${text}@`;
    text = applyMention(
      text,
      detectMentionTrigger(text, text.length),
      '王 小 二',
    );
    expect(text).toBe('@李雷 @王 小 二 ');
    expect(extractMentions(text, MEMBERS)).toStrictEqual(['u1', 'u2']);
  });

  it('光标在中间时只替换 @ 到光标，光标后的原文不动：整段替换会把后半句删掉', () => {
    const text = '@李后面还有一句';
    const state = detectMentionTrigger(text, 2);
    expect(applyMention(text, state, '李雷')).toBe('@李雷 后面还有一句');
  });
});

describe('高亮切分与提及提取', () => {
  it('最长匹配优先：`@王 小 二 你好` 命中「王 小 二」而不是「王」', () => {
    const segments = highlightSegments('@王 小 二 你好', MEMBERS);
    expect(segments).toStrictEqual([
      {
        memberId: 'u2',
        memberName: '王 小 二',
        text: '@王 小 二',
        type: 'mention',
      },
      { text: ' 你好', type: 'text' },
    ]);
  });

  it('@ 后名字还没打完（紧跟非分隔符）时不算命中：半截名字会高亮出一个不存在的人', () => {
    expect(highlightSegments('@李雷刚 在吗', MEMBERS)).toStrictEqual([
      { text: '@李雷刚 在吗', type: 'text' },
    ]);
    expect(extractMentions('@李雷刚 在吗', MEMBERS)).toStrictEqual([]);
  });

  it('句首、标点后、句中多处提及都能识别，邮箱里的 @ 不动', () => {
    const segments = highlightSegments(
      '@李雷 和 @韩梅梅，谢谢；抄送 me@li.com',
      MEMBERS,
    );
    expect(
      segments.filter((segment) => segment.type === 'mention'),
    ).toStrictEqual([
      { memberId: 'u1', memberName: '李雷', text: '@李雷', type: 'mention' },
      {
        memberId: 'u3',
        memberName: '韩梅梅',
        text: '@韩梅梅',
        type: 'mention',
      },
    ]);
    expect(joinSegments(segments)).toBe(
      '@李雷 和 @韩梅梅，谢谢；抄送 me@li.com',
    );
  });

  it('普通文本段与提及段拼回去必须等于原文：少一个字符就会在渲染时错位', () => {
    for (const text of [
      '@李雷',
      '你好 @李雷',
      '@李雷@韩梅梅',
      '没有提及',
      '@@李雷',
      '@王 小 二',
    ]) {
      const joined = highlightSegments(text, MEMBERS)
        .map((segment) => segment.text)
        .join('');
      expect(joined, text).toBe(text);
    }
  });

  it('同一个人 @ 两次只算一次提及：服务端只需要知道通知谁，重复会发两条推送', () => {
    expect(extractMentions('@李雷 还有 @李雷 看这里', MEMBERS)).toStrictEqual([
      'u1',
    ]);
    // 顺序按出现次序，不是按成员表顺序：通知列表要贴合上下文
    expect(extractMentions('@韩梅梅 和 @李雷', MEMBERS)).toStrictEqual([
      'u3',
      'u1',
    ]);
  });

  it('重名成员只认第一个 id：把两个同名的人合并成一条 @ 就会通知错人', () => {
    const duplicated: MentionMember[] = [
      { id: 'first', name: '张三' },
      { id: 'second', name: '张三' },
    ];
    expect(extractMentions('@张三 在吗', duplicated)).toStrictEqual(['first']);
  });

  it('成员表里没有的名字一律当普通文本：宁可少算一次提及，也不凭空高亮出一段假名字', () => {
    expect(highlightSegments('@赵四 你好', MEMBERS)).toStrictEqual([
      { text: '@赵四 你好', type: 'text' },
    ]);
    expect(extractMentions('@赵四 你好', MEMBERS)).toStrictEqual([]);
  });

  it('空成员表与全空名字都不高亮：没有依据的染色比不染色更糟', () => {
    expect(highlightSegments('@李雷', [])).toStrictEqual([
      { text: '@李雷', type: 'text' },
    ]);
    expect(extractMentions('@李雷', [{ id: 'u1', name: '  ' }])).toStrictEqual(
      [],
    );
  });
});
