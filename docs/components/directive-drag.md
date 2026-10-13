# 指令与拖拽布局

这一页覆盖两个示例路由：`/components/directive`（全局注册的**五条自定义指令**——`v-permission`、`v-loading`、`v-lazy`、`v-safe-html`、`v-escape`）和 `/components/drag-layout`（基于 `vue-draggable-plus` 的**拖拽布局**，列表 / 手柄 / 跨容器 / 栅格 / 约束五种形态）。两者放一页是因为都属于「不是组件库、但页面级反复要用」的基建；表格行内拖拽不在这页，见[表格](/components/table)。

## 五条全局指令：注册只有两处

全仓库的 `app.directive(...)` 调用点只有 `apps/web/src/main.ts:103-113` 这五条：

| 指令 | 实现所在 | 应用侧注入 | 生产使用点（示例页以外） |
| --- | --- | --- | --- |
| `v-permission` | `packages/directives/src/permission/index.ts:57` | `apps/web/src/directives/index.ts:19-36` | `apps/web/src/components/business/ImportExport.vue:206, 223` |
| `v-loading` | `packages/ui-kit/loading-ui/src/directive.ts:88-107` | 直接注册 `@antdv/loading-ui` 的 `vLoading`（`main.ts:8, 113`） | `apps/web/src/views/components/loading/index.vue:1026` 起 |
| `v-lazy` | `packages/directives/src/lazy.ts:145, 311` | `apps/web/src/directives/index.ts:16` 转出 | **除示例页外没有使用点**（见下文） |
| `v-safe-html` | `packages/shared/src/xss.ts:437-445` | `apps/web/src/directives/index.ts:17` 转出 | `MarkdownEditor.vue:599`、编辑器示例页 `editor/index.vue:834` |
| `v-escape` | `packages/shared/src/xss.ts:454-462` | `apps/web/src/directives/index.ts:17` 转出 | **除示例页外没有使用点**（见下文） |

::: warning 别按包名找实现 `@antdv/directives` 包里**只有 permission 和 lazy** 两条（`packages/directives/src/index.ts:10-11` 就这两个 export）。`escape` / `safe-html` 的实现住在 `@antdv/shared/xss`，`v-loading` 住在 `@antdv/loading-ui`。`apps/web/src/directives/index.ts` 的定位是「把项目依赖注进工厂」：包内不 import pinia / store（`packages/directives/src/index.ts:4-7` 的设计约束），判定函数、订阅源都由应用侧提供。:::

## v-permission：判定在包外，打标记在包内

### 应用注入的三件套

`apps/web/src/directives/index.ts:19-36` 用 `createPermissionDirective()` 造出全局那条，注入三个东西（配置项契约在 `packages/directives/src/permission/types.ts:67-84`）：

- `checkers: () => usePermission()`（`index.ts:24`）——**惰性工厂**：模块在 `main.ts` 被 import 时 pinia 还没挂到 app 上，直接调用会 `no active pinia`（`index.ts:20-23` 注释）。判定函数集是 `PermissionCheckers` 七个同步函数（`types.ts:9-24`），本项目实现在 `apps/web/src/composables/web/permission/usePermission.ts:105-117`，数据源是 `useUserStore()` 的 `permissions` / `roles`；`isAdmin()` 认 `SUPER` / `ADMIN` 两个角色（`usePermission.ts:66-73`）。
- `onCheck`（`index.ts:25-29`）——开发期 `console.log('[v-permission]', …)`，每次判定都会触发。
- `subscribe`（`index.ts:34-35`）——`watch(() => useUserStore().permissions, notify, { deep: true })`。权限是登录后异步回填的，没有这条订阅，指令 mounted 时权限表还是空的，按钮会**永远停在「无权限」**（`packages/directives/src/permission/index.ts:106-112`）。返回的 stop 函数在 `unmounted` 时调用，不留悬垂 watch（`index.ts:125-129`）。

### 怎么写才生效（判定优先级）

`resolveAccess()`（`packages/directives/src/permission/utils.ts:82-109`）按这个顺序解释 binding：

| 写法 | 效果 | 源码依据 |
| --- | --- | --- |
| `v-permission="'user:add'"` | 单权限码，`any` | `utils.ts:39-43, 65-67` |
| `v-permission="['a','b']"` | **默认 any**，命中其一即放行 | `utils.ts:100-101`（mode 默认 `'any'`） |
| `v-permission.all="['a','b']"` | every，全部命中 | `utils.ts:100-101`（`.all` 修饰符） |
| `v-permission:role="'editor'"` | 字符串/数组按**角色**解释 | `utils.ts:41-43`（`arg === 'role'`） |
| `v-permission:admin` | 直接走 `isAdmin()`，值不再参与 | `utils.ts:88` |
| `v-permission="{ permission, role, mode }"` | 对象写法，权限与角色**两组都要满足** | `utils.ts:46-50, 105-108`；类型 `types.ts:39-44` |
| `v-permission.disabled="'user:add'"` | 无权限时**置灰**而不是隐藏 | `permission/index.ts:96`（`disabledMode`）+ `utils.ts:182-195` |

::: warning 三个照实写的坑

1. **`:role` 是参数（arg），`.role` 是修饰符**——判定只认 arg（`utils.ts:41`），写成 `.role` 会静默地按权限码解释。示例页把这条印在界面上（`apps/web/src/views/components/directive/index.vue:284-289`）。
2. **空值 = 放行**：`undefined` / `null` / `''` / `[]` 一律通过（`utils.ts:90-97`）。`v-permission="[]"` 等于没写。
3. **mode 优先级**：对象里的 `mode` > `.all` 修饰符 > 默认 `any`（`utils.ts:100-101`）；对象写了 `mode: 'all'` 时 `.all` 就不再说话。:::

### 无权限时 DOM 上发生什么

`applyPermissionState()`（`utils.ts:176-209`）：默认隐藏走 `display: none` + `disabled` 属性 + `aria-disabled` + 叠加 class `permission-disabled`；`.disabled` 模式保留可见只禁用。**从不删节点**——删节点会让 Vue 的 patch 找不到锚点、兄弟 diff 错乱（`utils.ts:172-174` 注释）。降级样式在 `packages/styles/src/permission.css:12-17`（`cursor-not-allowed opacity-50 saturate-50 select-none` + `pointer-events: none`，非表单元素不认 `disabled` 属性所以统一挡交互），逃生舱 class `permission-disabled--passthrough`（`permission.css:21-23`）允许「看着降级但还能点」。样式由 `packages/styles/src/index.css:26` 统一引入。

::: tip 路由层不读 roles `RouteMeta` 类型声明了 `roles?: string[]` / `permissions?: string[]`（`packages/types/src/app-router.ts:9-10`），但 `apps/web/src/router/**` 与 `packages/router/src/**` 里**没有任何读取点**——路由准入实际靠菜单数据（「菜单即权限」，`apps/web/src/stores/modules/route.ts:181, 210` 只处理 `meta.requiresAuth`）。`v-permission` 管的只是元素这一层，三层的完整讲法见[权限与菜单访问](/guide/in-depth/access)。:::

## v-loading：布尔值驱动，配置从属性读

指令值是 `boolean`（`packages/ui-kit/loading-ui/src/directive.ts:88` 的类型标注）。要点：

- **配置读自元素属性**：`loading-background` / `loading-size` / `loading-theme` / `loading-tip` 四个（`directive.ts:34-39` 的映射表）。也可以把文案写成指令参数 `v-loading:加载中="isLoading"`，`binding.arg` 优先（`directive.ts:81, 96-98`）。
- **挂载位置由修饰符决定**：`.fullscreen` 或 `.body` 时覆盖层挂 body 盖整页（`directive.ts:59-61`），默认覆盖元素自身。
- **遮罩实例懒创建、挂 WeakMap**（`directive.ts:45, 69-86`）：`mounted` 时值为 `false` 也会建实例但不显示，`updated` 只管显隐（`directive.ts:93-99`），`unmounted` 销毁（`directive.ts:101-104`）。

::: warning 属性只在创建那一次被读 `getPropsFromAttributes()` 只在**遮罩实例首次创建**时执行（`directive.ts:70-76`，已有实例直接返回）。挂载之后再改 `loading-tip` / `loading-theme` 属性值**不会生效**，想动态改文案要用指令参数 `binding.arg`（`directive.ts:96-98` 是 `updated` 里唯一会热更的配置项）。:::

## v-lazy：默认实例 + 四层取值

`app.directive('lazy', vLazy)` 注册的是 `createLazyDirective()` 无参调用的默认实例（`packages/directives/src/lazy.ts:311`）。指令值是对象或字符串（字符串即 `src`，`lazy.ts:24`），只该用在 `<img>` 上。

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `src` | 必填 | 空则回退 `data-src` 属性（`lazy.ts:164`） |
| `placeholder` | 无 | 进视口前的占位图（`lazy.ts:260`），可用 `data-placeholder` |
| `error` | 无 | 预加载失败的回退图（`lazy.ts:235`），可用 `data-error` |
| `fade` / `duration` | `true` / 300ms | 双 rAF 渐显，避免硬跳（`lazy.ts:112-122, 190-201`） |
| `rootMargin` / `threshold` | `'100px'` / 0.1 | IntersectionObserver 提前量（`lazy.ts:61-62, 273`） |

取值优先级：**`binding.value` > `data-*` 属性 > 工厂级 `defaults` > 内置兜底**（`lazy.ts:152-188`）。已加载的 URL 存模块级 `Set` 全局缓存（`lazy.ts:66, 211-214`）——同一张图跨组件只请求一次，重放示例时第二次会直接命中。环境没有 IntersectionObserver 时降级为**立即加载**而不是留空图（`lazy.ts:276-280`）。加载中途换 `src` 或组件卸载由递增 token 作废在途结果（`lazy.ts:132-136, 226`）。

## v-safe-html 与 v-escape：一条清洗、一条转纯文本

### v-safe-html

`updateSafeHtml()`（`packages/shared/src/xss.ts:476-533`）的管线：**先正则剥离最危险内容，再交 DOMPurify 按白名单清理**。指令值是字符串，或 `{ content, allowedTags, … }` 对象（选项即 `XssFilterOptions`，`xss.ts:21-38`；外部传的对象字段覆盖默认值，`xss.ts:514-519`）。

- 第一道 `stripDangerousMarkup()`（`xss.ts:127-153`）：成对删 `<script>/<iframe>/<object>/<embed>/<applet>`，再兜底清扫残标签；摘掉所有 `on*=` 属性处理器与 `srcdoc`。注释写明了动机：DOMPurify 在 SSR / 测试环境可能解析不一致，这道剥离保证**任何环境都有下限**（`xss.ts:119-126`）。
- 第二道 DOMPurify（`xss.ts:523-530`）：白名单 `defaultSafeTags`（`xss.ts:482-511`，段落/标题/列表/表格/`a`/`img` 等富文本常用标签），`ALLOW_DATA_ATTR: false`。DOMPurify 不可用时退回 `escapeHtml()` 全转义（`xss.ts:530`）。
- 结果直接写 `el.innerHTML`（`xss.ts:532`）——**容器内原有的子节点会被清掉**，指令只该用在空元素上。

### v-escape

`escapeDirective` 只做一件事：把值写进 `el.textContent`（`xss.ts:470-474`），内容永远不会被解析成 HTML。指令参数切语境（`EscapeType`，`xss.ts:41`）：

- 默认 / `:html`：**原样显示**，不再做实体编码——`textContent` 本来就不解析标签，再转一道只会让用户看见 `&lt;` 噪音（`xss.ts:464-469` 注释）。
- `:url`：伪协议（`javascript:` / `vbscript:` / `data:text/html`）整个换成 `#unsafe-url` 并 `console.warn`（`xss.ts:198-214`），其余 `encodeURI`。
- `:js` / `:css` / `:attr`：语义变换后仍作为文字显示（`smartEscape`，`xss.ts:286-310`）。

## 在线示例：/components/directive

打开 `http://localhost:6080/#/components/directive`（登录与起服务方式见[组件示例](/components/index)）。四张卡片对应四条能力的点法，页头注释（`apps/web/src/views/components/directive/index.vue:16-23`）就写着这页的立意：每条都给「真能点、真会变」的例子。

**v-permission 卡**（`index.vue:214` 起）。示例**不动全局那条**，而是本地造 `v-demo-permission`：`<script setup>` 里名为 `vDemoPermission` 的变量自动成为局部指令（`index.vue:94-98`）。为什么本地？真实权限表是 `useUserStore().permissions` 的持久化 computed，示例去改它等于改当前登录账号的权限，还会被 keep-alive 带出页面（`index.vue:53-60` 注释）。左边勾权限码/角色（两个本地 ref，`index.vue:61-62`），右边七种写法的按钮当场翻正——这同时演示了 `subscribe`：`watch([grantedCodes, grantedRoles], notify)`（`index.vue:97`）。每行右侧灰字标注对应写法（any `index.vue:267-273`、`.all` 276-281、`:role` 是 arg 的坑 284-289、`:admin` 292-296、`.disabled` 299-304、对象写法 307-313）。「判定轨迹」面板由 `onCheck` 喂数据（`recordCheck`，`index.vue:82-92`），只记与上一条不同的结果、最多留 8 条。

**v-loading 卡**（`index.vue:322` 起）。点「加载这块 / 加载那块」各起 2 秒遮罩，第二块带 `loading-size="large"` / `loading-theme="dark"` / `loading-tip` 三个属性（`index.vue:349-351`）；「整页遮罩」按钮自己挂 `v-loading.fullscreen`（`index.vue:365`）。源码注释里还埋了一个 `<script setup>` 的坑：模板表达式拿到的是解包后的值，把 ref 直接传进函数会收到 `false` 而不是 Ref，于是 `.value = true` 抛错、遮罩永远不出现——示例因此改用「键名 + 一个 reactive 记录」（`index.vue:107-123`）。

**v-lazy 卡**（`index.vue:375` 起）。滚动图片框，进视口才发请求、数字逐步上涨；最后一张是坏地址，回退到 logo。失败回退故意用 data: URI 而不是会 404 的外链，免得全站巡检把它记成接口错误（`index.vue:132-137`）。「重放」按钮换 key 重挂图片墙（`index.vue:155, 168-171`），第二次因为命中全局缓存会一次到位。加载计数只认「元素 src 真的换成了目标图」，占位图的 `load` 事件不算数（`index.vue:158-166`）。

**v-safe-html / v-escape 卡**（`index.vue:413` 起）。左侧展示原始脏数据全文（`index.vue:193-199`：script 标签、`<svg onload>`、`javascript:` 链接、`onclick` 段落俱全），右上是 `v-safe-html` 渲染结果——富文本保留、危险内容剥离；右下再挂一份白名单收窄到 `b/i/p` 的实例（`strictSafeHtml`，`index.vue:206-209, 441-444`），同一份数据列表和链接一个不剩。`v-escape` 把脚本载荷当纯文本显示（`index.vue:452-456`）；`v-escape:url` 演示伪协议换 `#unsafe-url`（`index.vue:462-467`，点旁边按钮换回安全链接）。注意源码里的字符串拼接（`['<scr','ipt>…'].join('')`，`index.vue:176-186`）是 SFC 解析器的语法约束——模板里出现字面闭合标签会截断文件，不是示例内容。`data-safe-box` / `data-escape-box` 是给 e2e 的观测点（`index.vue:433, 450-451`）。

## 拖拽布局：VueDraggable（组件形态，不是指令）

`/components/drag-layout` 整页基于 `vue-draggable-plus` 的 **`VueDraggable` 组件**（`apps/web/src/views/components/drag-layout/index.vue:7`）。依赖与版本：`apps/web/package.json:107`（`"vue-draggable-plus": "catalog:"`，运行时依赖）→ `pnpm-workspace.yaml:216` 锁 `^0.6.1`，随架构整理提交（`ea1ffefc`）进的仓库；示例页目录本身还是工作区里的未跟踪新页（`menus.get.ts:335-340` 挂了菜单节点 `DemoDragLayout`，路径 `/components/drag-layout`，`menus.get.ts:339`）。

::: tip 用的是组件，库的另外两种形态没人用 `vue-draggable-plus` 同时导出 `v-draggable` 指令和 `useDraggable` 组合式（`dist/index.d.ts` 三个出口），但全仓库检索不到任何调用点——本页示例、表格的 `dragSort` 都不走这两条路（表格行拖拽是 `BasicTable` 内部直接绑 Sortable，见 `apps/web/src/components/business/Table/hooks/useDragSort.ts`，那部分归[表格](/components/table)页，这里不展开）。:::

### props 就是 sortablejs 的 Options

`VueDraggable` 的 props 是 sortablejs `Options` 全集，外加 `modelValue` / `tag` / `target` 三个（库的类型定义 `IProps extends UseDraggableOptions`；示例页头注释也写明，`drag-layout/index.vue:13-14`）。事件名是 sortablejs 回调去掉 `on` 的小写形式：`@start` / `@update` / `@add` / `@remove` / `@end` / `@filter`。五个示例块各自对应一类配置问题：

| 卡片 | 演示点 | 关键配置与源码 |
| --- | --- | --- |
| 基础列表拖拽 | `v-model` 直接接管数组 | `v-model="basicList"`（本地 ref，`index.vue:131-138`），`:animation="150"`、`ghost-class` / `chosen-class`（`index.vue:265-271`）；底部 tag 墙实时跟着 v-model 变（`index.vue:278-283`） |
| 手柄拖拽 | 触发区收敛到 ⠿ | `handle=".drag-grip"`（`index.vue:295`）；grip 类名在行的 span 上（`gripClassName`，`index.vue:68-77`；模板 `index.vue:302`）。行内文字保持可选中（`selectableClassName`，`index.vue:67`） |
| 两个列表互拖 | 跨容器 group | 两边共用模块级常量 `panelGroup = { name: 'drag-layout-panel', pull: true, put: true }`（`index.vue:162-166`），分别绑 `candidateList` / `chosenList` 两个 ref（`index.vue:181-182, 330, 351`） |
| 栅格卡片布局 | 列表换网格零改动 | `VueDraggable` 自己就是栅格容器（`:class="cardGridClassName"` 的 `grid grid-cols-1 … xl:grid-cols-4`，`index.vue:92, 382-387`） |
| 约束与开关 | disabled / filter / onEnd | `:disabled="dragDisabled"`（`index.vue:419`，开关 `index.vue:230`）、`:filter="lockedSelector"`（`index.vue:420`，选择器 `.drag-locked`，`index.vue:212`）、`:prevent-on-filter="false"`（`index.vue:421`）、`@end="handleEnd"`（`index.vue:426`） |

几条从源码里读出来的硬结论：

- **排序结果不需要同步**。Sortable 先派发 `update`——库在这一拍已经把 `v-model` 的数组按下标 splice 好——再派发 `end`；所以在 `end` 里手动 move 一次是重复劳动，两次重排叠加还会把顺序排乱（`index.vue:236-243` 注释）。`v-for` 的 `key` 必须是稳定 id，写 index 会和 Sortable 搬真实 DOM 节点打架，出现错位闪动（`index.vue:259-263`）。
- **`group` 别写成模板字面量**。`:group="{ name: 'x' }"` 每次渲染都是新对象，库深比较后会把 options 逐个 `sortable.option(...)` 回灌，拖拽中途重渲染还可能出现配置短暂不一致——所以提成模块级常量（`index.vue:156-161`）。
- **空容器必须给高度**。`emptyInsertThreshold` 默认只有 5px，塌成 0 高的空列表接不住落点；右侧「已选上墙」清空后照样能拖入，靠的是列表容器 `min-h-[112px]`（`index.vue:90-91`；文案 `index.vue:314-317`）。
- **网格形态的约束只有一条**：这层 `VueDraggable` 必须自己就是栅格容器（默认渲染 `div`，可用 `tag` 换），卡片外面再套 wrapper 就拖不动——Sortable 只认「容器的直接子元素」（`index.vue:372-378`）。
- **`preventOnFilter` 默认 true 会误伤按钮**：它对被 `filter` 命中的元素 `preventDefault()`，行里的「解锁」按钮会点了没反应；示例显式设 `:prevent-on-filter="false"`，条目照样拖不起、按钮恢复正常（`index.vue:421, 450-454`）。另外 `disabled` / `filter` 改值不需要重建实例，库深比较后逐项回灌（`index.vue:453-454`）。
- **ghost/chosen 样式要 `:deep()`**。`ghost-class` / `chosen-class` 传给 Sortable 的是类名字符串，落在被拖的真实节点上；跨容器搬运时节点会被挪进另一个组件的 DOM，`<style scoped>` 靠 `data-v-*` 属性命中会失效，所以用 `:deep(.drag-ghost)` / `:deep(.drag-chosen)` 退成普通选择器（`index.vue:460-476`）。

### 拖出来的顺序存在哪：本地 ref，没有后端

**没有任何网络请求**，也没有 localStorage。`@end` 落定时 `handleEnd()` 只是把当前 id 顺序拼成字符串写进一个本地 `ref`（`lastOrder`，`index.vue:232, 244-248`），页面上那行等宽字「onEnd 得到的顺序」就是将来该 POST 给排序接口的 payload（`index.vue:410, 442-449`）——示例把它印出来给你看，但没发出去。刷新即回初始顺序；「还原示例数据 / 还原卡片顺序」也只是重新拷贝初始数组字面量（`resetPanelLists` `index.vue:184-187`；`resetCardOrder` `index.vue:204-206`）。

## 在线示例：/components/drag-layout

打开 `http://localhost:6080/#/components/drag-layout`。逐卡点法：第一张直接拖任意行，看底部 tag 墙实时重排；第二张试「拖行中间拖不动、拖左侧 ⠿ 才动」，顺手划选行内文字验证可选中；第三张把「待选组件」的条目拖进「已选上墙」（清空右侧再往空区拖，验证 `min-h`），点「还原示例数据」复位；第四张在四列网格里拖统计卡；第五张先点「置顶公告」行的「解锁」按钮看 `filter` 行为，再拨「整列表禁用」开关看整列表冻结，拖完看 `onEnd` 那行 id 顺序与 `旧下标 → 新下标`。

## 查证后确认「不存在 / 静默失效」的

- **示例页那句「路由切换时的全屏 loading 由 `createFullscreenLoading()` 做同一件事」不成立**（`apps/web/src/views/components/directive/index.vue:368-371`）。`createFullscreenLoading()` 确实导出（`packages/ui-kit/loading-ui/src/createLoading.ts:66-74`），但全仓库检索**没有任何调用点**；路由切换的 loading 实际来自 `useRouteLoading()` + `RouteLoadingBar` + `PageLoading`（`apps/web/src/layouts/index.vue:14, 160-167, 177-183, 225-229`），和这个函数无关。
- **`v-lazy`、`v-escape` 注册了但全应用只有示例页自己在用**（注册：`main.ts:107, 111`；使用点检索除 `views/components/directive/index.vue` 外为零）。`lazy.ts:154-155` 注释里「头像列表逐张传对象太啰嗦」的 `data-*` 理由在本仓库也没有对应消费方。
- **`vue-draggable-plus` 的 `v-draggable` 指令与 `useDraggable` 组合式没有使用点**（见上文的 tip）；`RouteMeta.roles` / `RouteMeta.permissions` 类型字段没有读取方（见 v-permission 的 tip）。这三条和 `packages/types/src/app-router.ts:9-10`、库的 `dist/index.d.ts` 一样：声明 ≠ 在用。
- **`'*'` 权限码没有通配通道**：判定链 `resolveAccess()`（`utils.ts:82-109`）与 `usePermission()` 的匹配实现（`usePermission.ts:23-34`）里都没有 `'*'` 分支，权限表就是 `Array.includes` 白名单。而 mock 给 admin 账号发的是 `permissions: ['*']`（`apps/backend-mock/server/api/auth/login.post.ts:24`）——`['*'].includes('user:add')` 为 `false`，所以这条通配在元素层**什么都不授予**，演示账号想看 `v-permission` 放行得靠 `.disabled` / `:admin` 或指定码本身在表里。
- **`v-loading` 的属性配置只在遮罩创建那一次被读**（`packages/ui-kit/loading-ui/src/directive.ts:69-76`），挂载后改 `loading-tip` 等属性静默无效；能热更的只有 `binding.arg`（`directive.ts:96-98`）。
- **`v-escape` / `v-safe-html` 会覆写宿主元素内容**（`textContent` / `innerHTML`，`xss.ts:472, 532`），带插槽或子节点的容器挂它们等于丢弃原有 DOM——这是设计使然，但界面上没有任何提示。

## 相关页面

- [组件示例](/components/) — 章节总览与起服务方式
- [表格](/components/table) — `dragSort` 表格行拖拽（与本页的 VueDraggable 是两条路）
- [权限、指令与光标](/guide/in-depth/access) — 权限三层：路由、菜单、元素
- [样式与图标](/guide/essentials/styles) — `permission-disabled` 等降级样式的出处
- [目录说明](/guide/project/dir) — `packages/directives` / `packages/shared` 的分层位置
