import { readFileSync } from 'node:fs';
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
  readFileSync(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), 'utf8');

const index = read('index.css');
const base = read('base.css');
const nprogress = read('nprogress.css');
const a11y = read('a11y.css');
const permission = read('permission.css');
const scrollbar = read('scrollbar.css');

describe('@antdv/styles —— 入口', () => {
  it('第一句必须是层级顺序声明，utilities 排在最后', () => {
    // 顺序错了会出现"组件里的 components 规则盖掉模板 utilities"这类难查问题
    const layerDecl = /@layer\s+([^;]+);/u.exec(index)?.[1]?.trim();
    expect(layerDecl).toBe('theme, base, antd, components, utilities');
    expect(index.indexOf('@layer theme')).toBeLessThan(index.indexOf("@import 'tailwindcss'"));
  });

  it('Tailwind 本体 + antdv-next 兼容层 + 动画库都要在入口里', () => {
    expect(index).toContain("@import 'tailwindcss'");
    expect(index).toContain("@import '@antdv-next/tailwind/compat.css'");
    expect(index).toContain("@import 'tw-animate-css'");
    expect(index).toContain('@plugin "@tailwindcss/typography"');
    expect(index).toContain('@plugin "@tailwindcss/nesting"');
  });

  it('dark 变体走 .dark 类，与 preferences 写 DOM 的方式一致', () => {
    expect(index).toContain('@custom-variant dark (&:where(.dark, .dark *))');
  });

  it('五个分部都在入口里被引入，且 @import 全部出现在 @plugin 之前', () => {
    for (const part of ['base', 'nprogress', 'a11y', 'permission', 'scrollbar']) {
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

describe('@antdv/styles —— 分部职责', () => {
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
    expect(base).toMatch(/html,\s*body\s*\{[^@]*@apply h-full overflow-hidden/u);
    // perfect-scrollbar 已经下线，别再留它的死规则
    expect(base).not.toContain('.ps__');
  });

  it('scrollbar：第三方滚动区兜底，且必须写在 base 层', () => {
    // 包不住的滚动元素（antd 表格体、虚拟列表、textarea、pre）统一压成细圆角条
    expect(scrollbar).toContain('@layer base');
    expect(scrollbar).toContain('scrollbar-width: thin');
    expect(scrollbar).toContain('scrollbar-color:');
    expect(scrollbar).toContain('::-webkit-scrollbar-thumb');
    expect(scrollbar).toContain('.dark ::-webkit-scrollbar-thumb');
    // 轨道透明，避免在深色卡片上留下一条灰槽
    expect(scrollbar).toMatch(/::-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent/u);
    // 层级是这条规则能被 `.scrollbar__wrap--hidden-default` 反向覆盖的前提
    expect(base).not.toContain('::-webkit-scrollbar');
  });

  it('nprogress：进度条配色读 antd 主色变量，不写死蓝色', () => {
    expect(nprogress).toContain('#nprogress .bar');
    expect(nprogress).toContain('var(--ant-primary-color, #1677ff)');
    expect(nprogress).toMatch(/@apply fixed top-0 left-0 z-\[9999\] h-\[3px\] w-full/u);
  });

  it('a11y：色弱/灰色模式消费 preferences 写的 --app-filter', () => {
    expect(a11y).toContain('html.color-weak');
    expect(a11y).toContain('html.gray-mode');
    expect(a11y).toContain('var(--app-filter');
    // 滤镜值要和 packages/preferences/src/css-vars.ts 的常量对得上
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

describe('@antdv/styles —— 包边界', () => {
  it('不 @import 组件包，避免 CSS 与组件互相牵动（注释里提到不算依赖）', () => {
    const imports = [index, base, nprogress, a11y, permission, scrollbar]
      .join('\n')
      .split('\n')
      .filter((line) => line.trimStart().startsWith('@import'));
    expect(imports.join('\n')).not.toContain('@antdv/ui');
    expect(imports.join('\n')).not.toContain('@antdv/layouts');
    // 外部只允许这三个 npm 包进入样式入口
    expect(imports).toEqual([
      "@import 'tailwindcss';",
      "@import '@antdv-next/tailwind/compat.css';",
      "@import 'tw-animate-css';",
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
     * 那是组件带的类，样式归 `@antdv/ui`，全局包一旦插手就会出现"改组件不生效"的分裂。
     */
    expect(scrollbar).not.toMatch(/^\s*\.scrollbar__/mu);
  });
});
