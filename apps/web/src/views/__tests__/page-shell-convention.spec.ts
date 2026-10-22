import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 「后台页面外壳」这套约定的源码契约。
 *
 * 端到端那份巡检（`e2e/page-shell.spec.ts`）只能在真实 DOM 里判"页头渲染出来了 / 只有一个
 * h1 / 底色等于 --muted"，中性色这条它判不准 —— 它看到的是整棵子树，共享组件自带的工具类
 * 会一起被算进来（shadcn 的 destructive 按钮本身就写着 `text-white dark:bg-destructive/60`）。
 * "这一页源码有没有写死灰阶"是源码问题，就在源码里查。
 *
 * 口径与 `page-root-padding.spec.ts` 一致：扫文件，不扫路由表。名单就是这轮改版式落地的
 * 17 个页面（外加安全仪表盘那 4 个页面私有组件 —— 它们渲染在页内，底色同样得跟预设走）。
 * 新页面要进名单，先按 PageHeader + Card 分节的骨架写，再把路径加进来。
 */

/** 中性色写死的特征：调色板灰阶 + 纯白纯黑 */
const HARD_CODED_NEUTRAL =
  /(?:bg|text|border|ring|divide|from|via|to|fill|stroke|outline|shadow)-(?:gray|slate|zinc|neutral|stone)-\d+|(?:bg|text|border|ring|divide|from|via|to)-(?:white|black)(?![\w-])/;

/**
 * 允许出现在名单页里的"非 token 颜色"白名单。
 *
 * 分类色（blue / violet / emerald / amber / cyan）刻意放过：分析面板的 KPI 图标底、
 * 微前端的加载方式标签这类"给同类事物分个颜色"的调色板不是状态语义，硬压成 4 个状态色
 * 反而把区分度抹平；而且每档都写了配对的 `dark:`，深浅色都不糊。
 * 预设只负责主色与中性面，这部分不跟是已知且可接受的取舍 —— 但**必须成对**，
 * 所以下面另有一条"分类色不许单独出现，得带 dark: 搭档"的检查。
 */
const CATEGORICAL =
  /(?:bg|text|border)-(?:blue|violet|emerald|amber|cyan|indigo|sky|teal|rose|orange|fuchsia|purple|green|red|yellow)-\d+/;

const PAGES = [
  'src/views/system/user/index.vue',
  'src/views/system/role/index.vue',
  'src/views/system/menu/index.vue',
  'src/views/system/dept/index.vue',
  'src/views/system/post/index.vue',
  'src/views/system/notice/index.vue',
  'src/views/system/online/index.vue',
  'src/views/system/file/index.vue',
  'src/views/system/dict/index.vue',
  'src/views/system/settings/index.vue',
  'src/views/system/log/index.vue',
  'src/views/system/login-log/index.vue',
  'src/views/system/micro-app/index.vue',
  'src/views/security/dashboard/index.vue',
  'src/views/account/center/index.vue',
  'src/views/account/settings/index.vue',
  'src/views/dashboard/analysis/index.vue',
];

/** 页面私有组件也在页内渲染，底色同样只能来自 token */
const PAGE_PARTS = [
  'src/views/security/dashboard/components/RealtimeAlertPanel.vue',
  'src/views/security/dashboard/components/SecurityScoreCard.vue',
  'src/views/security/dashboard/components/SecurityStatsCharts.vue',
  'src/views/security/dashboard/components/SecurityTimeline.vue',
];

/**
 * 注释里提到 `bg-white` / `gray-900` 是在**解释这条规则**（dict、log 两页各一处），
 * 不是在写样式。所以先按整块注释与行首注释剥掉再匹配 ——
 * 不做这件事的话，规则写得越清楚，测试越红。
 */
function stripComments(source: string): string {
  return source
    .replaceAll(/<!--[\s\S]*?-->/g, '')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/^\s*(?:\/\/|\*).*$/gm, '');
}

function readSource(rel: string): string {
  // 仓库在 Windows 上 checkout 出来是 CRLF，按 LF 归一再解析，行首注释的正则才对得上
  return readFileSync(join(process.cwd(), rel), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

/** 模板正文里 `<h1>` 的个数 —— 标题只该由 PageHeader 渲染一次 */
function h1Count(templateSource: string): number {
  return templateSource.match(/<h1[\s>]/g)?.length ?? 0;
}

function templateOf(source: string): string {
  const start = source.indexOf('<template');
  return start === -1 ? source : source.slice(start);
}

describe('后台页面外壳约定（源码侧）', () => {
  it('名单不为空，且都能读到', () => {
    expect(PAGES.length).toBeGreaterThanOrEqual(17);
    const empty = [...PAGES, ...PAGE_PARTS].filter(
      (file) => readSource(file).length === 0,
    );
    expect(empty).toEqual([]);
  });

  it('页面与页面私有组件的中性色一律走 token', () => {
    const offenders: string[] = [];

    for (const file of [...PAGES, ...PAGE_PARTS]) {
      stripComments(readSource(file))
        .split('\n')
        .forEach((line, index) => {
          if (HARD_CODED_NEUTRAL.test(line)) {
            offenders.push(
              `${file}:${index + 1}  ${line.trim().slice(0, 120)}`,
            );
          }
        });
    }

    expect(offenders).toEqual([]);
  });

  it('分类色必须成对出现 dark: 档，否则深色模式下就是白底白字', () => {
    const offenders: string[] = [];

    for (const file of [...PAGES, ...PAGE_PARTS]) {
      stripComments(readSource(file))
        .split('\n')
        .forEach((line, index) => {
          const hits = line.match(new RegExp(CATEGORICAL.source, 'g')) ?? [];
          // 同一条 class 文本里，每一档分类色都要有一个 `dark:` 前缀的同族
          const darkened = (line.match(/\bdark:(?:bg|text|border)-/g) ?? [])
            .length;
          if (hits.length > 0 && darkened === 0) {
            offenders.push(
              `${file}:${index + 1}  ${line.trim().slice(0, 120)}`,
            );
          }
        });
    }

    expect(offenders).toEqual([]);
  });

  it('每个页面都挂了 PageHeader 与 data-page-view，且模板里不再自写 h1', () => {
    const offenders: string[] = [];

    for (const file of PAGES) {
      const source = stripComments(readSource(file));
      const missing: string[] = [];
      if (!source.includes('<PageHeader')) missing.push('缺 <PageHeader>');
      if (!source.includes('data-page-view')) missing.push('缺 data-page-view');
      const h1 = h1Count(templateOf(source));
      if (h1 > 0) missing.push(`自写了 ${h1} 个 <h1>`);
      if (missing.length > 0)
        offenders.push(`${file}  ::  ${missing.join('、')}`);
    }

    expect(offenders).toEqual([]);
  });

  /**
   * 外壳组件的**根元素**不带回间距。
   *
   * 页面根容器的 `gap` 是竖向节奏的唯一来源；一旦 PageHeader / PageToolbar 的根上
   * 又长出 `mt-*` / `mb-*`，同一份间距会被叠两层 —— 就是这轮改版式要消除的症状之一。
   * 端到端那份是从计算样式判"实际渲染出来有没有外边距"，这里钉的是源码：
   * 谁往根元素上加一档间距，这里立刻红，不用等浏览器跑完 4 分钟。
   * 只查根元素；组件内部的 `mt-1`（标题与说明之间）属于页头自己的排版，不动。
   */
  it('外壳组件的根元素不带 padding/margin', () => {
    const shells: Array<[string, string]> = [
      [
        '../../packages/core/ui-kit/common-ui/src/components/page-header/PageHeader.vue',
        'header',
      ],
      [
        '../../packages/core/ui-kit/common-ui/src/components/page-toolbar/PageToolbar.vue',
        'toolbar',
      ],
    ];

    const offenders: string[] = [];

    for (const [rel, marker] of shells) {
      const source = readFileSync(join(process.cwd(), rel), 'utf8').replaceAll(
        '\r\n',
        '\n',
      );
      // 根元素 = 挂着这个 data-page 标记的那一个标签
      const tag = new RegExp(
        `<[a-zA-Z-]+[^>]*\\bdata-page="${marker}"[^>]*>`,
      ).exec(source);
      const classes = /\bclass="([^"]*)"/.exec(tag?.[0] ?? '')?.[1] ?? '';
      const spacing =
        classes.match(
          /(?:^|\s)(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-\S*/g,
        ) ?? [];
      if (!tag) offenders.push(`${rel}  ::  根元素缺 data-page="${marker}"`);
      for (const utility of spacing) {
        offenders.push(`${rel}  ::  根元素自带 ${utility.trim()}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
