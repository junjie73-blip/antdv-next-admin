# 样式与图标

样式只有**一条链路**：Tailwind CSS v4 + antdv-next 的 token + 一层极薄的自定义 CSS。仓库里没有 SCSS / Less 源文件，也没有第二个全局样式入口。

## 全局样式只有一个文件

```
packages/styles/src/index.css      ← 唯一入口，apps/web/src/main.ts:43 引一次
  ├─ base.css            基础重置、共享类
  ├─ nprogress.css       进度条
  ├─ a11y.css            可访问性（focus-visible、prefers-reduced-motion）
  ├─ permission.css      权限相关的可见性
  └─ scrollbar.css      滚动条
```

关键的是**层顺序显式声明**（`packages/styles/src/index.css:18-32`）：

```css
@layer theme, base, antd, components, utilities;
@import 'tailwindcss';
@import '@antdv-next/tailwind/compat.css';
@import 'tw-animate-css';
@plugin '@tailwindcss/typography';
@plugin '@tailwindcss/nesting';
@custom-variant dark (&:where(.dark, .dark *));
```

- `antd` 被排进层里，所以覆盖组件库默认样式**不需要 `!important`**；层顺序就是优先级。
- `dark` 变体绑定 `.dark` class（由偏好写到 `html` 上），不是媒体查询——所以 `theme: 'auto'` 下 Tailwind 与 antd 看到的是同一个结果。
- `apps/web` 自己不保留 `global.css`，原因写在 `main.ts:39-43` 的注释里：全局样式归 `@antdv/styles`。

Tailwind 通过 `@tailwindcss/vite` 接入（`internal/vite-config/src/plugins/vue.ts:48`），版本来自 catalog（`^4.3.3`）。

## 组件里怎么写样式

约定是 **utilities + `cn()`**，`cn()` = clsx + tailwind-merge（`packages/shared/src/cn.ts:1-7`，106 个 `.vue` 在 import 它）。

```vue
<template>
  <div
    class="flex items-center gap-2 rounded-lg bg-[var(--ant-color-primary)]"
  />
</template>
```

| 要做的事 | 写法 | 依据 |
| --- | --- | --- |
| 条件类名 / 合并外部 class | `cn('base', cond && 'x', props.class)` | `packages/shared/src/cn.ts` |
| 用主题色 | `bg-ant-primary`（compat 桥接）或 `bg-[var(--ant-color-primary)]` | `packages/styles/src/base.css:9`、`layouts/components/LayoutNavRail.vue:115` |
| 复用的小块样式 | 共享类 `.icon`、`.outline-box` | `packages/styles/src/base.css:53-64` |
| 过渡 / keyframes | 才开 `<style scoped>` | 153 个 `.vue` 里只有 19 个这么做，如 `LayoutSidebar.vue:340` |

::: warning 不要在路由页面的外层容器写 padding 内容区内边距归布局管。页面自己加一层 padding 会在切布局形态时重复。见[开发规范与环境变量](/guide/essentials/development)与[布局、菜单与标签页](/guide/in-depth/layout)。:::

颜色不要钉死。深色下 antdv-next 会在 `.ant-app` 上**重算主色**，覆盖值要写在 `html` 的种子变量上，断言也别按具体色值写——这是本仓库踩过的测试坑，细节见[主题与偏好设置](/guide/in-depth/theme)。

### stylelint 现状

规则包是有的（`internal/lint-configs/stylelint-config/index.mjs`：`stylelint-config-standard` + `recess-order`、`order/order` `:83-104`、BEM 风格的 `selector-class-pattern` `:144-145`、Vue 的 `global`/`deep` 白名单 `:15-28`），`vsh lint` 也会调它（`scripts/vsh/src/lint/index.ts:122,131`）。但**根目录和 `apps/web` 下没有 `stylelint.config.*` / `.stylelintrc*` 落地文件**，lefthook 的 stylelint 步骤是注释状态（`lefthook.yml:16-18`）。也就是说：CSS 排序规则目前靠自觉，别在 PR 里声称"stylelint 会帮你抓"。

## 图标：Iconify 为主，sprite 为辅

### Iconify（默认选择）

离线打包五套集合，避免运行时打网络：`carbon`、`ant-design`、`lucide`、`fa6-regular`、`mdi` （`internal/vite-config/src/plugins/auto-import.ts:55-57`，依赖在 `apps/web/package.json:46,131-134` 与 `packages/icons/package.json:28-32`）。

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue';
</script>

<template>
  <Icon icon="carbon:search" class="text-lg" />
</template>
<!-- apps/web/src/layouts/widgets/WidgetSearch.vue:2,17 -->
```

`<Icon>` / `<IconifyIcon>` / `<SvgIcon>` 全部要求**显式 import** —— 组件 resolver 已经下线（`auto-import.ts:12-25` 解释了为什么），页面里不写 import 只剩一个空白标签加一条运行期警告。 `IconifyIcon` 是 `@antdv/icons` 的包装（`packages/icons/src/icon/IconifyIcon.vue:8,50-62`）。

::: tip 只允许这五个前缀新增集合要同时改 catalog 依赖与 `auto-import.ts` 的离线列表，否则构建能过、生产包里**没有那套图标数据**，线上表现为空白方块。:::

### SVG sprite

`vite-plugin-svg-icons` 指向 `apps/web/src/assets/icons`，`symbolId: 'icon-[name]'` （`internal/vite-config/src/plugins/svg-icons.ts:7-12`），注册在 `plugins/index.ts:70`，运行时靠 `main.ts:38` 的 `import 'virtual:svg-icons-register'`，消费组件是 `packages/icons/src/icon/SvgIcon.vue`（`:41` 的 `<use xlink:href="#icon-xxx">`）。

**目前 `src/assets/icons` 是空目录**，也就是 sprite 链路已接通但一个自定义图标都没在用。要放品牌图/多色图标时才走这条路（Iconify 的多色支持不好）。

### 图标选择器与菜单集成

`IconPicker` 在这五套前缀上分页搜索（`packages/icons/src/icon/IconPicker.vue:53-86`），菜单管理页的 `icon` 字段就挂它（`views/system/menu/index.vue:8,898`）。 `meta.icon` 的消费点：侧栏与图标栏（`packages/ui-kit/layout-ui/src/components/LayoutNavRail.vue:93`）、标签页（`apps/web/src/layouts/composables/useTabs.ts`）、面包屑（`packages/layouts/src/breadcrumb.ts:42,62,111`）。标签页的动作按钮组已经换成 `@antdv/tabs-ui`，图标走 `IconifyIcon`（`packages/ui-kit/tabs-ui/src/components/TabActions.vue:6`），不再直连 `@antdv-next/icons`。

## 共享 UI 包（`@antdv/icons` + `@antdv/ui-kit/*`）

原来一个 `@antdv/ui` 现在按职责拆成了独立子包，各自有 barrel、各自的依赖，谁用谁引：

| 子包 | 内容 | 导出入口 |
| --- | --- | --- |
| `@antdv/icons` | `IconifyIcon` / `IconPicker` / `SvgIcon`，另有 `createIconInstaller()` | `packages/icons/src/index.ts`、`./icon` 子路径 |
| `@antdv/loading-ui` | `Loading.vue`、`useLoading`、`createContainerLoading` / `createFullscreenLoading` / `createLoading` 与 `vLoading` 指令 | `packages/ui-kit/loading-ui/src/index.ts` |
| `@antdv/scrollbar-ui` | `Scrollbar` + 自绘 `Bar`，样式随组件走（不依赖宿主 Tailwind） | `packages/ui-kit/scrollbar-ui/src/index.ts` |
| `@antdv/shadcn-ui` | shadcn-vue 原子件（`Popover` / `Dialog` / `Select` / `Input`…），上面三个包的实现底座 | `packages/ui-kit/shadcn-ui/src/index.ts` |
| `@antdv/{form,table,popup,layout,menu,tabs}-ui` | 表单 / 表格 / 弹窗抽屉 / 布局壳 / 菜单 / 标签页 | 各 `src/index.ts` |

- 应用侧一律**显式 import 具名导出**（`import { Scrollbar } from '@antdv/scrollbar-ui'`、`import { vLoading } from '@antdv/loading-ui'`（`main.ts:8`）、`import { IconPicker } from '@antdv/icons/icon'`），保留 tree-shaking。
- `createIconInstaller()` 在应用里**没有被调用**——它只服务"要把图标组件挂成全局组件"的外部消费者。
