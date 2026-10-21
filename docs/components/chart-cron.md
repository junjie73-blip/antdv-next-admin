# 图表与 Cron

本页覆盖两个示例路由：`/components/chart`（菜单「图表」，`apps/backend-mock/server/api/menus.get.ts:305-310`）与 `/components/cron`（菜单「Cron 表达式」，`menus.get.ts:299-304`）。

## 图表：`/components/chart`

### 它解决什么问题

`ECharts` 封装（`packages/core/ui-kit/common-ui/src/components/charts/ECharts.vue`）把「挂容器 → init → setOption → resize → dispose」这条样板收进一个组件，页面只管喂 `option`。它**不在根 barrel 里**，得走子路径显式引：`import { ECharts } from '@antdv/common-ui/charts'`（`packages/core/ui-kit/common-ui/package.json` 的 `exports` 只列了 `.` 和 `./charts`，因为这张图会把整个 echarts 全量注册表拖进来）。

### 真实 API

入参**只有三个**，没有事件，也不 `defineExpose` 任何东西（`charts/ECharts.vue:18-21`）：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `option` | `echarts.EChartsOption` | 必填 | 图表配置 |
| `height` | `string` | `'320px'` | 容器高度，宽度固定 100%（`:64`） |
| `loading` | `boolean` | `false` | 映射到 ECharts 自身的 `showLoading/hideLoading` 遮罩（`:44-50`），不用页面自己盖 Spin |

行为逐条对源码：

- **`option` 更新是替换不是合并**：组件对 `option` 做 deep watch，回调里 `setOption(opt, true)`（`charts/ECharts.vue:36-42`）——第二个参数 `true` 即 `notMerge`，**每次改动整篇重设**。想「只改数据、保留其余配置」就别原地改 option 的子字段，示例页的做法是每次由 `computed` 产出完整新 option（`views/components/chart/index.vue:104-164`）。
- **resize 谁负责**：组件自己监听 `window` 的 `resize` 并调 `chart.resize()`（`charts/ECharts.vue:32-34,54`）。**没有 ResizeObserver**：窗口不动、只有容器变（侧栏折叠、分栏拖动）时不会重算尺寸。
- **销毁时机**：`onBeforeUnmount` 摘掉 resize 监听并 `dispose()`（`charts/ECharts.vue:57-60`）。
- **主题不联动**：`echarts.init(el.value)` 不传主题参数（`charts/ECharts.vue:28`），封装也**没有 `theme` 入参**——注册过的 ECharts 主题、偏好里的深色模式都不会自动作用到图上。

::: warning

明暗适配是示例页自己做的「图表」示例页的做法是：读 `appStore.resolvedTheme` 得到 `isDark`（`chart/index.vue:22`；store 侧 `packages/stores/src/app.ts:44`），把所有颜色写成 `computed` 里的 option 字段（文字/轴线/tooltip 背景都按明暗两套取值，`chart/index.vue:24-51`），主题切换时 `computed` 重算、触发组件的 notMerge 重绘（页面注释原话在 `chart/index.vue:20-21`）。换你自己的页面时，这是封装可用能力的全部：其余的「深色主题」都得这样进 option。:::

### 一个存在但没被接线的全功能 composable

仓库里另有一套 `packages/core/hooks/src/echarts/use-echarts.ts`（子路径 `@antdv/hooks/echarts`）：支持 `isDark`（切换时销毁重建图表，`:296-310`）、`resizeStrategy`（none/raf/debounce/throttle，`:129-151`）、ResizeObserver 观察容器（`:313-342`）、`setData` 深合并补丁（`:254-262`）、init 失败重试（`:201-215`）。注释还记录它修掉过「`setData` 曾经是静默空函数」的历史（`:245-252`）。但它在 `apps/web` 里**没有任何消费者**（只有 `packages/core/hooks/__tests__/echarts.test.ts`），`/components/chart` 用的是上面那个三 prop 的薄封装。别把两套能力混着写。

### 示例页内容

五张卡片，数据全是页内常量、零请求（页面 alert 原话，`chart/index.vue:447-456`）：折线（「刷新数据」在三组内置数据间轮换，`:79-102`）、柱状（分组/堆叠开关只改 `series.stack`，`:170-223`）、环形饼图（图例点选、label 模板）、双 Y 轴组合图（柱+线，`:294-369`）、loading 与空数据（空数组 option 渲染坐标系骨架，`:375-443`）。

## Cron：`/components/cron`

### 它解决什么问题

`CronEditor`（`packages/core/ui-kit/common-ui/src/components/cron-editor/CronEditor.vue`，从 `@antdv/common-ui` 具名导出）给「配置定时任务表达式」一个预设点选 + 六字段下拉拼接的可视界面，配 `cronstrue` 中文描述实时回显，产出/接收一个表达式字符串。

### 真实 API

Props 与事件（`CronEditor.vue:27-33`）：

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `modelValue` | `string` | 表达式，支持 `v-model`；组件挂载时若处于「自定义」模式会解析回填字段（`:151-159`） |
| `disabled` | `boolean` | 禁用全部按钮与下拉 |
| `change` 事件 | `(value: string) => void` | 预设点选（`:224-227`）、字段变更（`:230-240`）、模式切换补默认值（`:208-221`）时抛出 |

没有校验函数、没有 `valid` 事件、不暴露实例方法——表达式合法性只体现在描述区。

### 表达式格式：6 段「秒 分 时 日 月 周」

- 生成侧固定输出 **6 段**：按 `fields` 顺序 join（`CronEditor.vue:54-103,162-164`），即秒、分、时、日、月、周；12 个内置预设也全是 6 段（`:38-51`）。可以理解为「Quartz 风格但只有前 6 段」。
- **不是严格 Quartz**：组件没有年段，日/周两段互不排斥、不输出 Quartz 的 `?` 占位，周字段取值范围是 **0~6**（`:95-102`）。Quartz 后端（典型如调度器要求 day-of-month 与 day-of-week 恰有一个为 `?`、周从 1 开始）接到这份表达式需要自己转换——封装并没有做这层保证，别按「原生 Quartz 编辑器」写它。
- 解析侧（外部传入的 `modelValue`）：`parseCron` 接受 **5 段或 6 段**，5 段按「分时日月周」补一个 `0` 秒（`CronEditor.vue:116-148`）；**其余段数一律重置为默认值** `0 0 0 * * *`，不报错——坏输入会被静默吞掉。
- 字段选项由下拉枚举：每个字段 `*` / 单值 / 秒分（`*/5 */10 */15 */30`）/ 时（`*/2 */4 */6 */12`），见 `getFieldOptions`（`:167-196`）。日/月/周没有步进选项。下拉由 reka 组合件 `Select` 渲染，值一律按字符串桥接（`String()` 归一，`:237-240`）。

### 校验规则：只有一层 try/catch

组件对表达式的「校验」就是把生成结果丢给 `cronstrue.toString(expr, { locale: 'zh_CN' })`，抛异常时把描述区改成「表达式无效」（`CronEditor.vue:199-205`）——**不阻止输出**，`change` 照抛。示例页在此之上自建了 `check()` 把错误收进 `{ text, error }`（`views/components/cron/index.vue:49-61`），非法时标红/弹 warning（如 `:63-71,84-98`）。

::: warning

组件不支持手动输入展示表达式的那个 `Input` 是 `readonly` 的（`CronEditor.vue:330-336`）；antd 时代脚本里那段无模板绑定点的死代码 `handleInputChange` 已在迁入 `@antdv/common-ui` 时删除。想手输表达式得像示例页第 3 张卡片那样自己放输入框。:::

### 曾经的 type-check 报错文件：迁移时已消解

`CronEditor` 应用内旧版是仓库已确认的 type-check 报错文件之一（type-check 目前非阻断）：`noUncheckedIndexedAccess` 下 `presets[0].value` 与 `parseCron` 里 `parts[0]` 类下标赋值被推成可能 `undefined`。common-ui 与应用的 tsconfig 都开着同一个严格开关，迁入包时已用 `?? ''` 与解构守卫消解这些报错；长度判断（`parts.length === 5 / 6`）原样保留，别在重构时顺手删掉。示例页 `previewFields`（`views/components/cron/index.vue:129`）仍有一处同源的既有 TS2769 报错，未在本次迁移中处理。

### 示例页怎么用它：页面内联，不是弹窗

`/components/cron` 的四张卡片各自内联一个 `CronEditor`（从 `@antdv/common-ui` 具名 import，`cron/index.vue:4`，使用点 `:168,206,268,287`），演示的是四种用法：v-model + 实时描述；预设按钮写值并校验；「草稿 → 应用/重置」的受控/非受控回退（`:102-122`）；表达式按 5/6 段拆字段展示 + 文字描述。第 4 张卡片顶上的 alert 诚实地写明：项目里**只有 cronstrue（只能生成文字描述），没有 cron-parser 这类能算「下次运行时间」的调度库，也没有后端**，所以这一页不伪造运行时间表（原注释 `cron/index.vue:125-126`，alert 文案 `:275-281`）。

## 在线示例

- **`http://localhost:6080/#/components/chart`** — 侧栏「组件示例 → 图表」。点「刷新数据」看整篇 option 替换式重绘；打开/关闭柱状图的堆叠开关；点饼图右侧图例隐去某个扇区；在「加载与空数据」卡片按「显示 Loading」看封装自带的遮罩。切全局深浅色主题（见[主题定制](/guide/in-depth/theme)）验证颜色确实跟着 option 重算——那是页面 computed 的功劳，不是封装的。
- **`http://localhost:6080/#/components/cron`** — 侧栏「Cron 表达式」。在「常用预设 / 自定义」两态间切换，改六个下拉观察 `update:modelValue` 产物恒为 6 段；第 3 张卡片手动输入 `* * *` 看校验标红、再点「应用」看非法值被拒。

## 相关页面

- [组件示例总览](/components/)
- [表格](/components/table)
- [表单](/components/form)
- [主题定制](/guide/in-depth/theme) —— 图表明暗取色所依赖的 `resolvedTheme`
- [设计令牌与全局样式](/guide/essentials/design) —— 示例页 `cn()` 类名约定的出处
