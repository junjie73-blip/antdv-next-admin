---
'@antdv/hooks': patch
'@antdv/common-ui': patch
---

refactor: 把"跨包只走包名导入"写成测试守住；`ErrorBoundary` 不再从自己的 barrel 绕，堆栈区改成定高

诉求（用户归纳）：审一遍 `packages/**` 的跨包引用——不许用相对路径伸进别的包、每个 `@antdv/*` 都要在清单里声明、并且必须走目标的 `exports`；找出来的违规要修掉并用测试固化。

- **盘点结果：仓库其实已经基本合规**。全仓 `packages/**` 的 JS/TS/Vue 里跨包相对路径 0 条、绝对路径/盘符 0 条、未声明的 `@antdv/*` 0 条（早期一轮报出 1194 条"未声明"是我扫描脚本把 `spec.slice(8)` 写错成包名截断，正确是 ` '@antdv/'.length === 7`）。真正的违规只有三处，两处是**该留的**：
  - `packages/core/base/design/src/index.css:39-48` 的 10 条 `@source` 指向别的包 —— Tailwind v4 的 `@source` 只认文件系统路径（在 `tailwindcss@4.3.3/dist/lib.js` 里确认它编译成 `{base, pattern}`，没有包名解析），而构建根在 `apps/web`，`packages/` 全在自动检测之外。试图改成包名是错的方向，改为**白名单 + 存在性 + 完整性**校验。
  - `packages/core/ui-kit/shadcn-ui/src/assets/index.css:1` 的 `@reference "@antdv/design"`，`@antdv/design` 只在 devDependencies —— 这个文件唯一的消费者是 `shadcn-ui/components.json` 的 `"css"` 字段，即 shadcn CLI 的构建期入口，分类正确。
- **唯一真违规并修掉的**：`common-ui/src/components/error-boundary/ErrorBoundary.vue:6` 原来写 `import { Scrollbar } from '@antdv/common-ui'`，即组件经自己的 barrel（`src/index.ts:111`）反向引回同包的另一个组件，是条环。打包产物里侥幸能跑，按源码消费本包的兄弟包（`tabs-ui` 引 barrel）会拿到 undefined。改成 `import Scrollbar from '../scrollbar/Scrollbar.vue'`，与包内"互引走相对路径、对外只认 barrel"的既有口径一致。
- **顺带修掉一个从迁移前就带着的显示缺陷**：默认兜底里那层堆栈区写的是 `Scrollbar root-class="max-h-32"`。`max-*` 只裁掉可视高度，`.scrollbar` 根元素本身仍是 auto 高度，内部 `.scrollbar__wrap{height:100%}` 量不到确定高度，浏览器上实测根 128px / 滚动区 400px、`scrollTop` 赋 999 仍是 0 —— 一屏 1316 字符的调用栈只显示上 128px 且滚不动。改成 `h-32` 后 clientHeight 128 / scrollHeight 400 / `scrollTop` 272，能滚了。单测钉的是类名（jsdom 不应用 SFC 的 `<style>`），几何在浏览器里量。
- **守卫落在 `packages/core/hooks/__tests__/boundary.test.ts`**（就是守"子包不许依赖 antdv-next"的那个文件，同一份 `packages/` 全体不变量放一处），新增 `describe('跨包只走包名导入')` 四条：① 相对说明符解析后必须落在自己包根内，且不许出现盘符/根路径/UNC/`file:`；② 指向本仓其他包的 `@antdv/*` 必须写在 `dependencies`/`peerDependencies`（devDependencies 只放行 CSS 工具链入口那条，见上）；③ `src` 下的文件不许通过自己的包名引自己（就是 ErrorBoundary 那条环）；④ 只有 `design/src/index.css` 允许带跨包相对路径，其中每条目标都要在磁盘上存在，且名单必须**覆盖所有 `src` 下有 `.vue` 的包**——实测这 10 个包正好是 `shadcn-ui`(373) / `common-ui`(55) / `layouts`(29) / `form-ui`(20) / `layout-ui`(9) / `table-ui`(7) / `menu-ui`(6) / `tabs-ui`(5) / `popup-ui`(3) / `icons`(3)，以后新增组件包忘记登记会直接红，不再靠肉眼发现"组件渲染出来了但没样式"。四条都用临时探针文件验过能红（跨包相对路径、`J:/…` 绝对路径、未声明依赖、自引包名、给未登记包塞一个 `.vue`），探针已删。
- **两条扫描口径**：说明符提取会命中测试里的正则字面量（`icons.test.ts:62` 的 `/from '\.\/(loading|scrollbar)'/` 被当成 `'\.\/(loading|scrollbar)'`），所以"绝对路径"判定只认盘符、`/` 开头、双反斜杠与 `file:`，单反斜杠开头不是路径；注释（`//`、`/* */`、`*` 续行、`<!-- -->`）先剥掉再扫。`toSorted` 只出现在测试文件里，包源码不许用（`tsconfig.app.json` 的 lib 没有 ES2023）。

验证：`boundary.test.ts` 8 条、`error-boundary.test.ts` 8 条全绿；`@antdv/hooks` 与 `@antdv/common-ui` 的 `vue-tsc --noEmit` 均零错；`pnpm turbo run test:unit --concurrency=2` 32/32；`pnpm turbo run build --filter=@antdv/web` 9/9；`vue-tsc -p tsconfig.app.json` 仍是 98 条（与本次无关，见 P7a）；oxlint 对两份改动文件零新增错（`ErrorBoundary.vue` 那 3 条 `no-console` 是 DEV 分支的既有报错，属存量）。浏览器侧在 :6080 的 `/components/loading` 上实测：点「模拟一次崩溃」出兜底（`⚠️ 出错了` + 消息 + `🔄 重试`），展开调用栈详情能量到 `h-32` 定高且可滚（`scrollTop` 272/400），点重试真的恢复内容（`fallbackGoneAfterRetry: true`）。**改 `packages/core/hooks` 这类走 dist 的包之后必须重启 dev server**，否则页面读的是旧 chunk；本轮还遇到重建 `hooks/dist` 期间 dev server 报 404 导致应用挂不起来，重新加载即恢复。文档同步：`docs/{guide,zh/guide,en/guide}/other/project-update.md` 里那条测试路径已从 `packages/core/composables/...` 更正为 `packages/core/hooks/...`，并把新第二节写进去；`docs/{components,en/components}/common-ui.md` 的 `max-h-32` 描述改成 `h-32` 并记着为什么不能用 `max-*`。
