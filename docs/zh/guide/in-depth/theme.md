# 主题与偏好设置

一句话：**偏好的唯一事实源在 `@antdv/preferences`，主题色只有一条链路，视觉层只认 CSS 变量。**

## 一条链路一个出口

```
用户在设置抽屉里改主色
        │
        ▼
preferences store（持久化）
        │
        └──► applyPreferencesToDom() ──► documentElement 上的 CSS 变量 ──► 组件与外壳的样式
```

写侧只有这一个出口，读的是偏好里的 `primaryColor / borderRadius / fontSize`；组件与外壳共用同一份变量。历史上给 antd 组件留过第二条出口（`<a-config-provider :theme>` 那份 JS token，它会另存一份 `colorPrimary`，于是"改了主题色、进度条还是蓝的"），antd 请出去以后整段删掉了。DOM 侧由 `packages/core/preferences/src/update-css-variables.ts` 的 `applyPreferencesToDom()`（`:39`）与它内部的 `writeThemeCssVars()`（`:87`）落这四件事：

| 写到 `<html>` 的东西 | 作用 |
| --- | --- |
| `data-theme="…"` | 主题档位。`THEME_PRESETS`（`@antdv/shared/constants`）共 14 档：`default` 吃基础块，其余 13 档在 `@antdv/design` 的 `token/default.css` / `token/dark.css` 里各有明暗两份完整 `--*` 色板 |
| `class`：`dark` / `color-weak` / `gray-mode` + `style.colorScheme` | 明暗与无障碍开关。`colorScheme` 漏了会出现"页面黑了、滚动条还是白的" |
| `--primary`（**只有自定义色才写**） | 取色器选的颜色不在任何色板里，只能内联覆盖；预设档写了反而会把暗色档提亮过的主色压回亮色值（`css-vars.ts:33-35`）。值是 **HSL 三段**（`215.02 100% 54.31%`），由 `convertToHslCssVar()` 生成 |
| `--radius` / `--font-size` / `--filter` | 圆角倍率折成 **rem**（`radiusToRem()` 是全站唯一的 px→rem 出口，禁止写 px 圆角）、正文 px 折成根字号百分比、色弱/灰度滤镜链 |

::: warning

`--ant-*` 那四条桥已经整体删掉，变量名单的纪律是**只收有读取点的名字**（`@antdv/shared/constants` 的 `css-vars.ts:17`）。契约测试 `packages/core/preferences/__tests__/update-css-variables.test.ts:80-82` 反向钉住"内联样式上不许再出现这些名字"。:::

## 用 Tailwind 写主题色

设计规范只有一套 shadcn-vue 令牌：`@theme inline` 把 `--*` 接成工具类，强调色一律走它们，永远跟着主色：

```ts
// 强调色用 *-primary，中性色必须成对写 dark:
cn('bg-primary text-primary-foreground shadow-lg shadow-primary/30');
cn('bg-primary/10 text-primary ring-1 ring-primary/20');
```

::: danger

不要再写 `*-ant-primary`。那组工具类来自 antdv-next 的 Tailwind 兼容层（`@antdv-next/tailwind/compat.css`），`@antdv/design` 已经不引它 —— 不是"颜色不对"，而是**整条类根本不生成**，表现成元素没底色、没边框。:::

::: warning

别写死蓝色 `bg-blue-600`、`text-blue-500`、`#1677ff` 这类硬编码在浅色下看着对，换主色 / 进暗黑就露馅。登录页有 `views/login/__tests__/login-styles.spec.ts` 当契约钉住"强调色只能来自主色令牌"，新写的页面建议照这条口径来。（存量：部分 view 文件里还留着 `blue-*` / `#1677ff`，属于逐步清理的技术债。）:::

## 每个主题都是一份完整色板

`[data-theme]` 的 13 个预设档（`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`）在明暗两侧各自写满 27 个颜色令牌，不是"只改主色"：`background / card / popover / border / foreground / sidebar-*` 全部按该主题的色相重新给值，所以换主题时弹层底色、分割线、侧栏会一起走。契约由 `packages/core/base/design/__tests__/design.test.ts` 守着：每档 27 色齐全、各档签名互不相同、明暗两版的底面不同。

## 强调色只有一条链路：语义 token

历史上"换了主题色，某处还是蓝的"有三个来源：`colorLink` 被钉在 `#1677ff` 上不随种子色派生、菜单**选中项的父级**另有写死值、时区小部件的选中态自带一支蓝。antd 那层主题算法请出去之后，这三处一律改成语义 token —— `text-primary` / `bg-primary`，由 `@theme inline` 展开成 `hsl(var(--primary))`，浏览器算颜色时只剩一个来源。

`apps/web/e2e/theme-primary.spec.ts` 就是按这三处取样的：CSS 变量（探针解析）、选中父级、操作列 link 按钮，换色后必须一起过去，且换之前它们确实不是这个颜色。

## 明暗与 `auto`

`ThemeMode = 'auto' | 'dark' | 'light'`，`auto` 用 `matchMedia('(prefers-color-scheme: dark)')` 解析出真正生效的明暗（`resolveThemeMode()`）。

::: warning

判断"现在是不是深色"要用解析结果 `appStore.themeMode === 'dark'` 在 `auto` 模式下**永远为 false**，即使系统已经是深色。需要按明暗分支的地方（ECharts 配色、大屏底色）要读 `resolvedTheme`，不能读 `themeMode`。:::

DOM 侧的 class 由 `applyPreferencesToDom()` 增删（默认 `dark`，可传 `darkClass`），Tailwind 的 `dark:` 变体和 `@antdv/design` 的 dark 规则都挂在这个 class 上。

## 风格预设是注册式的

`ThemeStyle` 有 11 个值（`default / compact / dark / geek / glass / bootstrap / cartoon / illustration / mui / shadcn / skeuomorphism`），包**不内置**全部视觉方案，但留了注入口，否则设置面板里的"风格"下拉就是个摆设：

```ts
import { registerThemePreset } from '@antdv/preferences';

registerThemePreset('glass', {
  algorithm: undefined, // 不给就沿用明暗算法
  token: {/* antd token 覆盖 */},
  components: {/* 组件级覆盖 */},
});
```

内置只实现 `compact`（antd 官方有 `compactAlgorithm`）；未注册的风格安全回落到 default。

## 圆角是倍率，字号是 px

偏好里 `borderRadius` 存倍率（`0 / 0.25 / 0.5 / 0.75 / 1`，默认 `1`），基准 16px（`BORDER_RADIUS_BASE`）。换算有两条出口且同源：`themeOverridesFrom()` 把倍率换成 px 交给 antd token，`writeThemeCssVars()` 把同一个 px 写成 `--ant-border-radius` / `--radius`。漏一条就是"antd 组件圆角变了、我们自己的面板没变"。

`fontSize` 存的是 px 本身（默认 `14`）：`themeOverridesFrom()` 里 `0`/`NaN` 会退回基准 16px，免得整棵组件树字号塌成 0。

## 无障碍开关

灰色模式与色弱模式走 CSS filter（`--filter` + 内联 `filter`，并挂 `gray-mode` / `color-weak` class）：用内联而不只是样式表，是为了"没有样式表时开关也立即生效"。焦点可见性、`prefers-reduced-motion` 等规则在 `@antdv/design` 的 `css/a11y.css`。

## 加一个偏好开关的固定动作

1. `@antdv/types` 的 `AppSetting` 里加字段；
2. `packages/core/preferences/src/defaults.ts` 给默认值；
3. 需要落到 DOM 的，在 `css-vars.ts` 写变量 / class，并把它加进 `clearPreferencesFromDom()` 的清理清单（登出、卸载、测试收尾都靠它，漏了会串味）；
4. 设置抽屉里加控件；
5. 补一条单测断言"改偏好 → DOM 上有对应变量/class"，端到端再点一次真实开关。
