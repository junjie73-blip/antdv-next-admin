---
'@antdv/form-ui': minor
---

feat: `BasicForm` 的动作区改成栅格单元，贴着末行剩余空间排布；顺带修掉两个配置优先级缺陷

现象（需求原话）：`showActionGroup` 打开时，只要 schema 的列宽没占满 24 栅格，按钮组就会被顶到**新的一行**去，行尾留一大片空白。折叠/展开也各自有一套定位规则，切换时能看到跳。

- **行分组顺带记账，布局规则只有一条**：`allRows` 在按 `colProps.span` 切行时记录每行**已占用**的栅格数（`FormRow.span`，`form.vue:236-240`），`actionsSpan = 24 - 末行已占`（`form.vue:331-339`）。末行正好铺满 24、或末行是 `Divider` 时给满 24，靠 `margin-left: auto` 右对齐独占一行 —— 这仍然是「栅格单元」，不是特判出来的第二套定位。24 栅格的计算逻辑、`grid.cols` 与断点回落（`form.vue:163-170`）一个字没动，所以兼容原来的列宽配置。
- **动作区本体换成一个格子**：`FormActions` 根节点吃 `span` / `gutter-px` / `action-col-style`，`width = span/24` 的百分比、左右内边距各吃 gutter 的一半，与 `FormField` 同一套口径（`form-actions.vue:48-57`）。`min-width: max-content` 加行容器的 `flex-wrap` 是兜底：剩余栅格放不下按钮时整块落到下一行，而不是把按钮压扁。`actionColOptions.style` 摊在最后，调用方可以覆盖 `width` / `margin-left`。
- **折叠与展开共用同一个宿主行**：两者都读 `rowsWithActions` 的末行（`form.vue:300-305,331-339`），切换只改变可见行数（`displayRows`，`form.vue:288-294`），末行的剩余栅格随之变化，不存在「折叠一套、展开一套」的两条规则 —— 这是切换不抖的原因，也是实测里回到的折叠态与初始折叠态逐字节相同的原因。
- **顺带修掉的两个真缺陷**（都是这次做折叠态验证时才暴露的）：
  1. `useForm(options)` / `setProps` 传进去的 Boolean 开关**全部静默失效**。Vue 把父级没传的 Boolean prop cast 成 `false`，`withDefaults` 的默认值又落在同一个对象里，而 `deepMerge` 的标量规则是「目标优先」，于是这些合成值盖掉了运行时配置 —— `showAdvancedButton: true` 永远打不开。现在先用 `vnode.props` 挑出父级**真的绑过**的键，其余键让给 `setProps`，优先级确定为「模板显式绑定 > `setProps` > 组件默认值」（`form.vue:139-160`）。
  2. `setProps` 合并方向反了，后一次补丁改不掉前一次（`disabled: true` 关不回 `false`）。改成把新补丁放在 target（`form.vue:572-582`）。
- **原有配置项功能面不变**：`showActionButtonGroup` / `showSubmitButton` / `showResetButton` 三档开关、`submitButtonOptions` / `resetButtonOptions` 的 `text` / `preIcon` / `disabled`、三个动作区插槽（`#submitBefore` / `#resetBefore` / `#actionAfter`）与「提交 → 重置 → 展开/收起」的按钮次序都保持原样；`schema` 依然不参与 props 合并，数组不会被拼接。

验证：`form-ui` 单测 90/90，其中新增 12 条 —— `__tests__/form-actions-layout.test.ts` 9 条覆盖不同 `colProps.span` 组合下动作区的行归属与 `width`（含末行满 24、末行 `Divider`、剩余空间不足、只有按钮组没有字段、`grid.cols` 变化），`__tests__/form-props-merge.test.ts` 3 条覆盖上面那条优先级链与 `setProps` 可回退。浏览器端到端新增 `apps/web/e2e/form-actions-layout.spec.ts`（4 条用例，chromium / firefox / webkit 三引擎各跑一遍），在 `#/components/form/basic`（14 字段、`alwaysShowLines: 2`）读真实包围盒：折叠态动作区 `width` 恰等于宿主行宽、独占第 2 行（共 2 行）并左贴行首、按钮文案「展开」；展开态 `width` 恰为行宽一半、与最后一个字段同一条基线且 `left` 等于该字段 `right`、文案「收起」；再点回折叠，与初始折叠态逐项相同。断点扫描 1440 / 1100 / 900 / 640 四个宽度，动作区要么行内（必有同行字段）要么满行（贴齐行首），且按钮宽度始终 ≥ 60px，没有被 `min-width: max-content` 之外的力量压扁。几何断言一律换算成**相对 `<form>` 左上角**的坐标：外壳内容区自带滚动，实测同一折叠态两次读取整个 `<form>` 的 `top` 相差 12px 而 `window.scrollY` 全程为 0，用视口坐标逐像素比会把容器位移读成布局抖动。`npx turbo run type-check --filter=@antdv/form-ui` 只剩仓库既有的两条 `vue-sonner/style.css` TS2882（`common-ui/Toaster.vue` 与 `popup-ui/message/index.ts` 的副作用导入，任何源码消费方都会命中，与本次改动无关，table-ui 同样报这两条）；`npx tsc --noEmit -p apps/web/e2e/tsconfig.json` 对新增用例干净，另有 3 处存量报错与本次无关：`e2e/app-loading-theme.spec.ts:85` TS2352、`e2e/ops-sweep.spec.ts:341,344` 用了 `locator.filter()` 并不存在的 `hasClass` 选项（那两条断言实际没有按层级过滤，是弱断言）、`e2e/screen-fit.spec.ts:64` TS2339。文档 zh 正文与 en 镜像同步：新增 `actionColOptions` 一行、改写动作区三条说明，并把全部代码行号引用（含 `:NN` 这种省略文件名的裸引用）对回当前源码。
