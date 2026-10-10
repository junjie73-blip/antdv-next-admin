import type { PluginOption } from 'vite';

import { getFileBasedRouteName } from 'vue-router/unplugin';
import VueRouter from 'vue-router/vite';

import viteVueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import tailwindcss from '@tailwindcss/vite';
import viteVue from '@vitejs/plugin-vue';
import viteVueJsx from '@vitejs/plugin-vue-jsx';
import Inspect from 'vite-plugin-inspect';
import { wrapPlugin } from 'vite-plugin-performance';
import Layouts from 'vite-plugin-vue-layouts-next';

import { createIsCustomElement } from './custom-elements';

export function createVuePlugins(): PluginOption[] {
  const plugins: PluginOption[] = [
    VueRouter({
      routesFolder: ['src/views'],
      dts: './types/router.d.ts',
      exclude: [
        // 只排除**页面目录内部**的 components/（页面私有组件，
        // 如 views/screen/components 与 views/security/dashboard/components）。
        //
        // 这里原本形如「双星 + 斜杠 + /components/ + 星」的模式，而 `**/` 能匹配"零层目录"，
        // 于是把 views/components 下那 26 个组件示例页一起排除了 —— 表现是
        // 路由表里根本没有这些路径，访问全部命中兜底 /error/404。
        // 中间多要求一段目录（星号 + 斜杠 + components）之后，
        // 私有组件继续被排除，示例页恢复成真实路由。
        '**/*/components/*',
        'account/**/*',
        'login/**/*',
        'register/**/*',
      ],
      extensions: ['.vue', '.tsx'],
      getRouteName: (routeNode) => getFileBasedRouteName(routeNode),
    }),
    viteVue({
      template: {
        compilerOptions: {
          // `<micro-app>` 这类由 SDK 在运行时注册的标签，交给浏览器当原生元素处理，
          // 不然每次渲染都会刷 "Failed to resolve component"（见 custom-elements.ts）
          isCustomElement: createIsCustomElement(),
        },
      },
    }),
    viteVueJsx(),
    tailwindcss(),
    wrapPlugin(Inspect(), { threshold: 50 }),
    // 该插件的 Options 里没有 dts 字段（它不生成布局声明文件），
    // 布局类型由 apps/web/src/types/layout.d.ts 手工声明，这里不要留一个被忽略的配置
    Layouts({
      exclude: ['**/components/**', '**/widgets/**'],
      defaultLayout: 'index',
    }),
    viteVueI18nPlugin({
      compositionOnly: true,
      fullInstall: true,
      runtimeOnly: true,
    }),
  ];

  // Vue DevTools 按需启用（从环境变量读取，此处由 index.ts 控制传入或在此处读取）
  // 为保持独立性，此处需结合环境变量判断，实际可提取到 index.ts 中
  return plugins;
}
