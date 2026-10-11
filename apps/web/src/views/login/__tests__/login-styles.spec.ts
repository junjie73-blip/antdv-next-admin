import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { useLoginStyles } from '../composables/useLoginStyles';

/**
 * 登录页样式表的两条不变量，对应的都是它出过的真实问题：
 * 强调色写死（换主色不动）和中性色没配深色（整站黑了、登录页还白着）。
 * 断言的是"每条 class 自己合不合规矩"，而不是"有没有某个类名字符串"，
 * 所以往 composable 里加新条目会自动被覆盖到。
 */
const styleSheet = useLoginStyles();

/** 只写了浅色一侧的中性色：出现它就必须同时出现 `dark:` */
const LIGHT_ONLY_NEUTRAL
  = /\b(?:bg-white\b|bg-slate-[12]00\b|border-slate-[123]00\b|text-slate-[456789]00\b)/u;

const ACCENT_LITERAL = /(bg|text|border|ring|shadow|from|via|to)-(blue|indigo|violet|sky)-[0-9]|#1677ff/iu;

function entries() {
  return Object.entries(styleSheet).map(([name, computed]) => [
    name,
    String(computed.value),
  ]) as Array<[string, string]>;
}

describe('登录页样式表', () => {
  it('每一条样式都能拿到（防止漏 return 导致模板上是 undefined）', () => {
    expect(entries().length).toBeGreaterThan(15);
    for (const [name, classes] of entries()) {
      expect(classes, `${name} 是空的`).not.toBe('');
      expect(classes, `${name} 不是字符串`).not.toContain('undefined');
    }
  });

  it('强调色只走主色变量，不出现写死的蓝', () => {
    const accented = entries().filter(([, classes]) =>
      /ant-primary|color-mix|var\(--ant/u.test(classes),
    );
    expect(accented.length, '登录页没有任何一处跟随主色').toBeGreaterThan(4);
    for (const [name, classes] of entries()) {
      expect(classes, `${name} 写死了强调色`).not.toMatch(ACCENT_LITERAL);
    }
  });

  it('写了浅色中性色的地方必须配深色变体', () => {
    for (const [name, classes] of entries()) {
      if (LIGHT_ONLY_NEUTRAL.test(classes)) {
        expect(classes, `${name} 缺 dark: 变体`).toContain('dark:');
      }
    }
  });
});

describe('登录页模板', () => {
  const template = readFileSync(
    // vitest 里 import.meta.url 是 http 形式，fileURLToPath 会直接抛错；
    // 而 `pnpm test:unit` 是逐包跑的，cwd 就是 apps/web
    resolve(process.cwd(), 'src/views/login/index.vue'),
    'utf8',
  );

  it('不覆盖 antd 从主色派生的控件配色', () => {
    expect(template).not.toMatch(ACCENT_LITERAL);
    // 旧版在这里用 !important 把复选框钉成白底，深色模式下变成一块白
    expect(template).not.toMatch(/ant-checkbox-inner\]?:\s*!?\s*bg-white/u);
  });

  /**
   * 端到端夹具（`e2e/utils/app.ts` 的 `signIn`）就是靠这三个可访问名定位的，
   * 改文案会把它整套用例一起弄红 —— 这条断言把契约钉在改文案的当下。
   */
  it('保留端到端夹具依赖的占位符与按钮文案', () => {
    expect(template).toContain('placeholder="请输入用户名"');
    expect(template).toContain('placeholder="请输入密码"');
    expect(template).toMatch(/>\s*登录\s*<\/a-button>/u);
  });
});
