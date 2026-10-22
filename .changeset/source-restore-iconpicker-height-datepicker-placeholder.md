---
'@antdv/design': patch
'@antdv/form-ui': patch
'@antdv/icons': patch
---

fix: 补回被重排时删掉的 `@source` 名单，IconPicker 面板接住可用高度，FDatePicker 的区间占位允许数组

三条都是"构建绿、页面也渲染，只是某样东西静默不见了 / 不定位"的同一类失效，共用这一批三引擎验证，所以并成一个 changeset。

- **`@source` 整块没了（`packages/core/base/design/src/index.css:46-55`）**：071dad02 重排这个文件时把十行 `@source` 一起删掉了。构建根的自动内容检测只扫得到 `apps/web`，`@antdv/*` 全在软链后面，所以少登记不等于报错 —— 消费方读的还是上一轮 `dist` 里的 CSS，构建、类型检查、页面渲染全部照常，只有那个包模板里的工具类一条不生成（浮层不定位、圆角间距消失）。这次按 `git show f64fc3ac` 原样补回十行，并在名单上方写清"必须与 `packages/core/ui-kit/*` 目录一一对上"。守门测试本来就在（`design/__tests__/design.test.ts` 的「每个子包的源码目录都登记了 @source，且登记路径解析得到真实目录」、`hooks/__tests__/boundary.test.ts` 的「@source 名单只属于 design」），漏网的原因是那一轮没有按仓库口径单文件复跑守卫测试。
- **IconPicker 面板高度（`packages/core/base/icons/src/icon/IconPicker.vue:281-289`）**：面板原本是"净高 360 + 工具栏 + 分页"的固定高度，`PopoverContent` 没有接 reka 挂在 `--reka-popover-content-available-height` 上的可用高度，从别的页面跳进来时（触发器到视口底只剩 400 出头）底边顶出视口，多出来那截看不见也点不到，常规视口下的用例碰不到它。改成 `max-h-(--reka-popover-content-available-height)` 并把面板排成 `flex-col`：工具栏与分页 `shrink-0`、网格 `min-h-0 shrink`。
- **FDatePicker 的 `placeholder`（`packages/core/ui-kit/form-ui/src/fields/FDatePicker.vue`）**：prop 声明的是 `string`，而全站四处区间用法（表单示例页、操作日志、登录日志）实际都传 `['开始时间', '结束时间']`。运行时只有一条 `Invalid prop: type check failed` 告警，文字照旧显示，所以构建与类型检查都不拦。放开成 `placeholder?: string | string[]`，数组按两端用 `-` 合成，空串与空数组才回落到内置文案（区间是 `开始日期 - 结束日期`）。合成串与两侧默认串互不相同，判据本身就是反证：传入被忽略会掉回默认串，拼接写错也不会等于任何一侧。

验证：

- 守卫测试：`design.test.ts` 32 条、`boundary.test.ts` 8 条全绿（含上面两条 `@source` 判据）；`npx turbo run test:unit --filter=@antdv/{icons,form-ui,design,hooks} --concurrency=1` 20/20 任务绿，其中 `hooks` 10 文件 / 106 条、`form-ui/__tests__/fields.test.ts` 31 条（新增 `fDatePicker` 5 条：数组合成、空数组回落、空串回落、单值字符串原样、传数组不再打 prop 告警）、`icons/__tests__/icons.test.ts` 6 条。
- 端到端三引擎各 10/10：`icon-picker` 6 条（新增「矮视口下面板完整落在视口内」：560 高视口下量面板盒子，上下都必须在视口内且高度 > 120、网格仍是整页 108 格）、`popup-anchor` 2 条、`f-date-picker` 2 条（新增 spec，钉住数组占位的合成文案与"控制台没有 `Invalid prop` 告警"）。chromium 是四次定向跑合起来的 10/10，firefox 与 webkit 各一次整跑。
- 新用例都过了反证。矮视口那条：临时把面板的 `max-height` 剥成 `none`，实测 `y=136 h=479 bottom=615` —— 判据在没修复的版本上会真的报溢出，不是一条永远绿的空检查（探针 spec 跑完即删）。`popup-anchor` 的浮层判据自带反向对照（剥掉 `z-50` / `bg-popover` / `shadow-md` 必须三条都报）。
- e2e 侧顺手修掉一条假红：菜单是模态层，打开后 reka 会给层外的一切（含触发器本体）挂 `aria-hidden`，可访问名字随之消失，`getByRole('button', { name: '标签页操作' })` 在"点得到"之后到了"量不到"。测量改锚在组件自己的钩子类 `button.tab-actions-trigger` 上，名字对不对仍由 `tabs.spec.ts` 那条负责；同文件 `CHECK` 的参数类型改成 `page.evaluate` 真正传进去的 `(HTMLElement | SVGElement)[]`。`pnpm exec tsc -p e2e/tsconfig.json --noEmit` 本轮三个 spec 零错（`layout.spec.ts:628` 的 `row.dataset` 是存量类型错，不在本轮改动面上，未动）。
