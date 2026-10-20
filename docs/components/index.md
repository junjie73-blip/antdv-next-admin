# 组件示例

这一章讲的是**这个仓库自己的组件画廊**，不是 antdv-next 的组件文档。业务组件（表格、表单、弹窗、上传、图表……）都封装在 `@antdv/*` 子包里，`apps/web` 只给每个组件配了可以点着玩的示例页；想搞清楚「这个封装到底怎么用、有什么坑」，最省事的办法是边看示例页边看这一章的源码引用。

## 示例页在哪

| 位置 | 内容 |
| --- | --- |
| `apps/web/src/views/components/**` | 全部示例页的 `.vue` 源码，路径与菜单路径一一对应 |
| `apps/web/src/components/business/**` | 仍留在应用侧的只有 `ImportExport` / `TenantSelect` 两个（都还没有示例页引用）；Table、Form、Modal/Drawer、Description、CountTo 等已迁到 `@antdv/{table-ui,form-ui,popup-ui,common-ui}`，`TreeTable` 在 `@antdv/table-ui`，`MicroAppContainer` 在 `@antdv/common-ui` |
| `apps/web/src/components/common/**` | 只剩 `AvatarUploader.vue` 与 `Upload/**`（分片上传的接口层与示例壳）；`Auth`、`ECharts`、`Loading`、`MarkdownEditor`、`CronEditor`、`EmptyState`、`StatusTag`、`Description`、`CountTo`、`Scrollbar` 等已进 `@antdv/common-ui`，其中图表在子路径 `@antdv/common-ui/charts` |
| `packages/core/base/icons/src/**` | 图标原子（`IconPicker` / `IconifyIcon` / `SvgIcon`），包名 `@antdv/icons` |
| `packages/core/ui-kit/**` | 无状态 UI 原子：`shadcn-ui` 与 common / form / table / popup / tabs / menu / layout 的封装层（`loading-ui`、`scrollbar-ui` 已并入 `common-ui`） |
| `apps/backend-mock/server/api/menus.get.ts:161-366` | 示例页的**唯一权威清单**：菜单即权限，没进菜单的路由进不去 |

`views/components/overview/index.vue` 是画廊的目录页，它不另写一份清单，而是直接读 `useRouteStore().menus` 把菜单树摊平成卡片墙（`overview/index.vue:12-24`）—— 所以新增示例页只要进菜单就会自动出现在总览里。

## 怎么打开

示例页是管理后台的路由，不是文档站的一部分。先在仓库根目录起服务：

```bash
pnpm dev:web       # apps/web，默认 http://localhost:6080
pnpm dev:mock      # apps/backend-mock（Nitro），5320；菜单和示例的假数据都来自这里
```

后台用的是 **hash 路由**，所以示例页地址长这样（`VITE_MOCK=false`，见 `apps/web/.env`，接口打到本地 Nitro）：

```text
http://localhost:6080/#/components/table/basic
http://localhost:6080/#/components/form/steps
http://localhost:6080/#/components/chart
```

登录用 mock 认可的账号（校验写死在 `apps/backend-mock/server/api/auth/login.post.ts:9`，演示账号见[快速开始](/guide/introduction/quick-start)）。左侧栏「组件示例」分组是同一批入口；本章只在需要时补一句「点什么看什么」，不复述界面。

## 已收录的 27 个路由（总览页另算）

侧栏对「表格」「表单」做了三级分组，其余全是二级叶子 —— `menus.get.ts:165-180` 的注释记录了这次摊平，以及被删掉的示例页（通用、卡片列表、详情页、数据展示、树形控件、视频、VueUse、二维码、密码强度、分页表格）。**被删的页面既没有菜单也没有文件，本章不会出现它们的链接**。「反馈与交互」在这一轮以 `/components/feedback` 回来了，记在[弹窗与抽屉](/components/modal-drawer)那一页。

| 本章页面 | 覆盖的路由 |
| --- | --- |
| [表格](/components/table) | `/components/table/basic`、`/components/table/crud`、`/components/table/drag-sort`、`/components/table/tree-table`、`/components/table/animation` |
| [表单](/components/form) | `/components/form/basic`、`/components/form/steps`、`/components/form/validation`、`/components/form/custom-component` |
| [弹窗与抽屉](/components/modal-drawer) | `/components/modal-drawer`、`/components/feedback` |
| [数据与展示](/components/display) | `/components/description`、`/components/count-to`、`/components/relative-time`、`/components/icon-picker`、`/components/loading`、`/components/scroll/basic` |
| [公共组件](/components/common-ui) | `/components/border-beam`、`/components/listy` |
| [编辑器与文件上传](/components/editor-upload) | `/components/editor`、`/components/upload`、`/components/image-crop` |
| [图表与 Cron](/components/chart-cron) | `/components/chart`、`/components/cron` |
| [指令与拖拽布局](/components/directive-drag) | `/components/directive`、`/components/drag-layout` |

## 读示例前先知道的几条约定

- **类名一律走 `cn()`**。示例页顶部会先声明一串 `const xxxClassName = cn('space-y-6')`，正文里 `:class="containerClassName"`。这是 `@antdv/shared/utils/cn`（clsx + tailwind-merge），不是样式文件；写文档时引用的类名字符串就是源码里的字符串。
- **页面根节点不加内边距**。滚动容器由布局层提供，示例页自己只放 `space-y-6` / `flex h-full flex-col` 这类间距，`a-card` 统一 `variant="borderless"`。
- **示例没有后端**。除了 `menus.get.ts` 和 `api/**` 这几个 Nitro handler，示例页的"保存"基本都是本地 ref 或 localStorage。每个用到这种情况的小节都会明说（典型：表格拖拽排序的「保存顺序」、分步表单的「草稿」）。
- **组件名要靠 `defineOptions({ name })`**。示例页被 keep-alive 缓存，name 与菜单的 `name` 字段对上才缓存得住（`apps/backend-mock/server/api/menus.get.ts` 里每个 Demo 节点的 `name`，如 `DemoModalDrawer`）。
- **只有 `apps/web/src/components/**` 里的组件不用 import**。`unplugin-vue-components` 的 `dirs` 默认就是这一层，清单见 `apps/web/types/components.d.ts`（现在只剩 `AvatarUploader` 真的被裸用，`ImportExport` / `TenantSelect` / `Upload/**` 是没人引的存量）；只要组件迁进了 `@antdv/*` 子包就必须显式 `import`，比如 `import { ECharts } from '@antdv/common-ui/charts'`。

## 本章怎么写

每个被记录的组件按同一顺序：**它解决什么问题** → **真实 API**（从组件源码读出来的 props / 事件 / 实例方法，附源码路径）→ **在线示例**（路由 + 点哪里）。

::: warning

缺陷照实写 `setModalProps` / `setDrawerProps` 是静默空操作、`useDrawerInner` 只是 `useDrawer` 的别名、`Modal` 的 `changeOkLoading` 拿不到 —— 这些都验证到行为代码了（见对应小节的 file:line），本章不会把它们写成可用 API。示例页自己也把这些话印在界面上。
:::
