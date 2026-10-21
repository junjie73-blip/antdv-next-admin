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

写侧只有这一个出口，读的就是偏好那几个字段（`primaryColor / borderRadius / fontSize`）；组件与外壳共用同一份变量，不存在第二条链路（`apps/web/src/App.vue:37` 把这件事写成了注释）。历史上确实有过后半条 —— `<ConfigProvider :theme>` 那份 antd token，它会把 `colorPrimary` 另存一份 JS 值，于是"换了主题色、link 按钮还是蓝的"；antd 请出去以后这条整段删掉了，颜色变量只剩 CSS 这一份。侧栏、标签页、登录页、NProgress 这些**自己写的**样式必须走 CSS 变量，否则就是"换了主题色，组件变了、外壳没变"。DOM 侧由 `packages/core/preferences/src/update-css-variables.ts` 的 `applyPreferencesToDom()`（`:39`）与它内部的 `writeThemeCssVars()`（`:87`）一起落：

| 写到 `<html>` 的东西 | 作用 |
| --- | --- |
| `class`：`dark` / `color-weak` / `gray-mode` + `style.colorScheme` | 明暗与无障碍开关。`colorScheme` 漏了会出现"页面黑了、滚动条还是白的" |
| `data-theme="…"` | 主题档位。`THEME_PRESETS`（`@antdv/shared/constants`）共 14 档：`default` 吃基础块，其余 13 档在 `@antdv/design` 的 `token/default.css` / `token/dark.css` 里各有明暗两份完整 `--*` 色板 |
| `--primary`（**只有自定义色才写**） | 取色器选的颜色不在任何色板里，只能内联覆盖；预设档写了反而会把暗色档提亮过的主色压回亮色值（`css-vars.ts:33-35`）。值是 **HSL 三段**（`215.02 100% 54.31%`），由 `convertToHslCssVar()` 生成 |
| `--radius` / `--font-size` / `--filter` | 圆角倍率折成 **rem**（`radiusToRem()` 是全站唯一的 px→rem 出口，禁止写 px 圆角）、正文 px 折成根字号百分比、色弱/灰度滤镜链 |

::: warning

`--ant-*` 那四条桥已经整体删掉。`--ant-color-primary`、`--ant-primary-color`、`--ant-border-radius` 等原本是给页面上 antd 组件的桥，antd 的 DOM 请出去之后它们只剩"每次换主题多写几条没人读的声明"，于是连同变量名单一起清了（`@antdv/shared/constants` 的 `css-vars.ts:17` 写了这条名单纪律：**只收有读取点的名字**）。契约测试 `packages/core/preferences/__tests__/update-css-variables.test.ts:80-82` 反向钉住"内联样式上不许再出现这两个名字"。:::

## 用 Tailwind 写主题色

设计规范只有一套 shadcn-vue 令牌：`@theme inline` 把 `--*` 接成工具类，强调色一律走它们，永远跟着主色：

```ts
// 强调色用 *-primary，中性色必须成对写 dark:
cn('bg-primary text-primary-foreground shadow-lg shadow-primary/30');
cn('bg-primary/10 text-primary ring-1 ring-primary/20');
```

::: danger

不要再写 `*-ant-primary`。那组工具类来自 antdv-next 的 Tailwind 兼容层（`@antdv-next/tailwind/compat.css`），`@antdv/design` 已经不引它 —— 不是"颜色不对"，而是**整条类根本不生成**，表现成元素没底色、没边框。目录里现在没有任何包依赖 `@antdv-next/tailwind`（catalog 还挂着 `^1.1.2` 这一条，但引用点为零），并且有测试反着钉：`design.test.ts:399-405` 断言 token 源码里不出现 `--ant-` 与 `-ant-[a-z]`，`:527` 断言本包依赖名单里不许出现 `@antdv-next/tailwind`。:::

::: warning

别写死蓝色 `bg-blue-600`、`text-blue-500`、`#1677ff` 这类硬编码在浅色下看着对，换主色 / 进暗黑就露馅。新写的页面请只从主色令牌取强调色。（存量：部分 view 文件里还留着 `blue-*` / `#1677ff`，属于逐步清理的技术债；原先钉这一条的 `views/login/__tests__/login-styles.spec.ts` 已随登录页改版删除。）:::

## 每个主题都是一份完整色板

`[data-theme]` 的 13 个预设档（`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`）在明暗两侧各自写满 27 个颜色令牌，不是"只改主色"：`background / card / popover / border / foreground / sidebar-*` 全部按该主题的色相重新给值，所以换主题时弹层底色、分割线、侧栏会一起走。契约由 `packages/core/base/design/__tests__/design.test.ts` 守着：每档 27 色齐全、各档签名互不相同、明暗两版的底面不同。

## 强调色只有一条链路：语义 token

历史上"换了主题色，某处还是蓝的"有三个来源：`colorLink` 被钉在 `#1677ff` 上不随种子色派生、菜单**选中项的父级**另有写死值、时区小部件的选中态自带一支蓝。antd 那层主题算法请出去之后，这三处一律改成语义 token —— `text-primary` / `bg-primary`，由 `@theme inline` 展开成 `hsl(var(--primary))`，浏览器算颜色时只剩一个来源。

`apps/web/e2e/theme-primary.spec.ts` 就是按这三处取样的：CSS 变量（探针解析）、选中父级、操作列 link 按钮，换色后必须一起过去，且换之前它们确实不是这个颜色。

## 明暗与 `auto`

`ThemeMode = 'auto' | 'dark' | 'light'`。系统那一侧由 `createSystemDark()` 订阅 `matchMedia('(prefers-color-scheme: dark)')`（不支持 SSR/老浏览器时恒为浅色，`packages/utils/src/theme-mode.ts:43`），`auto` 再由 `resolveThemeMode(mode, isSystemDark)`（`:14`）折叠成真正生效的 dark / light。两个函数都从 `@antdv/utils` 出口，`~/settings` 再转口一次。

::: warning

判断"现在是不是深色"要用解析结果 `appStore.themeMode === 'dark'` 在 `auto` 模式下**永远为 false**，即使系统已经是深色。需要按明暗分支的地方（ECharts 配色、大屏底色）要读 `resolvedTheme`，不能读 `themeMode`。:::

DOM 侧的 class 由 `applyPreferencesToDom()` 增删（默认 `dark`，可传 `darkClass`），Tailwind 的 `dark:` 变体和 `@antdv/design` 的 dark 规则都挂在这个 class 上。

## `ThemeStyle` 现在只剩一个读者

`ThemeStyle` 的类型里还留着 11 个值（`default / compact / dark / geek / glass / bootstrap / cartoon / illustration / mui / shadcn / skeuomorphism`，`packages/core/base/typings/src/app.ts:68-79`），但那份"风格 → antd ThemeConfig"的注册表已经随依赖一起退场 —— 没有 `registerThemePreset()`，也没有 `<ConfigProvider :theme>`，偏好到 DOM 只剩一条链路。现在只有 `geek` 还有人读：标签栏配色（`packages/layouts/src/basic/layout.vue:88` 把它折进 `tone.geek`）。其余档位留着是为了兼容已经存进 localStorage 的旧偏好值，改它们不会报错，也不会改变外观。

## 圆角是倍率，字号是 px

偏好里 `borderRadius` 存倍率（`0 / 0.25 / 0.5 / 0.75 / 1`，默认 `1`，见 `packages/core/preferences/src/config.ts` 的 `DEFAULT_PREFERENCES`），基准 16px（`BORDER_RADIUS_BASE`）。换算只有一条出口：`writeThemeCssVars()` 先乘基准，再交给 `radiusToRem()`（`@antdv/shared/utils/radius`）落成 `--radius` 上的 rem 串，默认档即 `1rem`。**全站圆角不许出现 px** —— 组件侧要绝对值时（`ConfigProvider` 的 `theme.radius`、`BorderBeam` 的 `radius`、锁屏卡片）也一律走同一个 `radiusToRem()`，所以倍率、子树覆盖、首屏快照三条链路是同一套单位口径。Tailwind 的 `rounded-*` 读的是 `--radius` 派生的 `--radius-*` 档，`--radius` 因此是尺度变量而不是颜色变量（值不带 `hsl()`，`design.test.ts` 的尺度用例守着这条）。

`fontSize` 存的是 px 本身（默认 `14`）：`themeOverridesFrom()` 里 `0`/`NaN` 会退回基准 16px，免得整棵组件树字号塌成 0。CSS 侧写的不是 px 而是根字号百分比（`--font-size`），因为正文用的是 `text-sm` = 0.875rem，直接写 px 会让所有 rem 尺寸一起缩。

## 无障碍开关

灰色模式与色弱模式走 CSS filter（`--filter` + 内联 `filter`，并挂 `gray-mode` / `color-weak` class）：用内联而不只是样式表，是为了"没有样式表时开关也立即生效"。焦点可见性、`prefers-reduced-motion` 等规则在 `@antdv/design` 的 `css/a11y.css`。

## 加一个偏好开关的固定动作

1. `@antdv/types` 的 `AppSetting` 里加字段（`packages/core/base/typings/src/app.ts`）；
2. `packages/core/preferences/src/config.ts` 的 `DEFAULT_PREFERENCES` 给默认值；
3. 需要落到 DOM 的，在 `update-css-variables.ts` 写变量 / class，变量名加进 `@antdv/shared/constants` 的 `css-vars.ts`（`PREFERENCE_CSS_VARS` 是 `clearPreferencesFromDom()` 的清理清单，登出、卸载、测试收尾都靠它，漏了会串味）；
4. 设置抽屉里加控件；
5. 补一条单测断言"改偏好 → DOM 上有对应变量/class"，端到端再点一次真实开关。
