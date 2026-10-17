import { describe, expect, it } from 'vitest';

import { DEFAULT_LOADING_HTML } from '../src/plugins/app-loading/defaults/loading-html';
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
    expect(script).toContain("classList.toggle(DARK,dark)");
    expect(script).toContain("s.theme==='auto'");
    expect(script).toContain('prefers-color-scheme: dark');
    expect(script).toContain("root.style.colorScheme=dark?'dark':'light'");
  });

  it('只有 custom 档内联主色，预设档交给色板', () => {
    const script = generateThemeSyncScript(options);
    expect(script).toContain("if(s.themeKey==='custom'&&v.primary)");
  });

  it('快照模式与当前解析出的模式一致才用快照实色', () => {
    const script = generateThemeSyncScript(options);
    expect(script).toContain("if(s.mode===(dark?'dark':'light')){");
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
  const html = '<html><head><title>t</title></head><body><div id="app"></div></body></html>';

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
  it('三级回退：首屏快照 → 应用色板 → 按明暗兜底', () => {
    expect(DEFAULT_LOADING_HTML).toContain(
      '--app-loading-primary: var(--loading-primary, var(--app-primary, #1677ff));',
    );
  });

  it('不再引用本仓库不存在的 --color-* 变量名', () => {
    // 那几个名字是 antd 时代的遗产：读不到就永远吃 #007bff，
    // 表现正是"遮罩一直是出厂蓝，跟全局主色没关系"
    expect(DEFAULT_LOADING_HTML).not.toContain('--color-primary');
    expect(DEFAULT_LOADING_HTML).not.toContain('--color-bg-layout');
  });

  it('渐变第二档用 color-mix 现算，不依赖额外的主色派生变量', () => {
    expect(DEFAULT_LOADING_HTML).toContain('color-mix(in srgb');
  });
});
