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

function pluginNames(plugins: PluginOption[]): string[] {
  return plugins
    .flat(4)
    .filter(
      (plugin): plugin is { name: string } =>
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

  it('两种形态共用同一条编译链（Vue / 自动导入 / 组件 / 图标 / 样式）', async () => {
    const shared = (list: string[]) =>
      list.filter((name) =>
        /^(vite:vue|@tailwindcss|unplugin-|vite-plugin-vue-layouts|tomjs:iconify|vite-plugin-env-parse|vite:svg-icons|vite:imagemin|vite-dayjs-plugin|vue-router)/.test(
          name,
        ),
      );

    const app = shared(pluginNames(await createPlugins('development')));
    const lib = shared(
      pluginNames(await createPlugins('development', { kind: 'library' })),
    );

    expect(app.length).toBeGreaterThan(10);
    expect(lib).toEqual(app);
  });
});
