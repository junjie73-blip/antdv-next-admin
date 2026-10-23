import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 样式子包的契约测试。
 *
 * CSS 没有类型系统兜底，抽包之后最容易坏的是"约定"而不是语法：
 * 层级顺序、Tailwind 入口、谁负责哪条规则 —— 这些一旦漂移，
 * 页面会静默变样（工具类覆盖失效、色弱模式失灵），构建却不报错。
 * 所以把约定钉在断言里。
 */

const read = (file: string) =>
  readFileSync(
    fileURLToPath(new URL(`../src/${file}`, import.meta.url)),
    'utf8',
  );

const index = read('index.css');
const tokenEntry = read('token/index.css');
const tokenDefault = read('token/default.css');
const tokenDark = read('token/dark.css');
const base = read('css/base.css');
const nprogress = read('css/nprogress.css');
const a11y = read('css/a11y.css');
const permission = read('css/permission.css');
const scrollbar = read('css/scrollbar.css');

const THEME_PARTS = [tokenEntry, tokenDefault, tokenDark];
const CSS_PARTS = [base, nprogress, a11y, permission, scrollbar];
const ALL_SOURCES = [index, ...THEME_PARTS, ...CSS_PARTS];

/** 去掉注释后的源码：断言"不存在某类写法"时要用它，否则注释自己会命中 */
const stripComments = (source: string) =>
  source.replaceAll(/\/\*[\s\S]*?\*\//gmu, '');

describe('@antdv/design —— 入口', () => {
  it('第一句必须是层级顺序声明，utilities 排在最后', () => {
    // 顺序错了会出现"组件里的 components 规则盖掉模板 utilities"这类难查问题
    const layerDecl = /@layer\s+([^;]+);/u.exec(index)?.[1]?.trim();
    expect(layerDecl).toBe('theme, base, components, utilities');
    expect(index.indexOf('@layer theme')).toBeLessThan(
      index.indexOf("@import 'tailwindcss'"),
    );
  });

  it('tailwind 本体与动画库在入口里，插件声明排在 @import 之后', () => {
    expect(index).toContain("@import 'tailwindcss'");
    expect(index).toContain("@import 'tw-animate-css'");
    expect(index).toContain('@plugin "@tailwindcss/typography"');
    expect(index).toContain('@plugin "@tailwindcss/nesting"');
  });

  it('dark 变体走 .dark 类，与 preferences 写 DOM 的方式一致', () => {
    expect(index).toContain('@custom-variant dark (&:where(.dark, .dark *))');
  });

  it('token 入口与五个 css 分部都在主入口里被引入，且 @import 全部出现在 @plugin 之前', () => {
    for (const part of [
      './token/index.css',
      './css/base.css',
      './css/nprogress.css',
      './css/a11y.css',
      './css/permission.css',
      './css/scrollbar.css',
    ]) {
      expect(index).toContain(`@import '${part}'`);
    }
    // CSS 规范：@import 必须早于普通规则；Tailwind 的 @plugin 也按位置解析，
    // 分部里要用 @apply，就必须先引完 tailwindcss 本体再声明插件。
    const lastImport = index.lastIndexOf('@import');
    const firstPlugin = index.indexOf('@plugin');
    expect(lastImport).toBeGreaterThan(-1);
    expect(firstPlugin).toBeGreaterThan(lastImport);
  });
});

/**
 * shadcn 的 vendored 组件写的是 `bg-popover` / `text-muted-foreground` 这类裸名字。
 * Tailwind v4 只为 `@theme` 里声明过的 token 生成工具类，少一个名字不是"退回默认样式"，
 * 而是**整条类不生成** —— 表现是弹层透明、次要文字没有灰度，而构建一声不吭。
 * 所以这份名单是契约，不是备忘。
 */
const SHADCN_COLORS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
];

/**
 * 尺度 token：偏好面板写在 html 内联样式上，主题文件里只负责给首屏兜底值。
 *
 * 它们不进 `@theme` 的**颜色**命名空间 —— 把 `--filter` 映成 `--color-*`
 * 只会生成一条没人用的工具类，还会把色板名单弄脏（名单是逐条比对亮暗两套的）。
 * 圆角是唯一例外，它进的是 `--radius-*` 命名空间：Tailwind 的 `rounded-*`
 * 类只认那一份表，偏好要能拖动全站半径，就必须把 `--radius` 接进去。
 */
const THEME_SCALARS = ['filter', 'font-size', 'radius'];

type Block = {
  selectors: string[];
  vars: Map<string, string>;
};

/**
 * 把主题文件拆成"选择器 + 声明"的块。
 *
 * 不能按 `:root {` 这种字符串找块：现在每个主题都是**选择器列表**
 * （`:root, .light, .light[data-theme='custom'], ...`），字符串对照只会一路误报。
 */
function parseBlocks(source: string): Block[] {
  return [...stripComments(source).matchAll(/([^{}]+)\{([^{}]*)\}/gmu)].map(
    (match) => ({
      selectors: match[1]!
        .split(',')
        .map((selector) => selector.trim())
        .filter(Boolean),
      vars: new Map(
        [...match[2]!.matchAll(/--([a-z][a-z0-9-]*):\s*([^;]*)/gmu)].map(
          (decl) => [decl[1]!, decl[2]!.trim()],
        ),
      ),
    }),
  );
}

/** 基础主题块：亮色带 `:root`，暗色带裸 `.dark` */
function baseBlock(source: string): Block {
  const block = parseBlocks(source).find(
    ({ selectors }) =>
      selectors.includes(':root') || selectors.includes('.dark'),
  );
  expect(block, '主题文件必须有一个裸基础块（:root 或 .dark）').toBeDefined();
  return block!;
}

/** `[data-theme='x']` 预设块，按主题名索引；custom/default 属于基础块，不算预设 */
function presetBlocks(source: string): Map<string, Block> {
  const presets = new Map<string, Block>();
  for (const block of parseBlocks(source)) {
    const names = new Set(
      block.selectors.map(
        (selector) => /data-theme='([^']+)'/u.exec(selector)?.[1],
      ),
    );
    // 基础块自己也带 [data-theme='custom'|'default']，用来抵消残留的预设标记
    if (names.size === 1 && [...names][0] === undefined) continue;
    const name = [...names].find((x) => x && x !== 'custom' && x !== 'default');
    if (name) presets.set(name, block);
  }
  return presets;
}

/** 主题文件里出现过的全部语义色名（含只在预设里出现的），用于两套主题对名单 */
function appColorNames(source: string): string[] {
  const names = new Set<string>();
  for (const { vars } of parseBlocks(source)) {
    for (const name of vars.keys()) {
      if (!THEME_SCALARS.includes(name)) names.add(name);
    }
  }
  return [...names].sort();
}

describe('@antdv/design —— shadcn 色板', () => {
  it('每个语义色都在 token 入口里导出成 --color-* token', () => {
    for (const name of SHADCN_COLORS) {
      expect(tokenEntry).toContain(`--color-${name}: hsl(var(--${name}));`);
    }
  });

  it('变量与映射一一对应：加了预设色却忘了 @theme，工具类照样不生成', () => {
    const mapped = [
      ...new Set(
        [
          ...tokenEntry.matchAll(
            /--color-[a-z-]+: hsl\(var\(--([a-z-]+)\)\);/gmu,
          ),
        ].map((match) => match[1]),
      ),
    ].sort();
    expect(mapped).toEqual(appColorNames(tokenDefault));
    expect(mapped).toEqual(appColorNames(tokenDark));
  });

  it('亮暗两套的名单逐条对齐：缺一条暗色声明，切到深色就是白底黑字浮层', () => {
    expect(appColorNames(tokenDark)).toEqual(appColorNames(tokenDefault));
    for (const name of SHADCN_COLORS) {
      expect(baseBlock(tokenDefault).vars.has(name), `亮色缺 ${name}`).toBe(
        true,
      );
      expect(baseBlock(tokenDark).vars.has(name), `暗色缺 ${name}`).toBe(true);
    }
  });

  /**
   * 用户要的是"每个主题的 token 都不一样"，而漂移的最初形态永远是
   * 新增预设时漏掉几条 —— 漏掉的那条不会报错，它会继续吃 `:root` 的亮色值，
   * 于是暗色预设上浮出一块白底。所以这里要的是**完整名单**，不是"有差异"。
   */
  it('每套预设都写满名单，缺一条就会被基础主题的颜色顶穿', () => {
    for (const [file, source] of [
      ['default.css', tokenDefault],
      ['dark.css', tokenDark],
    ]) {
      const presets = presetBlocks(source);
      expect(presets.size, `${file} 的预设数量`).toBe(13);
      for (const [name, block] of presets) {
        for (const color of SHADCN_COLORS) {
          expect(
            block.vars.has(color),
            `${file} 的 ${name} 预设缺 --${color}`,
          ).toBe(true);
        }
      }
    }
  });

  it('预设主题名两套一致：亮色有 violet 暗色没有，切深色就掉回默认蓝', () => {
    expect([...presetBlocks(tokenDark).keys()].sort()).toEqual(
      [...presetBlocks(tokenDefault).keys()].sort(),
    );
  });

  it('每套预设的取值互不相同：两套预设长得一样，等于用户点了没反应', () => {
    for (const [file, source] of [
      ['default.css', tokenDefault],
      ['dark.css', tokenDark],
    ]) {
      const signatures = new Map<string, string>();
      for (const [name, block] of presetBlocks(source)) {
        const signature = SHADCN_COLORS.map((color) =>
          block.vars.get(color),
        ).join('|');
        const previous = signatures.get(signature);
        expect(
          previous,
          `${file} 的 ${name} 与 ${previous ?? ''} 取值完全相同`,
        ).toBeUndefined();
        signatures.set(signature, name);
      }
    }
  });

  /**
   * "每个主题的 token 都不一样"在明暗之间同样成立：换到深色不是只换个主色，
   * 而是整块画布（底、卡片、浮层、正文、主色）一起重算。
   * `primary-foreground` 这类"色块上的一颗白字"两套相同是对的，所以只比画布五色。
   */
  it('同一预设的明暗取值必须真的换了：抄一遍亮色值就是深色模式白底', () => {
    const light = presetBlocks(tokenDefault);
    const dark = presetBlocks(tokenDark);
    const canvas = [
      'background',
      'card',
      'popover',
      'foreground',
      'primary',
      'border',
    ];
    for (const [name, lightBlock] of light) {
      const darkBlock = dark.get(name)!;
      for (const color of canvas) {
        expect(
          darkBlock.vars.get(color),
          `${name} 预设的 --${color} 明暗同值，深色模式没换画布`,
        ).not.toBe(lightBlock.vars.get(color));
      }
    }
  });

  it('尺度 token 两套基础主题各自完整：偏好落盘前的一帧也有兜底值', () => {
    const colorNamespace = new Set(
      [
        ...tokenEntry.matchAll(
          /--color-[a-z-]+: hsl\(var\(--([a-z-]+)\)\);/gmu,
        ),
      ].map((match) => match[1]),
    );
    for (const name of THEME_SCALARS) {
      expect(baseBlock(tokenDefault).vars.has(name)).toBe(true);
      expect(baseBlock(tokenDark).vars.has(name)).toBe(true);
      // 尺度值只准待在尺度命名空间里；混进颜色名单就是一堆没人用的工具类
      expect(colorNamespace, `--${name} 不该映射成颜色`).not.toContain(name);
    }
  });

  /**
   * 偏好面板改圆角/字号时，往 html 上内联写的就是这两条变量（见 `@antdv/preferences`）。
   * 变量断了不会报错，只会"设置保存了但页面没反应"，所以把两条接线钉住。
   */
  it('尺度 token 接到使用点：圆角进 --radius-* 表，字号进根字号', () => {
    expect(tokenEntry).toContain('--radius-lg: var(--radius);');
    expect(base).toContain('font-size: var(--font-size');
  });

  /**
   * 命名空间只有 shadcn 规范名这一套，变量里存的是**颜色通道**。
   *
   * `npx shadcn-vue add` 拉下来的组件与官方样板写的就是 `hsl(var(--border))`，
   * 所以 `@theme inline` 只能用 `hsl(var(--x))` 组合颜色，值本身不能是完整颜色：
   * 一旦有人把 `#f0f0f0` 或 `hsl(...)` 写回变量，`hsl(#f0f0f0)` 解析失败，
   * 表现是边框消失、背景透明，又不报错 —— 属于最难查的那类静默丢样式。
   * 反过来，混用 `--app-*` 前缀等于"别名层与事实来源"分家，两条都在这一条里钉住。
   *
   * 子树覆盖不再需要 `.app-theme-scope` 那种类：`@theme inline` 把 `hsl(var(--x))`
   * 内联进工具类，替换发生在用到它的那个元素上，所以 ConfigProvider 只要往容器
   * 内联写 `--primary` / `--radius` 就能带着整棵子树重算。
   */
  it('规范名单一事实来源：变量存通道，颜色由 hsl(var(--x)) 组合', () => {
    const channel = /^[\d.]+ [\d.]+% [\d.]+%(?: \/ [\d.]+)?$/u;
    for (const [file, source] of [
      ['default.css', tokenDefault],
      ['dark.css', tokenDark],
    ]) {
      for (const { vars } of [
        baseBlock(source),
        ...presetBlocks(source).values(),
      ]) {
        for (const [name, value] of vars) {
          if (THEME_SCALARS.includes(name) || value.startsWith('var('))
            continue;
          expect(value, `${file} 的 --${name} 不是颜色通道`).toMatch(channel);
        }
      }
    }
    // 只剩规范名一个命名空间（注释里讲历史可以，声明里不行）
    expect(stripComments(ALL_SOURCES.join('\n'))).not.toMatch(/--app-/u);
    // 状态色也在 @theme 里，否则 `bg-success` 这类工具类根本不生成
    for (const name of ['success', 'warning', 'info']) {
      expect(tokenEntry).toContain(`--color-${name}: hsl(var(--${name}));`);
    }
    // 圆角刻度基准就是规范名 `--radius`（偏好面板往 html 内联写的那一条）
    expect(tokenEntry).toContain('--radius-lg: var(--radius);');
  });

  /**
   * 圆角全站只准 rem。px 与 rem 混写时，根字号一缩放就出现"文字变了、圆角没变"，
   * 而这条分裂在默认字号下量不出来 —— 所以钉的是声明里的单位，不是计算值。
   */
  it('圆角基准写 rem，不写 px', () => {
    for (const [file, source] of [
      ['default.css', tokenDefault],
      ['dark.css', tokenDark],
    ]) {
      expect(baseBlock(source).vars.get('radius'), `${file} 的圆角基准`).toBe(
        '1rem',
      );
    }
  });

  it('token 目录只写变量声明，不掺视觉规则', () => {
    for (const [file, source] of [
      ['default.css', tokenDefault],
      ['dark.css', tokenDark],
      ['index.css', tokenEntry],
    ]) {
      const body = stripComments(source);
      const offenders = body
        .split('\n')
        .filter((line) => /^\s+\S.*;$/.test(line))
        .filter((line) => !/^\s*--/u.test(line));
      expect(offenders, `${file} 只允许 --变量: 值`).toEqual([]);
      expect(body).not.toContain('@apply');
    }
  });

  /**
   * 偏好面板只往 html 内联写一条 `--primary`（见 @antdv/shared 的 css-vars）。
   * 派生色写成 `var(--基色)`，自定义主色才会连带染到 ring 与整条侧栏；
   * 反过来，如果这里钉死取值，"换了主题色、弹层还是蓝的"就又回来了。
   */
  it('主色与它的派生族：一条 var(--primary) 串起 ring 和侧栏', () => {
    for (const [file, source] of [
      ['default.css', tokenDefault],
      ['dark.css', tokenDark],
    ]) {
      const { vars } = baseBlock(source);
      // 基础值是自洽的 hsl 通道，不读组件库变量
      expect(vars.get('primary'), `${file} 的主色不是颜色通道`).toMatch(
        /^[\d.]+ [\d.]+% [\d.]+%$/u,
      );
      for (const derived of ['ring', 'sidebar-primary', 'sidebar-ring']) {
        expect(vars.get(derived), `${file} 的 ${derived}`).toBe(
          'var(--primary)',
        );
      }
      expect(vars.get('sidebar-foreground')).toBe('var(--foreground)');
      expect(vars.get('sidebar-border')).toBe('var(--border)');
    }
  });

  it('必须写 @theme inline，否则 .dark / [data-theme] 的覆盖不生效', () => {
    // 非 inline 形式在 :root 求值一次就冻结了，换主题只动标记不动颜色
    expect(tokenEntry).toContain('@theme inline');
  });

  /**
   * 写侧在 `@antdv/shared` 的 `THEME_PRESETS`（偏好面板的色块、`<html data-theme>` 的档位名），
   * 读侧在本包两个 token 文件的 `[data-theme='x']` 块。名字对不上不报错，
   * 只会让那一档静默退回基础主题 —— 所以两边名单要在这里对一次。
   *
   * 直接读源码而不是 import：本包是样式包，不该为了测试背上 workspace 依赖。
   */
  it('预设名单与 @antdv/shared 的 THEME_PRESETS 完全一致', () => {
    const presetsSource = readFileSync(
      fileURLToPath(
        new URL('../../shared/src/constants/theme-presets.ts', import.meta.url),
      ),
      'utf8',
    );
    const registered = [
      ...presetsSource.matchAll(/key: ([A-Z_]+|'[^']+')/gmu),
    ].map((match) => match[1]!.replaceAll(/['"]/gmu, ''));
    const presetKeys = [...presetBlocks(tokenDefault).keys()];

    expect(registered).toContain('DEFAULT_THEME_KEY');
    // custom 档不进预设名单，但它必须真的存在：取色器选的颜色全靠它接住
    expect(presetsSource).toContain("CUSTOM_THEME_KEY = 'custom'");
    for (const source of [tokenDefault, tokenDark]) {
      expect(source).toContain("[data-theme='custom']");
    }
    // custom / default 由基础主题块承接，顺序各自自由，只比集合
    expect([...presetKeys].sort()).toEqual(
      registered.filter((key) => key !== 'DEFAULT_THEME_KEY').sort(),
    );
  });

  /**
   * 本包是设计规范本身：值一旦去读 `--ant-*`，"主题"就变成 antd 主题算法的副产品，
   * 明暗两套预设也就没法各自成立（antd 的作用域类还在 `.ant-app` 里，
   * 而弹层 portal 到 body，取不到变量只剩透明底）。
   */
  it('全包不引用 antd 变量与兼容层：token 是本包的单一事实来源', () => {
    const joined = stripComments(ALL_SOURCES.join('\n'));
    expect(joined).not.toMatch(/--ant-/u);
    expect(joined).not.toMatch(/@antdv-next\//u);
    // `-ant-primary` 这类工具类的生成源已被删掉，写它们等于静默丢样式
    expect(joined).not.toMatch(/-ant-[a-z]/u);
  });

  it('值不依赖 antd 作用域变量（浮层 portal 在 .ant-app 之外）', () => {
    expect([...baseBlock(tokenDefault).vars.values()].join(',')).not.toMatch(
      /--ant-/u,
    );
  });
});

describe('@antdv/design —— 分部职责', () => {
  it('base：文档根尺寸、选中态、视图过渡、通用交互类', () => {
    for (const selector of [
      'html,',
      '#app',
      '::selection',
      '::view-transition-old(root)',
      '.dark',
      '.icon',
      '.outline-box',
      '.outline-box-active',
    ]) {
      expect(base).toContain(selector);
    }
    // overflow-hidden 是"页面自身不滚、滚动交给 Scrollbar"的前提
    expect(base).toMatch(
      /html,\s*body\s*\{[^@]*@apply h-full overflow-hidden/u,
    );
    // perfect-scrollbar 已经下线，别再留它的死规则
    expect(base).not.toContain('.ps__');
    //
    // Tailwind v4 去掉了 v3 的 `borderColor.DEFAULT = gray.200`，preflight 只剩
    // 不带颜色的 `border: 0 solid`，于是只写 `border` 不写颜色的盒子边框算成
    // `currentColor`（亮色下就是 88% 黑）。兜底必须待在 base 层里 ——
    // 写在层级之外会把 `border-gray-700` 这类工具类的颜色一并压掉。
    expect(base).toMatch(/@layer base\s*\{/u);
    expect(base).toMatch(/::before\s*\{\s*@apply border-border;/u);
    // 选中态走本包主色，不再蹭 antd 命名空间
    expect(base).toMatch(/::selection\s*\{\s*@apply bg-primary/u);
  });

  it('光标：能点的盒子一律 pointer，禁用的给 not-allowed（浏览器不会自己给 button 指针）', () => {
    // `<button>` 在 UA 样式里是 default 光标，而本项目可点的盒子大多是手写 button，
    // 所以规则必须住在样式层：写在模板上一定会漏掉新页面
    expect(base).toMatch(
      /button:not\(:disabled\)\s*\{\s*@apply cursor-pointer;/u,
    );
    expect(base).toMatch(/button:disabled\s*\{\s*@apply cursor-not-allowed;/u);
    // 勾选框/单选框/下拉框同样是 UA 默认光标
    expect(base).toMatch(
      /input\[type='checkbox'\],\s*input\[type='radio'\],\s*select\s*\{/u,
    );
    // 带 ARIA role 的自定义控件（评分、开关等）：role 本身就是在宣布"这里能点"
    expect(base).toContain("[role='radio']:not([aria-disabled='true'])");
    expect(base).toContain("[role='button'][disabled]");
    /*
     * `<a href>`：Chromium 的 UA 表给 pointer，WebKit 静止态算 `auto`（三引擎整跑时
     * 只有 webkit 在 `cursor.spec.ts` 的全站扫描里红）。所以链接的光标也必须自己写死，
     * 并且要待在 `@layer base` 里 —— 层外规则压过工具类，会把
     * `<a class="cursor-not-allowed">` 这类显式表态盖掉。
     */
    expect(base).toMatch(
      /@layer base\s*\{[^}]*a\[href\]\s*\{\s*@apply cursor-pointer;/u,
    );
    // antdv-next 已退场，`.ant-upload` 那类第三方作用域类不该再出现在全局分部里
    expect(stripComments(base)).not.toContain('.ant-');
  });

  it('scrollbar：第三方滚动区兜底，且必须写在 base 层', () => {
    // 包不住的滚动元素（antd 表格体、虚拟列表、textarea、pre）统一压成细圆角条
    expect(scrollbar).toContain('@layer base');
    expect(scrollbar).toContain('scrollbar-width: thin');
    expect(scrollbar).toContain('scrollbar-color:');
    expect(scrollbar).toContain('::-webkit-scrollbar-thumb');
    expect(scrollbar).toContain('.dark ::-webkit-scrollbar-thumb');
    // 轨道透明，避免在深色卡片上留下一条灰槽
    expect(scrollbar).toMatch(
      /::-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent/u,
    );
    // 层级是 reka 给 ScrollArea viewport 注入的"隐藏原生条"规则能盖过这里的前提
    expect(base).not.toContain('::-webkit-scrollbar');
  });

  it('nprogress：进度条配色读本包主色 token，不写死蓝色', () => {
    expect(nprogress).toContain('#nprogress .bar');
    expect(nprogress).toContain('hsl(var(--primary, ');
    expect(nprogress).toMatch(
      /@apply fixed top-0 left-0 z-\[9999\] h-\[3px\] w-full/u,
    );
  });

  it('a11y：色弱/灰色模式消费 preferences 写的 --filter', () => {
    expect(a11y).toContain('html.color-weak');
    expect(a11y).toContain('html.gray-mode');
    expect(a11y).toContain('var(--filter');
    // 滤镜值要和 packages/core/base/shared/src/constants/css-vars.ts 的常量对得上
    expect(a11y).toContain('invert(80%) grayscale(100%)');
    expect(a11y).toContain('grayscale(100%)');
  });

  it('permission：指令只打 class，视觉降级写在这里并保持在 components 层', () => {
    expect(permission).toContain('@layer components');
    expect(permission).toContain('.permission-disabled');
    expect(permission).toMatch(/@apply cursor-not-allowed opacity-50/u);
    expect(permission).toContain('.permission-disabled--passthrough');
  });
});

describe('@antdv/design —— 包边界', () => {
  it('不 @import 组件包，避免 CSS 与组件互相牵动（注释里提到不算依赖）', () => {
    const imports = ALL_SOURCES.join('\n')
      .split('\n')
      .filter((line) => line.trimStart().startsWith('@import'));
    expect(imports.join('\n')).not.toContain('@antdv/icons');
    expect(imports.join('\n')).not.toContain('@antdv/layouts');
    // 外部只允许这两个 npm 包进入样式入口：Tailwind 本体与动画库
    expect(imports).toEqual([
      "@import 'tailwindcss';",
      "@import 'tw-animate-css';",
      "@import './token/index.css';",
      "@import './css/base.css';",
      "@import './css/nprogress.css';",
      "@import './css/a11y.css';",
      "@import './css/permission.css';",
      "@import './css/scrollbar.css';",
      "@import './default.css';",
      "@import './dark.css';",
    ]);
  });

  it('package.json 不声明组件库依赖：设计规范不建立在某个库的主题算法上', () => {
    const pkg = JSON.parse(read('../package.json'));
    expect(Object.keys(pkg.dependencies)).not.toContain('@antdv-next/tailwind');
  });

  it('二级目录只有 token 与 css：token 装变量，css 装规则', () => {
    const srcDir = resolve(fileURLToPath(new URL('../src', import.meta.url)));
    expect(readdirSync(srcDir).sort()).toEqual(['css', 'index.css', 'token']);
    expect(readdirSync(resolve(srcDir, 'token')).sort()).toEqual([
      'dark.css',
      'default.css',
      'index.css',
    ]);
    expect(readdirSync(resolve(srcDir, 'css')).sort()).toEqual([
      'a11y.css',
      'base.css',
      'nprogress.css',
      'permission.css',
      'scrollbar.css',
    ]);
  });

  it('组件滚动条样式不回流到全局包（随 Scrollbar.vue 走）', () => {
    expect([base, index, nprogress, a11y, permission].join('\n')).not.toContain(
      '.scrollbar__wrap',
    );
    /**
     * `scrollbar.css` 是"第三方内部滚动区"的兜底，注释里会提到 `.scrollbar__wrap`
     * （解释为什么层级要选 base），但它自己绝不写以 `scrollbar__` 为选择器的规则：
     * 那是组件带的类，样式归 `@antdv/common-ui`，全局包一旦插手就会出现"改组件不生效"的分裂。
     */
    expect(scrollbar).not.toMatch(/^\s*\.scrollbar__/mu);
  });

  /**
   * Tailwind v4 的自动内容检测从 Vite 根目录（`apps/web`）往上扫，扫不到 `packages/**`，
   * 所以每个子包模板里的工具类都必须在这里显式 `@source`。
   * 漏掉的包不会构建失败 —— 只是页面少一层圆角、少一个间距，属于最难查的那类"静默变样"，
   * 所以用目录清单反查登记项：新增子包却忘了登记 `@source` 时，这条先红。
   *
   * 比的是**解析后的绝对目录**而不是登记时写的那串相对路径：子包搬家会让 `@source` 指空，
   * 字符串对照反而看不出问题。
   */
  it('每个子包的源码目录都登记了 @source，且登记路径解析得到真实目录', () => {
    const designDir = fileURLToPath(new URL('../', import.meta.url));
    const cssDir = resolve(designDir, 'src');
    const coreDir = resolve(designDir, '../..');

    const registered = [...index.matchAll(/^@source\s+'([^']+)';/gmu)].map(
      (m) => resolve(cssDir, m[1]),
    );

    for (const dir of registered) {
      expect(
        existsSync(dir),
        `@source 登记的 ${dir} 不存在，Tailwind 会扫不到这些模板`,
      ).toBe(true);
    }

    const uiKitDir = resolve(coreDir, 'ui-kit');
    const expected = [
      resolve(coreDir, 'base/icons/src'),
      // 布局装配层在 packages 根下（不在 core 里），模板同样是包内源码
      resolve(coreDir, '../layouts/src'),
      ...readdirSync(uiKitDir)
        .filter((name) => existsSync(resolve(uiKitDir, name, 'src')))
        .map((name) => resolve(uiKitDir, name, 'src')),
    ];

    for (const dir of expected) {
      expect(
        registered,
        `${dir} 没登记 @source，模板里的工具类不会被生成`,
      ).toContain(dir);
    }
  });
});
