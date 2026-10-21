# 国际化

一句话：**文案表在 `apps/web/src/locales/`，locale 的唯一取值在偏好里，所有生效动作（i18n、`<html lang>`、dayjs、antd 内置文案）由 `useLocaleSync` 一处展开；日历里由 reka 原语排版的那部分不在这四件事里，走 `ConfigProvider` 的注入，见「日期控件的排版另走一条链路」小节。**

## 两张文案表 + 一个真相源

```
locales/index.ts        createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'zh-CN' })
  ├── lang/zh-CN.ts     // 默认导出一个嵌套对象：common / system / ...
  └── lang/en-US.ts
appStore.locale         // 偏好里的 locale（@antdv/preferences defaults: 'zh-CN'）——唯一真相
```

`locales/index.ts` 顶部的注释写明了分工：这里**只注册文案**，不再读任何存储。以前存在"两个各写各的 locale"的状态源，漂移表现是"菜单变英文、分页器还是中文"。

## applyLocale：一个 locale 展开成四件事

`src/composables/web/useLocale.ts`：

```ts
i18n.global.locale.value = locale; // 1. 自己的文案
document.documentElement.lang = locale; // 2. 无障碍 / SEO
dayjs.locale(DAYJS_LOCALE_MAP[locale]); // 3. 日期格式化（zh-CN → 'zh-cn'，注意小写短码）
antdLocale.value = await loadLocale(locale); // 4. antd 内置文案
```

第 4 件事的教训写在源码注释里：这一步曾经是注释掉的，`antdLocale` 恒为undefined，`ConfigProvider` 退回英文兜底 —— 整站中文界面里内置文案是英文、表格空状态是英文。现在 `App.vue` 把它接进 `ConfigProvider :locale`。

::: warning 内置文案有两层 provider，别记混 `Popconfirm` 的确定/取消、`Empty` / `EmptyState` / `Transfer` 的空态文案读的是 `@antdv/common-ui` 的 `ConfigProvider`（`apps/web/src/App.vue:76-79`，同样取 `appStore.locale`），与 antd 无关；antd 那只现在只剩表单设计器还在用。两层都从同一个偏好取值，所以切语言会一起动 —— 反过来说，谁在子树里新挂一层 provider 却忘了传 `locale`，就会出现"主体已切英文、包内组件仍是中文"这种半套状态。API 见 [公共组件](/components/common-ui)。:::

`useLocaleSync()` 是**唯一**做这个展开的地方（App.vue 调用），任何组件都不该再自己写 `i18n.global.locale`。

## 日期控件的排版另走一条链路

上面那四件事管不到日历里的月份标题和星期表头 —— 那是 **reka 原语**排版的，读的是 `@antdv/common-ui` 的 `ConfigProvider` 透传给 reka 底座的 `locale`：provider → reka 注入 → 各 Root 里的 `useLocale(propLocale)`（显式 prop 优先，否则取注入，再兜底 `'en'`），Root 拿到值才交给 `useDateFormatter` 做 `Intl` 格式化，并 watch 语言变化。覆盖 `CalendarRoot` / `RangeCalendarRoot` / `DateField` / `DatePicker` / `MonthPicker` / `YearPicker`（含各自 Range 变体）与 `TimeField` / `NumberField` / `ColorField`。

- **字段壳不许写死 `locale`**。`FDatePicker` 原先在 `<Calendar>` / `<RangeCalendar>` 上写死 `locale="zh-CN"`，另外还存了一份中文月名数组 —— "切了英文、日历还是中文"就是这两处；现在它不传 `locale`，12 个月名从 `useLocale()` 现取（`packages/core/ui-kit/form-ui/src/fields/FDatePicker.vue`）。
- **`useDateFormatter()` 自己不读注入**（参数是普通字符串），所以"自己 new 一个 formatter"的包装组件不在这条链路上：`@antdv/shadcn-ui` 的 `calendar/Calendar.vue` 就是 `useDateFormatter(props.locale ?? 'en')`，那份 formatter 只服务 `layout` 的 `month-and-year` / `month-only` / `year-only` 三个 `NativeSelect` 变体；默认分支渲染的 `<CalendarHeading />` 与星期表头才走注入。要让月/年下拉也跟语言，得显式把 `locale` 传进这个包装组件。
- 端到端锚点：`apps/web/e2e/config-provider.spec.ts` —— 切到 `en-US` 后断言标题从 `2026年10月` 变成 `Oct 2026`、星期表头从 `一 二 … 日` 变成 `S M T W T F S`。

组件侧的完整口径见[公共组件](/components/common-ui)的「日期排版走 reka 的注入」小节。

## 写入只有一条路

```ts
const { setLocale } = useLocale();
setLocale('en-US'); // 实际是 appStore.updateSetting({ locale })
```

偏好落盘由 `@antdv/preferences` 负责，`watch(appStore.locale)` 让效应自动跟上。语言切换的 UI 入口在设置抽屉（`layouts/components/SettingDrawer/`），它写的也是这个 `locale` 字段；组件层不要绕过 `setLocale` 直接 patch 偏好。

## antd 语言包按需加载

`packages/preferences/src/theme/index.ts`：

- `LOCALE_LOADERS` 懒加载 `antdv-next/locale/zh_CN | en_US | zh_TW`；
- `loadLocale()` 加载失败**回落默认语言**而不是白屏；
- 注意两处口径不同：loader 支持三种语言，而 `useLocale.ts` 的 `LocaleType = 'en-US' | 'zh-CN'`。加一门语言要同时改这两处，并在 `locales/lang/` 补对应文案表。

## 菜单标题的翻译

后端菜单的 `menuName` 是中文常量、不是 i18n key。`src/locales/menu.ts` 的 `localizeMenus()` 按路由 `name` 去文案表找 `menu.<Name>`，消费点在 `layouts/composables/useMenuTree.ts`（`te(key) ? t(key) : undefined`）；查不到就原样显示后端标题 —— 新增页面还没补译文时，导航里是一条能看懂的中文，而不是渲染出 `menu.NewPage` 这种 key。

## 编译期配合

`internal/vite-config/src/plugins/vue.ts` 注册了 `@intlify/unplugin-vue-i18n` （`compositionOnly / runtimeOnly: true`），模板里的 `$t` 走 Composition API 的运行时；`createI18n` 的 `legacy: false` 必须与它配套。

## 常见失误

| 症状 | 根因 |
| --- | --- |
| 切了语言，antd 组件文案不动 | 绕开 `useLocaleSync` 自己写了 `i18n.global.locale`，`ConfigProvider :locale` 没收到新对象 |
| 切了语言，包内组件文案不动 | 子树里另挂了一层 `@antdv/common-ui` 的 `ConfigProvider` 却没传 `locale`；或者有人把文案写死在组件里，没走 `useGlobalConfig()` |
| 日期中文不生效 | dayjs 的 locale 名是 `zh-cn`（小写短码），不是 BCP 47 的 `zh-CN`；映射在 `DAYJS_LOCALE_MAP` |
| 切了语言，日历还是中文 | 字段壳/包装组件把 `locale` 写死了，或 `layout` 模式的月/年下拉没显式传 `locale` —— 见「日期控件的排版另走一条链路」小节 |
| 某些文案在英文界面仍是中文 | 该键只存在于 `zh-CN.ts`；两个语言文件按键对齐是硬约束（见 [规范](/zh/guide/project/protocol)） |
| 菜单里出现 `menu.XXX` 字面量 | 不会 —— `localizeMenus` 查不到 key 时回落原始标题，出现即说明有人改了回退逻辑 |

## 相关页面

- 主题与 CSS 变量：[主题与偏好设置](/zh/guide/in-depth/theme)
- 时间格式化与时区：`useAppStore` 的 `timezone` 同样由偏好驱动（见 [状态管理](/zh/guide/essentials/stores)）
