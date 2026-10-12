# 弹窗与抽屉

这一页只讲一个示例路由 —— `/components/modal-drawer`，以及它背后那四个文件：`BasicModal.vue`、`BasicDrawer.vue`、`ModalWrapper.vue` 和它们的 `useXxx` 句柄。读完你要能回答三件事：**这套包装器比裸用 antdv-next 的 `Modal`/`Drawer` 多给了什么**、**`openModal(true, data)` 的数据到底怎么流进子组件**、**哪几个看起来能用的方法其实是空的**。

::: warning 先记住三条结论

1. `setModalProps` / `setDrawerProps` 是**静默空操作**（`apps/web/src/components/business/Modal/BasicModal.vue:100-102`、`apps/web/src/components/business/Drawer/BasicDrawer.vue:113-115`）。
2. `changeOkLoading` / `changeLoading` **拿不到实现**，弹窗内部的 `_innerMethods` 从来没被交出去（`Modal/BasicModal.vue:107-115` 对比 `:118`）。
3. `useDrawerInner` **只是 `useDrawer` 的别名导出**（`Drawer/index.ts:20`），不是「内层专用」的另一套实现。

下面每一节都会给出对应的行为代码，别把这三样当 API 抄进业务。:::

## 它解决什么问题

| 包装器 | 相比裸 antdv-next 多做的事 | 源码依据 |
| --- | --- | --- |
| `BasicModal` | 自带标题栏（含右侧插槽位与自绘关闭按钮）、自带底部按钮栏与四个插槽位、内容区套一层带滚动与 loading 遮罩的 `ModalWrapper` | `Modal/BasicModal.vue:191-212`（头部）、`:215-226`（内容）、`:229-264`（底部） |
| `BasicDrawer` | 同一套头部/底部结构，body 直接内置 `Scrollbar`，不经过 `ModalWrapper` | `Drawer/BasicDrawer.vue:207-228`、`:262-264`、`:268-302` |
| `useModal` / `useDrawer` | 把「开关弹窗」变成命令式句柄：父组件不需要维护 `open` 的 `ref`，也不必 `v-model` | `Modal/useModal.ts:37-51`、`Drawer/useDrawer.ts:43-57` |
| `useModalInner` | 让弹窗内的子组件收到 `openModal(true, data)` 传进来的 `data` | `Modal/useModalInner.ts:36-50` |

两个包装器都把 antd 自带的标题与底部关掉（`:title="null"` + `:footer="null"` + `:closable="false"`，见 `Modal/BasicModal.vue:172-176` 与 `Drawer/BasicDrawer.vue:186-189,194`），自己重画一份。所以 **antd 的 `confirmLoading`、`closeIcon`、`footer` 插槽这套东西在这里都不生效** —— 本仓库的 `ModalProps`/`DrawerProps` 里也没有 `confirmLoading` 字段（`Modal/types.ts:8-87`、`Drawer/types.ts:13-96`）。确认按钮的 loading 走组件内部状态，见后文「确认按钮的 loading 只能自己复位」。

## 句柄注册机制（读懂这段再看 API）

`BasicModal` 在挂载后**延迟一个宏任务**把方法对象 emit 出去：

```ts
// Modal/BasicModal.vue:117-125
const { start: scheduleRegister } = useTimeoutFn(
  () => emit('register', modalMethods),
  0,
  { immediate: false },
);
onMounted(() => scheduleRegister());
```

`BasicDrawer` 一模一样（`Drawer/BasicDrawer.vue:135-144`）。父组件的 `useModal()` 把 emit 的函数存成实例引用，并且**在调用时等待**：

```ts
// Modal/useModal.ts:22-35
const waitForInstance = async (): Promise<ModalMethods> => {
  if (modalInstance.value) return modalInstance.value;
  for (let i = 0; i < 10; i++) {
    // 每轮 nextTick + delay(50)
    await nextTick();
    if (modalInstance.value) return modalInstance.value;
    await delay(50);
  }
  throw new Error('[useModal] Modal instance not found. ...');
};
```

由此得出四条**实际行为**，写业务时比文档重要：

- `openModal` / `closeModal` / `setModalProps` 是 `async`（`useModal.ts:38-49`；抽屉版 `useDrawer.ts:44-55`）。等待上限约 10 轮 `nextTick` + 500ms，超时**抛错**而不是静默返回，所以不 `await` 的话错误会变成 unhandled rejection。
- `getVisible()` 是同步的，**不等待**：`useModal.ts:50`（`modalInstance.value?.getVisible() || false`）。在 `register` 之前调用必然得到 `false`。
- 卸载钩子挂在调用方的 setup 上（`useModal.ts:14-16`、`useDrawer.ts:21-23`）。源码注释记录了原因：`register` 是子组件 emit 的回调，那时 `currentInstance` 已经不可用，钩子写在回调里只会告警且挂不上（`useDrawer.ts:12-20` 的注释）。
- 实例引用存在就复用，所以同一句柄连开两个弹窗组件时，**后注册者覆盖前者**（`useModal.ts:18-20`）。

### data 通道：只有注册过 `useModalInner` 的子组件收得到

`BasicModal.openModal(visible, data)` 的第二个参数**在组件内部被直接丢掉** —— `Modal/BasicModal.vue:82-88` 里只有 `visibleRef.value = true` 和两个 emit，没有任何地方保存 `data`。数据能传进去全靠 `useModalInner` 在注册时**原地改写同一个实例对象上的 `openModal`**：

```ts
// Modal/useModalInner.ts:36-49
const register = (instance: ModalInnerMethods) => {
  modalInstance.value = instance;
  if (callback) {
    const originalOpenModal = instance.openModal;
    instance.openModal = (visible, data) => {
      if (data !== undefined) {
        dataRef.value = data;
        callback(data);
      }
      originalOpenModal(visible, data); // ← 这里把 data 消化掉
    };
  }
};
```

因为外层 `useModal` 保存的是**同一个对象引用**，它调用 `instance.openModal(...)` 时取到的是包装后的版本（`useModal.ts:38-41`），所以父页面 `openModal(true, data)` 会先进子组件回调。两个注册函数能被同一个 emit 喂到，靠的是 attrs 透传 —— 示例里 `InnerForm` 没有声明 `register` 这个 emit，父级的监听函数留在 `$attrs` 里，再由 `v-bind="$attrs"` 交给 `BasicModal`（`views/components/modal-drawer/components/InnerForm.vue:71`，机制解释在 `:12-23` 注释）；`inheritAttrs: false`（`:24`）是为了避免单根组件的默认透传把 `onRegister` 调用两遍。

::: tip 什么时候不必用 useModalInner 弹窗内容直接写在页面模板里（示例页第 2、3、5 节就是这样），子组件根本不存在，`data` 也就没人收 —— 直接读页面自己的 `ref` 即可。示例页把这句话印在了信息条里（`modal-drawer/index.vue:259-264`）。:::

## BasicModal 的 API

### Props（只列**真被读到**的）

默认值来自 `Modal/BasicModal.vue:14-29` 的 `withDefaults`，行为列给出读取位置。

| prop | 默认 | 实际作用 / 位置 |
| --- | --- | --- |
| `open` | 无（`undefined`） | 唯一能驱动显隐的 prop：`watch(() => props.open, ...)` 且 `immediate: true`（`:127-133`）；`v-model:open` 可回写（emit `update:open`，`:36,86,98`）。顺带一提，`:53` 那句 `ref(props.visible |  | false)`读的`visible`**不在`ModalProps` 里**（`types.ts:8-87`只有`open`），运行时只会是 `undefined`，初始显隐实际全靠那个 `immediate` 的 watcher |
| `title` | 无 | 自绘头部标题（`:194-196`），并拼进关闭按钮的 `aria-label`（`:205`） |
| `width` | 无 → `'520px'` | `getWidth` 计算属性兜底 `'520px'`（`:58-60`），传给 antd 的 `:width` |
| `height` | 无 | 固定内容区高度（px），交给 `ModalWrapper` 短路掉最大高度（`ModalWrapper.vue:30-32`） |
| `minHeight` | 无 | 内容区最小高度，缺省时是 `200px`（`ModalWrapper.vue:38`） |
| `wrapperFooterOffset` | `0` | 从最大高度里再扣掉的像素（`ModalWrapper.vue:34`） |
| `useWrapper` | `true` | `false` 时 `wrapperStyle` 直接返回 `{}`，即**不加高度上限、不做内部滚动**（`ModalWrapper.vue:28`） |
| `loading` | 无 | 初值进 `loadingRef`（`:55`），驱动内容区遮罩（`:216`） |
| `loadingTip` | 无 | 遮罩里 spinner 下方的文字（`ModalWrapper.vue:64-66`） |
| `centered` | **`true`** | 直接透传（`:174`）。注意 `Modal/types.ts:25-26` 的注释写「默认 false」，与代码不符 |
| `showFooter` | `true` | 与 `slots.footer`、`showCancelBtn/showOkBtn` 一起决定默认按钮栏是否渲染（`:230`） |
| `showCancelBtn` / `showOkBtn` | `true` / `true` | 两个按钮各自的开关（`:235`、`:246`） |
| `cancelText` / `okText` | `'关闭'` / `'保存'` | 按钮文案（`:242`、`:255`） |
| `okType` | 无 → `'primary'` | 模板里 `okType \|\| 'primary'`（`:247`） |
| `okButtonProps` / `cancelButtonProps` | 无 | `v-bind` 到对应 `Button`（`:249`、`:236`），**`disabled` 走这里** |
| `closable` | `true` | 只控制自绘 X 按钮是否渲染（`:202`）；antd 的 `:closable` 被硬编码为 `false`（`:176`） |
| `maskClosable` / `keyboard` | `true` / `true` | 透传给 antd（`:178-179`），但见下面「蒙层与 ESC 关不掉」的 warning |
| `mask` | `true` | 透传（`:181`） |
| `maskStyle` / `dialogStyle` | 无 | 透传（`:182-183`） |
| `bodyStyle` | 无 | 合并进 antd `styles.body`，覆盖 `padding: 0`（`:67-78`） |
| `zIndex` | `1000` | 透传（`:180`），嵌套场景就靠它 |
| `wrapClassName` | 无 | 拼上固定类名 `basic-modal`（`:63-65`） |
| `destroyOnHidden` | **`true`** | 透传（`:184`）。`Modal/types.ts:59` 注释写「默认 false」，与代码不符 |
| `closeFunc` | 无 | `closeModal()` 里 `await`，返回假值就不关闭（`:89-93`） |

`ModalProps` 里另外声明了 **`helpMessage`（`types.ts:13-14`）和 `afterClose`（`:76-77`）两个组件从不读取的字段**，以及 `onOk` / `onCancel` / `'onVisible-change'` / `'onUpdate:open'` 四个函数式字段（`:79-86`）—— 它们是 `defineEmits`（`:31-37`）的类型重复，组件内部一次都没引用。

::: warning 蒙层与 ESC 关不掉 Modal antd 的 `cancel` 事件签名是 `(e: MouseEvent | KeyboardEvent) => void`（`node_modules/.../antdv-next/dist/modal/interface.d.ts:121`，运行时 `dist/modal/Modal.js:61-66` 确实带事件对象），而 `BasicModal` 把它绑到了一个「按布尔值判断」的处理器上：

```ts
// Modal/BasicModal.vue:146-150,188
function handleVisibleChange(visible: boolean) {
  if (!visible) {
    handleCancel();
  } // ← 收到的是事件对象，永远为真
}
```

结果：点蒙层、按 ESC **都不会关闭弹窗**（`:open` 是受控的，antd 自己不会关）。能关闭的路径只剩三条 —— 自绘 X（`:206` → `handleCancel`）、底部取消按钮（`:237`）、以及外部调用 `closeModal()`。`maskClosable` / `keyboard` 两个 prop 因此只是透传给了 antd，在本组件里换不来行为。对比 `BasicDrawer`：它绑的是 `@close="handleCancel"`（`Drawer/BasicDrawer.vue:204,160-163`），所以抽屉的蒙层/ESC/X/取消按钮**四条路径都会走 `closeDrawer()` 并服从 `closeFunc`** —— 示例页第 5 节验证的就是抽屉这条链。:::

### 事件

| 事件 | 载荷 | 触发点 |
| --- | --- | --- |
| `register` | `ModalMethods` | 挂载后延迟 emit（`:117-125`），是给 `useModal` 用的 |
| `ok` | `MouseEvent` | 确认按钮点击（`:136-139`）；同时内部把确认按钮置 loading |
| `cancel` | `MouseEvent` | X 按钮与取消按钮（`:141-144`） |
| `visible-change` | `boolean` | `openModal`/`closeModal` 内部（`:85,97`） |
| `update:open` | `boolean` | 同上（`:86,98`），所以 `v-model:open` 可用 |

### 插槽

`titleTip`（标题右侧，`:197`）、默认插槽（内容，`:225`）、`insertFooter` / `centerFooter` / `appendFooter`（嵌在默认按钮栏里，`:233,244,257`）、`footer`（**一旦提供就整条替换默认按钮栏**，`:259-264` 与 `:230` 的条件互斥）。

### 实例方法（`ModalMethods`）

| 方法 | 声明 | 真实行为 |
| --- | --- | --- |
| `openModal(visible = true, data?)` | `types.ts:93-94` | 只有 `visible` 为真才打开，**关闭方向（传 `false`）不做任何事**（`BasicModal.vue:82-88`）；`data` 见上文 |
| `closeModal()` | `types.ts:95-96` | 先 `await props.closeFunc()`，返回假值直接 return；否则复位 `okLoadingRef`/`loadingRef` 并 emit（`:89-99`） |
| `getVisible()` | `types.ts:99-100` | 读内部 `visibleRef`（`:103`） |
| `setModalProps(partial)` | `types.ts:97-98` | **空操作**：`Object.assign(props, newProps)` 写只读 props（`:100-102`），DEV 控制台会有 readonly 告警，界面上标题/按钮/宽度一律不变 |

::: warning 确认按钮的 loading 只能自己复位 `handleOk` 无条件把 `okLoadingRef` 置 `true`（`:136-137`），而唯一的复位点是 `closeModal()`（`:95`）。`changeOkLoading` 虽然写进了 `ModalInnerMethods`（`types.ts:111-114`）和 `useModalInner` 的返回值（`useModalInner.ts:62-67`），但 `BasicModal` emit 出去的是**不含这两个方法的 `modalMethods`**（`:118`，对比白写了却没交出去的 `innerMethods` `:107-115`）。`useModalInner.ts:63` 用的是可选链 `modalInstance.value?.changeOkLoading?.(loading)`，所以调用**既不报错也不生效**。结论：`@ok` 的处理函数如果决定留着弹窗（例如校验失败），确认按钮会一直转圈，只能靠关窗复位 —— 示例页所有提交路径都会关窗，并把这个前提写在页面上（`modal-drawer/index.vue:304-314`）。:::

## BasicDrawer 的 API

默认值来自 `Drawer/BasicDrawer.vue:12-26`。与 `BasicModal` 同名的 props（`title`/`showFooter`/`showCancelBtn`/`showOkBtn`/`cancelText`/`okText`/`okType`/`okButtonProps`/`cancelButtonProps`/`closable`/`maskClosable`/`keyboard`/`mask`/`maskStyle`/`bodyStyle`/`wrapClassName`/`zIndex`/`destroyOnHidden`/`loading`/`loadingTip`/`closeFunc`）作用一致，位置换成 `:184-302` 区间，这里只写**差异**。

| prop | 默认 | 差异点 |
| --- | --- | --- |
| `placement` | `'right'` | 决定 `size` 取宽度还是高度（`:48-64`） |
| `size` | 无 | 推荐用法；左右缺省 `520`，上下缺省 `400`（`:54`、`:61`） |
| `width` | 无 | `placement` 为 left/right 时作为 `size` 的备选（`:50`） |
| `height` | 无 | `placement` 为 top/bottom 时作为 `size` 的备选（`:57`） |
| `useWrapper` | `true` | 抽屉里**只决定 body 加不加 `p-4`**（`:71-76`），没有高度逻辑 |
| `open` | 无 | 读的仍是 `props.open`（`:43,146-152`） |

::: warning 抽屉的 v-model 方向是断的 `BasicDrawer` 读 `props.open`（`:43`、`:146-152`），但 emit 的是 `update:visible`（`:33,99,111`）。`DrawerProps` 里也只声明了 `open`（`types.ts:14-15`）。于是：`v-model:visible` 绑不上（没有 `visible` 这个 prop，它会掉进 attrs）；`v-model:open` 只能进不能出（没有 `update:open`）。**可靠用法只有两种**：`@register` 配 `useDrawer()` 的命令式句柄，或者 `:open="x"` 自己接 `@update:visible` 写回。示例页全部走前者。:::

另外三点按实记录：

- **`wrapperFooterOffset` 在抽屉里没人读**：`Drawer/types.ts:33-34` 声明了，`BasicDrawer.vue` 既没设默认值也没引用（对比 `Modal/BasicModal.vue:25,220`）。同理 `helpMessage`（`types.ts:19`）、`afterClose`（`:86`）、`DrawerWrapperProps`（`:145-152`，没有对应的 wrapper 组件）。
- **字符串尺寸会被 `parseInt` 吃掉**：`getSize` 对字符串走 `Number.parseInt(size, 10)`（`:52`、`:59`），所以 `width="40%"` 会变成 `40` 像素。示例页统一给数字，并把这条写在信息条里（`modal-drawer/index.vue:416-421`）。
- **`closeDrawer()` 之外的显隐不受 `closeFunc` 约束**：钩子只在 `closeDrawer` 里 `await`（`:102-106`），打开方向没有等价的拦截点。

`useDrawer()` 的返回是 `openDrawer / closeDrawer / setDrawerProps / getVisible`（`useDrawer.ts:43-57`），语义与 `useModal` 完全对称：`waitForInstance` 同样是 10 轮 `nextTick` + 50ms、超时抛 `[useDrawer] Drawer instance not found`（`:29-41`）；`getVisible` 同样同步不等待（`:56`）。`setDrawerProps` 同样是 `Object.assign(props, ...)` 空操作（`BasicDrawer.vue:113-115`）。

::: warning `useDrawerInner` 不是「内层专用」 `Drawer/index.ts:19-20` 是同一模块的两行导出：

```ts
export { useDrawer } from './useDrawer';
export { useDrawer as useDrawerInner } from './useDrawer';
```

所以 `useDrawerInner(callback)` 的 `callback` **不会被接收也不会被调用**（`useDrawer.ts:9` 的签名没有任何参数）—— 抽屉侧没有 `useModalInner` 那样的数据通道。解构出来的第二个元素实际只有 `openDrawer/closeDrawer/setDrawerProps/getVisible` 四个键，按 `DrawerInnerMethods`（`types.ts:115-124`）去解构 `changeOkLoading` / `changeLoading` 会得到 `undefined`，调用即 `TypeError`。`BasicDrawer` 确实准备好了含这两个方法的 `_innerMethods`（`:120-128`），但它只挂在 `defineExpose` 上（`:131-134`），而 `register` emit 发的是 `drawerMethods`（`:136`），两头没接上。示例页第 4 节因此只用 `openDrawer/closeDrawer`（`modal-drawer/index.vue:165-171`）。:::

## 内容区滚动与 loading 遮罩

`BasicModal` 把滚动外包给 `Modal/components/ModalWrapper.vue`，规则很短：

| 条件 | 结果 | 位置 |
| --- | --- | --- |
| `useWrapper: false` | 样式对象为 `{}`，没有高度上限 | `ModalWrapper.vue:28` |
| 传了 `height` | `height: Npx` 固定，`maxHeight`/`minHeight` 全部让路 | `:30-32` |
| 其余情况 | `maxHeight = 视口高 - 200 - footerOffset`，`minHeight` 缺省 `200px` | `:34,38` |

外层 `div.modal-wrapper` 是 `relative`，loading 时叠一层 `absolute inset-0` 的半透明遮罩 + spinner（`:47-68`），内容始终包在 `@antdv/ui` 的 `Scrollbar` 里（`:70-76`，`p-6` 内边距），`native` 取自 `projectConfig.scrollbar?.native`（`:6,72`）—— 设成 `true` 就换成浏览器默认滚动条。窗口尺寸变化由 `useWindowSize` 响应（`:25`），不需要手动重算。

标题区与底部按钮栏在滚动容器**之外**（`BasicModal.vue:191-212` 与 `:229-264`），所以内容滚动时它们固定。抽屉的做法不同：body 直接 `h-full min-h-0 overflow-hidden` 再套 `Scrollbar root-class="h-full"`（`BasicDrawer.vue:231-236,262-264`），配合 `:deep(.ant-drawer-content)` 的 flex 列布局（`:306-318`）把高度压给 body；`ModalWrapper` 里那套 `height` / `minHeight` / `footerOffset` 在抽屉里一个都不适用。`ModalWrapper` 自己还声明了一个从不读取的 `visible` prop（`:17`）。

## 在线示例：`/components/modal-drawer`

打开方式：`pnpm dev:web` + `pnpm dev:mock`，访问 `http://localhost:6080/#/components/modal-drawer`（hash 路由），或左侧栏「组件示例 → 弹窗与抽屉」（菜单项 `menus.get.ts:257-262`，`name: 'DemoModalDrawer'`）。页面共 5 个小节，源码 `apps/web/src/views/components/modal-drawer/index.vue`（667 行）+ 私有子组件 `components/InnerForm.vue`；本节所有数据都是本地 `ref`，没有后端请求。

### 1. 基础弹窗（`index.vue:243-316`，逻辑 `:25-83`）

| 点什么 | 看到什么 |
| --- | --- |
| `openModal(true, data) 打开并传数据`（`:246-248`，逻辑 `:39-58`） | 弹出 `InnerForm`：左栏显示父页面发出去的 JSON（`:266-273`），弹窗内部标题下显示「useModalInner 回调第 N 次收到数据」和收到的 JSON（`InnerForm.vue:80-88`）。payload 里带了一个 `onSubmit` 函数（`index.vue:47-54`），证明数据通道原样透传 |
| 弹窗里改字段 → 底部「提交」（`InnerForm.vue:57-61`） | 右栏「弹窗点提交后回传的值」出现 JSON（`index.vue:276-288`），弹窗关闭 —— 关闭顺带把确认按钮的 loading 复位 |
| 底部「重置」（`centerFooter` 插槽，`InnerForm.vue:118-122`） | 表单清空但**弹窗保持打开**（`:63-66`），演示内置按钮栏的插槽位 |
| `closeModal() 关闭`（`:249-251`，逻辑 `:60-63`） | 关掉当前弹窗；没打开时点它会走 `waitForInstance`，实例已在就立刻返回 |
| `getVisible() 查询显隐`（`:252-254`，逻辑 `:65-67`） | 下方「方法返回值」打印时间戳 + `getVisible()` 结果（`:291-293`）—— 注意这个方法是同步的，弹窗还没注册好时只会得到 `false` |
| `setModalProps() 尝试改 props`（`:255-257`，逻辑 `:75-83`） | 日志追加一行「已发出，但标题/按钮/宽度均无变化」，并弹一条 warning message。**这就是空操作的现场证据**，页面把结论直接印在按钮下面（`:304-314`） |

### 2. 弹窗内滚动（`index.vue:321-400`，逻辑 `:85-129`）

| 点什么 | 看到什么 |
| --- | --- |
| `打开固定高度弹窗（:height="360"）`（`:324-326`，弹窗 `:346-373`） | 24 条单选记录只在内容区滚，标题与底部固定；选一条点「提交选择」→ 页面出现「已选择第 N 条」（逻辑 `:108-115`） |
| `打开自适应高度弹窗（minHeight + wrapperFooterOffset）`（`:327-329`，弹窗 `:375-400`） | 最大高度 = 视口 - 200 - 140；点「再追加 12 行」内容继续变长但窗口不超出视口（逻辑 `:117-129`） |
| —— | 上面的信息条（`:331-336`）逐字解释了 `ModalWrapper` 读到的四个 prop 各自作用，与本文表格一致 |

### 3. 抽屉基础与位置（`index.vue:403-523`，逻辑 `:131-161`）

| 点什么 | 看到什么 |
| --- | --- |
| `左侧抽屉 :width="360"`（`:406-408`，抽屉 `:431-460`） | 从左侧滑出，宽 360；`#footer` 插槽给的是「取消 / 应用」两个按钮（`:450-459`），内置按钮栏整条消失。点「应用」→ 页面蓝色结果块写入密度（逻辑 `:146-150`） |
| `右侧抽屉 :size="520"`（`:409-411`，抽屉 `:462-494`） | 默认右侧；footer 里再嵌 `insertFooter` 式的「全选 / 清空」+「取消 / 完成」布局（`:474-493`） |
| `底部抽屉 :height="280"`（`:412-414`，抽屉 `:496-523`） | `placement="bottom"` 时 `height` 才生效（`getSize`，`BasicDrawer.vue:56-62`） |
| 每个抽屉的 X / 蒙层 / ESC | 都会走 `closeDrawer()`，因此都受 `closeFunc` 约束 —— 第 5 节专门验证这条 |

### 4. 抽屉内滚动（`index.vue:526-599`，逻辑 `:163-195`）

`打开长内容抽屉`（`:529-531`）弹出 `:size="560"` 的抽屉（`:553-599`）：外层 16 条条款在 `BasicDrawer` 内置的 `Scrollbar` 里滚，标题与底部固定；里面再嵌一个 `@antdv/ui` 的 `Scrollbar`（`root-class="h-60"`，即 240px，`:577-580`），通过它的 `@scroll` 事件把 `scrollTop` 写回页面状态（逻辑 `:183-189`，`wrap` 元素来自组件 `defineExpose`，见 `packages/ui/src/scrollbar/Scrollbar.vue:256-257`）。只有滚到底（`scrollTop + clientHeight >= scrollHeight - 4`）才能勾选「我已阅读完附加条款」（`:591-597`），没勾选时抽屉的确认按钮通过 `:ok-button-props="{ disabled: !agreement }"`（`:558`）保持禁用。

::: tip 高度为什么用 `root-class` 而不是 `max-height` 页面文字（`:540-543`）给了原因：`max-height` 属性会被 `Scrollbar` 内部的 `useResponsiveMaxHeight` 以 712px 为下限重新算掉，所以这里用 `root-class="h-60"` 固定高度。细节见[数据与展示](/components/display)的滚动一节。:::

### 5. 嵌套与关闭拦截（`index.vue:602-665`，逻辑 `:196-237`）

`打开可编辑抽屉`（`:605-607`）弹出带 `textarea` 的草稿抽屉（`:630-650`），`ok-text="保存草稿"`，并挂上 `:close-func="guardCloseDrawer"`（`:635`）。改几个字 → 顶部标签变「有未保存修改」（`isDirty`，`:205`）→ 依次用 **X、蒙层、ESC、底部「关闭抽屉」** 去关：四种路径最后都调用 `closeDrawer()`，`guardCloseDrawer` 被 `await` 且返回 `false`，抽屉不动，拦截计数 +1，同时 `openConfirmModal()` 弹出确认弹窗（逻辑 `:214-223`）。

叠放与放行的真实机制：

- 确认弹窗压在抽屉之上靠的是 `BasicModal` 的 `:z-index="1100"`（`:654`），抽屉默认 `1000`（`BasicDrawer.vue:25`）。
- 「放弃修改并关闭」先 `closeConfirmModal()` 再 `closeNestDrawer()`（`:232-237`）；第二次进入 `closeDrawer()` 时 `isDirty` 已为假，`guardCloseDrawer` 返回 `true` 才真正放行（`:215-218`）—— 也就是说「放行」不是绕过钩子，而是让钩子的条件先成立。
- 「保存草稿」走 `@ok` → `handleSaveDraft`：先写 `savedDraft` 再 `closeNestDrawer()`（`:225-230`），同理第二次才通过。
- 内容干净时（没改过）关闭不拦截，日志写「内容干净，直接放行」（`:216-217`）。
- 拦截计数与结果文本都在页面上（`:608-611`、`:621-626`），没有任何后端参与。

## 这页没有的能力

按实际读过的源码说明「不存在」，别按别的模板（vben 等）的文档来找：

- **没有拖拽移动、没有全屏切换**。`Modal/hooks/useDragMove.ts`、`useModalFullScreen.ts`、`useModalHeight.ts` 三个文件存在，但全仓库没有任何地方 import 它们，`Modal/index.ts` 也不导出（导出清单见 `Modal/index.ts:1-19`）。`ModalProps` 里同样没有 `draggable` / `fullscreen` / `canFullscreen` 字段（`types.ts:8-87`）。
- **没有 `confirmLoading`**：本仓库的 props 定义里不存在这个字段，antd 的这条链路被 `:footer="null"` 切断（`BasicModal.vue:173`）。
- **没有「打开前确认」的钩子**：`closeFunc` 只作用于关闭（`BasicModal.vue:89-93`、`BasicDrawer.vue:102-106`）。
- **没有 Modal 的 destroyOnHidden 之外的销毁控制**，也**没有抽屉的数据回调**（见 `useDrawerInner` 一节）。
- **`openModal(false)` 不能用来关闭**（`BasicModal.vue:82-88` 里 `visible` 为假时什么都不做），要关只能调 `closeModal()`。

## 相关页面

- [组件示例](/components/) —— 本章目录、示例页打开方式与统一约定
- [表格](/components/table) —— 表格页里用 `BasicModal` 承载新增/编辑时的完整上下文
- [图标指南](/guide/essentials/icons) —— 抽屉/弹窗里 `IconifyIcon` 与离线图标集合
