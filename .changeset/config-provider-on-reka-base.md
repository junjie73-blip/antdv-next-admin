---
'@antdv/common-ui': minor
'@antdv/form-ui': patch
'@antdv/shadcn-ui': patch
'@antdv/popup-ui': patch
---

feat: `ConfigProvider` 按 reka-ui 的规范重做（内置文案 / 尺寸档位 / 子树主题三维补齐），并接上日期排版与档位下发两条断链

"包一层插槽"不算实现：`@antdv/common-ui` 的 `ConfigProvider` 现在以 **reka-ui 的 `ConfigProvider` 为底座**（`common-ui/src/components/config-provider/ConfigProvider.vue:194-201`），reka 那六个参数 `dir` / `locale` / `scrollBody` / `nonce` / `teleportTo` / `useId` 全部接上并且都有真实读取点；外面套的 `display: contents` 容器（`:164-173`、`:202-213`）承载主题变量与档位。在这之上补的是 reka 不管的三件事：

- **内置文案**：`okText` / `cancelText` / `emptyText` / `placeholder` 按 `locale` 从 `textsByLocale` 展开，读侧是 `useGlobalConfig()`（`Popconfirm`、`Empty` / `EmptyState` / `Transfer`、`Description`）。这些组件的 `size` / 文案 props 默认值一律改成 `undefined` —— 写死 `'default'` 就等于没有全局档位。
- **尺寸档位**：`componentSize` 三档，`'middle'` 这个存量别名在解析时折成 `'medium'`（`normalizeComponentSize`），各家族按自己的词汇落地（`Loading` → `default`、`Segmented` → `middle`）。`types.ts` 把 `ComponentSizeOption` / `ResolvedComponentSize` / `Direction` / `LocaleKey` / `GlobalTheme` 一并导出，包装组件不必再自己抄一遍档位类型。
- **子树主题**：`theme`（`mode` / `preset` / `primary` / `radius`）与 `cssVars` 只写成容器上的 CSS 变量与 `.dark` / `.light`，**不加第二个全局写侧** —— 全站主色仍然只有 `applyPreferencesToDom()` 往 `<html>` 写一次；`cssVars` 最后写入所以优先于 `theme` 派生的那两条。生效前提是 `@antdv/design` 用 `@theme inline` 声明 token，工具类编译成 `var(--app-primary)` 本身，于是 `display: contents` 这种"没有盒子"的容器也能把变量下发给子节点。留空 = 删掉声明 = 子树重新继承 `<html>`，不是"覆盖成默认值"。
- **嵌套**：内层只覆盖自己显式给出的字段，其余继承外层的成品值（`:39-47`、`:53-96`）；注入的是 `reactive` 对象而不是 `computed` 快照，否则外层改了内层收不到。宿主自己的 `class` / `style` / 事件与容器合到同一个元素（`inheritAttrs: false` + `useAttrs()`）。

两条链路上原来是断的，这次一并接上：

- **日期排版（`@antdv/form-ui`）**：`FDatePicker` 在 `<Calendar>` / `<RangeCalendar>` 上写死 `locale="zh-CN"`，另外还存了一份硬编码中文月名数组，切语言时"按钮变了、日历还是中文"。现在字段壳不传 `locale`，12 个月名由 reka 的 `useLocale()` 喂给 `Intl.DateTimeFormat`（`fields/FDatePicker.vue:161-174`）。链路是 provider → reka 注入 → 各 Root 的 `useLocale(propLocale)`（显式 prop 优先，否则注入，再兜底 `en`）→ `useDateFormatter`，Root 还 watch 语言变化重设 formatter。**`useDateFormatter()` 自己不读注入**（参数是普通字符串），所以"自己 new formatter"的包装组件不在这条桥接里：`shadcn-ui/calendar/Calendar.vue:27` 的 `useDateFormatter(props.locale ?? "en")` 只服务 `layout` 的 `NativeSelect` 变体，默认分支的 `<CalendarHeading />` 与星期表头才走注入 —— 想让月/年下拉也跟语言必须显式传。
- **档位下发（`@antdv/shadcn-ui`）**：`ToggleGroup` 往子项 `provide` 的是**普通对象**，等于 setup 那一刻的快照，切档时组自己身上的 `data-size` 变了、按钮高度不动，看起来就像"档位只写了个属性"。改成带 getter 的 `reactive()`（`toggle-group/ToggleGroup.vue:24-33`），子项每次渲染重新取。
- **下游类型出口（`@antdv/popup-ui`）**：`message/index.ts:18` 的 CSS 副作用类型声明被 `eslint --fix` 的 `spaced-comment` 拆成了 `// / <reference …>`，指令失效，按源码消费的下游 `vue-tsc` 立刻报 TS2882。恢复成真正的三斜线指令，并给 `common-ui/components/toast/Toaster.vue` 补上同样一条（本包同样按源码发布，下游看不见包内的 tsconfig include）。

验证：`@antdv/common-ui` 单测 308/308（27 个文件，其中 `__tests__/config-provider.test.ts` 22/22，覆盖注入合并、嵌套继承、`display: contents`、CSS 变量写入与"留空即删除声明"），`@antdv/form-ui` 90/90（6 个文件）；`turbo run type-check test:unit --filter=@antdv/shadcn-ui --filter=@antdv/form-ui` 14/14 任务通过，`turbo run type-check --filter=@antdv/common-ui --filter=@antdv/popup-ui` 11/11 任务通过。新增浏览器端到端 `apps/web/e2e/config-provider.spec.ts` 5 条 × chromium / firefox / webkit = 15/15，全程只用 `setPreference()` 这一个写侧（与用户操作偏好同一条形变）：偏好的语言与档位落到宿主 `data-config-*` 且容器 `display: contents`、宽高量到 0、根 provider 上不出现第二条 `--app-primary`；档位切档时 `Segmented` 实测行高跟着变；`Popconfirm` 的内置文案从"确定/取消"变 Cancel/OK；日历标题从 `2026年10月` 变 `Oct 2026`、星期表头从 `一 二 … 日` 变 `S M T W T F S`；子树换色量到 `.bg-primary` 探针变蓝而 body 级对照与 `<html>` 的主色不动。文档同步：`docs/components/common-ui.md` 与 en 镜像重写 ConfigProvider 小节（新增「日期排版走 reka 的注入」与档位 reactive 警告），`docs/guide/in-depth/internationalization.md`（含 `docs/zh` 副本）与 en 镜像新增「日期控件的排版另走一条链路」小节与排错行；`turbo run build --filter=@antdv/docs` 通过，`node docs/_linkcheck.mjs docs` 缺失目标 0（121 个文件），四个新增锚点在构建产物里都存在。`node scripts/check-uniform-build.mjs` 仍通过。已知噪声：`common-ui` 的 `cron-editor.test.ts` 会发起外网请求，在 turbo 并发下偶发超时（单跑 27/27 绿），与本次改动无关。
