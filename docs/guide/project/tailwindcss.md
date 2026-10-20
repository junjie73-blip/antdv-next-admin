# Tailwind CSS

一句话：**Tailwind v4、CSS-first —— 没有 `tailwind.config.*`（全仓搜不到），入口在 `packages/core/base/design/src/index.css`，由 `@tailwindcss/vite` 插件编译，主题色全部走 `@antdv/design` 自己的 shadcn-vue 令牌而不是硬编码色板。**

## 版本与装配

| 项 | 值 | 依据 |
| --- | --- | --- |
| Tailwind | `^4.3.3`（catalog） | `pnpm-workspace.yaml` |
| Vite 插件 | `@tailwindcss/vite ^4.3.3`，在 `internal/vite-config/src/plugins/vue.ts` 里 `tailwindcss()` 注册 | 应用与库共用这套插件装配 |
| 动画 | `tw-animate-css ^1.4.0`（**不是** v3 时代的 tailwindcss-animate） | catalog + `@import 'tw-animate-css'` |
| 排版 | `@plugin "@tailwindcss/typography"`；`@plugin "@tailwindcss/nesting"` | `index.css` |
| 入口 | `main.ts` 一句 `import '@antdv/design'`，全局样式只此一处 | 应用侧不再维护 global.css |

## 入口 CSS 的三件关键事

```css
@layer theme, base, components, utilities; /* 显式层级表 */
@import 'tailwindcss';
@import 'tw-animate-css';
@import './token/index.css'; /* shadcn-vue 令牌 → --color-* */
@custom-variant dark (&:where(.dark, .dark *)); /* 暗黑：class 策略 */
```

- **层级顺序是刻意的**：`utilities` 排最后，模板里的工具类才能覆盖 `components` 层规则（自绘 Scrollbar、布局外壳依赖这一点）。
- `@source` 必须逐个登记自带工具类的组件包：v4 的内容检测从**构建根**（`apps/web`）往下扫，而 `@antdv/*` 都在仓库根的 `packages/` 下（软链进 `node_modules`，也在检测范围之外）。漏登记的表现是"组件渲染出来了但没样式"，且不报错。
- `@custom-variant dark` 把 `dark:` 变体绑到 `.dark` class，而这个 class 由 `applyPreferencesToDom()`（`packages/core/preferences/src/update-css-variables.ts`）增删（`theme: 'auto'` 先经 `matchMedia` 解析）。**暗黑不是 media 策略**，否则偏好抽屉里的开关就失效了。明暗链路的完整口径见[主题与偏好设置](/guide/in-depth/theme)。

## 与 antdv-next 共存

antd 侧的样式来自 `@antdv-next/cssinjs` 运行时（App.vue 的 `StyleProvider` + `autoPrefixTransformer / px2remTransformer`），**没有 import 过 antd 静态 CSS**，所以不存在"preflight 重置覆盖 antd 组件"的经典冲突：antd 组件自带 cssinjs 的 hash 优先级，工具类要改它得走 `:deep()`（`CODE_STANDARD.md` 第 7 节规定的第四优先级）。

**颜色只有一条路**：`@antdv/design` 的 `token/index.css` 用 `@theme inline` 把本包的 `--app-*` 接成 Tailwind 变量（`--color-primary: var(--app-primary)`、`--color-muted-foreground` 等一整套 27 个语义色），于是：

```ts
cn('bg-primary text-primary-foreground shadow-primary/30'); // 永远跟主色
```

::: danger

不要用 `*-ant-primary`。那组类来自 antdv-next 的 Tailwind 兼容层（`@antdv-next/tailwind/compat.css`），本包已不引它 —— 不是颜色不对，而是**整条类根本不生成**。
:::

写死 `bg-blue-600` / `#1677ff` 在换主色或进暗黑时必露馅。原先钉这一条的 `views/login/__tests__/login-styles.spec.ts` 已随登录页改版删除，现在这一条只剩约定（存量 view 文件里还有硬编码，属逐步清理的技术债 —— 见主题页同款警告）。

## 响应式与写法约定

- 断点用默认 `sm/md/lg/xl`，登录页的品牌区/表单区分栏就是纯工具类实现（`packages/core/ui-kit/common-ui/src/components/auth/AuthPageLayout.vue` 可当范例：品牌列 `hidden` + `lg:flex`（`:101-102`）在窄屏整块隐藏，表单列靠 `lg:w-[54%]`（`:192`）换宽度，logo 固定在页面左上角的 `absolute` header（`:46-48`）里、任何宽度都在。`views/login/index.vue` 只传 props 与 slot，自己不写断点。
- 超过一行、或需要条件拼接的 class 走 `cn()`（`packages/core/base/shared/src/utils/cn.ts`，clsx + tailwind-merge；twMerge 保证"后写的冲突类赢"，这是 register-props 组件里 `setProps` 能覆盖样式类的基础）。
- 复杂类名串抽到模块 `constants.ts` 里命名（`CODE_STANDARD.md` 7.2），模板只引用变量。
- 需要原始 CSS 的少数场景（视图过渡、`::selection`）集中在 `packages/core/base/design/src/css/base.css`，刻意**不写 @layer**：无层级规则优先级高于全部层级，`html/body` 的尺寸约束不能被工具类意外盖掉。

## 常见失误

| 症状 | 原因 |
| --- | --- |
| 新页面里 `dark:` 不生效 | 判断明暗用了 `themeMode === 'dark'`，而当前是 `auto`；要读 `resolvedTheme`（见主题页） |
| 工具类没生成、样式"偶发丢失" | v4 按需扫描，新增目录被 ignore 或 dev 期间 CSS 缓存没刷新；重启 dev 并确认文件在 `apps/web` 的扫描根里 |
| 改主色后 Tailwind 色不动 | 页面写了死色值；改成 `*-primary` / `*-muted` 这类本包令牌工具类 |
| 写了 `*-ant-primary` 没效果 | 那组类要 antdv-next 的 Tailwind 兼容层才生成，`@antdv/design` 不引它；换成本包的主色令牌 |
| 写了 `tailwind.config.ts` 没反应 | 项目是 CSS-first，配置走 `index.css` 的 `@theme/@plugin`；若确要新增 token 应加在样式包而不是造一个 v3 配置文件 |

## 相关页面

- 主题变量与偏好持久化：[主题与偏好设置](/guide/in-depth/theme)
- 样式优先级四档：[设计令牌与全局样式](/guide/essentials/design)
