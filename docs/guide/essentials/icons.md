# 图标

仓库里同时存在**三条图标通道**，各自的适用面不同，出错方式也不同：

| 通道 | 依赖 | 写法 | 现状 |
| --- | --- | --- | --- |
| Iconify 离线集合 | `@iconify/vue` `^5.0.3` + 五套 `@iconify-json/*` | `<Icon icon="carbon:search" />` | 主力：`apps` 与 `packages` 下 `carbon:` 466 处、`ant-design:` 99 处、`lucide:` 11 处（几乎都在 `IconPicker` 与 `@iconify` 自己的加载器里） |
| antdv-next 自带图标组件 | `@antdv-next/icons` `^1.1.2` | `import { FullscreenOutlined } from '@antdv-next/icons'` | 只剩 1 个源文件：`apps/web/src/views/screen/components/ScreenHeader.vue:4`（另有 `views/screen/__tests__/screen-header.spec.ts` 一个测试引用）。登录/注册/导入导出/租户选择那几处早已换成 Iconify |
| 本地 SVG 雪碧图 | `vite-plugin-svg-icons` `^2.0.1` | `<SvgIcon name="logo" />` | `apps/web/src/assets/icons` 目前放着 `github / google / qq / wechat` 四个（登录页的 social 按钮用它们，见[登录与鉴权](/guide/in-depth/login)） |

版本都来自 `pnpm-workspace.yaml` 的 catalog，别按子包 package.json 查。

## Iconify：默认走离线数据

离线由 `@tomjs/vite-plugin-iconify` 提供（`internal/vite-config/src/plugins/auto-import.ts:30-32`）：

```ts
iconifyOffline({
  local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi'],
});
```

`local` 列表里的集合会被读成 `@iconify-json/<name>/icons.json`，由插件在构建期供给 `@iconify/vue`，**不会**在运行时去打 Iconify API。装了哪五套看依赖：`packages/core/base/icons/package.json` 里五套齐全（`:27-31`），`apps/web` 把 `carbon` 放在 dependencies（`:48`），另外四套 `ant-design` / `fa6-regular` / `lucide` / `mdi` 放在 devDependencies（`:116-119`）。

`mdi` 的引用点只有两处：`IconPicker` 自己的集合加载表（`packages/core/base/icons/src/icon/IconPicker.vue:80`）和一条单测样例。`fa6-regular` 目前**没有任何代码引用**。它们存在的意义是让用户在 `IconPicker` 里挑得到。也就是说：离线列表 = 挑选器可搜的集合，不等于"用掉的集合"。

::: warning 列表外（或没装）的集合不会报错，只会变空白 `<Icon icon="carbon:card" />` 写错名字时 Vue 不报错：构建期查不到就是**空 span**，若走到运行时取图则变成一次网络请求（还常被本站 CSP 挡掉）。表现是"菜单有的项有图标、有的整格空白，标题被顶得左右不齐"——看着像样式坏了，其实是数据写错。:::

`vite-plugin-iconify-offline` 也在 `apps/web` 的 devDependencies 里（catalog `^0.4.3`），但全仓**没有任何 import**，起作用的是上面那个 `@tomjs/*`。

## 用哪个组件

| 组件 | 出处 | 什么时候用 |
| --- | --- | --- |
| `<Icon>` | `@iconify/vue`，**必须显式 `import { Icon } from '@iconify/vue'`**（`IconifyResolver` 随自动导入一起下线了） | 首选，全站裸写 `<Icon>` 的文件现在都在自己头部引它 |
| `IconifyIcon` | `packages/core/base/icons/src/icon/IconifyIcon.vue`，`import { IconifyIcon } from '@antdv/icons/icon'` | 想要 `size` 默认 `16`、`mode`、翻转、`rotate` 这层封装时 |
| `IconPicker` | `packages/core/base/icons/src/icon/IconPicker.vue`（shadcn-ui 实现：`Popover` + `Select` + `Input` + `Tooltip`，滚动区用 `@antdv/common-ui`） | 表单里让人选图标（菜单管理页 `views/system/menu/index.vue`、示例页 `views/components/icon-picker/index.vue`） |
| `SvgIcon` | `packages/core/base/icons/src/icon/SvgIcon.vue` | 品牌图 / 多色图标（Iconify 对多色支持差），`<use xlink:href="#icon-xxx">` |

`IconifyIcon` 刻意不给可选属性补 `''` / `0` 默认值（文件头注释写了原因）：一旦补上，"未设置"就变成 "显式设为空值"，把 `@iconify/vue` 自己的回落逻辑（颜色继承 `currentColor`、尺寸回落 `size`）顶掉了。

`IconPicker` 的图标名列表是**懒加载**的：五个集合各写成一个 `() => import('@iconify-json/<name>/icons.json')` （`IconPicker.vue:75-86`），Vite 把它们切成独立 chunk，不切到那个分类就不下载。所以离线方案不是 "把五套全塞进首屏"——只有真正用到图标的组件进渲染链，`icons.json` 全量只在挑选器里按需出现（`mdi` 单个 JSON 约 3 MB，对账测试的超时注释里提到了这个体积）。

::: tip 加一套集合要改五个地方

1. `pnpm-workspace.yaml` catalog 加 `@iconify-json/<name>`，并在消费它的 package.json 里写 `"catalog:"`；
2. `auto-import.ts:31` 的 `local` 数组；
3. `IconPicker.vue` 的 `Prefix` 联合类型（`:53`）、`COLLECTIONS`（`:62`）、`COLLECTION_LOADERS`（`:75`）（漏了就选不到也搜不出来）；
4. `apps/web/test/icon-names.test.ts` 的 `COLLECTIONS` 和 `LITERAL` 正则里的集合名分支；
5. 跑一次 `pnpm --filter @antdv/web build` 确认离线数据真的进了产物。:::

## 图标名对账测试（本仓库的硬约束）

`apps/web/test/icon-names.test.ts` 会把源码里**每一个** `'collection:name'` 字面量拿去 `@iconify-json/<collection>/icons.json` 的 `icons` + `aliases` 里查（`loadCollection()`，`:55-64`）。

| 设计 | 实现 | 为什么 |
| --- | --- | --- |
| 扫描范围含 mock | `SCAN_ROOTS = ['apps/backend-mock/server', 'apps/web/src', 'packages']`（`:45`） | 菜单图标是后端下发的，写错最多的是 `server/api/menus.get.ts`（58 处 `carbon:`）；只扫前端等于漏掉最大一处 |
| 只认整串字面量 | `LITERAL` 正则（`:52-53`），且要求引号包裹 | 注释散文里出现 `carbon:` 不算 |
| 跳过 `*.test.ts` | `walk()` 里的 `!entry.name.endsWith('.test.ts')`（`:74`） | 测试里的样例名不该被当真引用 |
| 扫到 0 处引用视为失败 | `expect(checked).toBeGreaterThan(100)`（`:122`） | 路径或后缀写错时不能"绿灯通过" |
| 超时放宽到 60s | 两条用例都传 `60_000`（`:86`、`:129`） | 五套 JSON 全解析 + 遍历三棵树，`turbo run test:unit` 并发时磁盘排队会顶过默认 5s |

历史动机写在文件头：某轮巡检前仓库里有 **45 个**不存在的图标名（`carbon:cards`、`carbon:form`、 `carbon:layout` 等），覆盖菜单种子数据、布局外壳与 8 个示例页，前后端单测都抓不到——它们只断言了 "我把 icon 传下去了"，图标是否真的存在只有浏览器知道。

跑法：`pnpm test:unit`（turbo 全仓）或 `pnpm --filter @antdv/web test:unit`（只跑应用，含这条）。

::: warning 类名形式的图标在本仓库不生效 `apps/web/src/views/system/micro-app/index.vue` 里还能看到 `class="i-carbon-search"`、`i-carbon-application` 这类 UnoCSS 风格写法（`MicroAppContainer` 已迁进 `@antdv/common-ui`，那份引用跟着没了，视图里还剩一处）。仓库里没有 UnoCSS，也没有任何把 `i-*` 编译成 CSS 的插件（样式是 Tailwind v4，见[设计令牌与全局样式](/guide/essentials/design)），这些 span 渲染出来是**纯空白**。新代码一律写组件形式：`<Icon icon="carbon:search" />`。:::

## 图标名从哪来

运行时消费的图标名有两处来源，都不在组件里写死：

- **菜单数据**：`GET /menus` 每条的 `icon` 字段（mock 种子在 `apps/backend-mock/server/api/menus.get.ts`），归一化后进 `MenuConfig.icon`。侧栏/图标栏消费点 `packages/core/ui-kit/layout-ui/src/components/layout-sidebar/nav-rail.vue:90` 带兜底 `menu.icon || 'carbon:category'`。
- **路由 `meta.icon`**：约定路由或静态路由上写的字段，类型见 `packages/core/base/typings/src/app-router.ts`；标签页与面包屑也读它（`packages/layouts/src/breadcrumb.ts`）。

面包屑对空值的处理：`toText()`（`packages/layouts/src/breadcrumb.ts:49-51`）把"不是非空字符串"统一折成 `undefined`，视图侧再靠 `v-if="showIcon && entry.icon"` 决定渲不渲 `<Icon>`（`packages/layouts/src/widgets/breadcrumb.vue:111-113`）——空串不再往 `<Icon :icon>` 里塞，也就不会有"图标位占了一格但什么都不画"的对不齐问题。

`antdv-next` 组件内部自己的图标（表单校验、选择器下拉箭头等）走 `@antdv-next/icons`，与上面这套无关。页面上还剩的 antd DOM 只有表单设计器，所以这条通道今天真正被业务代码用着的只有大屏头部那两只全屏箭头（`views/screen/components/ScreenHeader.vue:4`）；除此之外要图标一律走 Iconify。

## 相关页面

- 样式链路与 `cn()`：[设计令牌与全局样式](/guide/essentials/design)
- 菜单与 `meta` 字段的完整口径：[路由和菜单](/guide/essentials/route)
- 测试策略与门禁：[测试策略](/guide/project/testing)
