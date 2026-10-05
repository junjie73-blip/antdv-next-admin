import type { PluginOption } from 'vite'

import Pages from 'vite-plugin-pages'

/**
 * 文件即路由：src/views 的目录结构决定路径，页面中间的 `<route>` 块决定路由名与 meta。
 *
 * - `baseRoute: ''`：`src/views/system/user/index.vue` → `/system/user`，与现有菜单路径一致；
 * - `routeBlockLang: 'yaml'`：路由信息用 YAML 写，比 json5 更适合注释；
 * - `exclude`：目录里的 `components/**`、公共子组件与示例残片不是页面，不能变成路由；
 * - `dts`：生成 `types/auto-routes.d.ts`，让 `router.push({ name: 'SystemUser' })` 有类型提示。
 *
 * 路由表由 `src/router/pages.ts` 消费：`virtual:pages` 负责注册，`menu.ts` 负责把同一批
 * `<route>` 块推导成侧边栏菜单树，两处共用一份来源，不再手写菜单。
 */
export function createPagesPlugin(): PluginOption {
  return Pages({
    dirs: [{ baseRoute: '', dir: 'src/views' }],
    exclude: [
      '**/components/**',
      '**/composables/**',
      '**/*.components.vue',
      'demo/**',
      'micro-app/**',
    ],
    extensions: ['vue'],
    importMode: 'async',
    routeBlockLang: 'yaml',
    dts: 'types/auto-routes.d.ts',
  })
}
