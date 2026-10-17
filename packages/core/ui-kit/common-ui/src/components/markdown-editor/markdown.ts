import type { JSONContent } from '@tiptap/core';

import { marked } from 'marked';

/* ============================================================
 * Markdown ↔ ProseMirror JSON
 *
 * 为什么自研而不是直接用 @tiptap/markdown：本编辑器有两个官方序列化器覆盖不了的结构 ——
 *  1. 自定义 `todo` 节点（扁平块、`checked` 属性，不是 tiptap 的 TaskList）；
 *  2. 块级对齐（`text-align` 是 paragraph / heading 上的全局属性，官方 render 链按节点类型
 *     取第一个 handler，全局属性不参与序列化，也不便覆盖 paragraph 的 handler）。
 * 官方 manager 的注册顺序决定了这两点只能改它内部逻辑，风险高。这里改为：序列化自己走一棵
 * 已知结构，解析复用 marked 的词法结果（内联标记 / 表格 / 嵌套列表由 marked 负责），把官方
 * 没覆盖的 todo 与对齐显式映射回 schema。
 *
 * 覆盖范围（与需求一致）：标题、粗体 / 斜体 / 删除线、行内代码、代码块、引用、有序 / 无序列表、
 * 任务列表、链接、图片、表格、对齐。下划线、字体、颜色、行高、视频是 HTML 专有能力，
 * Markdown 语法无法无损表达，转换时会丢弃 —— 需要用它们时走 getHTML / setHTML。
 * ============================================================ */

/** 对齐值：`left` 与默认一致，序列化时省略以保持 Markdown 干净 */
const ALIGN_RE = /^\s*(center|left|right|justify)\s*$/;

function textAlign(node: JSONContent | undefined): null | string {
  const raw = node?.attrs?.textAlign;
  if (typeof raw !== 'string') return null;
  const matched = ALIGN_RE.exec(raw);
  const value = matched?.[1] ?? null;
  return value && value !== 'left' ? value : null;
}

/* ============================================================
 * 序列化：ProseMirror JSON → Markdown
 * ============================================================ */

/** 转义会破坏行内语法的字符；marked 解析时会把 `\x` 还原成 `x` */
function escapeText(text: string): string {
  return text.replaceAll(/([\\`*_~[\]!])/g, String.raw`\$1`);
}

/** 取一个节点下所有 text 的纯内容（代码块用，不参与 Markdown 转义） */
function extractText(node: JSONContent | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map((child) => extractText(child)).join('');
}

function markAttrs(
  marks: Array<{ attrs?: any; type: string }> | undefined,
  type: string,
): Record<string, any> {
  return marks?.find((m) => m.type === type)?.attrs ?? {};
}

/** 序列化行内节点数组（不含块级包裹） */
function serializeInline(nodes: JSONContent[] | undefined): string {
  if (!nodes?.length) return '';
  return nodes.map((node) => serializeInlineNode(node)).join('');
}

function serializeInlineNode(node: JSONContent): string {
  if (node.type === 'hardBreak') return '\\\n';

  if (node.type === 'image') {
    const { alt, src, title } = node.attrs ?? {};
    const label = alt ?? '';
    const url = src ?? '';
    const titlePart = title
      ? ` "${String(title).replaceAll('"', String.raw`\"`)}"`
      : '';
    return `![${escapeText(label)}](${url}${titlePart})`;
  }

  if (node.type !== 'text') {
    // 其它行内节点（少见）退化为渲染其子内容
    return serializeInline(node.content);
  }

  const marks = node.marks ?? [];
  let out = node.text ?? '';

  if (marks.some((m) => m.type === 'code')) {
    // 行内代码：内容按字面处理，不做 Markdown 转义
    out = `\`${out}\``;
    return wrapMarks(out, marks, true);
  }

  out = escapeText(out);
  return wrapMarks(out, marks, false);
}

/** 依次套上删除线 / 斜体 / 粗体 / 链接（顺序保证嵌套合法，链接在最外层） */
function wrapMarks(
  inner: string,
  marks: Array<{ attrs?: any; type: string }>,
  skipCode: boolean,
): string {
  let out = inner;
  if (marks.some((m) => m.type === 'strike')) out = `~~${out}~~`;
  if (marks.some((m) => m.type === 'italic')) out = `*${out}*`;
  if (marks.some((m) => m.type === 'bold')) out = `**${out}**`;
  if (!skipCode && marks.some((m) => m.type === 'code')) out = `\`${out}\``;

  const link = marks.find((m) => m.type === 'link');
  if (link) {
    const href = markAttrs(marks, 'link').href ?? '';
    out = `[${out}](${href})`;
  }
  return out;
}

/** 空行分隔地把块级数组拼成 Markdown */
function serializeBlocks(nodes: JSONContent[] | undefined): string {
  if (!nodes?.length) return '';
  const parts: string[] = [];
  for (const node of nodes) {
    const rendered = serializeBlock(node);
    if (rendered !== null) parts.push(rendered);
  }
  // 连续 todo 归到同一个列表块里（去掉块间空行），其余块之间留空行
  return collapseConsecutiveTodos(parts).join('\n\n').trim();
}

/**
 * serializeBlock 对每个 todo 只产出一行；块之间默认用空行连接会让连续任务项被
 * 拆成多个松散列表。这里把相邻的 todo 行合并成一块，其余保持原样。
 */
function collapseConsecutiveTodos(parts: string[]): string[] {
  const merged: string[] = [];
  for (const part of parts) {
    const isTodo = /^- \[[ xX]\] /.test(part) && !part.includes('\n\n');
    const prev = merged.at(-1);
    const prevIsTodo =
      prev !== undefined &&
      prev
        .split('\n')
        .every((line) => line === '' || /^- \[[ xX]\] /.test(line)) &&
      prev.trim() !== '';
    if (isTodo && prevIsTodo) merged[merged.length - 1] = `${prev}\n${part}`;
    else merged.push(part);
  }
  return merged;
}

/** 对齐块用 HTML 表达（GFM 允许块级 HTML），其它块用原生 Markdown */
function alignWrap(
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'p',
  node: JSONContent,
  inner: string,
): null | string {
  const align = textAlign(node);
  if (!align) return null;
  return `<${tag} style="text-align: ${align}">${inner}</${tag}>`;
}

function serializeBlock(node: JSONContent): null | string {
  switch (node.type) {
    case 'blockquote': {
      const inner = serializeBlocks(node.content);
      return inner
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    }
    case 'bulletList': {
      return serializeList(node, false, 0);
    }
    case 'codeBlock': {
      const lang = node.attrs?.language ?? '';
      return `\`\`\`${lang}\n${extractText(node)}\n\`\`\``;
    }
    case 'heading': {
      const level = Math.min(Math.max(node.attrs?.level ?? 1, 1), 5);
      const inner = serializeInline(node.content);
      const aligned = alignWrap(`h${level}` as any, node, inner);
      return aligned ?? `${'#'.repeat(level)} ${inner}`;
    }
    case 'horizontalRule': {
      return '---';
    }
    case 'orderedList': {
      return serializeList(node, true, 0);
    }
    case 'paragraph': {
      const inner = serializeInline(node.content);
      return alignWrap('p', node, inner) ?? inner;
    }
    case 'table': {
      return serializeTable(node);
    }
    case 'todo': {
      const inner = serializeInline(node.content);
      return `- [${node.attrs?.checked ? 'x' : ' '}] ${inner}`;
    }
    case 'video': {
      const src = node.attrs?.src ?? '';
      const poster = node.attrs?.poster;
      const posterAttr = poster ? ` poster="${poster}"` : '';
      return `<div data-w-e-type="video"><video controls${posterAttr} src="${src}"></video></div>`;
    }
    default: {
      return node.content ? serializeBlocks(node.content) : null;
    }
  }
}

function serializeList(
  node: JSONContent,
  ordered: boolean,
  depth: number,
): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  let counter = 1;

  for (const item of node.content ?? []) {
    if (item.type !== 'listItem') continue;
    const marker = ordered ? `${counter}. ` : '- ';
    counter += 1;

    const inlineBlocks: string[] = [];
    const nestedLists: JSONContent[] = [];
    for (const child of item.content ?? []) {
      if (child.type === 'paragraph') {
        const text = serializeInline(child.content);
        if (text) inlineBlocks.push(text);
      } else if (child.type === 'bulletList' || child.type === 'orderedList') {
        nestedLists.push(child);
      } else {
        const rendered = serializeBlock(child);
        if (rendered !== null) inlineBlocks.push(rendered);
      }
    }

    lines.push(`${indent}${marker}${inlineBlocks.join(' ')}`);
    for (const nested of nestedLists) {
      lines.push(
        serializeList(nested, nested.type === 'orderedList', depth + 1),
      );
    }
  }

  return lines.join('\n');
}

function serializeTable(node: JSONContent): string {
  const rows = node.content ?? [];
  if (rows.length === 0) return '';

  const cellText = (cell: JSONContent): string => {
    let text = '';
    for (const block of cell.content ?? []) {
      if (block.type === 'paragraph') text += serializeInline(block.content);
    }
    return text.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
  };

  const headerCells = rows[0]?.content ?? [];
  const hasHeader = headerCells.some((cell) => cell.type === 'tableHeader');

  const lines: string[] = [];
  if (hasHeader) {
    lines.push(
      `| ${headerCells.map((cell) => cellText(cell)).join(' | ')} |`,
      `| ${headerCells.map(() => '---').join(' | ')} |`,
    );
    for (let i = 1; i < rows.length; i += 1) {
      const cells = (rows[i]?.content ?? []).map((cell) => cellText(cell));
      lines.push(`| ${cells.join(' | ')} |`);
    }
    return lines.join('\n');
  }

  // 无表头行：用空表头补一列分隔，保证仍是合法 GFM 表格
  lines.push(
    `| ${headerCells.map(() => ' ').join(' | ')} |`,
    `| ${headerCells.map(() => '---').join(' | ')} |`,
  );
  for (const row of rows) {
    const cells = (row.content ?? []).map((cell) => cellText(cell));
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

/* ============================================================
 * 解析：Markdown → ProseMirror JSON（词法复用 marked）
 * ============================================================ */

function textNode(
  text: string,
  marks?: Array<{ attrs?: any; type: string }>,
): JSONContent {
  return marks?.length ? { marks, text, type: 'text' } : { text, type: 'text' };
}

/** 给一段行内节点统一加上某个标记（仅落到 text 节点上） */
function applyMark(
  nodes: JSONContent[],
  type: string,
  attrs?: Record<string, any>,
): JSONContent[] {
  return nodes.map((node) => {
    if (node.type === 'text') {
      return {
        ...node,
        marks: [...(node.marks ?? []), attrs ? { attrs, type } : { type }],
      };
    }
    if (node.content) {
      return { ...node, content: applyMark(node.content, type, attrs) };
    }
    return node;
  });
}

function parseInline(tokens: any[] | undefined): JSONContent[] {
  if (!tokens?.length) return [];
  const out: JSONContent[] = [];
  for (const token of tokens) {
    out.push(...parseInlineToken(token));
  }
  return out;
}

function parseInlineToken(token: any): JSONContent[] {
  switch (token.type) {
    case 'br': {
      return [{ type: 'hardBreak' }];
    }
    case 'codespan': {
      return [textNode(token.text ?? '', [{ type: 'code' }])];
    }
    case 'del': {
      return applyMark(parseInline(token.tokens), 'strike');
    }
    case 'em': {
      return applyMark(parseInline(token.tokens), 'italic');
    }
    case 'escape': {
      return [textNode(token.text ?? token.raw ?? '')];
    }
    case 'html': {
      // 行内 HTML（如 <u>）在 Markdown 里无法无损回映射为 schema 标记，退化为纯文本
      const stripped = String(token.raw ?? token.text ?? '').replaceAll(
        /<[^>]*>/g,
        '',
      );
      return stripped ? [textNode(stripped)] : [];
    }
    case 'image': {
      return [
        {
          attrs: {
            alt: token.text ?? '',
            src: token.href ?? '',
            title: token.title ?? null,
          },
          type: 'image',
        },
      ];
    }
    case 'link': {
      return applyMark(parseInline(token.tokens), 'link', {
        href: token.href ?? '',
        rel: 'noopener noreferrer',
        target: '_blank',
      });
    }
    case 'strong': {
      return applyMark(parseInline(token.tokens), 'bold');
    }
    case 'text': {
      if (token.tokens?.length) return parseInline(token.tokens);
      return [textNode(token.text ?? token.raw ?? '')];
    }
    default: {
      if (token.tokens) return parseInline(token.tokens);
      return token.text ? [textNode(token.text)] : [];
    }
  }
}

function parseBlockTokens(tokens: any[] | undefined): JSONContent[] {
  const out: JSONContent[] = [];
  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'blockquote': {
        out.push({
          content: parseBlockTokens(token.tokens),
          type: 'blockquote',
        });
        break;
      }
      case 'code': {
        out.push({
          attrs: { language: token.lang || null },
          content: token.text ? [textNode(token.text)] : [],
          type: 'codeBlock',
        });
        break;
      }
      case 'heading': {
        const level = Math.min(Math.max(token.depth ?? 1, 1), 5);
        out.push({
          attrs: { level },
          content: parseInline(token.tokens),
          type: 'heading',
        });
        break;
      }
      case 'hr': {
        out.push({ type: 'horizontalRule' });
        break;
      }
      case 'html': {
        out.push(...parseHtmlBlock(String(token.text ?? token.raw ?? '')));
        break;
      }
      case 'list': {
        out.push(...parseList(token));
        break;
      }
      case 'paragraph': {
        out.push({ content: parseInline(token.tokens), type: 'paragraph' });
        break;
      }
      case 'space': {
        break;
      }
      case 'table': {
        out.push(parseTable(token));
        break;
      }
      case 'text': {
        out.push({ content: parseInline([token]), type: 'paragraph' });
        break;
      }
      default: {
        if (token.tokens) out.push(...parseBlockTokens(token.tokens));
        break;
      }
    }
  }
  return out;
}

/** 解析对齐用的块级 HTML，以及 video 快照 */
function parseHtmlBlock(html: string): JSONContent[] {
  const trimmed = html.trim();
  if (!trimmed) return [];

  // 视频：官方对齐 wangEditor 的 <div data-w-e-type="video"><video><source></video></div>
  if (/<video|data-w-e-type="video"/i.test(trimmed)) {
    const src =
      pickAttr(trimmed, 'video', 'src') ??
      pickAttr(trimmed, 'source', 'src') ??
      '';
    const poster = pickAttr(trimmed, 'video', 'poster');
    return [{ attrs: { poster: poster ?? null, src }, type: 'video' }];
  }

  // 对齐块：<p|h1..h5 style="text-align: xxx">内联 Markdown</p>
  const aligned =
    /<(p|h[1-5])\b[^>]*?style="[^"]*?text-align:\s*([a-z]+)[^"]*?"[^>]*?>([\s\S]*?)<\/\1>/i.exec(
      trimmed,
    );
  if (aligned) {
    const tag = (aligned[1] ?? '').toLowerCase();
    const align = (aligned[2] ?? '').toLowerCase();
    const inner = parseInlineMarkdown(aligned[3] ?? '');
    if (tag === 'p') {
      return [
        { attrs: { textAlign: align }, content: inner, type: 'paragraph' },
      ];
    }
    return [
      {
        attrs: { level: Number(tag.slice(1)), textAlign: align },
        content: inner,
        type: 'heading',
      },
    ];
  }

  // 其它块级 HTML：无法映射成 schema，直接忽略（保持 Markdown 语义干净）
  return [];
}

/** 从一段内联 Markdown 得到行内节点（对齐块内部用） */
function parseInlineMarkdown(md: string): JSONContent[] {
  if (!md.trim()) return [];
  const tokens = marked.lexer(md);
  const inline: JSONContent[] = [];
  for (const token of tokens) {
    if (token.type === 'paragraph' && (token as any).tokens) {
      inline.push(...parseInline((token as any).tokens));
    } else if (token.type === 'text') {
      inline.push(...parseInline([token]));
    }
  }
  return inline;
}

function pickAttr(html: string, tag: string, attr: string): null | string {
  const re = new RegExp(`<${tag}\\b[^>]*?\\b${attr}="([^"]*)"`, 'i');
  return re.exec(html)?.[1] ?? null;
}

/**
 * 列表 token：任务项映射成扁平 `todo` 节点，普通项聚合成 bullet / ordered 列表。
 * 一个列表里既有任务项又有普通项时按出现顺序切段。
 */
function parseList(token: any): JSONContent[] {
  const out: JSONContent[] = [];
  // content 显式非可选：普通项按出现顺序聚合到同一个列表块里
  let currentList: (JSONContent & { content: JSONContent[] }) | null = null;

  for (const item of token.items ?? []) {
    if (item.task) {
      currentList = null;
      out.push({
        attrs: { checked: Boolean(item.checked) },
        content: taskItemInline(item),
        type: 'todo',
      });
      continue;
    }

    const wantType = token.ordered ? 'orderedList' : 'bulletList';
    if (!currentList || currentList.type !== wantType) {
      currentList = { content: [], type: wantType };
      out.push(currentList);
    }
    const blocks = parseBlockTokens(item.tokens);
    currentList.content.push({
      content:
        blocks.length > 0 ? blocks : [{ content: [], type: 'paragraph' }],
      type: 'listItem',
    });
  }

  return out;
}

/** 任务项的标签文本（marked 已剥离 `[x]`，标签落在 item.tokens 的首个段落里） */
function taskItemInline(item: any): JSONContent[] {
  const inline: JSONContent[] = [];
  for (const tk of item.tokens ?? []) {
    if (tk.type === 'paragraph' && tk.tokens)
      inline.push(...parseInline(tk.tokens));
    else if (tk.type === 'text') inline.push(...parseInline([tk]));
  }
  if (inline.length === 0 && item.text)
    inline.push(textNode(String(item.text)));
  return inline;
}

function parseTable(token: any): JSONContent {
  const headerCells: JSONContent[] = (token.header ?? []).map((cell: any) => ({
    attrs: { colspan: 1, rowspan: 1 },
    content: [{ content: parseInline(cell.tokens ?? []), type: 'paragraph' }],
    type: 'tableHeader',
  }));

  const bodyRows: JSONContent[] = (token.rows ?? []).map((row: any[]) => ({
    content: row.map((cell) => ({
      attrs: { colspan: 1, rowspan: 1 },
      content: [{ content: parseInline(cell.tokens ?? []), type: 'paragraph' }],
      type: 'tableCell',
    })),
    type: 'tableRow',
  }));

  const content: JSONContent[] = [];
  if (headerCells.length > 0)
    content.push({ content: headerCells, type: 'tableRow' });
  content.push(...bodyRows);

  return { content, type: 'table' };
}

/* ============================================================
 * 对外 API
 * ============================================================ */

/** ProseMirror 文档 JSON → Markdown 源码 */
export function docToMarkdown(doc: JSONContent): string {
  return serializeBlocks(doc?.content);
}

/** Markdown 源码 → ProseMirror 文档 JSON（可直接交给 editor.commands.setContent） */
export function markdownToDoc(markdown = ''): JSONContent {
  const tokens = markdown ? marked.lexer(markdown) : [];
  const content = parseBlockTokens(tokens);
  if (content.length === 0) content.push({ content: [], type: 'paragraph' });
  return { content, type: 'doc' };
}
