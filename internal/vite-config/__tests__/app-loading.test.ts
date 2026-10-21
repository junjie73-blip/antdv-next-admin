import { describe, expect, it } from 'vitest';

import DEFAULT_LOADING_HTML from '../src/plugins/app-loading/defaults/loading.html?raw';
import { DEFAULT_OPTIONS } from '../src/plugins/app-loading/src/constants';
import { injectThemeSync } from '../src/plugins/app-loading/src/html-injector';
import {
  generateThemeSyncScript,
  THEME_SYNC_MARKER,
  themeSyncTag,
} from '../src/plugins/app-loading/src/theme-sync';

const options = { ...DEFAULT_OPTIONS };

describe('generateThemeSyncScript', () => {
  it('按后缀找键，不重复推导应用前缀', () => {
    const script = generateThemeSyncScript(options);
    // 前缀由应用运行时注入（configureSharedEnv），构建期抄一份就会两边不一致
    expect(script).toContain('"_bootTheme"');
    expect(script).toContain('key.slice(-SUFFIX.length)===SUFFIX');
  });

  it('明暗走 class 开关，并按当前系统偏好解析 auto', () => {
    const script = generateThemeSyncScript(options);
    expect(script).toContain('classList.toggle(DARK,dark)');
    expect(script).toContain("s.theme==='auto'");
    expect(script).toContain('prefers-color-scheme: dark');
    expect(script).toContain("root.style.colorScheme=dark?'dark':'light'");
  });

  /**
   * 颜色搬运必须过版本门：`--primary` 里的值从"完整颜色"换成了"HSL 三段"，
   * v1 快照那种 `#1677ff` 拼进 `hsl(var(--x))` 解析失败，遮罩直接染成透明 ——
   * 现象是首屏白屏，而且构建一声不吭。明暗 class 与档位跟格式无关，不受门限制。
   */
  it('只有 custom 档内联主色，且颜色搬运 gated 在快照版本上', () => {
    const script = generateThemeSyncScript(options);
    expect(script).toContain('var ok=s.version===2;');
    expect(script).toContain("if(ok&&s.themeKey==='custom'&&v.primary)");
  });

  it('快照模式与当前解析出的模式一致才用快照实色', () => {
    const script = generateThemeSyncScript(options);
    expect(script).toContain("if(ok&&s.mode===(dark?'dark':'light')){");
  });

  it('darkClass 与键后缀可配，值以字面量注入而非拼接', () => {
    const script = generateThemeSyncScript({
      ...options,
      darkClass: 'theme-dark',
      themeCacheKeySuffix: 'bootThemeX',
    });
    expect(script).toContain('var DARK="theme-dark"');
    expect(script).toContain('"_bootThemeX"');
  });

  it('整段包在 try 里，隐私模式读不到 localStorage 也只是不染色', () => {
    const script = generateThemeSyncScript(options);
    expect(script.startsWith('(function(){\ntry{')).toBe(true);
    expect(script.endsWith('}catch(e){}\n})();')).toBe(true);
  });
});

describe('themeSyncTag / injectThemeSync', () => {
  const html =
    '<html><head><title>t</title></head><body><div id="app"></div></body></html>';

  it('带上可去重的标记属性', () => {
    expect(themeSyncTag(options)).toContain(`<script ${THEME_SYNC_MARKER}>`);
  });

  it('注入到 </head> 之前，保证遮罩首次被画出来时变量已就位', () => {
    const next = injectThemeSync(html, themeSyncTag(options));
    expect(next.indexOf(THEME_SYNC_MARKER)).toBeLessThan(next.indexOf('<body'));
  });

  it('重复注入只有一份', () => {
    const once = injectThemeSync(html, themeSyncTag(options));
    const twice = injectThemeSync(once, themeSyncTag(options));
    expect(twice).toBe(once);
  });

  it('没有 head 标签时原样返回，不产生半个文档', () => {
    const fragment = '<div id="__app-loading__"></div>';
    expect(injectThemeSync(fragment, themeSyncTag(options))).toBe(fragment);
  });
});

describe('默认 loading 模板的颜色链路', () => {
  /**
   * 三级回退，而且每一级都是 HSL 三段（不是完整颜色）：模板把变量套进 `hsl()`，
   * 上游谁写进来都必须是通道形状，否则整条 `--app-loading-primary` 失效，
   * 遮罩跟着变成透明。用 `\s*` 而不是单行精确匹配 —— 长串会被格式化工具折行。
   */
  it('三级回退：首屏快照 → 应用色板 → 按明暗兜底', () => {
    expect(DEFAULT_LOADING_HTML).toMatch(
      /--app-loading-primary:\s*hsl\(\s*var\(--loading-primary,\s*var\(--primary,\s*215\.02 100% 54\.31%\)\)\s*\)/u,
    );
    expect(DEFAULT_LOADING_HTML).toMatch(
      /--app-loading-bg:\s*hsl\(\s*var\(--loading-background,\s*var\(--background,\s*0 0% 100%\)\)\s*\)/u,
    );
  });

  it('不再引用本仓库不存在的 --color-* 变量名', () => {
    // 那几个名字是 antd 时代的遗产：读不到就永远吃 #007bff，
    // 表现正是"遮罩一直是出厂蓝，跟全局主色没关系"
    expect(DEFAULT_LOADING_HTML).not.toContain('--color-primary');
    expect(DEFAULT_LOADING_HTML).not.toContain('--color-bg-layout');
  });

  it('不再读已退役的 --app-* 主题变量', () => {
    // 只有遮罩自己的三个局部变量保留 `--app-loading-*` 命名（它们不出模板）
    expect(DEFAULT_LOADING_HTML).not.toMatch(
      /var\(--app-(?!loading-)[\w-]+\)/u,
    );
  });

  it('渐变第二档用 color-mix 现算，不依赖额外的主色派生变量', () => {
    expect(DEFAULT_LOADING_HTML).toContain('color-mix(in srgb');
  });
});

/**
 * 模板本体是 `defaults/loading.html`，构建期经 `?raw` 内联成字符串。
 *
 * 这三条钉的是"它仍然是一份能直接注入 index.html 的 HTML 片段"这件事：
 * 从 TS 迁到 HTML 之后，模板不再经过任何拼接或转义，所以根节点、注入用的
 * 容器 id 与 rem 圆角口径都得在这里看一眼，坏了就是首屏白屏那一类。
 */
describe('默认 loading 模板（HTML 文件）', () => {
  it('是一段以遮罩容器打头的 HTML 片段，容器 id 与默认选择器一致', () => {
    expect(DEFAULT_LOADING_HTML.trimStart().startsWith('<!--')).toBe(true);
    expect(DEFAULT_LOADING_HTML).toContain('<div id="__app-loading__"');
    expect(DEFAULT_LOADING_HTML.trimEnd().endsWith('</div>')).toBe(true);
  });

  it('样式随容器一起注入，不产生游离的 <style>', () => {
    // 数闭合标签而不是开标签：模板头部的注释里也提到了 `<style>` 这个词
    expect(DEFAULT_LOADING_HTML.match(/<\/style>/gu)?.length).toBe(1);
    expect(DEFAULT_LOADING_HTML.lastIndexOf('<style>')).toBeGreaterThan(
      DEFAULT_LOADING_HTML.indexOf('<div id="__app-loading__"'),
    );
  });

  it('圆角一律 rem（50% 这类比例值不是长度，保留）', () => {
    const radii = [
      ...DEFAULT_LOADING_HTML.matchAll(/border(?:-\w+)*-radius:\s*([^;]+);/gmu),
    ].flatMap((match) => (match[1] === undefined ? [] : [match[1].trim()]));
    expect(radii.length).toBeGreaterThan(0);
    for (const value of radii) {
      expect(value, `圆角 "${value}" 必须写成 rem`).toMatch(
        /^(\d+(?:\.\d+)?rem|50%)$/u,
      );
    }
  });
});
