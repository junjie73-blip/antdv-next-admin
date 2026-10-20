import type { PluginOption } from 'vite';

import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPlugins } from '../src/plugins';

/**
 * `createPlugins` 会实例化 unplugin-auto-import / svg-icons 等插件，这些插件在
 * 构造期就去解析宿主项目的依赖（@vueuse/core、@iconify-json/*），所以只有把 cwd
 * 切到某个真实应用目录下才能跑通 —— 这也正好验证了"配置层不依赖包内环境"。
 */
const APP_ROOT = fileURLToPath(new URL('../../../apps/web', import.meta.url));

/** 数组型插件（unplugin 系会返回 `[插件, 插件…]`）可能再套一层，展平到能拿到 name 即可 */
const PLUGIN_FLAT_DEPTH = 4;

function pluginNames(plugins: PluginOption[]): string[] {
  return plugins
    .flat(PLUGIN_FLAT_DEPTH)
    .filter((plugin): plugin is { name: string } =>
      Boolean(
        plugin &&
        typeof plugin === 'object' &&
        'name' in plugin &&
        (plugin as { name?: string }).name,
      ),
    )
    .map((plugin) => plugin.name);
}

const originalCwd = process.cwd();

beforeAll(() => {
  process.chdir(APP_ROOT);
});

afterAll(() => {
  process.chdir(originalCwd);
});

describe('createPlugins 按产物形态分层', () => {
  it('应用形态带 HTML 注入，不带 .d.ts 生成', async () => {
    const list = pluginNames(await createPlugins('development'));
    expect(list).toContain('vite:html');
    expect(list).not.toContain('vite:dts');
  });

  it('库形态反过来：出 .d.ts，不碰 HTML / devtools / mock', async () => {
    const list = pluginNames(
      await createPlugins('development', { kind: 'library' }),
    );
    expect(list).toContain('vite:dts');
    expect(list).not.toContain('vite:html');
    expect(list).not.toContain('vite-plugin-vue-devtools');
    expect(list).not.toContain('vite:mock-server');
  });

  it('库模式 dts: false 时连声明插件也不挂', async () => {
    const list = pluginNames(
      await createPlugins('development', { dts: false, kind: 'library' }),
    );
    expect(list).not.toContain('vite:dts');
  });

  it('两种形态共用编译链，但库形态不带任何按宿主环境工作的插件', async () => {
    const app = pluginNames(await createPlugins('development'));
    const lib = pluginNames(
      await createPlugins('development', { kind: 'library' }),
    );

    // SFC / TSX / Tailwind 两边都要有，否则子包的 .vue、.tsx 与原子类编译不出来
    const compile = [
      'vite:vue',
      'vite:vue-jsx',
      '@tailwindcss/vite:scan',
      '@tailwindcss/vite:generate:build',
    ];
    for (const name of compile) {
      expect(app).toContain(name);
      expect(lib).toContain(name);
    }

    expect(app.length).toBeGreaterThan(lib.length);

    // 这些插件扫 src/views、回写 cwd/types/*.d.ts、要求 @iconify-json/* 与
    // src/assets/icons 存在 —— 子包按自己的目录构建时前提全不成立。
    const appOnly = [
      'vue-router',
      'vite-plugin-vue-layouts-next',
      'unplugin-vue-i18n:resource',
      'vite-plugin-inspect',
      'unplugin-auto-import',
      'unplugin-vue-components',
      'tomjs:iconify',
      'vite:svg-icons',
      'vite:imagemin',
      'vite-dayjs-plugin',
      'vite:html',
      'vite-plugin-app-loading',
    ];
    for (const name of appOnly) {
      expect(app).toContain(name);
      expect(lib).not.toContain(name);
    }
  });
});
