# 检查更新

一句话：**这个仓库的"检查更新"是 PWA 路线（vite-plugin-pwa 的 Service Worker 更新流），不是版本号轮询；而承载提示 UI 的 `ReloadPrompt.vue` 目前没有挂在任何布局上 —— 提示不会弹出。**

## 真实的机制在哪

| 环节 | 位置 | 事实 |
| --- | --- | --- |
| 插件装配 | `internal/vite-config/src/plugins/pwa.ts`，由 `VITE_PWA=true` 时挂上（`.env.production` 已开） | `VitePWA({ registerType: 'prompt', strategies: 'generateSW', injectRegister: 'script-defer' })`，`devOptions.enabled: true` |
| 缓存清单 | 同上 | `workbox.globPatterns` 收 js/css/html/ico/png/svg/woff2，单文件上限 20MB；图片另走 `CacheFirst` 运行时缓存（50 条 / 30 天） |
| 提示组件 | `apps/web/src/components/layout/ReloadPrompt.vue` | 完整实现：`useRegisterSW` 的 `needRefresh` / `offlineReady`、轮询、倒计时、更新按钮 |
| 挂载 | —— | **没有任何模板引用 `<ReloadPrompt />`**。它只在 `types/components.d.ts` 里有条目（`unplugin-vue-components` 扫 `src/components` 目录的产物，本地组件都会被列进去），这不等于被使用 |

所以当前线上行为是：SW 由注入的注册脚本正常装好，构建产物变化后 Workbox 会检测到新 SW 进入 waiting 状态；但 `registerType: 'prompt'` 意味着**需要 UI 去调 `updateServiceWorker()`**，而这个 UI 没挂 —— 用户看不到"发现新版本"的卡片，旧版本会一直用到下次自然刷新。

## ReloadPrompt 被挂上后的行为（读源码所得）

组件内部四条检查路径，全部只作用于 SW registration：

- **定时轮询**：`registration.update()` 每 5 分钟一次（`POLL_INTERVAL`），仅生产（`onRegisteredSW` 里 `!import.meta.env.PROD` 直接 return）；
- **页面恢复可见**：`useDocumentVisibility` 监听到 visible 后延迟 1s 查一次并恢复轮询，不可见时暂停轮询；
- **路由切换**：`router.afterEach` 触发，30s 节流（`ROUTE_CHECK_THROTTLE`）；
- **手动**：`window.__pwaCheckUpdate()`（onMounted 注册，调试用）。

提示 UI 的口径：`needRefresh` 显示"发现新版本"，同时启动 **10 秒自动更新倒计时** （`AUTO_COUNTDOWN`），点"稍后"取消自动更新但保留手动按钮；`offlineReady` 显示"离线可用" 一次性提示。倒计时用 `useTimestamp` 驱动而不是 `setInterval` 递减，标签页后台节流时也不会漂。

::: warning 这里没有的东西，别按 vue-vben-admin 的文档找

- 没有接口轮询 `package.json` 版本号 / `buildTime` 对比的"版本检查服务"；
- 没有 `__APP_INFO__`（构建时间 + 依赖清单，`defineApplicationConfig` 会注入）与运行时对比的逻辑 —— 它目前只是构建元数据，没有消费者拿它做更新判定；
- 没有版本信息展示页。想要"检测到新版本文案 + 立即刷新"的完整体验，第一步就是把 `<ReloadPrompt />` 挂进布局（例如 `apps/web/src/layouts/index.vue` 根节点旁），其余逻辑都是现成的。:::

## 本地验证

```bash
pnpm --filter @antdv/web build     # VITE_PWA=true 产物含 sw.js 与 workbox-*.js
pnpm --filter @antdv/web preview
```

改一个页面文案重新 build，对比 `dist/sw.js` 里的 precache 清单变化；挂载组件后，preview 页面右下角应出现"发现新版本"卡片。dev 下 `devOptions.enabled` 也是 true，但 dev 的 SW 产物在 `dev-dist/`，行为与生产不完全一致，验证以 preview 为准。

## 相关页面

- Vite 插件开关全表：[Vite 配置](/zh/guide/project/vite)
- 构建产物与部署：[部署](/zh/guide/essentials/deploy)
