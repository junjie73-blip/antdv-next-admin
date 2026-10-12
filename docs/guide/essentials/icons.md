# 图标

仓库里同时存在**三条图标通道**，各自的适用面不同，出错方式也不同：

| 通道 | 依赖 | 写法 | 现状 |
| --- | --- | --- | --- |
| Iconify 离线集合 | `@iconify/vue` `^5.0.3` + 五套 `@iconify-json/*` | `<Icon icon="carbon:search" />` | 主力：`apps` 与 `packages` 下 `carbon:` 460+ 处、`ant-design:` 约 90 处、`lucide:` 个位数 |
| antdv-next 自带图标组件 | `@antdv-next/icons` `^1.1.2` | `import { SearchOutlined } from '@antdv-next/icons'` | 少量：登录/注册页、标签页关闭按钮、大屏头部等 7 个文件 |
| 本地 SVG 雪碧图 | `vite-plugin-svg-icons` `^2.0.1` | `<SvgIcon name="logo" />` | 链路已接通，`apps/web/src/assets/icons` 是**空目录** |

版本都来自 `pnpm-workspace.yaml` 的 catalog，别按子包 package.json 查。

## Iconify：默认走离线数据

离线由 `@tomjs/vite-plugin-iconify` 提供（`internal/vite-config/src/plugins/auto-import.ts:95-97`）：

```ts
iconifyOffline({
  local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi'],
});
```

`local` 列表里的集合会被读成 `@iconify-json/<name>/icons.json`，由插件在构建期供给 `@iconify/vue`，**不会**在运行时去打 Iconify API。装了哪五套看依赖：`packages/ui/package.json` 里五套齐全，`apps/web` 把 `carbon` 放在 dependencies（`:37`），另外四套 `ant-design` / `fa6-regular` / `lucide` / `mdi` 放在 devDependencies（`:121-124`）。

其中 `mdi` 与 `fa6-regular` 目前**没有任何代码引用**（`apps`/`packages` 下 0 处字面量），它们存在的意义是让用户在 `IconPicker` 里挑得到。也就是说：离线列表 = 挑选器可搜的集合，不等于"用掉的集合"。

::: warning 列表外（或没装）的集合不会报错，只会变空白 `<Icon icon="carbon:card" />` 写错名字时 Vue 不报错：构建期查不到就是**空 span**，若走到运行时取图则变成一次网络请求（还常被本站 CSP 挡掉）。表现是"菜单有的项有图标、有的整格空白，标题被顶得左右不齐"——看着像样式坏了，其实是数据写错。:::

`vite-plugin-iconify-offline` 也在 `apps/web` 的 devDependencies 里（catalog `^0.4.3`），但全仓**没有任何 import**，起作用的是上面那个 `@tomjs/*`。

## 用哪个组件

| 组件 | 出处 | 什么时候用 |
| --- | --- | --- |
| `<Icon>` | `@iconify/vue`，由 `IconifyResolver` 接进自动导入（`auto-import.ts:44-50`） | 首选。显式 `import { Icon } from '@iconify/vue'` 更好读，两种都行 |
| `IconifyIcon` | `packages/ui/src/icon/IconifyIcon.vue` | 想要 `size` 默认 `16`、`mode`、翻转、`rotate` 这层封装时；它也进了解析器 |
| `IconPicker` | `packages/ui/src/icon/IconPicker.vue` | 表单里让人选图标（菜单管理页 `views/system/menu/index.vue`、示例页 `views/components/icon-picker/index.vue`） |
| `SvgIcon` | `packages/ui/src/icon/SvgIcon.vue` | 品牌图 / 多色图标（Iconify 对多色支持差），`<use xlink:href="#icon-xxx">` |

`IconifyIcon` 刻意不给可选属性补 `''` / `0` 默认值（文件头注释写了原因）：一旦补上，"未设置"就变成 "显式设为空值"，把 `@iconify/vue` 自己的回落逻辑（颜色继承 `currentColor`、尺寸回落 `size`）顶掉了。

`IconPicker` 的图标名列表是**懒加载**的：五个集合各写成一个 `() => import('@iconify-json/<name>/icons.json')` （`IconPicker.vue:57-66`），Vite 把它们切成独立 chunk，不切到那个分类就不下载。所以离线方案不是 "把五套全塞进首屏"——只有真正用到图标的组件进渲染链，`icons.json` 全量只在挑选器里按需出现（`mdi` 单个 JSON 约 3 MB，对账测试的超时注释里提到了这个体积）。

::: tip 加一套集合要改五个地方

1. `pnpm-workspace.yaml` catalog 加 `@iconify-json/<name>`，并在消费它的 package.json 里写 `"catalog:"`；
2. `auto-import.ts:96` 的 `local` 数组；
3. `IconPicker.vue` 的 `Prefix` 联合类型、`COLLECTIONS`、`COLLECTION_LOADERS`（漏了就选不到也搜不出来）；
4. `apps/web/test/icon-names.test.ts` 的 `COLLECTIONS` 和 `LITERAL` 正则里的集合名分支；
5. 跑一次 `pnpm --filter @antdv/web build` 确认离线数据真的进了产物。:::

## 图标名对账测试（本仓库的硬约束）

`apps/web/test/icon-names.test.ts` 会把源码里**每一个** `'collection:name'` 字面量拿去 `@iconify-json/<collection>/icons.json` 的 `icons` + `aliases` 里查（`loadCollection()`，`:51-60`）。

| 设计 | 实现 | 为什么 |
| --- | --- | --- |
| 扫描范围含 mock | `SCAN_ROOTS = ['apps/backend-mock/server', 'apps/web/src', 'packages']`（`:37-41`） | 菜单图标是后端下发的，写错最多的是 `server/api/menus.get.ts`（54 处 `carbon:`）；只扫前端等于漏掉最大一处 |
| 只认整串字面量 | `LITERAL` 正则（`:48-49`），且要求引号包裹 | 注释散文里出现 `carbon:` 不算 |
| 跳过 `*.test.ts` | `walk()`（`:70`） | 测试里的样例名不该被当真引用 |
| 扫到 0 处引用视为失败 | `expect(checked).toBeGreaterThan(100)`（`:118`） | 路径或后缀写错时不能"绿灯通过" |
| 超时放宽到 60s | 两条用例都传 `60_000` | 五套 JSON 全解析 + 遍历三棵树，`turbo run test:unit` 并发时磁盘排队会顶过默认 5s |

历史动机写在文件头：某轮巡检前仓库里有 **45 个**不存在的图标名（`carbon:cards`、`carbon:form`、 `carbon:layout` 等），覆盖菜单种子数据、布局外壳与 8 个示例页，前后端单测都抓不到——它们只断言了 "我把 icon 传下去了"，图标是否真的存在只有浏览器知道。

跑法：`pnpm test:unit`（turbo 全仓）或 `pnpm --filter @antdv/web test:unit`（只跑应用，含这条）。

::: warning 类名形式的图标在本仓库不生效 `views/system/micro-app/index.vue` 与 `components/business/MicroAppContainer.vue` 里还能看到 `class="i-carbon-search"`、`i-carbon-application` 这类 UnoCSS 风格写法。仓库里没有 UnoCSS，也没有任何把 `i-*` 编译成 CSS 的插件（样式是 Tailwind v4，见[样式](/guide/essentials/styles)），这些 span 渲染出来是**纯空白**。新代码一律写组件形式：`<Icon icon="carbon:search" />`。:::

## 图标名从哪来

运行时消费的图标名有两处来源，都不在组件里写死：

- **菜单数据**：`GET /menus` 每条的 `icon` 字段（mock 种子在 `apps/backend-mock/server/api/menus.get.ts`），归一化后进 `MenuConfig.icon`。侧栏/图标栏消费点 `apps/web/src/layouts/components/LayoutNavRail.vue:111` 带兜底 `menu.icon || 'carbon:category'`。
- **路由 `meta.icon`**：约定路由或静态路由上写的字段，类型见 `packages/types/src/app-router.ts`；标签页与面包屑也读它（`packages/layouts/src/breadcrumb.ts`）。

面包屑对空串的处理值得注意：`LayoutBreadcrumb.vue:81` 的注释说明为什么用 `''` 而不是 `undefined` ——`undefined` 会让 `<Icon :icon>` 报类型错，空串既让 `v-if` 为假又保持 `string`。

`antdv-next` 组件内部自己的图标（表单校验、选择器下拉箭头等）走 `@antdv-next/icons`，与上面这套无关；业务代码里只在需要"和 antd 表单同款的 Outlined 图标"时用它。

## 相关页面

- 样式链路与 `cn()`：[样式](/guide/essentials/styles)
- 菜单与 `meta` 字段的完整口径：[路由和菜单](/guide/essentials/route)
- 测试策略与门禁：[测试策略](/guide/project/testing)
