# 图表与 Cron

本页覆盖两个示例路由：`/components/chart`（菜单「图表」，`apps/backend-mock/server/api/menus.get.ts:305-310`）与 `/components/cron`（菜单「Cron 表达式」，`menus.get.ts:299-304`）。

## 图表：`/components/chart`

### 它解决什么问题

`ECharts` 封装（`apps/web/src/components/common/ECharts/index.vue`）把「挂容器 → init → setOption → resize → dispose」这条样板收进一个组件，页面只管喂 `option`。它由 unplugin-vue-components 自动注册（见 `apps/web/types/components.d.ts` 的 `ECharts` 条目），示例页模板里裸写 `<ECharts />` 没有 import 语句，不是漏了。

### 真实 API

入参**只有三个**，没有事件，也不 `defineExpose` 任何东西（`ECharts/index.vue:8-15`）：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `option` | `echarts.EChartsOption` | 必填 | 图表配置 |
| `height` | `string` | `'320px'` | 容器高度，宽度固定 100%（`:58`） |
| `loading` | `boolean` | `false` | 映射到 ECharts 自身的 `showLoading/hideLoading` 遮罩（`:38-44`），不用页面自己盖 Spin |

行为逐条对源码：

- **`option` 更新是替换不是合并**：组件对 `option` 做 deep watch，回调里 `setOption(opt, true)`（`ECharts/index.vue:30-36`）——第二个参数 `true` 即 `notMerge`，**每次改动整篇重设**。想「只改数据、保留其余配置」就别原地改 option 的子字段，示例页的做法是每次由 `computed` 产出完整新 option（`views/components/chart/index.vue:104-158`）。
- **resize 谁负责**：组件自己监听 `window` 的 `resize` 并调 `chart.resize()`（`ECharts/index.vue:26-28,48`）。**没有 ResizeObserver**：窗口不动、只有容器变（侧栏折叠、分栏拖动）时不会重算尺寸。
- **销毁时机**：`onBeforeUnmount` 摘掉 resize 监听并 `dispose()`（`ECharts/index.vue:51-54`）。
- **主题不联动**：`echarts.init(el.value)` 不传主题参数（`ECharts/index.vue:22`），封装也**没有 `theme` 入参**——注册过的 ECharts 主题、偏好里的深色模式都不会自动作用到图上。

::: warning 明暗适配是示例页自己做的「图表」示例页的做法是：读 `appStore.resolvedTheme` 得到 `isDark`（`chart/index.vue:21`；store 侧 `apps/web/src/stores/modules/app.ts:42`），把所有颜色写成 `computed` 里的 option 字段（文字/轴线/tooltip 背景都按明暗两套取值，`chart/index.vue:23-50`），主题切换时 `computed` 重算、触发组件的 notMerge 重绘（页面注释原话在 `chart/index.vue:19-21`）。换你自己的页面时，这是封装可用能力的全部：其余的「深色主题」都得这样进 option。:::

### 一个存在但没被接线的全功能 composable

仓库里另有一套 `packages/composables/src/echarts/useEcharts.ts`：支持 `isDark`（切换时销毁重建图表，`:297-310`）、`resizeStrategy`（none/raf/debounce/throttle，`:130-150`）、ResizeObserver 观察容器（`:313-342`）、`setData` 深合并补丁（`:254-262`）、init 失败重试（`:201-215`）。注释还记录它修掉过「`setData` 曾经是静默空函数」的历史（`:245-252`）。但它在 `apps/web` 里**没有任何消费者**（除自身的测试与 dist 产物），`/components/chart` 用的是上面那个三 prop 的薄封装。别把两套能力混着写。

### 示例页内容

五张卡片，数据全是页内常量、零请求（页面 alert 原话，`chart/index.vue:417-425`）：折线（「刷新数据」在三组内置数据间轮换，`:96-102`）、柱状（分组/堆叠开关只改 `series.stack`，`:164-211`）、环形饼图（图例点选、label 模板）、双 Y 轴组合图（柱+线，`:282-351`）、loading 与空数据（空数组 option 渲染坐标系骨架，`:357-412`）。

## Cron：`/components/cron`

### 它解决什么问题

`CronEditor`（`apps/web/src/components/common/CronEditor/index.vue`）给「配置定时任务表达式」一个预设点选 + 六字段下拉拼接的可视界面，配 `cronstrue` 中文描述实时回显，产出/接收一个表达式字符串。

### 真实 API

Props 与事件（`CronEditor/index.vue:12-26`）：

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `modelValue` | `string` | 表达式，支持 `v-model`；组件挂载时若处于「自定义」模式会解析回填字段（`:154-162`） |
| `disabled` | `boolean` | 禁用全部按钮与下拉 |
| `change` 事件 | `(value: string) => void` | 预设点选（`:226-229`）、字段变更（`:232-236`）、模式切换补默认值（`:211-223`）时抛出 |

没有校验函数、没有 `valid` 事件、不暴露实例方法——表达式合法性只体现在描述区。

### 表达式格式：6 段「秒 分 时 日 月 周」

- 生成侧固定输出 **6 段**：按 `fields` 顺序 join（`CronEditor/index.vue:57-106,165-167`），即秒、分、时、日、月、周；12 个内置预设也全是 6 段（`:32-45`）。可以理解为「Quartz 风格但只有前 6 段」。
- **不是严格 Quartz**：组件没有年段，日/周两段互不排斥、不输出 Quartz 的 `?` 占位，周字段取值范围是 **0~6**（`:99-105`）。Quartz 后端（典型如调度器要求 day-of-month 与 day-of-week 恰有一个为 `?`、周从 1 开始）接到这份表达式需要自己转换——封装并没有做这层保证，别按「原生 Quartz 编辑器」写它。
- 解析侧（外部传入的 `modelValue`）：`parseCron` 接受 **5 段或 6 段**，5 段按「分时日月周」补一个 `0` 秒（`CronEditor/index.vue:119-151`）；**其余段数一律重置为默认值** `0 0 0 * * *`，不报错——坏输入会被静默吞掉。
- 字段选项由下拉枚举：每个字段 `*` / 单值 / 秒分（`*/5 */10 */15 */30`）/ 时（`*/2 */4 */6 */12`），见 `getFieldOptions`（`:170-199`）。日/月/周没有步进选项。

### 校验规则：只有一层 try/catch

组件对表达式的「校验」就是把生成结果丢给 `cronstrue.toString(expr, { locale: 'zh_CN' })`，抛异常时把描述区改成「表达式无效」（`CronEditor/index.vue:202-208`）——**不阻止输出**，`change` 照抛。示例页在此之上自建了 `check()` 把错误收进 `{ text, error }`（`views/components/cron/index.vue:34-43`），非法时标红/弹 warning（如 `:48-53,88-96`）。

::: warning 组件不支持手动输入展示表达式的那个 `a-input` 是 `readonly` 的（`CronEditor/index.vue:323-330`）；脚本里定义的 `handleInputChange`（`:239-243`）**在模板里没有任何绑定点**，是一段死代码。想手输表达式得像示例页第 3 张卡片那样自己放输入框。:::

### type-check 报错文件之一：类型隐患，不是运行时故障

`CronEditor` 是仓库已确认的 type-check 报错文件之一（type-check 目前非阻断）。从源码看报错来源清楚：`apps/web/tsconfig.app.json:21` 开了 `noUncheckedIndexedAccess`，于是 `presets[0].value`（`CronEditor/index.vue:219-220`）与 `parseCron` 里把 `parts[0]` 这类下标结果赋进 `Record<string, string>`（`:123-139`）都被推成可能 `undefined` 而被拦。实际执行路径都有前置守卫——`presets` 是非空字面量数组、下标访问发生在 `parts.length === 5 / 6` 分支内——**不影响当前运行行为**，但也意味着别在重构时顺手删掉那些长度判断，删了类型层不会替你兜住 `undefined` 之外的语义。

### 示例页怎么用它：页面内联，不是弹窗

`/components/cron` 的四张卡片各自内联一个 `CronEditor`（显式 import，`cron/index.vue:8,134,163,216,233`），演示的是四种用法：v-model + 实时描述；预设按钮写值并校验；「草稿 → 应用/重置」的受控/非受控回退（`:83-104`）；表达式按 5/6 段拆字段展示 + 文字描述。第 4 张卡片顶上的 alert 诚实地写明：项目里**只有 cronstrue（只能生成文字描述），没有 cron-parser 这类能算「下次运行时间」的调度库，也没有后端**，所以这一页不伪造运行时间表（原注释 `cron/index.vue:107-108`，alert 文案 `:223-229`）。

## 在线示例

- **`http://localhost:6080/#/components/chart`** — 侧栏「组件示例 → 图表」。点「刷新数据」看整篇 option 替换式重绘；打开/关闭柱状图的堆叠开关；点饼图右侧图例隐去某个扇区；在「加载与空数据」卡片按「显示 Loading」看封装自带的遮罩。切全局深浅色主题（见[主题定制](/guide/in-depth/theme)）验证颜色确实跟着 option 重算——那是页面 computed 的功劳，不是封装的。
- **`http://localhost:6080/#/components/cron`** — 侧栏「Cron 表达式」。在「常用预设 / 自定义」两态间切换，改六个下拉观察 `update:modelValue` 产物恒为 6 段；第 3 张卡片手动输入 `* * *` 看校验标红、再点「应用」看非法值被拒。

## 相关页面

- [组件示例总览](/components/)
- [表格](/components/table)
- [表单](/components/form)
- [主题定制](/guide/in-depth/theme) —— 图表明暗取色所依赖的 `resolvedTheme`
- [样式](/guide/essentials/styles) —— 示例页 `cn()` 类名约定的出处
