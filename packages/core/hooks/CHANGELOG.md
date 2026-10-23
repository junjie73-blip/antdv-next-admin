# @antdv/hooks

## 0.1.0

### Minor Changes

- abfe730: 架构升级：把可复用能力从应用层抽成独立子包，重排 monorepo。

  - 新增 `@antdv/shared`（通用方法、菜单树工具、请求封装）、`@antdv/preferences`（用户偏好设置与持久化）、`@antdv/composables`（自定义 hooks）、`@antdv/ui`（公共组件）、`@antdv/layouts`（多布局形态：vertical / two-column / horizontal / side-nav / mixed-vertical / mixed-two-column / full-content）、`@antdv/router`（鉴权与动态菜单守卫，依赖注入式，不绑定 store）、`@antdv/directives`（通用指令）、`@antdv/design`（设计令牌与基础样式）、`internal/vite-config`（可组合的 Vite 配置）、`internal/node-utils`（缺失的 Node 工具包）。
  - 子包统一用 tsdown 产出 dist，由 turborepo 编排 build / dev / type-check / test:unit；依赖版本走 pnpm `catalog`。
  - mock 服务迁移到 Nitro（`apps/backend-mock`）：业务接口走 `/api`，控制面走 `/api/mock-center/**`。
  - 菜单与标签页：混合布局下两级联动、精准单选高亮、横向导航溢出滚动 + 拖拽；标签页支持拖拽排序、四种风格、放大还原、关闭其他、固定与刷新。
  - 接通标签页页面缓存：`apps/web` 新增 `usePageCache`，用归一化 path 生成 KeepAlive 缓存名，`include` 只收"标签还开着且菜单允许缓存"的页面；刷新标签会推进缓存代号，退出登录清空缓存。
  - e2e：`apps/web/e2e` 从上游模板的失效用例改为可跑的真实链路（冒烟、页面缓存、XSS 安全基线），`playwright.config.ts` 对齐项目实际端口 6080 并支持 `E2E_BASE_URL` / `E2E_HEADED` / `E2E_WORKERS`，turbo 补上 `test:e2e` 任务；Chromium / Firefox / WebKit 三引擎 81 条用例全绿。
  - 跨浏览器兼容修掉两处真问题（都不是"调超时能糊过去"的那种）：
    - `@antdv/shared` 的 CSRF Double Submit Cookie 原来写 `HttpOnly=false`。Cookie 属性是"出现即为真"的标记，浏览器据此把 cookie 存成 HttpOnly，脚本第二次写同名 cookie 就被拒绝 —— Chromium 只在 DevTools 的 Security 面板提示，Firefox 直接往 console 打 error。现在按 `path=/; SameSite=Lax` 写入，`Secure` 只在 https 下追加。
    - `apps/web/index.html` 的 CSP 原来恒定带 `upgrade-insecure-requests`。WebKit 不豁免 `http://localhost`，会把每个模块请求升级成 https 并握手失败，页面只剩首屏 Loading 的白屏（Chromium / Firefox 无症状）。该指令改由 `@antdv/vite-config` 按构建模式注入：生产保留，开发留空。
  - e2e 基建收尾：`watchErrors` 忽略 `ResizeObserver loop …`（观察者规范里的正常收敛状态，WebKit 抛成 pageerror、Firefox 抛成 console error）；本地并发压到 `E2E_WORKERS`（默认 3，一个引擎一个 worker）并只给 WebKit 放宽计时，避免"纯超时"的假红；`.gitignore` 用不带路径的 `.mock-state.json`，覆盖 Nitro mock 落在 `apps/web/` 的运行时状态文件。
  - 退出登录的会话态收口：`useUserStore().logout()` 现在除了凭证与页面缓存，还会 `resetRoutes()`（把 `isLoaded` 打回 false，守卫下次导航重新拉菜单）并清空标签页；`forceLogout()` 改为复用这一个出口，并把回登录页从 `location.href = '/login'` 换成改 hash —— 本应用是 hash 路由，写 pathname 会触发整页重载，打断进行中的导航还把 `redirect` 参数弄丢了。修前：换个账号在同一次页面会话里登录，会沿用上一个账号的菜单与授权集合。
  - 发布链路改为 changesets（移除 `docs/` 与 standard-version），根脚本新增 `release`。

- 340f692: refactor: `apps/web` 的通用 composables 与无业务耦合组件迁进对应子包（hooks / common-ui / table-ui），web 侧只留业务件

  诉求（用户归纳）：把 web 子包 `composables/` 与 `components/` 里"可复用公共内容"统一迁到对应子包，保留类型、响应式逻辑与功能兼容，更新全部引用路径，迁完清理冗余并同步文档。判据沿用仓库既有一条：**换一个项目还能不能用**——能就进包，需要应用配置/store 单例/应用内组件类型的留在 `apps/web`。

  - **`usePermission` → `packages/core/hooks/src/use-permission.ts`（184 行，`@antdv/hooks`）**：原 `apps/web/src/composables/web/permission/`（`usePermission.ts` + `types.ts` + `index.ts`）整目录搬走，七个判定函数、四个枚举（`PermissionAction` / `PermissionMode` / `PermissionResource` / `PermissionRole`，枚举在 `:27-32`）与 `UsePermissionOptions` 全部原样保留。它能进 hooks 的理由写在包入口注释里：这是唯一读会话状态的 hook，但只认 `@antdv/stores` 的 user store，不读路由实例、不发请求，因此子包可直接复用。消费点三处改为从包里引：`apps/web/src/directives/index.ts:13`、`apps/web/src/plugins/table-runtime.ts:1`、`views/components/table/crud/index.vue:34`。单测跟着搬（`packages/core/hooks/__tests__/use-permission.test.ts`，6 条）。**顺带纠正一条写错的文档**：`docs/components/directive-drag.md` 原来断言 `permissions: ['*']` 在元素层"什么都不授予"，实际上 `checkArrayMatch()` 第一件事就是 `userList.includes('*')` 直接返回 true（`use-permission.ts:91-93`），而 `v-permission` 的 `resolveAccess()` / `matchGroup()`（`packages/directives/src/permission/utils.ts:82-108`、`:53-68`）整条链都委托给注入的 checkers——所以 mock 给 admin 发的 `['*']`（`apps/backend-mock/server/utils/accounts.ts:48`）是全量放行。这条通配在迁移前的 `git show HEAD` 里就存在，迁移没有改变行为，是文档口径错。
  - **`useCRUD` → `packages/core/hooks/src/use-crud.ts`（393 行）**：入参/返回、`containerType`、批量删除内置那一次确认框（现在显式走 `@antdv/popup-ui` 的 `confirm()`，`use-crud.ts:277`）都没动。**依赖方向是要设计过的**：它对 `@antdv/form-ui` / `@antdv/table-ui` 只取 `*ActionType` 这几个**类型**（`use-crud.ts:1-3`），运行时只碰 popup-ui 的 `confirm` / `message`（`:8`），所以 `ui-kit → hooks` 这条边不成环。测试 28 条一并迁入，`apps/web/src/composables/__tests__/use-crud.spec.ts` 删除。
  - **`MicroAppContainer` → `common-ui/src/components/micro-app-container/`（162 行 + `types.ts` 18 行）**：micro-app SDK 派发的四个 window 事件（`beforeload-` / `mounted-` / `unmount-` / `error-${name}`）用 `useEventListener` 收敛成 props/emits（`:76-79`），加载遮罩、失败重试与"未配置地址"占位都在组件内。`<micro-app>` 标签由 `internal/vite-config` 的 `isCustomElement` 认下（`plugins/custom-elements.ts`、`plugins/vue.ts:43`），组件不声明局部组件，否则会有 `Failed to resolve component` 警告。
  - **`ECharts` → `common-ui/src/components/charts/`（65 行），只走子路径 `@antdv/common-ui/charts`**：`import * as echarts from 'echarts'` 会把全量注册表拖进来，所以它和 `@antdv/hooks/echarts` 同口径**故意不进根 barrel**（豁免注释在 `charts/index.ts:1-5`）。`EChartsProps` 也只从子路径导出。
  - **`TreeTable` → `table-ui/src/components/TreeTable.vue`（301 行），而不是 common-ui**：组件内部渲染的就是 `BasicTable`，而 `table-ui → common-ui` 这条依赖已经存在，反向引用会让两个包成环。类型进 `table-ui/src/types.ts:1071-1108`（`TreeDataNode` / `TreeTableFetchParams` / `TreeTableProps` / `TreeTableEmits`），从包根导出（`table-ui/src/index.ts:9`）。对外分页字段仍是 `page`，由内部 `pageNum` 换算（`TreeTable.vue:136-142`）——这是 `FetchParams` 与组件契约之间唯一的翻译点，别改成直接透传。搬迁后端到端验证顺带修掉一个从原 `apps/web` 版本就带着的缺陷：右侧表格由 `selectedKey` 才挂载，第一次点树节点时 `reload()` 跑在组件注册之前，选中了却取不到数（表现为空表格）。现在在 `handleTreeSelect` 里 `await nextTick()` 再 `reload()`，回归用例见 `apps/web/e2e/tree-table.spec.ts`。
  - **导出规范与样式管理**：`common-ui` 三个出口保持 `.` / `./charts` / `./package.json`；迁移后根 barrel 实测 55 个值导出 + 66 个类型导出（`UploadProps` 仍未转口，`EChartsProps` 只在 `./charts`）。组件一律 `components/<kebab>/<Pascal>.vue` + `types.ts` + `index.ts`，样式走 shadcn 语义 token（`bg-background` / `text-muted-foreground` 一类），不新增裸色值。
  - **web 侧清理（收尾一轮做完）**：`apps/web/src/components/` **整目录删除** —— `business/ImportExport.vue` → `@antdv/common-ui/import-export`，`common/AvatarUploader.vue` → `@antdv/common-ui/avatar-uploader`，`common/Upload/**` → `@antdv/common-ui/chunk-upload`，`layout/ReloadPrompt.vue` → `components/reload-prompt/` 并进根 barrel；`business/TenantSelect.vue` 直接删掉，`grep -rn TenantSelect apps packages` 为空。`Upload.vue` 在包内改名 `FileUpload.vue`：`components/upload/` 早就占着 `Upload` 这个名字（`upload/index.ts` 同时导出 `Upload` 与 `UploadDragger`/`UploadList`），两个入口共用一个名字会让人分不清拖拽壳和基础件。`apps/web/src/composables/useLocale.ts` → `packages/core/hooks/src/use-locale.ts`，按 `@antdv/hooks/use-locale` 深路径暴露（唯一牵 vue-i18n 的组合式函数，进根 barrel 等于让每个 `@antdv/hooks` 消费者都付一份 i18n 运行时），消费点 `App.vue`、`plugins/layouts-host.ts`、`views/{login,register}/index.vue`、`locales/__tests__/locale.spec.ts` 全部改成从包里引。
  - **自动导入声明跟着收**：`unplugin-vue-components` 的注册范围就是那个被删掉的目录，所以 `apps/web/types/components.d.ts` 里的 6 条（`AvatarUploader` / `ChunkUpload` / `ImportExport` / `ReloadPrompt` / `TenantSelect` / `Upload`）必须清掉 —— 留着不会报错，但会把"裸标签能用"这个假象留在类型层，实际运行时解析不到组件。现在只剩 `RouterLink` / `RouterView`。
  - **文档同步**：`docs/components/{index,common-ui,chart-cron,table,directive-drag}.md` 与 en 镜像、`docs/{guide,zh/guide,en/guide}/in-depth/{common,composables}.md`、`docs/{guide,zh/guide,en/guide}/essentials/utils.md` 逐条把路径与行号对回当前实现；三副本一致性用"`docs/zh` 去掉 `/zh` 前缀后与 canonical 逐字节相同"校验。`~/components/business/{Table,Form}` 一类的旧 import 全量替换为 `@antdv/{table-ui,form-ui}`。

  验证：`@antdv/hooks` 构建 + `vue-tsc` 绿、包内 10 个测试文件 102 条用例全绿；`@antdv/common-ui` `vue-tsc` 绿；这一轮迁进来的四件按包内既有口径补了单测（`__tests__/chunk-upload-hash.test.ts` 8 条、`import-export.test.ts` 7 条、`reload-prompt.test.ts` 9 条，`upload.test.ts` 覆盖基础件），`useLocale` / `useLocaleSync` 的行为断言留在 `apps/web/src/locales/__tests__/locale.spec.ts`（它要 vue-i18n 实例与语言包，那两样都住在应用侧）；`pnpm turbo run test:unit --concurrency=2` 32/32；`vue-tsc -p tsconfig.app.json` 剩 98 条且**没有一条能归到这次迁移**（迁移前 109）；`node _linkcheck.mjs .` 与 `node _sidebarcheck.mjs .`（在 `docs/` 下跑）均为 0 missing。浏览器侧需要重启 :6080 dev server 再看 `/components/chart`、`/components/table/tree-table`、`/components/table/crud`、`/components/directive`、`/micro-app` 五个页面——hooks 走 dist 产物，不重启会读到旧 chunk。Playwright（chromium）在这台 dev server 上跑过：新增的 `apps/web/e2e/tree-table.spec.ts` 2 条（选部门驱动取数 + 搜索过滤树，首次点击就取到数正是上面那个 nextTick 修复的验收点）、`e2e/table-crud.spec.ts` 4 条（`useCRUD` 全链路 + custom 账号的按钮级权限）、`e2e/permission-accounts.spec.ts` 7 条、`e2e/site-sweep.spec.ts` 2 条（全站菜单叶子逐页打开，本站错误为零），合计 15 条全绿。

### Patch Changes

- 340f692: refactor: 把"跨包只走包名导入"写成测试守住；`ErrorBoundary` 不再从自己的 barrel 绕，堆栈区改成定高

  诉求（用户归纳）：审一遍 `packages/**` 的跨包引用——不许用相对路径伸进别的包、每个 `@antdv/*` 都要在清单里声明、并且必须走目标的 `exports`；找出来的违规要修掉并用测试固化。

  - **盘点结果：仓库其实已经基本合规**。全仓 `packages/**` 的 JS/TS/Vue 里跨包相对路径 0 条、绝对路径/盘符 0 条、未声明的 `@antdv/*` 0 条（早期一轮报出 1194 条"未声明"是我扫描脚本把 `spec.slice(8)` 写错成包名截断，正确是 ` '@antdv/'.length === 7`）。真正的违规只有三处，两处是**该留的**：
    - `packages/core/base/design/src/index.css:39-48` 的 10 条 `@source` 指向别的包 —— Tailwind v4 的 `@source` 只认文件系统路径（在 `tailwindcss@4.3.3/dist/lib.js` 里确认它编译成 `{base, pattern}`，没有包名解析），而构建根在 `apps/web`，`packages/` 全在自动检测之外。试图改成包名是错的方向，改为**白名单 + 存在性 + 完整性**校验。
    - `packages/core/ui-kit/shadcn-ui/src/assets/index.css:1` 的 `@reference "@antdv/design"`，`@antdv/design` 只在 devDependencies —— 这个文件唯一的消费者是 `shadcn-ui/components.json` 的 `"css"` 字段，即 shadcn CLI 的构建期入口，分类正确。
  - **唯一真违规并修掉的**：`common-ui/src/components/error-boundary/ErrorBoundary.vue:6` 原来写 `import { Scrollbar } from '@antdv/common-ui'`，即组件经自己的 barrel（`src/index.ts:111`）反向引回同包的另一个组件，是条环。打包产物里侥幸能跑，按源码消费本包的兄弟包（`tabs-ui` 引 barrel）会拿到 undefined。改成 `import Scrollbar from '../scrollbar/Scrollbar.vue'`，与包内"互引走相对路径、对外只认 barrel"的既有口径一致。
  - **顺带修掉一个从迁移前就带着的显示缺陷**：默认兜底里那层堆栈区写的是 `Scrollbar root-class="max-h-32"`。`max-*` 只裁掉可视高度，`.scrollbar` 根元素本身仍是 auto 高度，内部 `.scrollbar__wrap{height:100%}` 量不到确定高度，浏览器上实测根 128px / 滚动区 400px、`scrollTop` 赋 999 仍是 0 —— 一屏 1316 字符的调用栈只显示上 128px 且滚不动。改成 `h-32` 后 clientHeight 128 / scrollHeight 400 / `scrollTop` 272，能滚了。单测钉的是类名（jsdom 不应用 SFC 的 `<style>`），几何在浏览器里量。
  - **守卫落在 `packages/core/hooks/__tests__/boundary.test.ts`**（就是守"子包不许依赖 antdv-next"的那个文件，同一份 `packages/` 全体不变量放一处），新增 `describe('跨包只走包名导入')` 四条：① 相对说明符解析后必须落在自己包根内，且不许出现盘符/根路径/UNC/`file:`；② 指向本仓其他包的 `@antdv/*` 必须写在 `dependencies`/`peerDependencies`（devDependencies 只放行 CSS 工具链入口那条，见上）；③ `src` 下的文件不许通过自己的包名引自己（就是 ErrorBoundary 那条环）；④ 只有 `design/src/index.css` 允许带跨包相对路径，其中每条目标都要在磁盘上存在，且名单必须**覆盖所有 `src` 下有 `.vue` 的包**——实测这 10 个包正好是 `shadcn-ui`(373) / `common-ui`(55) / `layouts`(29) / `form-ui`(20) / `layout-ui`(9) / `table-ui`(7) / `menu-ui`(6) / `tabs-ui`(5) / `popup-ui`(3) / `icons`(3)，以后新增组件包忘记登记会直接红，不再靠肉眼发现"组件渲染出来了但没样式"。四条都用临时探针文件验过能红（跨包相对路径、`J:/…` 绝对路径、未声明依赖、自引包名、给未登记包塞一个 `.vue`），探针已删。
  - **两条扫描口径**：说明符提取会命中测试里的正则字面量（`icons.test.ts:62` 的 `/from '\.\/(loading|scrollbar)'/` 被当成 `'\.\/(loading|scrollbar)'`），所以"绝对路径"判定只认盘符、`/` 开头、双反斜杠与 `file:`，单反斜杠开头不是路径；注释（`//`、`/* */`、`*` 续行、`<!-- -->`）先剥掉再扫。`toSorted` 只出现在测试文件里，包源码不许用（`tsconfig.app.json` 的 lib 没有 ES2023）。

  验证：`boundary.test.ts` 8 条、`error-boundary.test.ts` 8 条全绿；`@antdv/hooks` 与 `@antdv/common-ui` 的 `vue-tsc --noEmit` 均零错；`pnpm turbo run test:unit --concurrency=2` 32/32；`pnpm turbo run build --filter=@antdv/web` 9/9；`vue-tsc -p tsconfig.app.json` 仍是 98 条（与本次无关，见 P7a）；oxlint 对两份改动文件零新增错（`ErrorBoundary.vue` 那 3 条 `no-console` 是 DEV 分支的既有报错，属存量）。浏览器侧在 :6080 的 `/components/loading` 上实测：点「模拟一次崩溃」出兜底（`⚠️ 出错了` + 消息 + `🔄 重试`），展开调用栈详情能量到 `h-32` 定高且可滚（`scrollTop` 272/400），点重试真的恢复内容（`fallbackGoneAfterRetry: true`）。**改 `packages/core/hooks` 这类走 dist 的包之后必须重启 dev server**，否则页面读的是旧 chunk；本轮还遇到重建 `hooks/dist` 期间 dev server 报 404 导致应用挂不起来，重新加载即恢复。文档同步：`docs/{guide,zh/guide,en/guide}/other/project-update.md` 里那条测试路径已从 `packages/core/composables/...` 更正为 `packages/core/hooks/...`，并把新第二节写进去；`docs/{components,en/components}/common-ui.md` 的 `max-h-32` 描述改成 `h-32` 并记着为什么不能用 `max-*`。

- Updated dependencies [f64fc3a]
- Updated dependencies [c1e9020]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [5194446]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [c1e9020]
- Updated dependencies [f740d13]
- Updated dependencies [f64fc3a]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [54d880b]
- Updated dependencies [abfe730]
- Updated dependencies [d8fa761]
- Updated dependencies [2f1a233]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
  - @antdv/popup-ui@0.1.0
  - @antdv/table-ui@0.1.0
  - @antdv/form-ui@0.1.0
  - @antdv/shared@0.1.0
  - @antdv/types@0.1.0
  - @antdv/stores@0.1.0
