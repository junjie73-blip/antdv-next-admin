# 主题与偏好设置

一句话：**偏好的唯一事实源在 `@antdv/preferences`，主题色只有一条链路，视觉层只认 CSS 变量。**

## 一条链路两个出口

```
用户在设置抽屉里改主色
        │
        ▼
preferences store（持久化）
        │
        ├──► getAntdTheme() ──► <a-config-provider :theme> ──► antdv-next 组件
        │
        └──► applyPreferencesToDom() ──► documentElement 上的 CSS 变量 ──► 我们自己写的样式
```

antd 的 token 只管得到 antdv-next 组件；侧栏、标签页、登录页、NProgress 这些**自己写的**
样式必须走 CSS 变量，否则就是"换了主题色，组件变了、外壳没变"。所以
`writeThemeCssVars()` 会同时写两个名字：

| 变量 | 谁在用 |
| --- | --- |
| `--ant-color-primary` | antdv-next 运行时注入的命名（本项目 39 处在用），Tailwind 的 `*-ant-primary` 也指向它 |
| `--ant-primary-color` | 旧命名，进度条、NProgress 等几处仍在读 |

两个都写是刻意的 —— 只写新的会出现"改了主色、进度条还是蓝的"这种半更新。

## 用 Tailwind 写主题色

`@antdv-next/tailwind/compat.css` 把 antd 的色板映射成 Tailwind 主题变量
（`--color-ant-primary: var(--ant-color-primary)`，还有 `-hover / -active / -bg / -border / -text` 一整套），
所以视觉层这样写就行，永远跟着主色：

```ts
// 强调色一律用 *-ant-primary，不要写死色值
cn('bg-ant-primary text-white shadow-lg shadow-ant-primary/30');
cn('bg-ant-primary/10 text-ant-primary ring-1 ring-ant-primary/20');
```

::: danger 别写死蓝色
`bg-blue-600`、`text-blue-500`、`#1677ff` 这类硬编码在浅色下看着对，换主色 / 进暗黑就露馅。
登录页有 `views/login/__tests__/login-styles.spec.ts` 当契约钉住"强调色只能来自
`*-ant-primary` 或 `var(--ant*)`"，新写的页面建议照这条口径来。
（存量：约 38 个 view 文件里还留着 `blue-*` / `#1677ff`，属于逐步清理的技术债。）
:::

## `colorLink` 必须和 `colorPrimary` 一起给

antd 把 `colorLink` 绑在自己的 `#1677ff` 上，而不是从 `colorPrimary` 派生。只覆盖主色的话，
`type="link"` 的按钮、超链接、Typography 可点文字全都不动 —— 这就是"换了主题色，link 按钮还是蓝的"
的根因。`getAntdTheme()` 里给 `colorPrimary` 的同时显式带上 `colorLink`，之后的
`colorLinkHover / colorLinkActive` 交给算法派生。

同理，菜单**选中项的父级**、横向菜单的 active 条也要从 CSS 变量取色，不能只改 token。

## 明暗与 `auto`

`ThemeMode = 'auto' | 'dark' | 'light'`，`auto` 用 `matchMedia('(prefers-color-scheme: dark)')`
解析出真正生效的明暗（`resolveThemeMode()`）。

::: warning 判断"现在是不是深色"要用解析结果
`appStore.themeMode === 'dark'` 在 `auto` 模式下**永远为 false**，即使系统已经是深色。
需要按明暗分支的地方（ECharts 配色、大屏底色）要读 `resolvedTheme`，不能读 `themeMode`。
:::

DOM 侧的 class 由 `applyPreferencesToDom()` 增删（默认 `dark`，可传 `darkClass`），
Tailwind 的 `dark:` 变体和 `@antdv/styles` 的 dark 规则都挂在这个 class 上。

## 风格预设是注册式的

`ThemeStyle` 有 11 个值（`default / compact / dark / geek / glass / bootstrap / cartoon /
illustration / mui / shadcn / skeuomorphism`），包**不内置**全部视觉方案，但留了注入口，
否则设置面板里的"风格"下拉就是个摆设：

```ts
import { registerThemePreset } from '@antdv/preferences';

registerThemePreset('glass', {
  algorithm: undefined,          // 不给就沿用明暗算法
  token: { /* antd token 覆盖 */ },
  components: { /* 组件级覆盖 */ },
});
```

内置只实现 `compact`（antd 官方有 `compactAlgorithm`）；未注册的风格安全回落到 default。

## 圆角与字号是倍率，不是 px

偏好里 `borderRadius` 存倍率（`0 / 0.25 / 0.5 / 0.75 / 1`），antd 基准 8px、字号基准 16px，
换算发生在 `getThemeConfig` 与 `writeThemeCssVars` 两处（都从 `--ant-*` 落到 `--app-*`）。
这样"存 0.5"在暗亮两套算法下都能派生出一致的层次。

## 无障碍开关

灰色模式与色弱模式走 CSS filter（`--app-filter` + 内联 `filter`，并挂 `gray-mode` /
`color-weak` class）：用内联而不只是样式表，是为了"没有样式表时开关也立即生效"。
焦点可见性、`prefers-reduced-motion` 等规则在 `@antdv/styles` 的 `a11y.css`。

## 加一个偏好开关的固定动作

1. `@antdv/types` 的 `AppSetting` 里加字段；
2. `packages/preferences/src/defaults.ts` 给默认值；
3. 需要落到 DOM 的，在 `css-vars.ts` 写变量 / class，并把它加进
   `clearPreferencesFromDom()` 的清理清单（登出、卸载、测试收尾都靠它，漏了会串味）；
4. 设置抽屉里加控件；
5. 补一条单测断言"改偏好 → DOM 上有对应变量/class"，端到端再点一次真实开关。
