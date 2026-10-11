---
"@antdv/styles": patch
"@antdv/web": patch
---

fix: 能点的盒子都有可点光标，禁用的不再装成能点

现象：不少地方"盒子已经亮了、鼠标还是箭头" —— 设置面板的主题色块与布局磁贴、
通知面板的按钮、Markdown 工具栏、分片上传的操作键、评分星、上传拖拽区；
反过来也有"已经灰掉了、光标却还是能点的样子"。用户归纳成一句话：
**能 hover 的盒子都需要带上 cursor**。

- **根因是 UA 默认值，不是谁写错了样式**：浏览器给 `<button>` 的是 `default` 光标
  （只有 `<a href>` 才自动 pointer），而本项目可点的"盒子"绝大多数是手写的
   `<button type="button">`。以前靠逐个模板补 `cursor-pointer` —— 79 处里对的需要 35 处，
  漏的那些就是用户看到的。模板写法管不住新页面，所以规则搬到样式层一次接上。
- **写在 `packages/styles/src/base.css`，且不新增文件**：`@antdv/styles` 的入口是**原始 CSS**
  （无编译步骤，`main.ts` 直接 `import '@antdv/styles'`），Tailwind v4 在应用构建时处理；
  再加一个 `cursor.css` 就得动 `index.css` 的 `@import` 清单，而那份清单有契约用例钉着 —— 
  不值得为四条规则引发一次包边界变更。
- **规则按"可点性的来源"分三档**，而不是罗列 class 名：
  1. `button:not(:disabled)` / `button:disabled` → pointer / not-allowed；
     `input[type=checkbox|radio]`、`select` 同理（antd 的 hover 反馈做在外层盒子上，光标却归元素自己）。
  2. 带 ARIA `role` 的自定义控件（评分星的 `role="radio"` 等）→ pointer，
     `[aria-disabled=true]` → not-allowed。role 属性本身就是在宣布"这里能点"，
     antd 只把光标写在外层 `<li>` 上，鼠标真正停的那层是 `default`。
  3. antd 自己漏的上传触发区 `.ant-upload`（里面包的是 `<span>` 不是 button），
     `ant-upload-disabled` 给 not-allowed。
- **antd 已有的规则不会被盖掉**：它的选择器是 class（特异度 0,1,0），这里写的是元素/属性选择器，
  所以只补空位。实测 loading 按钮（`ant-btn-loading`）仍是 `default` —— 点了没意义，
  这是 antd 故意的，扫描也把它当已知项跳过。
- **`Select` 不用管**：这个版本的 antdv-next 把可点的 combobox 渲染成 `<input>`，
  只读时 antd 已给 pointer、可搜索时是 text（该是文本光标），实测三种状态都对。

留了两处"看着能点、其实点了没反应"的例外并写进清单，因为它们**该**是箭头：
card-list 的 KPI 卡与瀑布流卡只有装饰性 hover 抬升，设置面板的开关行 hover 描边框
是"帮你找到行尾那个开关"，可点的是开关本身。给它们 pointer 是在撒谎。

测试口径（新增 `apps/web/e2e/cursor.spec.ts`，三引擎各跑一遍）：

- 断言的是**浏览器算出来的光标**（`getComputedStyle().cursor`），不是模板里有没有写那个类 ——
  类名断言只能证明"有人写了字"，证明不了它生效、也证明不了没被 antd 盖掉。
- 一张"该是指针的可点件"清单，每条先 `toBeVisible()` 再断言 pointer：
  选择器写错或那个控件从页面上消失了要红，不能静默跳过。
- 禁用态单独一条，并**同页反证**可用按钮是 pointer，
  否则"整页都写了 not-allowed"也能让这条假绿。
- 兜底扫描遍历可见元素：`<button>`/`<a>`/带交互 role/带 `hover:bg-*|hover:outline-*|hover:shadow`
  的盒子，光标不能是 `auto|default|text`，命中就把 `outerHTML` 打出来。
  例外必须写进 `DECORATIVE_HOVER_ALLOWLIST`（按 class 前 4 项匹配）或带 `data-setting-label`，
  以后新增"装饰性 hover 盒子"要么登记、要么补上 click，不能靠扫描看不见它糊过去。
- 红绿都验过：把 `button:not(:disabled)` 那条规则临时改名停用后，四条里立刻红三条，
  装回即绿。webkit 整跑时导航等待从默认 20s 提到 40s（dev 按需编译重型路由 + 前序引擎挤掉
  编译缓存的纯计时问题，单跑即绿），只改这一处、不动全局 expect 超时。
