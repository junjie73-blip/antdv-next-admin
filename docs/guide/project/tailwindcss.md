# Tailwind CSS

一句话：**Tailwind v4、CSS-first —— 没有 `tailwind.config.*`（全仓搜不到），全站只有一个 Tailwind root：`apps/web/src/styles/index.css`（它先 `@import '@antdv/design'` 拿设计规范，再逐条 `@import` 各组件包的 `./style.css` 内容登记），由 `@tailwindcss/vite` 插件编译，主题色全部走 `@antdv/design` 自己的 shadcn-vue 令牌而不是硬编码色板。**

## 版本与装配

| 项 | 值 | 依据 |
| --- | --- | --- |
| Tailwind | `^4.3.3`（catalog `pnpm-workspace.yaml:198`，`@tailwindcss/vite` 同档 `:57`） | 版本只钉在 catalog 一处，其余全写 `catalog:`（`apps/web/package.json:47-49,144`、`internal/vite-config/package.json:35`、`packages/core/base/design/package.json:32-35`） |
| Vite 插件 | `@tailwindcss/vite ^4.3.3`，在 `internal/vite-config/src/plugins/vue.ts:35` 里 `tailwindcss()` 注册 | 应用与库共用这套插件装配 |
| 动画 | `tw-animate-css ^1.4.0`（catalog `:202`；**不是** v3 时代的 tailwindcss-animate） | `design/src/index.css` 的 `@import 'tw-animate-css'` |
| 排版 | `@plugin "@tailwindcss/typography"`；`@plugin "@tailwindcss/nesting"`（同上） | catalog `:56` / `:55` |
| 装配入口 | `apps/web/src/styles/index.css`：`@import '@antdv/design';` 打头，随后 15 条 `@import '<pkg>/style.css'`（`layouts` / `icons` 先，再 `ui-kit/*` 按包名字母序） | 全站唯一的 Tailwind root，`main.ts:46` 只引这一条 |
| 设计规范 | `packages/core/base/design/src/index.css`：层级顺序 + Tailwind 本体 + token + 五个公共 css 分部 + 插件 + dark 变体 | **不再代管任何子包的内容登记** |

## 装配入口长什么样

```css
/* apps/web/src/styles/index.css —— 唯一的 Tailwind root */
@import '@antdv/design';

@import '@antdv/layouts/style.css'; /* 装配层与图标先 */
@import '@antdv/icons/style.css';
@import '@antdv/common-ui/style.css'; /* 再 ui-kit/* 按包名字母序；五个业务域已并入 common-ui */
/* …common-ui / form-ui / im-ui / layout-ui / lowcode-ui / menu-ui */
/* …popup-ui / report-ui / shadcn-ui / table-ui / tabs-ui / common-ui */
```

- 每一条 `@import '<pkg>/style.css'` 就是那个包自己的 `@source './';`：**工具类的扫描范围跟着功能模块走**，新增一个 ui 子包时改的是它自己的文件，外加在这里补一行。
- **必须是 CSS 的 `@import`，不能改成在 `main.ts` 里逐条 JS `import`**：只有 `@source` 的样式文件自己**不构成 Tailwind root**（实测 `features=0`、产物 13 字节、零工具类），从 JS 模块图进来等于没登记；`@import` 会被内联进本文件这一个 root，登记才真正参与扫描。
- 同理 `@antdv/design` 只引一次：重复 `@import 'tw-animate-css'` 这类它已经引过的东西会把那份 CSS 输出两遍（实测 +1746 字节）。
- 这些包都只有内容登记、没有规则，所以它们之间谁先谁后不影响层叠；`@antdv/design` 必须打头，因为它的 `@layer` 声明要在所有规则之前定好优先级。

## 设计规范入口的三件关键事

```css
@layer theme, base, components, utilities; /* 显式层级表，必须是第一条 */
@import 'tailwindcss';
@import 'tw-animate-css';
@import './token/index.css'; /* shadcn-vue 令牌 → --color-* */
@import './css/base.css'; /* 基础层 / nprogress / a11y / permission / scrollbar */
/* 组件包的工具类不在这里登记：名单跟着各个包走 */
@plugin "@tailwindcss/typography";
@custom-variant dark (&:where(.dark, .dark *)); /* 暗黑：class 策略 */
```

- **层级顺序是刻意的**：`utilities` 排最后，模板里的工具类才能覆盖 `components` 层规则（自绘 Scrollbar、布局外壳依赖这一点）。
- **内容登记随包走**，三环缺一不可：① 包自己的 `src/index.css` 写 `@source './';` → ② `package.json` 的 `exports['./style.css']` 指向它 → ③ 应用装配入口 `@import` 到它。v4 的内容检测从**构建根**（`apps/web`）往下扫，而 `@antdv/*` 都在仓库根的 `packages/` 下（软链进 `node_modules`，也在检测范围之外），所以必须显式登记。漏登记的表现是"组件渲染出来了但没样式"（侧栏白底不缩进、标签栏挤成一行、抽屉落在视口之外），且不报错。**这份名单曾经集中在 `design/src/index.css` 里，被跟样式无关的重构提交整段删过一次** —— 守门用例（判据用标题，行号会漂）：`design.test.ts`「入口不代管任何子包的内容登记」、`@antdv/hooks` 的 `boundary.test.ts`「每个带 `.vue` 的包都自己登记 `@source`、暴露 `./style.css`，并被应用入口引到」；快速体检 `node <skill-dir>/scripts/check-repo.mjs --only @source`。改到任一环后都要跑，别只看构建绿。
- `@custom-variant dark` 把 `dark:` 变体绑到 `.dark` class，而这个 class 由 `applyPreferencesToDom()`（`packages/core/preferences/src/update-css-variables.ts:39`）增删（`theme: 'auto'` 先经 `matchMedia` 解析）。**暗黑不是 media 策略**，否则偏好抽屉里的开关就失效了。明暗链路的完整口径见[主题与偏好设置](/guide/in-depth/theme)。

## 样式只有一条链路

antd 那套运行时样式（`@antdv-next/cssinjs` 的 `StyleProvider` + `autoPrefixTransformer / px2remTransformer`）已随依赖一起移除。`App.vue` 现在只挂 `@antdv/common-ui` 的 `ConfigProvider`（`apps/web/src/App.vue:48-51`）和两只 `Toaster`（`:60-70`），没有任何组件库在运行时往 `<head>` 末尾追加样式，所以"preflight 重置盖住组件库样式"这个经典冲突在这里不存在，也不存在"谁后注入谁赢"的排序问题。

`:deep()` 于是只剩一个正当用途：穿透**第三方组件的内部 DOM**（`CODE_STANDARD.md:169-174` 的第三优先级；`<style scoped>` 才是第四）。全仓现在只有 3 个文件用到它 —— `markdown-editor/MarkdownEditor.vue`（tiptap 的 `ProseMirror`）、`micro-app-container/MicroAppContainer.vue`（micro-app 自定义元素）、`apps/web/src/views/components/drag-layout/index.vue`（分隔条）。改自己组件的样式请回到工具类，别拿 `:deep()` 当后门。

**颜色只有一条路**：`@antdv/design` 的 `token/index.css:30-82` 用 `@theme inline` 把本包的 `--*` 接成 Tailwind 变量 —— 值是 `hsl(var(--x))`（`:31-49` 19 条基础语义色 + `:51-58` 8 条侧栏 = 27 个，再加 `:61-63` 三条状态色 `success/warning/info`），于是：

```ts
cn('bg-primary text-primary-foreground shadow-primary/30'); // 永远跟主色
```

尺度变量同出一处：`:75-81` 以 `--radius` 为 `lg` 档基准，按 `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3` 倍率派生 `--radius-xs … --radius-3xl`。基准钉死 **1rem**（`token/default.css:75`、`token/dark.css:51`；不是官方样板的 `0.5rem`），且换算全用乘法不用 `calc(- 4px)` —— 减档在 0 档会算出负半径、被浏览器丢掉，"取消圆角"就取消不干净。**半径一律 rem，不写 px**：偏好档位由 `radiusToRem()`（`packages/core/base/shared/src/utils/radius.ts:13`，写侧 `update-css-variables.ts:106`）换成 rem，这样它跟着 `--font-size` 一起缩放。

::: danger

不要用 `*-ant-primary`。那组类来自 antdv-next 的 Tailwind 兼容层（`@antdv-next/tailwind/compat.css`），这个包早从依赖里删干净了（守卫：`packages/core/base/design/__tests__/design.test.ts:585-588`），本包源码里连 `-ant-` 字样都不许出现（`:459-465`）—— 不是颜色不对，而是**整条类根本不生成**，还不报错。

:::

写死 `bg-blue-600` / `#1677ff` 在换主色或进暗黑时必露馅。原先钉这一条的 `views/login/__tests__/login-styles.spec.ts` 已随登录页改版删除，现在这一条只剩约定（`apps/web/src/views` 下按 `bg-blue-*` / `text-blue-*` / `#1677ff` 检索还有 98 处、散在 33 个文件里，属逐步清理的技术债 —— 见主题页同款警告）。

## 响应式与写法约定

- 断点用默认 `sm/md/lg/xl`，登录页的品牌区/表单区分栏就是纯工具类实现。`packages/core/ui-kit/common-ui/src/components/auth/AuthPageLayout.vue` 可当范例：品牌列 `hidden` + `lg:flex`（`:101`）在窄屏整块隐藏，表单列靠 `lg:w-[54%]`（`:192`）换宽度，logo 固定在页面左上角的 `absolute` header（`:46-48`）里、任何宽度都在。`views/login/index.vue` 只传 props 与 slot，自己不写断点。
- 超过一行、或需要条件拼接的 class 走 `cn()`（`packages/core/base/shared/src/utils/cn.ts:6-8`，`twMerge(clsx(inputs))`；twMerge 保证"后写的冲突类赢"，这是 register-props 组件里 `setProps` 能覆盖样式类的基础）。
- 复杂类名串抽到模块 `constants.ts` 里命名（`CODE_STANDARD.md:176-188` 的 7.2），模板只引用变量。
- 需要原始 CSS 的少数场景（边框默认色、`::selection`、视图过渡）集中在 `packages/core/base/design/src/css/base.css`。除了 `:17-23` 那条边框兜底**必须**待在 `@layer base` 里（否则会把 `border-gray-700` 这类工具类的边框色全压掉），其余刻意不写 @layer：无层级规则优先级高于全部层级，`html/body` 的尺寸约束不能被工具类意外盖掉。原委写在文件头 `:4-7`。

## 常见失误

| 症状 | 原因 |
| --- | --- |
| 新页面里 `dark:` 不生效 | 判断明暗用了 `themeMode === 'dark'`，而当前是 `auto`；要读 `resolvedTheme`（见主题页） |
| 工具类没生成、样式"偶发丢失" | v4 按需扫描，新增目录被 ignore 或 dev 期间 CSS 缓存没刷新；重启 dev 并确认文件在 `apps/web` 的扫描根里 |
| 改主色后 Tailwind 色不动 | 页面写了死色值；改成 `*-primary` / `*-muted` 这类本包令牌工具类 |
| 写了 `*-ant-primary` 没效果 | 那组类要 antdv-next 的 Tailwind 兼容层才生成，而它已不是本包依赖（`design.test.ts:585-588` 钉着）；换成本包的主色令牌 |
| 用 `:deep()` 改自己组件的样式 | `:deep()` 只留给第三方内部 DOM（`CODE_STANDARD.md:169-174` 第三优先级）；自己的组件回到工具类或 `cn()` |
| 写了 `tailwind.config.ts` 没反应 | 项目是 CSS-first，配置走 `index.css` 的 `@theme/@plugin`；若确要新增 token 应加在样式包而不是造一个 v3 配置文件 |

## 相关页面

- 主题变量与偏好持久化：[主题与偏好设置](/guide/in-depth/theme)
- 样式优先级四档：[设计令牌与全局样式](/guide/essentials/design)
