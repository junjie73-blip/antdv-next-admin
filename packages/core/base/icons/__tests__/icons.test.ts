import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 图标子包的契约测试。
 *
 * 这个包的边界是"只有图标，而且只用 shadcn-ui 封装"：
 * 一旦有人为了省事在 `IconPicker` 里塞回 antdv-next 的 `a-popover`，
 * 包就又变成"必须靠宿主的自动导入解析器才能跑"的东西 —— 构建照样绿，
 * 只是换一种消费方式时整块 UI 静默消失。所以把边界钉在断言里。
 */
// jsdom 环境下 import.meta.url 是 http:，取路径只能用 cwd（vitest 的 root 就是包目录）
const SRC = resolve(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|vue)$/u.test(entry.name) ? [full] : [];
  });
}

const sources = sourceFiles(SRC);
const allSource = sources.map((f) => readFileSync(f, 'utf8')).join('\n');
const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as { dependencies: Record<string, string>; exports: Record<string, string> };

describe('@antdv/icons —— 封装方式', () => {
  it('源码与依赖里都没有 antdv-next', () => {
    expect(allSource).not.toMatch(/from ['"]antdv-next['"]/u);
    expect(manifest.dependencies).not.toHaveProperty('antdv-next');
  });

  it('模板里不裸写 a-* 组件（那要靠宿主的自动解析器才认得）', () => {
    expect(allSource).not.toMatch(/<a-[a-z-]+/u);
  });

  it('图标选择器走的是 shadcn-ui 原语', () => {
    const picker = readFileSync(`${SRC}/icon/IconPicker.vue`, 'utf8');
    expect(picker).toContain('@antdv/shadcn-ui');
    expect(picker).toMatch(/Popover/u);
  });
});

describe('@antdv/icons —— 导出面', () => {
  /** 注释里会提到迁出去的组件名，断言只看真实的注册表与导出语句 */
  const entry = readFileSync(`${SRC}/index.ts`, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('*'))
    .join('\n');

  it('全局注册表里只有图标', () => {
    const block = /const COMPONENTS[^{]*\{([^}]*)\}/u.exec(entry)?.[1] ?? '';
    expect(
      Object.keys(
        Object.fromEntries(
          [...block.matchAll(/(\w+),/gu)].map((m) => [m[1], true]),
        ),
      ).sort(),
    ).toEqual(['IconPicker', 'IconifyIcon', 'SvgIcon']);
    expect(entry).not.toMatch(/vLoading/u);
  });

  it('不再导出 loading / scrollbar', () => {
    expect(entry).not.toMatch(/from '\.\/(loading|scrollbar)'/u);
  });

  it('不再暴露 loading / scrollbar 子路径', () => {
    expect(Object.keys(manifest.exports)).toEqual([
      '.',
      './*',
      './icon',
      './package.json',
    ]);
  });
});
