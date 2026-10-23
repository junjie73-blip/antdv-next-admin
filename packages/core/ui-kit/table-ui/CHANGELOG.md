# @antdv/table-ui

## 0.1.0

### Minor Changes

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

- c1e9020: refactor: `BasicTable` 的表格骨架换成 `@antdv/shadcn-ui` 的 Table 原语，setup 里的逻辑按职责拆进 `hooks/` 与 `helpers/`

  现象（用户归纳）：`basicTable` 还在用原生 `<table>/<thead>/<tr>/<td>` 手写结构，与其余组件（都建在 shadcn 原语上）不是同一套规范；同时 `setup` 里塞了取数、排版、吸边、光标、事件等上千行逻辑，改一处要通读全文。要求是**换原语 + 拆逻辑，但对外 API 与行为一律不变**。

  - **骨架换原语**：`<table>` → `Table`，表头/表体/行/单元/页脚/说明依次换成 `TableHeader`、`TableBody`、`TableRow`、`TableHead`、`TableCell`、`TableFooter`、`TableCaption`，空态用原语的 `TableEmpty`（它自己生成 `<tr>`，把 `class` 与 `colspan` 落在 `<td>` 上）。原语来自仓库内 vendor 的 `@antdv/shadcn-ui`，不新增依赖，也不改它的源文件（外观一律在本包用类名表达）。
  - **滚动容器只有一个**：`Table` 自带一层 `div[data-slot="table-container"] class="relative w-full overflow-auto"`，它就是唯一负责滚动的层；`.basic-table-body` 退成"定位祖先 + `bordered` 外框 + 稳定钩子"，**不能再写 `overflow-auto`** —— 两层都能滚时 `sticky top-0` 的表头会跟着外层一起走。`scroll.y` 的 `max-height` 与 `scroll.x` 的最小宽因此都落在那层容器上（`Table.vue` 只声明 `class` prop，`style` 透传正好落在容器）。
  - **`scroll.x` 走 CSS 变量而不是 `:style`**：`<table>` 上的 `min-width` 必须是静态工具类才能被 Tailwind 扫到，所以写成 `min-w-[var(--basic-table-min-width)]`，变量值由容器 `--basic-table-min-width: ${scroll.x}px` 提供。同理表头/单元格共用一套盒模型类（`cellBoxClass`），否则同一列上下错位。
  - **固定列与吸顶表头的配色改成实色**：`position: sticky` 只改绘制位置不给背景，透明底的固定单元格会被横向滚过去的普通单元格穿透（实测出现过"2026-10-1新增35-24编辑删除"叠字）。固定格取 `bg-inherit`，于是**行底一律要实色**：`TableRow` 默认的 `hover:bg-muted/50` 与 `data-[state=selected]:bg-muted` 里的半透明档在表头行必须压掉，`headRowClass` 显式给了 `bg-muted hover:bg-muted`；数据行的 hover/选中同样换成实色档（`bg-muted` / 主色混色），固定列才不会穿透。这也让 `cn()` 合成后的 `<tr>` 类名变成 4 种快照，`e2e/cursor.spec.ts` 的装饰性 hover 白名单按这 4 条逐一登记。
  - **拆出去的 10 个 hook + 2 个 helper**：`useMergedProps`（props 缺省与 `setProps` 合并）、`useTableClasses`（容器/表头/行/单元格/选择列的样式族，原先在 setup 里连写 170 行、模板还内联一份）、`useStickyColumns`（列宽与左右吸边偏移，含操作列默认靠右）、`useTableRows`（树形摊平 + 分页切片 + 展开行）、`useTableApi`（对外 `TableActionType` 的装配处，兼容承诺集中在这一个文件）、`useTableChange`/`useTableSorting`/`useTableFilters`/`usePaginationModel`/`useSelectionColumn`，以及 `helpers/cellContent.ts`（单元格内容优先级：`customRender` > `editComponent` > `format` > 原文）与 `helpers/renderVNode.ts`。本包 `src/index.ts` 把这些与两个 helper 一并导出（新增，不删旧）。
  - **三条历史约束按原样保留**：`expandAll` 仍走"在当前数据源上重算可展开 key"（静态 `dataSource` 的树表也要能一键全展开）；`scrollTo` 先找 `data-slot="table-container"`、找不到退回 `.basic-table-body`（兼容旧模板与调用方自带钩子）；`updateFormSchema` / `appendFormSchema` / `removeFormSchema` 仍是空实现 —— 接上就是新增行为，本轮口径是"对外一致"，补这个洞该单独开一条改动。
  - **对外接口零变化**：`BasicTableProps`、`TableActionType` 的 30 多个方法名与签名、`register`/`submit`/`reset` 等事件、`toolbar` / `toolbar-actions` / `bodyCell` / `header-<key>` 等插槽名全部原样；`apps/web` 里 19 个页面用到 `BasicTable`（其中 17 个走 `useTable()`），一行没改。`index.html` 首屏、`@source` 名单、token 命名空间都没动。

  验证：（收尾时补全）

- 5194446: fix: 设计规范彻底脱离 antdv-next，并修掉迁移留下的三处样式缺陷（固定列重叠、表头比数据行矮一线、浮层被抽屉压住）

  现象（用户归纳）：`@antdv/design` 还在引 antd 的 Tailwind 兼容层，主题色事实上依赖组件库；换主题只换一颗主色，画布色温不动；固定右侧的操作列会跟横向滚动内容叠在一起；表头比数据行差一小截；抽屉里点开自定义主色的取色器，色块弹层出现在抽屉**底下**。

  - **`@antdv/design` 的包边界收成"只有变量与 CSS"**：删掉 `@import '@antdv-next/tailwind/compat.css'` 与 `@antdv-next/tailwind` 依赖，`package.json` 不再声明任何组件库。这不是"换个变量名"——compat 层一走，`*-ant-primary` 那组工具类**整条不生成**（Tailwind v4 只为 `@theme` 里声明过的 token 出类），所以页面侧必须一起迁到本包令牌。`__tests__/design.test.ts` 里加了两条钉死边界的用例：全包不出现 `--ant-*` 读取、`package.json` 不含组件库依赖。
  - **每个主题改成"一份完整色板"**：`token/default.css` 与 `token/dark.css` 各写 13 套 `[data-theme]` 预设（`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`），每套 27 条语义色一条不少、各套签名互不相同、明暗两版真的换值（三条都由用例反查名单，不是抽查）。缺一条的后果不是"退回默认色"而是它继续吃 `:root` 的亮色值 —— 暗色预设上浮出一块白底。
  - **档位由 DOM 说话，主色只留一条链**：`@antdv/shared/constants` 新增 `THEME_PRESETS` / `themeKeyByColor` / `CUSTOM_THEME_KEY`；`applyPreferencesToDom()` 把选中的色反查成 `<html data-theme="…">`，**只有取色器选的颜色**才额外内联 `--app-primary`（预设档内联反而会把暗色档辛苦提亮的主色压回亮色值）。给 antdv-next 的桥 `--ant-color-primary` + `--ant-primary-color` 两个名字继续都写，因为页面里还有 antd 的 DOM 在读旧名。
  - **固定列不再与滚动内容重叠**（`table-ui`）：粘性单元格的 `z-index` 与底色一起给（`bg-inherit` 而不是透明底），横向滚动时内容从固定格下面穿过去而不再是盖在上面。用几何断言核对（`boundingBox()` 与滚动容器右边缘），只看 `toBeVisible()` 会放过这个缺陷。
  - **表头与数据行同高**（`table-ui`）：表头与单元格共用一套盒模型 `px-3 py-2 text-sm leading-6 align-middle`。行高用 `leading-6`（24px 行盒）而不是 `h-6` —— Tailwind 预置的 `box-sizing: border-box` 会把内边距一起算进 24px，小于"内边距 16 + 内容 20"，等于没设；实测 41/41 行等高。
  - **浮层回到 shadcn 的同一档刻度**（`popup-ui`）：抽屉/弹窗的内联 `zIndex: 1000` 是 antd 时代的遗产，而 reka-ui 的 Popover / Select / Tooltip 全在 `z-50` 且 portal 到 `body` 末尾，于是"抽屉里打开的取色器被抽屉本身盖住"。现在默认不覆盖层级，靠挂载顺序叠放；只有要钉死先后关系时才显式传 `zIndex`。这条缺陷 Playwright 只会报 hit-test 重试（"subtree intercepts pointer events"），`toBeVisible()` 一路放行 —— 加了两条单测断言"默认内联 zIndex 为空、显式传入才写"。
  - **`BasicDrawer` 标题区补齐内边距**（`popup-ui`）：内置 header 与 `#header` 插槽两条分支都走 `px-6 py-4`，标题文字不再贴着头部边缘与分割线。
  - **表单与组件的默认色/间距规范**（`form-ui`）：label 与行距统一走 token 化刻度，校验只在提交时触发（去掉初始校验导致的"一进页面满屏红"），组件默认边框由黑色改成 `border` 令牌色。
  - **包源码不再读 `import.meta.env`**（`common-ui`）：`ErrorBoundary` 的开发态判定原先写死 `import.meta.env.DEV`，而包里 tsconfig 有意不带 `vite/client`（免得 vite 变成隐式依赖）。包自己的 type-check 靠一份手写 `vite-env.d.ts` 兜住，但 `tabs-ui` 按源码消费本包时那份环境声明不在它的 program 里，直接报 TS2339。现在改用 `@antdv/shared` 注入的 `isProduction()` —— 这也是 `shared/utils/env.ts` 一开始立这条规矩的理由：包读 env 既拿不到静态替换，也没法在单测里切分支。新增两条用例把"开发态给调用栈详情、生产态收起"钉住，收尾复位共享状态。
  - **CSS 副作用导入的类型声明要跟着模块图走**（`popup-ui`）：`message/index.ts` 的 `import 'vue-sonner/style.css'` 只有本包的 `src/types/css.d.ts` 声明，下游包（`table-ui`）一视同仁报 TS2882。改成在导入处补一行 `/// <reference path="../types/css.d.ts" />`，声明随模块被一起纳入，不用每个消费方复制一份 shim。

  验证：`npx turbo run test:unit` 全绿 —— 22 个套件共 1861 条（`design` 29、`table-ui` 214、`popup-ui` 46、`common-ui` 192、`apps/web` 282）；`common-ui` 在并发整跑里出现过一条 5s 超时假红，单独复跑 192/192 绿。`npx turbo run type-check` 里 **31 个包全绿**，只剩 `@antdv/web` 一条红：109 条报错分布在 38 个本轮没碰过的文件上（`~/api/notice` 等指向不存在模块的死引用、`@vue/tsconfig/tsconfig.dom.json` 的 `lib` 没有 ES2021/ES2023 导致 `replaceAll` 与包源码里的 `.toSorted()` 报 TS2550、以及一批响应体类型对不上的 `res.data`），报错行号均不在本轮 diff 的 hunk 内 —— CI 只跑 docs，这条链从未被门禁挡住过，属于迁移期存量债，另开一轮清理（见待办 P7）。它此前被 `tabs-ui` 的失败掩盖（依赖任务失败会让它不执行），所以第一次露脸。chromium 端到端全量跑 151 条，4 条红 —— 逐条缩小复跑后，3 条（登录框 `fill` 超时、拖拽用例 execution context destroyed、IconPicker 点击超时）是 Vite 依赖重优化把正在跑的页面重载了一次造成的假红（`gallery-examples` 单跑 26/26 绿、`icon-picker` 单跑 7/7 绿），1 条是用例自身的缺陷：`theme-primary` 把主色断言写成大写字面量 `#FA541C`，而色板实际拼作 `#fa541c`，大小写不该是契约，已在读取处归一化并复跑绿。主题侧另有浏览器实测：14 档 × 明暗画布逐档不同、`data-theme` 正确、预设不写内联、刷新后偏好仍在、0 条 console error，且全仓不再有 `*-ant-*` 工具类的使用点；固定列/表头同高/抽屉内取色器都用几何断言（`boundingBox()` / `elementFromPoint()`）而不是 `toBeVisible()`；`ErrorBoundary` 的调用栈详情在真实页面（`/components/loading` → 模拟一次崩溃）实测仍会出现。顺带修掉一处只在 CI 全量跑才暴露的既有问题：`backend-mock` 在 `noUncheckedIndexedAccess` 下的 `accounts[0]` 类型。文档侧 `npx turbo run build --filter=@antdv/docs` 通过，zh 正文 / `docs/zh` 副本 / en 镜像三份口径一致，代码引用逐条对回当前行号。

- d8fa761: fix: `dragSortConfig.disabled` 与 `canDrop` 真的生效（整表冻结、按行禁用、落点约束三种形态都钉）

  诉求（用户原话）：定位并修复 `useDragSort` 的 `disabled` 参数与 `canDrop` 回调不生效的问题，确保参数传入后能正确控制拖拽排序的启用状态与元素拖拽放置规则。

  - **`disabled` 不生效的根因是"拦错地方"**：Sortable 的构造参数 `disabled` 只在 `new Sortable()` 那一拍读一次，之后 `dragSortConfig.disabled` 换值不会回头；而 `onStart` 里 `preventDefault()` / `return false` 也是无效的 —— `EventDispatcher.js` 派发用户回调时写的是 `options[onName].call(sortable, evt)`，返回值直接丢掉。**唯一每次按下都现读、且返回值真的被认的门是 `filter`**，所以禁用判定搬到 `filter`，构造参数恒写 `false`（注释里留了这句原因，别被"disabled 怎么是 false"骗回去）。
  - **`filter` 拦住时不能再吞 `mousedown`**：默认 `preventOnFilter: true` 会连 `preventDefault()` 一起做，结果禁用行里的按钮、链接、文本选中全废（用户下一条反馈就会是"禁用行连复制都做不到"）。写 `preventOnFilter: false`，与"点在非手柄区域压根不 preventDefault"那条路径保持同一口径。
  - **两种 `disabled` 形态都支持**：布尔 `true` 整表冻结，函数形态按行判。函数拿到的必须是**数据记录**而不是 DOM 元素，所以行身份先认 `BasicTable` 写在 `<tr>` 上的 `data-row-key`，没写这个属性才退回下标换算。
  - **`canDrop` 原来读的字段根本不存在**：Sortable 给 `onMove` 的事件对象上只有 `dragged` / `related` / `to` / `from` 和几个 `*Rect`，**没有** `oldIndex` / `newIndex` / `draggedRowIndex` / `relatedRowIndex`。照这些字段取下标，永远比的是"数据源第 0 条 vs 自己"，于是任何 `canDrop` 都看起来"没拦住也没放行"。`onMove` 的返回值本身是被认的（`!== false` 才换位），所以修法是把取索引改成从 `dragged` / `related` 反查记录。
  - **快照必须在 `filter` / `onStart` 这一拍量**：拖拽中途 Sortable 会真的把 `<tr>` 挪位，此时再数"首行前有几个非数据行"就漂了。所以 `leadingRowCount`（测量行 / 占位行数量，用来把 DOM 下标换算成数据下标）和 `rowByKey` 都在 `filter` 里、DOM 还没动的时候量一次，`onStart` 再补一次。
  - **落点约束要管"跨过的那几行"，不只是落点那一行**：一步拖得远时中间会掠过多行，只校验 `related` 的话"不能越过锁定行"形同虚设。所以 `onMove` 里对 `dragged` 与 `related` 之间的每个位置都调一次 `canDrop`；悬在自己原位（`dragRecord === dropRecord`）放行，不构成"越过"。

  测试口径：

  - 单测（`packages/core/ui-kit/table-ui/__tests__/drag-sort.test.ts`，19 条）钉的是**契约而不是 Sortable 内部**：布尔与函数两种 `disabled` 形态、前导偏移下的行对齐、`canDrop` 拿到的是哪两条记录、跨越路径逐行校验、"拖过之后 DOM 已换位仍按 `data-row-key` 认人"，以及"落点没有对应数据行时不许落"。
  - 端到端（`apps/web/e2e/gallery-examples.spec.ts` 的拖拽一段，chromium / firefox / webkit 三引擎）只能走 Playwright 的 `dragTo`：sortablejs 1.15.7 走原生 HTML5 DnD，`mouse.down()` + 分步 `move()` + `up()` 这种手搓序列在这台机器上 3/3 召不出 `dragstart`。禁用行那条断的是"数据顺序不变"而不是"没动画"，因为 `filter` 命中时 Sortable 只是不起拖，DOM 没有任何可观察的中间态。

- 54d880b: build: 全部子包统一走完整 `build`（编译 + 打包 + 产物校验），消灭 stub-only 与热更新混配

  要求（用户原话）："所有子包必须统一采用完整构建（build）的编译打包方式，严格禁止出现部分子包使用 build 构建、部分子包使用热更新（hot reload/hmr）的混合配置情况"。落地口径按已确认的方案 —— **统一构建标准，保留源码消费**：每个包都有一份真 build 并纳入全量构建与检查，dev 期间仍由宿主应用的 dev server 直接吃源码，子包级热更新不退化。

  - **15 个按源码发布的包补上真 build**：`packages/**` 的组件与工具包（含 `@antdv/icons`）一律 `vite build`，各自的 `vite.config.mts` 只有一行 `defineLibraryConfig()`。此前它们的 `build` 是一句 `echo`，产物从没被真编译过 —— 包里的 SFC 编译错误、缺失依赖、`exports` 漏配都要等别人 import 时才现形。
  - **入口从 `exports` 推导，不再写死 `src/index.ts`**：`resolveLibraryEntries()` 读包自己的 `exports` 映射（`./*` 通配按同一模式去 glob 展开），加一个子路径导出，构建自动覆盖到它。只认 `src/` 下的源文件，指向 `dist` 的子路径（按产物发布的那批包）不进这条链路。
  - **`antdv:validate-dist` 兜住"构建绿了但产物残缺"**：`writeBundle` 逐条核对每个入口的 `dist/<name>.js`（样式入口查 `.css`，开了 `dts` 再查同名 `.d.ts`）既在产物表里也真落盘，缺一条就 `this.error` 并点名是哪个公共子路径。子包平时按源码被消费、`dist` 没人读，这层校验是标准里唯一能自动兜住的部分。
  - **库形态的插件链裁到最小编译链**：`createPlugins(mode, { kind: 'library' })` 不再挂自动导入 / iconify / svg-icons / imagemin / 文件路由 / Layouts / i18n / Inspect。这些插件都按"宿主是一个应用"的前提工作 —— 扫 `src/views`、往 `cwd/types/*.d.ts` 回写声明、要求 `@iconify-json/*` 与 `src/assets/icons` 存在；子包按自己的目录构建时前提全不成立，实测 `@antdv/enums` 在配置加载期就抛 `Please install "@iconify/json" or "@iconify-json/*" package`。两种形态现在共用 SFC / TSX / Tailwind 这一段，其余按形态分家。
  - **`dts` 默认跟随 `types` 指向**：只有 `types` 指进 `dist` 才生成声明文件。按源码发布的包（`types: ./src/index.ts`）生成那份 `.d.ts` 没有读者，类型面归各自的 `type-check`，重复出一份只把构建时间翻倍 —— 实测 `@antdv/menu-ui` 27 s → 7.5 s。
  - **`@antdv/design` 从"没有 build"变成真出产物**：纯样式包走 `entry: 'src/index.css'` 并显式 `cssCodeSplit: true`（lib 模式默认 `false`，而那个模式下 Vite 直接拒绝 CSS 入口），产出 `dist/index.css` 277 kB，顺带证明 `src/css/*.css` 里的 `@apply` 级联编译得动。
  - **5 个只有 `stub` 的包换成真 build**：`@antdv/eslint-config`、`@antdv/oxfmt-config`、`@antdv/oxlint-config`、`@antdv/vsh`、`@antdv/turbo-run` 删掉 `stub`，`build` 改为 `pnpm exec tsdown`（各自 `tsdown.config.ts` 已带 `clean: true, dts: true`）。`@antdv/node-utils` 的 `stub` 作为加速手段与真 `build` 并存。根 `postinstall` 随之从 `run stub` 改成 `--filter ./internal/** --filter ./scripts/** run --if-present build`。
  - **标准变成可跑的守卫**：`scripts/check-uniform-build.mjs`（零依赖）查四件事 —— 每个包都有 `build`（没有可编译内容的 3 个预设包写进例外清单并附理由）、`stub` 不能是唯一构建方式、`exports` 指 `dist` 的包必须把 `dist` 列进 `files`、按源码发布的包不许挂自己的 `dev` / `watch`（热更新归宿主应用）。已排进 `pnpm check`，不过那条链现在会在 `check:type` 处短路，所以日常按 `pnpm check:builds` 单跑。

  验证：`pnpm build` 全量 31/31 成功（3 m 57 s；此前只有按产物发布的包与应用参与）；`pnpm turbo run test:unit --concurrency=1` 只有 `common-ui/cron-editor` 一条红，是仓库里已记录的机器负载超时假红（整跑 5621 ms 撞 5 s 上限，空闲单跑同一用例 2054 ms 通过，同批 290 条其余全绿）；`@antdv/vite-config` 单测 70 条全绿，其中新增 `__tests__/library.test.ts` 12 条覆盖入口推导 / 产物推导 / 校验器，`__tests__/plugins.test.ts` 由"两种形态共用同一条链"改成钉住"应用形态带宿主插件、库形态只留编译链"；`node scripts/check-uniform-build.mjs` 通过；dev server 与 `apps/web` 生产构建两侧都跑通（登录 → 工作台 → 组件示例）。文档在 `docs/guide/essentials/development.md` 新增「子包统一构建标准」一节，en 镜像与 `docs/zh` 副本同步。

- Updated dependencies [2f1a233]
- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [5194446]
- Updated dependencies [54d880b]
- Updated dependencies [c1e9020]
- Updated dependencies [f740d13]
- Updated dependencies [340f692]
- Updated dependencies [f64fc3a]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [d8fa761]
- Updated dependencies [2f1a233]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
  - @antdv/common-ui@0.1.0
  - @antdv/popup-ui@0.1.0
  - @antdv/shadcn-ui@0.1.0
  - @antdv/form-ui@0.1.0
  - @antdv/shared@0.1.0
  - @antdv/icons@0.1.0
