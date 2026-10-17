# 移除代码

拿这个模板做业务系统时，第一件事通常是把示例页、大屏、不用的包拆掉。这里讲**按什么顺序拆** 以及**每一刀会牵动谁**——因为这个仓库有一条规则，它让"删一半"变成静默故障。

## 规则：菜单即权限

侧栏不是从路由表递归出来的，授权集合也不是。两者都来自 `GET /api/menus` （种子数据在 `apps/backend-mock/server/api/menus.get.ts`，是一份静态数组）：

- `apps/web/src/stores/modules/route.ts` 把整棵树（含 `hidden` 节点）摊成 `allowedNames` / `allowedPaths`，再由 `syncRouteRegistry()` 拿它去比对路由表快照，**不在菜单里的约定路由被 `removeRoute` 摘掉**；
- 剩下的导航放行由 `packages/router/src/guards/dynamic-route.ts:85-86` 判，`canAccess` 不通过就跳 `/error/403`；
- 菜单里有、页面上没有的路径则落到 `router/routes.ts` 末尾的 `/:pathMatch(.*)*` → `/error/404`。

于是两种"只删一半"的结局不同但都坏：**只删页面不删菜单** = 侧栏留一条死链，点开是 404； **只删菜单不删页面** = 页面还在、还能被直达链接访问（除非你连文件一起删），但没人能进， `site-sweep` 也扫不到它。

::: warning `hidden` 不是删除 `hidden: true` 只表示"不进导航"，节点照样进授权集合（`menus.get.ts` 的注释专门在讲这件事）。菜单管理页那个「导航显示」开关也**不写库**：它只写 localStorage 的 `xy-menu-hidden-overrides` （`stores/modules/route.ts`），而 `apps/web/src/api/menu.ts` 里只有一个 `getMenus()`——没有任何菜单写接口。所以"删掉一条菜单"在本地就等价于改那份 mock 种子文件；接真后端时才是删表数据。:::

## 删除清单（按依赖顺序）

| 步骤 | 动哪里 | 漏掉的后果 |
| --- | --- | --- |
| 1 | `apps/web/src/views/**` 页面文件（连同页面私有 `components/`、`composables/`、`__tests__/`） | 文件约定路由还在注册它 |
| 2 | `apps/backend-mock/server/api/menus.get.ts` 里对应的节点（含父目录只剩一个孩子时的收敛） | 侧栏死链 → 404 |
| 3 | `src/locales/lang/zh-CN.ts` 与 `en-US.ts` 的 `menu.<Name>` 两行 | 英文界面退回显示中文 `menuName`（`layouts/composables/useMenuTree.ts:22` 用 `localizeMenus` 翻译） |
| 4 | `apps/web/types/router.d.ts`（生成物，别手改：文件顶部就写着 `@ts-nocheck` 与 `DO NOT MODIFY`） | 类型里留着一个不存在的路径名 |
| 5 | `types/components.d.ts`、`types/auto-imports.d.ts`（同批生成） | 编辑器补出不存在的组件 |
| 6 | `apps/web/e2e/**` 里写死的路径与常量 | 端到端红，或更糟——绿着但测的是空气 |
| 7 | `apps/web/src/api/<域>.ts` 与 mock 端 `apps/backend-mock/server/api/<域>/**` | 孤儿模块留在 `~/api` 的可达面上 |
| 8 | `apps/web/package.json` 依赖（必要时连 `pnpm-workspace.yaml` 的 catalog 行一起） | 包还在装、还在进 lockfile |

第 4、5 步不用手写：跑一次 `pnpm dev` 或 `pnpm build` 让插件重新生成（`internal/vite-config` 里 `VueRouter({ dts: './types/router.d.ts' })`，见 `internal/vite-config/src/plugins/vue.ts:20`）。临时全站巡检时可用 `VITE_WRITE_DTS=false` 跳过写入，但那不会帮你清掉旧条目。

## 案例 A：删一个示例页

以 Cron 表达式页为样本，`grep -rn "components/cron\|DemoCron" apps/web/src apps/web/types apps/web/e2e apps/backend-mock` 的命中就是全部工作量：

- `apps/web/src/views/components/cron/`（页面本体）
- `apps/backend-mock/server/api/menus.get.ts:300-304`（`DemoCron` 节点）
- `src/locales/lang/zh-CN.ts` / `en-US.ts` 的 `menu.DemoCron`
- `apps/web/types/router.d.ts:62-64` 与 `:422-424` 两段生成条目

「示例总览」的卡片墙是读 `routeStore.menus` 现拼的（`views/components/overview/index.vue:107`），菜单节点删掉卡片就自己消失，不用改代码。但端到端会拦住你：`apps/web/e2e/gallery-examples.spec.ts:46` 把 Demo 段叶子数写成了常量 `OVERVIEW_CARD_COUNT = 23`（注释里逐项加出 24 个叶子，总览页自己不进墙）， **少一页就少一张卡**，这个数字必须跟着改。

## 案例 B：删一整块功能区

| 区域 | 文件面 | 额外牵动 |
| --- | --- | --- |
| 大屏 `views/screen/**` | `monitor/` + `components/` + `composables/` + `__tests__/`（3 个单测） | `api/screen.ts`、mock 端 `server/api/screen/monitor.get.ts`、菜单 `ScreenMonitor`（注意它挂在**仪表盘**目录下而不是独立目录）、`e2e` 里 4 个 spec 写死 `/screen/monitor` |
| 系统管理 `views/system/**` | 13 个页面目录 | `api/system.ts`、mock 端 `server/api/system/**`（11 个域）、菜单 `SystemManage` 子树、`stores/modules/dict.ts`（字典 store 消费 system 接口，删了它 `v-*` 里的字典渲染就没数据）、`e2e` 里 13 个 spec 引用 `/system/` |
| 仪表盘 `views/dashboard/**` | `analysis/` + `__tests__/` | **先改 `HOME_PATH`**（`src/config/constants.ts:17` = `/dashboard/analysis`），否则登录成功与目录节点兜底跳转都会落进 404；`stores/__tests__/route-menu.spec.ts` 与 `views/dashboard/__tests__/analysis-merge.spec.ts` 也把这条路径当锚点 |

::: danger 有一条静态契约专门盯着菜单与页面的对应关系 `apps/web/src/views/dashboard/__tests__/analysis-merge.spec.ts` 直接读 `apps/backend-mock/server/api/menus.get.ts` 的源码，把里面所有 `path: '/...'` 提成集合，再断言分析页快捷操作的跳转目标都在其中。它的注释写得很直白："菜单种子同时是路由表和权限来源"、"删页面必须连种子一起删"。这是全仓最会把"删一半"立刻变红的地方——好事。:::

## 案例 C：删一个 workspace 包

先给结论：`packages/` 里没有一个可以只删目录了事。下表是 `grep -rl "@antdv/<pkg>" apps/web/src | wc -l` 的真实文件数（本轮重构后重跑过一遍），以及包与包之间的边（只算源码里的 import，注释与文档字符串不算）：

| 包 | apps/web 引用文件数 | 其他引用者 | 删它的真实成本 |
| --- | --- | --- | --- |
| `@antdv/shared` | 108 | `composables` / `layouts` / `preferences` / `icons` / `common-ui` / `popup-ui` / `table-ui` … 都 import 它（`cn()` 是全仓唯一的类名合并入口） | 基本等于重写应用 |
| `@antdv/types` | 31 | `shared` / `layouts` / `preferences` / `composables` + `apps/backend-mock` | 类型面全域铺开 |
| `@antdv/shadcn-ui` | 67 | `common-ui` / `icons` / `popup-ui` / `table-ui` / `form-ui` / `menu-ui` / `tabs-ui` 的实现底座 | 上面这批包一起塌，等于没有 UI 层 |
| `@antdv/common-ui` | 67 | 只被应用引用；它自己依赖 `icons` / `shadcn-ui` / `shared`（loading 与 scrollbar 已并入本包） | 卡片、标签、步骤条、上传、穿梭框、骨架屏这类展示件一起没；`@antdv/design` 的 `index.css` 里还有一条 `@source '../../../ui-kit/common-ui/src'`，删包要同步删这一行 |
| `@antdv/popup-ui` | 50 | 应用侧的 `BasicModal` / `BasicDrawer` / `useModal` / `useDrawer` / `confirm` / `message` **全部来自这个包**（`apps/web/src/components/business/**` 里已经没有这套包装器） | 弹窗、抽屉、命令式确认与全局提示一起断，见[弹窗与抽屉](/components/modal-drawer) |
| `@antdv/table-ui` | 27 | 应用侧 `BasicTable` / `useTable` / `BasicColumn` 来自它 | 列表页全都没表格 |
| `@antdv/form-ui` | 22 | 应用侧 `BasicForm` / `useForm` / `FormSchema` 来自它 | 搜索表单与表单页一起断 |
| `@antdv/layout-ui` | 3 | `@antdv/layouts` 的渲染底座（外壳、五个区域、尺寸契约与文案注入点都在这） | 七种布局形态的 DOM 在这一层，装配层就没有可渲染的件了 |
| `@antdv/composables` | 7 | 仅应用引用 | 相对可删，但 echarts/sse/websocket 是三个子入口 |
| `@antdv/layouts` | 6 | 没有其他包 import 它；应用侧薄壳 `apps/web/src/layouts/index.vue` 的 `BasicLayout` / `LayoutWidgetBar` / `LayoutUserDropdown` 来自它 | 布局外壳、顶栏小部件与菜单/面包屑/标签页一起没 |
| `@antdv/preferences` | 5 | 没有其他包 import 它；`apps/web/src/settings/index.ts` 是它的适配层 | 主题链路断，见[主题与偏好设置](/guide/in-depth/theme) |
| `@antdv/tabs-ui` | 5 | 应用侧 `useTabs` 与布局壳 | 标签栏、右键菜单、放大收起一起没 |
| `@antdv/menu-ui` | 2 | 布局壳内的菜单树 | 侧栏/图标栏的菜单渲染断 |
| `@antdv/icons` | 2 | 应用侧只直接用 `IconPicker`；包内组件（含 `common-ui`）大量 import `@antdv/icons/icon`。`internal/vite-config` 的 iconify 离线列表只供数据，不 import 这个包 | 图标选择器与 `IconifyIcon` / `SvgIcon` 一起没 |
| `@antdv/directives` | 2 | `apps/web/src/directives/index.ts` 注入判定函数；模板里 `v-permission` / `v-lazy` 共 7 处 | 可删，权限降级样式在 `@antdv/design/css/permission.css` |
| `@antdv/router` | 1 | 守卫实现全在包里，`apps/web/src/router/guards/index.ts` 只做依赖注入 | 不是删一行依赖：403 裁剪、进度条、标题都要在应用里重写 |
| `@antdv/design` | 1（`main.ts`） | 没有其他包 import 它；`preferences/css-vars.ts` 与指令的禁用态只是按它的口径写 | Tailwind 层顺序一丢，覆盖组件库样式就要靠 `!important` |

两个操作细节：除源码发布的那批（`icons` / `design` / `ui-kit` 八个）之外，每个包都产出 `dist`（`main: ./dist/...`，`build: tsdown`）—— 改 dist 包要 `pnpm --filter <pkg> build` **并重启 dev**，改源码包保存即热更；另外 `@antdv/router` 的 store 刻意不 import router（`route.ts` 的注释：`router → guards → store → router` 会闭环），裁剪能力靠装配处注入，这就是"看着像装饰、其实拆不动"的那类耦合。

## 案例 D：删一个应用依赖

视频三件套是干净的样本：`@videojs-player/vue`、`@videojs/http-streaming`、`video.js` 在 `apps/web/src`、`packages`、`internal`、`apps/web/e2e` 里**零处 import**（`grep -rn -i "videojs\|video-js"` 只剩下文档站自己的两句叙述）。清掉它：删 `apps/web/package.json` 里那三行 → `pnpm install` 同步 lockfile → 要彻底就顺手删 `pnpm-workspace.yaml` catalog 里的对应三行（留着不影响解析，只是下次审计时又得重新确认一遍）。

::: warning "没人 import"和"可以删"是两件事 `pnpm check:dep`（knip）会报一批未使用依赖，但它的默认配置 ignore 了 `docs/**`，`ignoreDependencies` 里还写死了 `playwright`、`rimraf`、`tailwindcss` 等（见 `scripts/vsh/src/check-dep/index.ts`）。构建期才用到的插件、被 CDN 引入的包，在它眼里都是"未使用"。删之前自己 `grep` 一次源码与 `internal/vite-config`。:::

## 删完用什么兜底

```bash
pnpm check:type                        # turbo run type-check（@antdv/web 是两份 vue-tsc：app + vitest）
pnpm test:unit                         # 全仓 vitest，含源码契约与图标对账
pnpm check:dep && pnpm check:circular  # 漏删的依赖 / 拆出来的环
cd apps/web && pnpm test:e2e           # 三引擎；本地先 --project=chromium
cd docs && pnpm exec vitepress build   # 文档里指向被删页面的死链
```

各条分别抓什么：`src/views/__tests__/page-root-padding.spec.ts` 扫路由页根容器的 padding（口径与 VueRouter 的 `**/*/components/*` 排除一致）；`src/views/__tests__/gallery-api-usage.spec.ts` 抓三类静默 API 误用；`apps/web/test/icon-names.test.ts` 对账图标名；`e2e/site-sweep.spec.ts` 从 `/api/menus` 现取叶子逐页跑（**这就是为什么菜单删干净比页面删干净更重要**）；`e2e/ops-sweep.spec.ts` 验"点了有没有反应"。

## 说句实话：这几处拆不动

- 菜单是**静态种子 + 浏览器 localStorage 覆盖**，没有写接口。任何"删了菜单"的操作都要落到改文件；拨过开关的那台浏览器还会把 override 留在本地。
- `internal/*` 与 `scripts/*` 不是装饰：`@antdv/vite-config` 装配了约定路由、布局插件、框架 API 的 auto-import 与两份 `.d.ts` 生成、iconify 离线集合、Nitro mock 代理与分包策略，它自己又 import `@antdv/node-utils`。动它们等于动构建。
- i18n 已经接到菜单与外壳（10 个 `.vue` 用 `useI18n`，顶栏有 `LocaleSwitcher.vue`），但业务页面文案仍是硬编码中文。删语言包前先确认 `src/locales/__tests__/locale.spec.ts` 与 `useMenuTree`。
- `docs/` 与 `apps` 齐平写在 `pnpm-workspace.yaml` 里：删掉它，中英切换的另一半就没了。

相关页面：[路由与菜单](/guide/essentials/route)、[Mock 服务（Nitro）](/guide/essentials/mock)、 [测试策略](/guide/project/testing)、[项目更新](/guide/other/project-update)。
