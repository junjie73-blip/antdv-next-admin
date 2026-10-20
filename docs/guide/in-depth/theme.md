# 主题与偏好设置

一句话：**偏好的唯一事实源在 `@antdv/preferences`，主题色只有一条链路，视觉层只认 CSS 变量。**

## 一条链路两个出口

```
用户在设置抽屉里改主色
        │
        ▼
preferences store（持久化）
        │
        ├──► getThemeConfig() ──► <ConfigProvider :theme> ──► antdv-next 组件（只剩表单设计器）
        │
        └──► applyPreferencesToDom() ──► documentElement 上的 CSS 变量 ──► 我们自己写的样式
```

两条出口读的是**同一份偏好字段**（`primaryColor / borderRadius / fontSize`），所以不存在"换了主题色、设计器还是蓝的"这种第二条链路 —— 有第二条的形态是它自己另存一份色板，而这里没有（`apps/web/src/App.vue:15-23` 把这件事写成了注释）。antd 的 token 只管得到页面里剩下的那一点 antd DOM（`@form-create/antd-designer` 的模板，预编译、靠全局注册找组件）；侧栏、标签页、登录页、NProgress 这些**自己写的**样式必须走 CSS 变量，否则就是"换了主题色，组件变了、外壳没变"。DOM 侧由 `packages/core/preferences/src/update-css-variables.ts` 的 `applyPreferencesToDom()`（`:37`）与它内部的 `writeThemeCssVars()`（`:85`）一起落：

| 写到 `<html>` 的东西 | 作用 |
| --- | --- |
| `class`：`dark` / `color-weak` / `gray-mode` + `style.colorScheme` | 明暗与无障碍开关。`colorScheme` 漏了会出现"页面黑了、滚动条还是白的" |
| `data-theme="…"` | 主题档位。`THEME_PRESETS`（`@antdv/shared/constants`）共 14 档：`default` 吃基础块，其余 13 档在 `@antdv/design` 的 `token/default.css` / `token/dark.css` 里各有明暗两份完整 `--app-*` 色板 |
| `--app-primary`（**只有自定义色才写**） | 取色器选的颜色不在任何色板里，只能内联覆盖；预设档写了反而会把暗色档提亮过的主色压回亮色值（`css-vars.ts:23-27`） |
| `--app-border-radius` / `--app-font-size` / `--app-filter` | 圆角倍率折成 px、正文 px 折成根字号百分比、色弱/灰度滤镜链 |

::: warning

`--ant-*` 那四条桥已经整体删掉。`--ant-color-primary`、`--ant-primary-color`、`--ant-border-radius` 等原本是给页面上 antd 组件的桥，antd 的 DOM 请出去之后它们只剩"每次换主题多写几条没人读的声明"，于是连同变量名单一起清了（`@antdv/shared/constants` 的 `css-vars.ts:9-11` 写了这条名单纪律：**只收有读取点的名字**）。契约测试 `packages/core/preferences/__tests__/update-css-variables.test.ts:74-75` 反向钉住"内联样式上不许再出现这两个名字"。
:::

## 用 Tailwind 写主题色

设计规范只有一套 shadcn-vue 令牌：`@theme inline` 把 `--app-*` 接成工具类，强调色一律走它们，永远跟着主色：

```ts
// 强调色用 *-primary，中性色必须成对写 dark:
cn('bg-primary text-primary-foreground shadow-lg shadow-primary/30');
cn('bg-primary/10 text-primary ring-1 ring-primary/20');
```

::: danger

不要再写 `*-ant-primary`。那组工具类来自 antdv-next 的 Tailwind 兼容层（`@antdv-next/tailwind/compat.css`），`@antdv/design` 已经不引它 —— 不是"颜色不对"，而是**整条类根本不生成**，表现成元素没底色、没边框。目录里现在没有任何包依赖 `@antdv-next/tailwind`（catalog 还挂着 `^1.1.2` 这一条，但引用点为零），并且有测试反着钉：`design.test.ts:399-405` 断言 token 源码里不出现 `--ant-` 与 `-ant-[a-z]`，`:527` 断言本包依赖名单里不许出现 `@antdv-next/tailwind`。
:::

::: warning

别写死蓝色 `bg-blue-600`、`text-blue-500`、`#1677ff` 这类硬编码在浅色下看着对，换主色 / 进暗黑就露馅。新写的页面请只从主色令牌取强调色。（存量：部分 view 文件里还留着 `blue-*` / `#1677ff`，属于逐步清理的技术债；原先钉这一条的 `views/login/__tests__/login-styles.spec.ts` 已随登录页改版删除。）
:::

## 每个主题都是一份完整色板

`[data-theme]` 的 13 个预设档（`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`）在明暗两侧各自写满 27 个颜色令牌，不是"只改主色"：`background / card / popover / border / foreground / sidebar-*` 全部按该主题的色相重新给值，所以换主题时弹层底色、分割线、侧栏会一起走。契约由 `packages/core/base/design/__tests__/design.test.ts` 守着：每档 27 色齐全、各档签名互不相同、明暗两版的底面不同。

## `colorLink` 必须和 `colorPrimary` 一起给

antd 把 `colorLink` 绑在自己的 `#1677ff` 上，而不是从 `colorPrimary` 派生。只覆盖主色的话， `type="link"` 的按钮、超链接、Typography 可点文字全都不动 —— 这就是"换了主题色，link 按钮还是蓝的" 的根因。`getAntdTheme()` 里给 `colorPrimary` 的同时显式带上 `colorLink`，之后的 `colorLinkHover / colorLinkActive` 交给算法派生。

同理，菜单**选中项的父级**、横向菜单的 active 条也要从 CSS 变量取色，不能只改 token。

## 明暗与 `auto`

`ThemeMode = 'auto' | 'dark' | 'light'`。系统那一侧由 `createSystemDark()` 订阅 `matchMedia('(prefers-color-scheme: dark)')`（不支持 SSR/老浏览器时恒为浅色，`packages/utils/src/theme-mode.ts:43`），`auto` 再由 `resolveThemeMode(mode, isSystemDark)`（`:14`）折叠成真正生效的 dark / light。两个函数都从 `@antdv/utils` 出口，`~/settings` 再转口一次。

::: warning

判断"现在是不是深色"要用解析结果 `appStore.themeMode === 'dark'` 在 `auto` 模式下**永远为 false**，即使系统已经是深色。需要按明暗分支的地方（ECharts 配色、大屏底色）要读 `resolvedTheme`，不能读 `themeMode`。
:::

DOM 侧的 class 由 `applyPreferencesToDom()` 增删（默认 `dark`，可传 `darkClass`），Tailwind 的 `dark:` 变体和 `@antdv/design` 的 dark 规则都挂在这个 class 上。

## 风格预设是注册式的

`ThemeStyle` 有 11 个值（`default / compact / dark / geek / glass / bootstrap / cartoon / illustration / mui / shadcn / skeuomorphism`，`packages/core/base/typings/src/app.ts:68-79`），但 antd 侧**不内置**全部视觉方案，只留了注入口，否则设置面板里的"风格"下拉就是个摆设。注意这张注册表住在**应用**里（`apps/web/src/settings/theme/index.ts:57`，从 `~/settings` 出口），不在 `@antdv/preferences`：

```ts
import { registerThemePreset } from '~/settings';

registerThemePreset('glass', {
  algorithm: undefined, // 不给就沿用明暗算法
  token: {/* antd token 覆盖 */},
  components: {/* 组件级覆盖 */},
});
```

内置只实现 `compact`（`getAntdTheme()` 里 `[baseAlgorithm, theme.compactAlgorithm]`，同文件 `:90-96`）；其余未注册的风格拿不到预设，`preset` 为 `undefined` 时安全回落到明暗算法 + 基础 token 表。今天真正调用 `registerThemePreset()` 的只有 `apps/web/src/settings/__tests__/antd-theme.test.ts:89` —— 也就是说这条口子是留着的，页面还没用它挂任何第三方风格。

## 圆角是倍率，字号是 px

偏好里 `borderRadius` 存倍率（`0 / 0.25 / 0.5 / 0.75 / 1`，默认 `1`，见 `packages/core/preferences/src/config.ts` 的 `DEFAULT_PREFERENCES`），基准 16px（`BORDER_RADIUS_BASE`，即 `@antdv/design` 里 `--radius-lg` 的档）。换算有两条出口且同源：`themeOverridesFrom()` 把倍率换成 px 交给 antd token（`settings/theme/index.ts:125`），`writeThemeCssVars()` 把同一个 px 写成 `--app-border-radius`。Tailwind 的 `rounded-*` 只认 `--radius-*` 那一份表，所以这个变量是唯一例外——它进的是 `--radius-*` 命名空间而不是颜色命名空间（`design.test.ts:123-133` 的注释与用例）。

`fontSize` 存的是 px 本身（默认 `14`）：`themeOverridesFrom()` 里 `0`/`NaN` 会退回基准 16px，免得整棵组件树字号塌成 0。CSS 侧写的不是 px 而是根字号百分比（`--app-font-size`），因为正文用的是 `text-sm` = 0.875rem，直接写 px 会让所有 rem 尺寸一起缩。

## 无障碍开关

灰色模式与色弱模式走 CSS filter（`--app-filter` + 内联 `filter`，并挂 `gray-mode` / `color-weak` class）：用内联而不只是样式表，是为了"没有样式表时开关也立即生效"。焦点可见性、`prefers-reduced-motion` 等规则在 `@antdv/design` 的 `css/a11y.css`。

## 加一个偏好开关的固定动作

1. `@antdv/types` 的 `AppSetting` 里加字段（`packages/core/base/typings/src/app.ts`）；
2. `packages/core/preferences/src/config.ts` 的 `DEFAULT_PREFERENCES` 给默认值；
3. 需要落到 DOM 的，在 `update-css-variables.ts` 写变量 / class，变量名加进 `@antdv/shared/constants` 的 `css-vars.ts`（`PREFERENCE_CSS_VARS` 是 `clearPreferencesFromDom()` 的清理清单，登出、卸载、测试收尾都靠它，漏了会串味）；
4. 设置抽屉里加控件；
5. 补一条单测断言"改偏好 → DOM 上有对应变量/class"，端到端再点一次真实开关。
