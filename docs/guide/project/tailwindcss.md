# Tailwind CSS

一句话：**Tailwind v4、CSS-first —— 没有 `tailwind.config.*`（全仓搜不到），入口在 `packages/design/src/index.css`，由 `@tailwindcss/vite` 插件编译，主题色全部走 antd CSS 变量而不是硬编码色板。**

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
@layer theme, base, antd, components, utilities; /* 显式层级表 */
@import 'tailwindcss';
@import '@antdv-next/tailwind/compat.css'; /* antd 色板 → Tailwind 主题变量 */
@import 'tw-animate-css';
@custom-variant dark (&:where(.dark, .dark *)); /* 暗黑：class 策略 */
```

- **层级顺序是刻意的**：`utilities` 排最后，模板里的工具类才能覆盖 `components` 层规则（自绘 Scrollbar、布局外壳依赖这一点）。`antd` 位是预留给第三方样式进层的占位 —— antdv-next 的样式本体是 cssinjs 运行时注入的，不落在这张表里。
- `@custom-variant dark` 把 `dark:` 变体绑到 `.dark` class，而这个 class 由 `@antdv/preferences` 的 `applyPreferencesToDom()` 增删（`themeMode: auto` 先经 `matchMedia` 解析）。**暗黑不是 media 策略**，否则偏好抽屉里的开关就失效了。明暗链路的完整口径见[主题与偏好设置](/guide/in-depth/theme)。

## 与 antdv-next 共存

antd 侧的样式来自 `@antdv-next/cssinjs` 运行时（App.vue 的 `StyleProvider` + `autoPrefixTransformer / px2remTransformer`），**没有 import 过 antd 静态 CSS**，所以不存在"preflight 重置覆盖 antd 组件"的经典冲突：antd 组件自带 cssinjs 的 hash 优先级，工具类要改它得走 `:deep()`（`CODE_STANDARD.md` 第 7 节规定的第四优先级）。

**颜色只有一条路**：`@antdv-next/tailwind/compat.css` 把 antd token 映射为 Tailwind 变量（`--color-ant-primary: var(--ant-color-primary)` 及 hover/active/bg/ border/text 全套），于是：

```ts
cn('bg-ant-primary text-white shadow-ant-primary/30'); // 永远跟主色
```

登录页有 `views/login/__tests__/login-styles.spec.ts` 用源码契约钉住"强调色只能来自 `*-ant-primary` 或 `var(--ant*)`"。写死 `bg-blue-600` / `#1677ff` 在换主色或进暗黑时必露馅（存量约 38 个 view 文件还有硬编码，属逐步清理的技术债 —— 见主题页同款警告）。

## 响应式与写法约定

- 断点用默认 `sm/md/lg/xl`，登录页的品牌区/表单区分栏就是纯工具类实现（`views/login/index.vue` 可当范例：窄屏隐藏 `data-auth="brand"` 区，logo 退到卡片内）。
- 超过一行、或需要条件拼接的 class 走 `cn()`（`packages/shared/src/cn.ts`，clsx + tailwind-merge；twMerge 保证"后写的冲突类赢"，这是 register-props 组件里 `setProps` 能覆盖样式类的基础）。
- 复杂类名串抽到模块 `constants.ts` 里命名（`CODE_STANDARD.md` 7.2），模板只引用变量。
- 需要原始 CSS 的少数场景（视图过渡、`::selection`）集中在 `packages/design/src/base.css`，刻意**不写 @layer**：无层级规则优先级高于全部层级，`html/body` 的尺寸约束不能被工具类意外盖掉。

## 常见失误

| 症状 | 原因 |
| --- | --- |
| 新页面里 `dark:` 不生效 | 判断明暗用了 `themeMode === 'dark'`，而当前是 `auto`；要读 `resolvedTheme`（见主题页） |
| 工具类没生成、样式"偶发丢失" | v4 按需扫描，新增目录被 ignore 或 dev 期间 CSS 缓存没刷新；重启 dev 并确认文件在 `apps/web` 的扫描根里 |
| 改主色后 Tailwind 色不动 | 页面写了死色值；改成 `*-ant-primary` 系 |
| 写了 `tailwind.config.ts` 没反应 | 项目是 CSS-first，配置走 `index.css` 的 `@theme/@plugin`；若确要新增 token 应加在样式包而不是造一个 v3 配置文件 |

## 相关页面

- 主题变量与偏好持久化：[主题与偏好设置](/guide/in-depth/theme)
- 样式优先级四档：[设计令牌与全局样式](/guide/essentials/design)
