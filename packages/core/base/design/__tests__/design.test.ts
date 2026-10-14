import { readFileSync, readdirSync, existsSync } from 'node:fs';
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
const tokens = read('tokens.css');
const base = read('base.css');
const nprogress = read('nprogress.css');
const a11y = read('a11y.css');
const permission = read('permission.css');
const scrollbar = read('scrollbar.css');

describe('@antdv/design —— 入口', () => {
  it('第一句必须是层级顺序声明，utilities 排在最后', () => {
    // 顺序错了会出现"组件里的 components 规则盖掉模板 utilities"这类难查问题
    const layerDecl = /@layer\s+([^;]+);/u.exec(index)?.[1]?.trim();
    expect(layerDecl).toBe('theme, base, antd, components, utilities');
    expect(index.indexOf('@layer theme')).toBeLessThan(
      index.indexOf("@import 'tailwindcss'"),
    );
  });

  it('tailwind 本体 + antdv-next 兼容层 + 动画库都要在入口里', () => {
    expect(index).toContain("@import 'tailwindcss'");
    expect(index).toContain("@import '@antdv-next/tailwind/compat.css'");
    expect(index).toContain("@import 'tw-animate-css'");
    expect(index).toContain('@plugin "@tailwindcss/typography"');
    expect(index).toContain('@plugin "@tailwindcss/nesting"');
  });

  it('dark 变体走 .dark 类，与 preferences 写 DOM 的方式一致', () => {
    expect(index).toContain('@custom-variant dark (&:where(.dark, .dark *))');
  });

  it('六个分部都在入口里被引入，且 @import 全部出现在 @plugin 之前', () => {
    for (const part of [
      'tokens',
      'base',
      'nprogress',
      'a11y',
      'permission',
      'scrollbar',
    ]) {
      expect(index).toContain(`@import './${part}.css'`);
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

/** 取某个选择器块里的声明体（只要第一段，够覆盖 :root / .dark 两种写法） */
function blockBody(selector: string): string {
  const start = tokens.indexOf(`${selector} {`);
  expect(start).toBeGreaterThan(-1);
  const end = tokens.indexOf('}', start);
  return tokens.slice(start, end);
}

describe('@antdv/design —— shadcn 色板', () => {
  it('每个语义色都导出成 --color-* token', () => {
    for (const name of SHADCN_COLORS) {
      expect(tokens).toContain(`--color-${name}: var(--app-${name});`);
    }
  });

  it('亮暗两套给齐：缺一条暗色声明，切到深色就是白底黑字浮层', () => {
    for (const name of SHADCN_COLORS) {
      expect(blockBody(':root')).toContain(`--app-${name}:`);
      expect(blockBody('.dark')).toContain(`--app-${name}:`);
    }
  });

  it('主色读偏好写到 html 上的变量，并留兜底值', () => {
    // 偏好面板改的是 `--ant-color-primary`（见 @antdv/preferences/css-vars），
    // 钉死值就会出现"换了主题色、弹层还是蓝的"
    expect(tokens).toContain(
      '--app-primary: var(--ant-color-primary, #1677ff);',
    );
    expect(tokens).toContain('--app-ring: var(--ant-color-primary, #1677ff);');
  });

  it('必须写 @theme inline，否则 .dark 覆盖不生效', () => {
    // 非 inline 形式在 :root 求值一次就冻结了，暗色切换只动 class 不动颜色
    expect(tokens).toContain('@theme inline');
  });

  it('值不依赖 antd 作用域变量（浮层 portal 在 .ant-app 之外）', () => {
    expect(blockBody(':root')).not.toMatch(
      /var\(--ant-color-(?:text|bg-[a-z]+)\b/u,
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
    // antd 唯独漏了上传触发区（里面包的是 span，不是 button）
    expect(base).toContain('.ant-upload:not(.ant-upload-disabled)');
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

  it('nprogress：进度条配色读 antd 主色变量，不写死蓝色', () => {
    expect(nprogress).toContain('#nprogress .bar');
    expect(nprogress).toContain('var(--ant-primary-color, #1677ff)');
    expect(nprogress).toMatch(
      /@apply fixed top-0 left-0 z-\[9999\] h-\[3px\] w-full/u,
    );
  });

  it('a11y：色弱/灰色模式消费 preferences 写的 --app-filter', () => {
    expect(a11y).toContain('html.color-weak');
    expect(a11y).toContain('html.gray-mode');
    expect(a11y).toContain('var(--app-filter');
    // 滤镜值要和 packages/core/preferences/src/css-vars.ts 的常量对得上
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
    const imports = [
      index,
      tokens,
      base,
      nprogress,
      a11y,
      permission,
      scrollbar,
    ]
      .join('\n')
      .split('\n')
      .filter((line) => line.trimStart().startsWith('@import'));
    expect(imports.join('\n')).not.toContain('@antdv/icons');
    expect(imports.join('\n')).not.toContain('@antdv/layouts');
    // 外部只允许这三个 npm 包进入样式入口
    expect(imports).toEqual([
      "@import 'tailwindcss';",
      "@import '@antdv-next/tailwind/compat.css';",
      "@import 'tw-animate-css';",
      "@import './tokens.css';",
      "@import './base.css';",
      "@import './nprogress.css';",
      "@import './a11y.css';",
      "@import './permission.css';",
      "@import './scrollbar.css';",
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
