import type { XssFilterOptions } from '../src/xss';

import { describe, expect, it, vi } from 'vitest';

import {
  detectXss,
  escapeAttr,
  escapeCss,
  escapeDirective,
  escapeHtml,
  escapeJs,
  escapeUrl,
  purifyHtml,
  safeHtmlDirective,
  sanitizeInput,
  sanitizeUrl,
  smartEscape,
  stripDangerousMarkup,
} from '../src/xss';

/** 这些函数会 console.warn 刷攻击模式名，测试里静音 */
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('escapeHtml', () => {
  it('转义尖括号、引号、斜杠与等号', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;',
    );
    expect(escapeHtml(`a'b"c&d=e`)).toBe(
      'a&#39;b&quot;c&amp;d&#x3D;e',
    );
  });

  it('空值返回空串而不是 undefined', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('反转义后回到原文，保证只转义一次', () => {
    const raw = '<b>粗体 & "引号"</b>';
    const escaped = escapeHtml(raw);
    const textarea = document.createElement('textarea');
    textarea.innerHTML = escaped;
    expect(textarea.value).toBe(raw);
  });
});

describe('escapeJs', () => {
  it('转义引号与换行，属性注入无法逃逸', () => {
    expect(escapeJs(`" onmouseover="alert(1)`)).toBe(
      String.raw`\" onmouseover=\"alert(1)`,
    );
    expect(escapeJs(`line1\nline2`)).toBe(String.raw`line1\nline2`);
    expect(escapeJs(`tab\there`)).toBe(String.raw`tab\there`);
  });

  it('每个反斜杠都被转义（回归：曾经只替换第一个）', () => {
    expect(escapeJs(String.raw`a\b\c\\d`)).toBe(String.raw`a\\b\\c\\\\d`);
  });

  it('不吞掉普通字符', () => {
    expect(escapeJs('hello 世界 123')).toBe('hello 世界 123');
  });
});

describe('escapeUrl', () => {
  it('危险协议直接替换为占位地址', () => {
    expect(escapeUrl('javascript:alert(1)')).toBe('#unsafe-url');
    expect(escapeUrl('  JaVaScRiPt:alert(1)')).toBe('#unsafe-url');
    expect(escapeUrl('data:text/html,<script>')).toBe('#unsafe-url');
    expect(escapeUrl('vbscript:msgbox')).toBe('#unsafe-url');
  });

  it('正常地址做 encodeURI', () => {
    expect(escapeUrl('https://a.com/中文/a b')).toBe(
      'https://a.com/%E4%B8%AD%E6%96%87/a%20b',
    );
  });
});

describe('escapeCss', () => {
  it('移除表达式与脚本协议', () => {
    expect(escapeCss('background:expression(alert(1))')).not.toContain(
      'expression(',
    );
    expect(escapeCss('background:url(javascript:1)')).not.toContain(
      'javascript:',
    );
    expect(escapeCss('behavior:url(#default#time2)')).not.toContain('behavior:');
  });

  it('保留安全字符', () => {
    expect(escapeCss('12px solid #fff')).toBe('12px solid #fff');
  });
});

describe('escapeAttr', () => {
  it('先 JS 转义再 HTML 转义', () => {
    expect(escapeAttr(`" onmouseover="alert(1)`)).toContain('&quot;');
    expect(escapeAttr('<b>')).toContain('&lt;');
  });
});

describe('smartEscape', () => {
  it('按上下文分派', () => {
    expect(smartEscape('<a>', 'html')).toBe(escapeHtml('<a>'));
    expect(smartEscape('javascript:1', 'url')).toBe('#unsafe-url');
    expect(smartEscape(String.raw`a\b`, 'js')).toBe(String.raw`a\\b`);
    expect(smartEscape('12px', 'css')).toBe('12px');
    expect(smartEscape("'", 'attr')).toBe(escapeAttr("'"));
    expect(smartEscape('<a>')).toBe(escapeHtml('<a>'));
  });
});

describe('detectXss', () => {
  it('识别常见攻击向量', () => {
    expect(detectXss('<script>alert(1)</script>')).toBe(true);
    expect(detectXss('<img src=x onerror=alert(1)>')).toBe(true);
    expect(detectXss('javascript:alert(1)')).toBe(true);
    expect(detectXss('<iframe src="//evil"></iframe>')).toBe(true);
    expect(detectXss('<svg onload=alert(1)></svg>')).toBe(true);
    expect(detectXss('<a href=" javascript:alert(1)">x</a>')).toBe(true);
  });

  it('正常文本不误报', () => {
    expect(detectXss('今天的销售额是 1,234 元')).toBe(false);
    expect(detectXss('')).toBe(false);
  });

  it('超长输入按可疑处理（防 DOS）', () => {
    expect(detectXss('a'.repeat(10_001))).toBe(true);
  });
});

describe('sanitizeInput', () => {
  it('默认不允许 HTML：整段转义', () => {
    expect(sanitizeInput('<b>hi</b>')).toBe('&lt;b&gt;hi&lt;&#x2F;b&gt;');
  });

  it('allowHtml 时先剥离脚本与事件属性，再交给 DOMPurify', () => {
    const out = sanitizeInput('<p onclick="evil()">ok</p><script>bad()</script>', {
      allowHtml: true,
      allowedTags: ['p'],
    });
    // 只断言「下限」：无论运行环境的 DOMPurify 是否完整可用，最危险的三类内容都不能出现。
    // 白名单标签是否保留属于 DOMPurify 自身行为，放到浏览器验证里覆盖。
    expect(out).not.toContain('bad()');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain('onclick');
    expect(out).toContain('ok');
  });

  it('iframe / object 一并剥离', () => {
    const out = sanitizeInput('<div>a</div><iframe src="//evil"></iframe>', {
      allowHtml: true,
    });
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toContain('//evil');
  });

  it('按 maxLength 截断', () => {
    expect(sanitizeInput('abcdef', { maxLength: 3 })).toBe('abc');
  });

  it('去掉空字节与首尾空白', () => {
    expect(sanitizeInput('  hi\0  ')).toBe('hi');
  });

  it('空输入返回空串', () => {
    expect(sanitizeInput('')).toBe('');
  });
});

describe('sanitizeUrl', () => {
  it('白名单协议放行并规范化', () => {
    expect(sanitizeUrl('https://a.com/b?c=1')).toBe('https://a.com/b?c=1');
    expect(sanitizeUrl('http://a.com')).toBe('http://a.com/');
  });

  it('危险/未知协议拦截', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('ftp://a.com')).toBe('');
  });

  it('相对路径需要显式允许', () => {
    expect(sanitizeUrl('/system/user')).toBe('');
    expect(sanitizeUrl('/system/user', true)).toBe('/system/user');
    expect(sanitizeUrl('../etc/passwd', true)).toBe('../etc/passwd');
    expect(sanitizeUrl('a<b', true)).toBe('');
  });
});

describe('purifyHtml', () => {
  it('不允许 HTML 时退回转义', async () => {
    await expect(purifyHtml('<b>x</b>')).resolves.toBe(
      '&lt;b&gt;x&lt;&#x2F;b&gt;',
    );
  });

  it('允许 HTML 时脚本与事件属性都不残留', async () => {
    const out = await purifyHtml('<div onclick="evil()">a</div><script>bad()</script>', {
      allowHtml: true,
      allowedTags: ['div'],
    });
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain('bad()');
    expect(out).not.toContain('onclick');
  });
});

describe('stripDangerousMarkup（DOMPurify 之外的下限保证）', () => {
  const opts: Required<XssFilterOptions> = {
    allowHtml: true,
    allowedTags: [],
    forbiddenAttrs: [],
    stripScript: true,
    stripEventHandlers: true,
    maxLength: 10_000,
    allowUrl: true,
    urlProtocols: [],
  };

  it('剥离 script / iframe / object / embed 整块', () => {
    expect(stripDangerousMarkup('<b>a</b><script>alert(1)</script>', opts)).toBe(
      '<b>a</b>',
    );
    expect(
      stripDangerousMarkup('<iframe src="//evil"></iframe>keep', opts),
    ).toBe('keep');
    expect(stripDangerousMarkup('<object data="x"></object>', opts)).toBe('');
    expect(stripDangerousMarkup('<embed src="x">y', opts)).toBe('y');
  });

  it('大小写与换行写法都要命中', () => {
    expect(
      stripDangerousMarkup('<SCRIPT >a()</ScRiPt>', opts),
    ).not.toContain('SCRIPT');
    expect(
      stripDangerousMarkup('<script\n  type="text/javascript">x()</script>', opts),
    ).toBe('');
  });

  it('剥离 on* 事件属性（带引号与不带引号）', () => {
    expect(stripDangerousMarkup('<img src="a.png" onerror=alert(1)>', opts)).toBe(
      '<img src="a.png">',
    );
    expect(stripDangerousMarkup("<a ONCLICK = 'evil()'>x</a>", opts)).toBe(
      '<a>x</a>',
    );
    expect(stripDangerousMarkup('<p srcdoc="<b>">x</p>', opts)).not.toContain(
      'srcdoc',
    );
  });

  it('按选项关闭：stripScript/stripEventHandlers 为 false 时不动', () => {
    const html = '<b>x</b><script>bad()</script><i onclick="e()">y</i>';
    expect(
      stripDangerousMarkup(html, { ...opts, stripScript: false }),
    ).toContain('<script>');
    expect(
      stripDangerousMarkup(html, { ...opts, stripEventHandlers: false }),
    ).toContain('onclick');
  });

  it('普通内容原样保留', () => {
    const html = '<p class="lead">你好 <strong>世界</strong></p>';
    expect(stripDangerousMarkup(html, opts)).toBe(html);
  });
});

describe('Vue 指令', () => {
  it('v-safe-html 渲染清理后的 HTML，字符串与对象两种写法都支持', () => {
    const el = document.createElement('div');
    safeHtmlDirective.mounted(el, {
      value: '<h3>标题</h3><script>bad()</script>',
    });
    expect(el.innerHTML).not.toMatch(/<script/i);
    expect(el.innerHTML).not.toContain('bad()');

    const el2 = document.createElement('div');
    safeHtmlDirective.updated(el2, {
      value: { allowedTags: ['em'], content: '<em>ok</em><script>bad()</script>' },
    });
    expect(el2.innerHTML).not.toContain('bad()');
    expect(el2.innerHTML).toContain('ok');
  });

  it('v-escape 写入 textContent，默认按 HTML 上下文转义', () => {
    const el = document.createElement('span');
    escapeDirective.mounted(el, { arg: undefined, value: '<b>x</b>' });
    expect(el.textContent).toBe('&lt;b&gt;x&lt;&#x2F;b&gt;');
    expect(el.querySelector('b')).toBeNull();

    const js = document.createElement('span');
    escapeDirective.updated(js, { arg: 'js', value: `"q"` });
    expect(js.textContent).toBe(escapeJs('"q"'));
  });
});
