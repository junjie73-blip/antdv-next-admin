---
'@antdv/popup-ui': minor
'@antdv/web': patch
---

refactor: 轻提示与通知的关闭按钮改成单条可选项，默认不展示

诉求（用户归纳）：`message` 不再默认渲染关闭按钮；`notification` 增加可配置项控制显隐；两者的默认状态统一为「不展示」，没配置传入就没有按钮；其余功能不动，配置读写与不同取值下的展示状态都要验。

**开关落在单条，而不是 toaster**：`vue-sonner@2.0.9` 的解析顺序是 `Toast.vue:233` 的 `props.toast.closeButton ?? props.closeButton`，而 `Toaster.vue:170` 的 `closeButton` 默认 `false`。所以把开关做成 `ToastInit` 上的 `closeButton?: boolean`（`popup-ui/src/message/index.ts:67`）就能同时表达两件事——「默认没有」和「这一条要/不要」；只开在宿主那侧反而做不到后者（整体开一次，就没法让某一条不带按钮）。两条通道共用这一个键、同一条判断，`toToastOptions` 只在 `closeButton !== undefined` 时写进载荷（`:98`），所以不传时连键都不出现，载荷形状与改动前完全一致，`message` / `notification` 的方法清单仍然逐档相同。

- **`message`（`:95-98`）**：`ToastInit` 新增 `closeButton`，`closeButton: true` 才有 ✕。原来的"轻提示一律带按钮"来自宿主的整体开关，现在宿主不开了，所以默认无按钮就是默认无按钮，不是靠这层特判。
- **`notification`**：同一个键，同一个口径，走对象写法（`notification.info('标题', { closeButton: true, description: '描述' })`）。数字/字符串两档简写不带开关——那两个位置已经有含义，再往里塞布尔只会让人猜（`normalizeInit` 的注释记了这条）。
- **宿主（`apps/web/src/App.vue:60-70`）**：两只 `<Toaster>` 都去掉 `close-button`，`close-button-position="top-right"` 留着，它只给"显式开了 ✕ 的那条"定朝向。
- **示例页（`apps/web/src/views/components/feedback/index.vue`）**：通知那组改成 `{ closeButton: true, description }`，另加一张「关闭按钮开关」卡把四档都点出来（轻提示开 ✕ / 轻提示不开 / 通知开 ✕ / 通知不传），页面文案跟着改掉「点右上角 ✕ 或等 3 秒」那句已经不再适用于所有条目的说明。
- **单测**：`popup-ui/__tests__/message.test.ts` 新增一组 5 条（默认不写键 × 两条通道、简写不带开关、`true` 原样透传、轻提示侧同样生效且仍不带 `toasterId`、显式 `false` 要写进载荷），整包 18/18；`common-ui/__tests__/toast.test.ts` 补一条外壳层的默认口径（不传 props 就不该有 `[data-close-button]`）。
- **e2e**：`apps/web/e2e/preference-effects.spec.ts` 里原来那条「两条通道都能点 ✕」改成按单条口径断言（轻提示默认无按钮、通知那条有并点了立刻收），另加一条专测开关本身；卡片样式对照表里去掉了 ✕ 数量这一维，因为它已经不再是两条通道的公共属性。同一轮补了一处**早就缺的等帧**：`/account/settings` 那条 warning 在量 `elementFromPoint` 之前没调 `settleToast`，slide-in 头几帧整张卡片还在视口上沿之外、命中测试拿到 `null`，于是 WebKit 稳定假红（Chromium / Firefox 恰好读得晚所以看不出来；缩小到单条复跑仍红 → 补 `settleToast` 后通过）。
- **文档**：`docs/components/modal-drawer.md` 与 en 镜像的「为什么根部要挂两只 `<Toaster />`」一节重写（原话「两只都开 `close-button`」已过期），签名表与行号引用同步（`message/index.ts` 从 128 行变 141 行，`NOTIFICATION_TOASTER_ID` 从 `:33` 移到 `:34` 等）；`docs/zh/**` 那份副本按 `docs/.vitepress/config.mts:14-15` 的口径不写入。

顺带两处类型口径修复：`apps/web/tsconfig.vitest.json` 的 `types` 是**覆盖**不是追加，原来漏了 `vite/client`，于是 `ImportMetaEnv` 没有索引签名、被测源码里的 `import.meta.env.VITE_APP_BASE_API` 报 TS2339；补上之后该项目的报错从 74 降到 66，`src/plugins/**` 与其新增用例全部干净。`types/env.d.ts:1-4` 顶部那几行 `<reference>` 也被 `spaced-comment` 拆成了 `// /`（本仓库文档里记过这个失效形式），所以它指望不上，`types` 里必须显式列。

验证：`popup-ui` 单测 18/18、`vue-tsc --noEmit` 该包 0 错、`common-ui/__tests__/toast.test.ts` 8/8；`apps/web` 的 `src/plugins/__tests__` 18/18、`vue-tsc -p tsconfig.app.json` 90 条存量错且无一条落在本轮改动文件、`-p tsconfig.vitest.json` 66 条同样不含 `src/plugins/**`。清掉 `apps/web/node_modules/.vite` 后重启 :6080（Nitro mock 5320 一起起），确认 dev 侧拿到的 `App.vue` / `feedback/index.vue` transform 已不含 `close-button`；`preference-effects.spec.ts` 三引擎各 `--workers=1` 整跑：chromium 10/10（1.7m）、firefox 10/10（2.8m）、webkit 10/10（补上等帧后那条单跑 57.4s 通过）。用例全程挂 `watchErrors`，四种配置组合（轻提示开/关、通知开/关）的按钮显隐与"点了立刻收"都在浏览器里读实值断言，控制台无新增报错。
