import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 「内边距归布局管」的源码契约。
 *
 * 布局在内容区外面套了一层 `<Scrollbar view-class="p-4">`（`src/layouts/index.vue`），
 * 页面内容的所有者已经是布局。路由页面**再**给自己的外层容器加一份 padding，
 * 表现是内容离边缘 40px、和别的页面对不齐、卡片阴影被顶出可视区。
 * 用户诉求：「所有路由页面，在布局组件中增加了 padding，那么路由页面外层容器不需要添加 padding」。
 *
 * 所以这里钉两件事：布局那份 padding 还在（挪走了就得回来改口径），
 * 以及每个路由页面的**根容器**不带 padding。页面内部的卡片、代码块、抽屉内容该有
 * 内边距随便有 —— 只看根容器，不看第二层。
 *
 * 口径说明（为什么是"扫文件"而不是"扫路由表"）：
 * 页面有三种来源 —— 文件约定式路由、`routes.ts` 里的静态路由（登录/注册/redirect），
 * 以及菜单接口动态注册的 `account/*`。想覆盖全就得按文件走，
 * 只排掉**页面私有组件**（`views/<页>/components/**`、`widgets/**`，它们不是页面）。
 */

/** 页面根容器上不允许出现的内边距工具类（含变体前缀与任意值） */
const PADDING_CLASS = /(?:^|[^\w-])(?:p|px|py|pt|pb|pl|pr)-(?:\d|\[[^\]]*\]|px)(?![\w-])/;
/** 也不允许直接写行内 padding */
const INLINE_PADDING = /padding(?:-top|-right|-bottom|-left|-inline|-block)?\s*:/;

const VIEWS = join(process.cwd(), 'src/views');
const LAYOUT = join(process.cwd(), 'src/layouts/index.vue');

/** `views/<页>/components/X.vue`、`.../widgets/X.vue` 是页面私有组件，不是路由页面 */
function isPrivateComponent(relativePath: string) {
  const segments = relativePath.split(sep);
  // 第一段就是 components/ 的是"组件示例页"目录（views/components/**），算页面；
  // 口径对齐 vite-config 里 VueRouter 的 `**/*/components/*` 排除规则
  return segments.slice(1).includes('components') || segments.slice(1).includes('widgets');
}

function viewFiles(dir: string = VIEWS): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...viewFiles(full));
    else if (name.endsWith('.vue')) {
      const rel = relative(VIEWS, full);
      if (!isPrivateComponent(rel)) out.push(full);
    }
  }
  return out.sort();
}

/**
 * 统一成 LF 再解析。
 *
 * 仓库在 Windows 上 checkout 出来是 CRLF，而下面靠 `\n\n`（空行）当 `const X = ...`
 * 定义的结束边界；不转换的话边界永远找不到，正则会一路吞到模板里，
 * 把"页面内部的卡片有 p-4"误报成根容器违规 —— 首轮就是这么翻车的。
 */
function readSource(file: string): string {
  return readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
}

/** 取出与开头 `<template>` 配对的那一段模板正文 */
function templateBody(source: string): string {
  const open = source.indexOf('<template>');
  if (open === -1) return '';
  let cursor = open + '<template>'.length;
  let depth = 1;
  while (cursor < source.length && depth > 0) {
    const nextOpen = source.indexOf('<template', cursor);
    const nextClose = source.indexOf('</template>', cursor);
    if (nextClose === -1) return '';
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + '<template'.length;
      continue;
    }
    depth -= 1;
    cursor = nextClose;
  }
  return source.slice(open + '<template>'.length, source.lastIndexOf('</template>'));
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** 模板正文里所有**顶层**元素（多根模板的每个 v-if 分支都算） */
function rootTags(template: string): string[] {
  const tags: string[] = [];
  let depth = 0;
  let cursor = 0;
  while (cursor < template.length) {
    const lt = template.indexOf('<', cursor);
    if (lt === -1) break;
    if (template.startsWith('!--', lt + 1)) {
      const end = template.indexOf('-->', lt);
      cursor = end === -1 ? template.length : end + 3;
      continue;
    }
    if (template.startsWith('/', lt + 1)) {
      const end = template.indexOf('>', lt);
      if (end === -1) break;
      depth = Math.max(0, depth - 1);
      cursor = end + 1;
      continue;
    }
    // 扫到标签结束的 '>'，属性值里的尖括号不能算（引号内跳过）
    let gt = lt + 1;
    let quote = '';
    for (; gt < template.length; gt += 1) {
      const char = template[gt];
      if (quote) {
        if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    const raw = template.slice(lt + 1, gt).replace(/\s+/g, ' ').trim();
    const name = /^([\w.-]+)/.exec(raw)?.[1] ?? '';
    const selfClosing = raw.endsWith('/');
    if (depth === 0 && name) tags.push(raw);
    if (!selfClosing && !VOID_TAGS.has(name.toLowerCase())) depth += 1;
    cursor = gt + 1;
  }
  return tags;
}

/**
 * 根容器上声明的类名文本。
 *
 * `:class="containerClassName"` 这种计算属性也要看 —— 登录/注册/异常页就是这么写的，
 * 只读字面量等于给它们开了后门。解析方式很克制：取 `const NAME = ...` 到下一个空行
 * 为止的原文（prettier 会把这些 `cn(...)` 定义写成紧凑的整块），在里面找 padding 类。
 */
function rootClassText(tag: string, source: string): string {
  const parts: string[] = [];
  for (const match of tag.matchAll(/(?:::?)class="([^"]*)"/g)) {
    const value = match[1];
    parts.push(value);
    // 只按 `xxxClassName` 这一条命名约定去解析计算属性，不做无差别的全大写常量匹配
    for (const identifier of value.matchAll(/\b\w+ClassName\b/g)) {
      const name = identifier[0];
      /**
       * 取到"下一条顶格语句之前"为止，而不是"下一个空行之前"。
       *
       * prettier 会把连续的一行式 `const xxxClassName = cn(...)` 挤成不留空行的一整块，
       * 用空行当边界等于把整块兄弟常量都吞进来 —— 于是 `btnClassName = cn('px-0.5!')`
       * 这种**别的元素**的 padding 会被算到根容器头上，首轮就误报了 20 多个页面。
       * 顶格（行首非空白）才是同级的下一条语句。
       */
      const definition = new RegExp(`(?:const|let)\\s+${name}\\b[\\s\\S]*?(?=\\n\\S|\\s*$)`).exec(
        source,
      );
      if (definition) parts.push(definition[0]);
    }
  }
  const style = /\bstyle="([^"]*)"/.exec(tag)?.[1];
  if (style) parts.push(style);
  return parts.join(' ');
}

describe('路由页面的根容器不重复加内边距', () => {
  it('内边距由布局的 Scrollbar view-class 统一提供', () => {
    const layout = readSource(LAYOUT);
    // 「内容全屏 / 标签页放大」那一档故意不留内边距，所以只认"view 上出现 p-4"这件事
    expect(layout).toMatch(/view-class="[^"]*p-4/);
  });

  it('扫到了足够多的页面（防止目录口径变化把断言跑成空转）', () => {
    const files = viewFiles();
    expect(files.length).toBeGreaterThanOrEqual(40);
    expect(files.some((file) => file.endsWith(join('system', 'user', 'index.vue')))).toBe(true);
  });

  it('每个路由页面的根容器都没有 p-*/px-*/py-* 或行内 padding', () => {
    const offenders: string[] = [];

    for (const file of viewFiles()) {
      const source = readSource(file);
      const template = templateBody(source);
      if (!template) continue;
      for (const tag of rootTags(template)) {
        const classText = rootClassText(tag, source);
        if (PADDING_CLASS.test(` ${classText} `) || INLINE_PADDING.test(classText)) {
          offenders.push(
            `${relative(process.cwd(), file)}  ::  ${tag.slice(0, 140)}\n        类名: ${classText
              .replace(/\s+/g, ' ')
              .slice(0, 200)}`,
          );
        }
      }
    }

    // 一次性列全，改一个页面不至于反复跑
    expect(offenders).toEqual([]);
  });

  it('已知被修掉的四个页面保持无内边距', () => {
    for (const rel of [
      'src/views/components/editor/markdown/index.vue',
      'src/views/demo/table-pagination-test.vue',
      'src/views/micro-app/SubAppView.vue',
      'src/views/system/micro-app/index.vue',
    ]) {
      const source = readSource(join(process.cwd(), rel));
      const roots = rootTags(templateBody(source));
      expect(roots.length, `${rel} 应该有根容器`).toBeGreaterThan(0);
      for (const tag of roots) {
        expect(rootClassText(tag, source), rel).not.toMatch(PADDING_CLASS);
      }
    }
  });
});
