# 设计令牌与全局样式（`@antdv/design`）

样式只有**一条链路**：Tailwind CSS v4 + `@antdv/design` 的 CSS 变量令牌 + 一层极薄的自定义 CSS。仓库里没有 SCSS / Less 源文件，也没有第二个全局样式入口。

`@antdv/design` 就是这条链路的**令牌与样式层**（`packages/core/base/design`，包边界写在 `packages/core/base/design/package.json:4` 的 description 里）：**只写变量与 CSS，不含组件逻辑，也不感知组件库**。组件自身的样式随组件放在 `packages/core/ui-kit/*` 与 `packages/core/base/icons`，本包只负责登记它们的 Tailwind 扫描路径（见下面「`@source`」一节）。

## 它包含什么

二级目录只有两个，分界线是**变量还是规则**：`token/` 装 shadcn-vue 需要的 CSS 变量，`css/` 装规则。

```
packages/core/base/design/
├─ package.json              包名 @antdv/design，exports 只到 .css 粒度
└─ src/
   ├─ index.css         ← 唯一入口，apps/web/src/main.ts:45 引一次
   ├─ token/                 主题令牌，内容只有变量声明
   │  ├─ default.css         亮色：`:root` / `.light` + 13 套 `[data-theme]` 预设色板
   │  ├─ dark.css            暗色：`.dark` + 同样 13 套 `[data-theme]` 预设色板
   │  └─ index.css           引两套值 + `@theme inline`，把 `--*` 映射成 `--color-*`
   └─ css/                   公共样式，按职责再分文件
      ├─ base.css            文档根 / 选中态 / 视图过渡 / 通用交互类
      ├─ nprogress.css       顶部路由进度条
      ├─ a11y.css            色弱 / 灰色模式（class 由 @antdv/preferences 打到 html）
      ├─ permission.css      无权限降级（class 由 @antdv/directives 的 v-permission 打上）
      └─ scrollbar.css       第三方组件内部滚动区的系统滚动条兜底美化
```

明暗是**两套独立的值**，不是"亮色改几条"：名单必须逐条对齐（少一条暗色声明，切到深色就是白底黑字浮层），取值可以完全不同。映射只有一份，住在 `token/index.css` —— 主题文件不管 Tailwind 契约，加一条变量忘了映射，表现和漏登记 `@source` 一样是静默失效，所以这三条不变量（名单对齐、变量↔映射一一对应、token 目录只有变量）都钉在 `__tests__/design.test.ts` 里。

`src/index.css` 把 token 入口和五个 css 分部引齐（CSS 规范只允许 `@import` 出现在普通规则之前，所以必须排在 `@layer` / `@source` / `@plugin` 之前，见 `index.css:25` 的注释）。每个分部也能单独引 —— `package.json` 的 `exports` 给了 `.`、`./index.css`、`./token`、`./token/index.css`、`./token/default.css`、`./token/dark.css`、`./css/base.css`、`./css/nprogress.css`、`./css/a11y.css`、`./css/permission.css`、`./css/scrollbar.css`、`./package.json`，只要令牌不要样式时可以用 `@antdv/design/token`。

::: warning `@antdv/design` 不包含什么

- **不含组件**：包里没有一行 `.vue`，也没有 `src/index.ts`。卡片、标签、步骤条这类公共展示件在 `@antdv/common-ui`，图标原子在 `@antdv/icons`，`index.css:18` 的注释专门写了这条边界。
- **不感知组件库**：不 import 任何组件库的 JS，也不引它们的样式兼容层 —— 令牌与规则全部来自本包，组件包改名或换库都不需要动这里。唯一的残留是 `css/base.css:128-134` 那两条 `.ant-upload` 光标补丁（antd 给上传触发区漏了 `cursor: pointer`，页面里还有它的 DOM 时得补），组件库 DOM 一走就可以删掉。
- **不含业务样式**：需要读 store 的薄壳（如 `apps/web/src/components/common/Loading/PageLoading.vue`）留在应用里，不往本包搬。:::

## 层顺序是显式声明的

`packages/core/base/design/src/index.css:27-52`：

```css
@layer theme, base, components, utilities;
@import 'tailwindcss';
@import 'tw-animate-css';
@import './token/index.css'; /* 里面再引 ./default.css + ./dark.css */
@import './css/base.css';
/* …css/nprogress · css/a11y · css/permission · css/scrollbar */

@source '../../icons/src';
@source '../../../ui-kit/common-ui/src';
/* …form-ui / layout-ui / menu-ui / popup-ui / shadcn-ui / table-ui / tabs-ui */

@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/nesting";

@custom-variant dark (&:where(.dark, .dark *));
```

- 层表里**没有组件库的份**：本包不给 antd 让位，`utilities` 排最后，模板里写的工具类才覆盖得住 `components` 层的规则（自绘 `Scrollbar`、布局外壳都依赖这一点）。
- `dark` 变体绑定 `.dark` class（由偏好写到 `html` 上），不是媒体查询 —— 所以 `theme: 'auto'` 下 Tailwind 与组件库看到的是同一个结果。
- `apps/web` 自己不保留 `global.css`，原因写在 `main.ts:40-43` 的注释里：全局样式归 `@antdv/design`。

Tailwind 通过 `@tailwindcss/vite` 接入（`internal/vite-config/src/plugins/vue.ts`），版本来自 catalog（`pnpm-workspace.yaml`）。

## `@source`：为什么每个组件包都要登记一次

Tailwind v4 的自动内容检测从**构建根**开始扫，而应用侧的构建根是 `apps/web`，`@antdv/*` 全在仓库根的 `packages/` 下（软链进 `node_modules`，也在检测范围之外）。所以组件包里的工具类必须在入口 CSS 里**逐包显式登记**（`index.css:20-23` 的注释记录了症状）。

- 漏登记的表现是「组件渲染出来了但没样式」—— 侧栏白底不缩进、标签栏挤成一行，**且不报任何错**。
- 目前登记的是 `packages/core/base/icons/src` 加 `packages/core/ui-kit/*` 的八个 `src`。
- 新增一个 ui-kit 子包，或者给某个包新写一批工具类，**要同时改这张 `@source` 列表**；只加包不加登记是最省事的一类「构建通过、页面裸奔」。`__tests__/design.test.ts` 会拿目录清单反查登记项，并且比的是**解析后的绝对路径**—— 子包搬家让 `@source` 指空时，字符串对照反而看不出来。
- 反过来说，某个包如果像 `Scrollbar` 那样把工具类展开成等价原生 CSS 塞进 `@layer components`（`packages/core/ui-kit/common-ui/src/components/scrollbar/Scrollbar.vue` 的 `<style>` 块），它就不依赖这份登记 —— 这也是它敢被外部工程单独消费的前提。

## 变量令牌怎么用

`token/` 是一层**裸名字语义色板**，照着 shadcn-vue 的命名规范写：`bg-popover`、`text-muted-foreground`、`border-input`。Tailwind v4 只为 `@theme` 里声明过的 token 生成工具类，没声明不是「样式被覆盖」，而是**整条类根本不生成**，表现就是弹层没有底色、次要文字没有灰度、hover 没有反馈。

链路是两段：

| 段 | 位置 | 内容 |
| --- | --- | --- |
| 种子变量 | `token/default.css:24`（`:root` / `.light` / `.light[data-theme=…]`）、`token/dark.css:13`（`.dark` / `.dark[data-theme=…]`） | `--background` / `--foreground` / `--card` / `--popover` / `--primary` / `--secondary` / `--muted` / `--accent` / `--destructive` / `--border` / `--input` / `--ring`，再加一整套 `--sidebar-*`，以及四条尺度变量 |
| Tailwind token | `token/index.css:22-51` 的 `@theme inline` | 把每个 `--*` 映射成 `--color-*`，于是 `bg-popover`、`text-muted-foreground`、`border-input` 这些工具类才存在 |

写法上有三个决定不能改回去：

- **值必须是自洽的 HSL 三段，不读 `var(--ant-color-*)`**：antd 的 CSS 变量挂在 `ConfigProvider` 生成的作用域类上，而 reka/shadcn 的弹层 portal 到 `body`（在 `.ant-app` 之外），取不到变量就只剩透明底。明暗两套值钉在根元素上，body 里的浮层与页面内部同解。
- **派生色写 `var(--*)`，不重复钉值**：`--ring` / `--sidebar-primary` / `--sidebar-ring` 都指向同块的 `--primary`，中性色同理。自定义主色时运行时只内联一条 `--primary`（预设主题则整块色板由 `[data-theme]` 给，不写内联），其余变量在同一元素上自动跟上。
- **`@theme inline` 而不是 `@theme`**：inline 让工具类直接内联 `hsl(var(--*))`，于是 `.dark` 与 `[data-theme]` 的覆盖能生效；写成 `--color-x: var(--x)` 的非 inline 形式会在 `:root` 求值一次，暗色切换就冻在亮色值上了。

`[data-theme]` 的 13 套预设（`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`）在明暗两侧各自写满这 27 条语义色 —— 换主题换掉的是整块画布的色温，不是只有一个按钮。名单与取值由 `__tests__/design.test.ts` 钉住：每套齐全、各套互不相同、明暗两版真的换了值，且预设名与 `@antdv/shared` 的 `THEME_PRESETS` 完全一致。

消费侧两条路：

```vue
<template>
  <!-- 1. 走工具类（推荐）：令牌名即类名 -->
  <div
    class="rounded-lg border border-input bg-popover text-muted-foreground"
  />

  <!-- 2. 需要写进 style / 传参时直接引用变量 -->
  <span
    class="bg-[hsl(var(--primary))]"
    :style="{ color: 'hsl(var(--foreground))' }"
  />
</template>
```

侧栏自成一套（`--sidebar-*`）：暗色侧栏是刻意偏好，不是暗色模式，值要能独立调。暗色里的中性色一律用半透明叠加（`.08` / `.12` 两档对应次要与悬停两级反馈）而不是钉死 hex，预设主题反过来才用实色底 —— 因为整套色温要一起换，原因写在 `token/dark.css` 文件头。

主题色怎么落到这些变量上，见[主题与偏好设置](/zh/guide/in-depth/theme)。

## 组件里怎么写样式

约定是 **utilities + `cn()`**，`cn()` = clsx + tailwind-merge（`packages/core/base/shared/src/utils/cn.ts`）。

| 要做的事 | 写法 |
| --- | --- |
| 条件类名 / 合并外部 class | `cn('base', cond && 'x', props.class)` |
| 用主题色 | 本包的裸名令牌 `bg-primary` / `text-muted-foreground` / `border-input`；需要写进 style 或传参时用 `bg-[hsl(var(--primary))]`。**不要**再用 antd 兼容层的 `*-ant-*`，那组类已不生成 |
| 复用的小块样式 | 共享类 `.icon`、`.outline-box`、`.outline-box-active`（`css/base.css:70-80`） |
| 过渡 / keyframes | 才开 `<style scoped>` |

::: warning Tailwind 只认字面量类名

- 类名必须是**源码里出现的完整字符串**。拼接（`text-${color}-500`）、把档位拼进变量、或写进 `@source` 没覆盖到的目录，都不会生成对应 CSS，而且不报错。
- `cn(...)` 不要写在模板属性里带**尾随逗号**（`cn('a', cond && 'b',)` 之外的 `:class="cn('a',)"` 形式同理易被格式工具改坏）；组件包里的通行做法是**在 `<script setup>` 里收成 `computed`**，模板只引用变量 —— `packages/core/ui-kit/common-ui` 的各组件都这么写，既避免模板里塞表达式，也让 class 字符串保持是字面量。
- 状态到配色一律用**查表**（`Record<string, string>`，值是完整类名串），不要 `cn('text-' + tone)`。常见例子见 `packages/core/ui-kit/common-ui/src/components/badge/Badge.vue`、`steps/Steps.vue`、`tag/Tag.vue` 里的 `STATUS_DOT` / `CIRCLE` / `PRESET` 常量。:::

::: warning

不要在路由页面的外层容器写 padding 内容区内边距归布局管。页面自己加一层 padding 会在切布局形态时重复。见[开发规范与环境变量](/zh/guide/essentials/development)与[布局、菜单与标签页](/zh/guide/in-depth/layout)。:::

颜色不要钉死。页面里同时住着两套主色：本包的 `--primary`（钉在 `html` 上，portal 出去的浮层也取得到）与 antdv-next 运行时在 `.ant-app` 上**按暗底重算**的同族变量。一条链取种子、一条链取重算值，混用就会在同一屏里出现两种橙色。所以新页面一律走 `*-primary` 这套令牌，写测试断言时也别说死色值 —— 要么在浅色下断，要么断"同源关系"（两个元素的计算色相等）。细节见[主题与偏好设置](/zh/guide/in-depth/theme)。

## stylelint 现状

规则包是有的（`internal/lint-configs/stylelint-config/index.mjs`：`stylelint-config-standard` + `recess-order`、`order/order`、BEM 风格的 `selector-class-pattern`、Vue 的 `global`/`deep` 白名单），`vsh lint` 也会调它（`scripts/vsh/src/lint/index.ts`）。但**根目录和 `apps/web` 下没有 `stylelint.config.*` / `.stylelintrc*` 落地文件**，lefthook 的 stylelint 步骤是注释状态（`lefthook.yml`）。也就是说：CSS 排序规则目前靠自觉，别在 PR 里声称"stylelint 会帮你抓"。

## 图标

图标不在本包，走 Iconify + SVG sprite 那套，清单、离线集合与新增集合的步骤见[图标](/zh/guide/essentials/icons)。

## 相关页面

- [Tailwind CSS](/zh/guide/project/tailwindcss) —— 本包作为唯一入口在应用侧怎么接线
- [主题与偏好设置](/zh/guide/in-depth/theme) —— `data-theme` 档位与 `--*` / `--ant-*` 的写入方
- [权限、指令与光标](/zh/guide/in-depth/access) —— `permission.css` 里 `permission-disabled` 的触发方
- [组件示例](/components/common-ui) —— 这些令牌被 `@antdv/common-ui` 各组件消费的实例
- [外部模块](/zh/guide/essentials/external) —— 源码发布包（含本包）为什么没有 build 步骤
