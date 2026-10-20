# 弹窗与抽屉

这一页只讲一个示例路由 —— `/components/modal-drawer`，以及它背后那几个文件：`BasicModal.vue`、`BasicDrawer.vue`、`ModalWrapper.vue` 和它们的 `useXxx` 句柄。读完你要能回答三件事：**这套包装器比裸用 `@antdv/shadcn-ui` 的 Dialog / Drawer 原语多给了什么**、**`openModal(true, data)` 的数据到底怎么流进子组件**、**哪几个 props 声明了却没有落点**。

::: warning 先记住三条结论

1. `setModalProps` / `setDrawerProps` **是真生效的**：实现不去写 `defineProps` 交出来的只读 props，而是把覆盖值并进组件内部的 `propOverrides`，渲染统一读 `merged`（`modal/BasicModal.vue:70-71`、`:118-122`；`drawer/BasicDrawer.vue:57-58`、`:156-161`）。
2. `ModalProps` / `DrawerProps` 里有**声明了但组件从不读取**的字段：`helpMessage`、`maskStyle`，弹窗侧还要再加一个 `bodyStyle`（详见下面两张 props 表）。
3. `useDrawerInner` **只是 `useDrawer` 的别名导出**（`drawer/index.ts:13-15`），不是「内层专用」的另一套实现；抽屉侧没有数据通道，`useModalInner` 才有。

下面每一节都会给出对应的行为代码，别把第 2 条那几个字段当 API 抄进业务。
:::

## 它解决什么问题

| 包装器 | 相比裸用原语多做的事 | 源码依据 |
| --- | --- | --- |
| `BasicModal` | 自带标题栏（含右侧插槽位与自绘关闭按钮）、自带底部按钮栏与四个插槽位、内容区套一层带滚动与 loading 遮罩的 `ModalWrapper` | `modal/BasicModal.vue:206-235`（头部）、`:241-252`（内容）、`:255-293`（底部） |
| `BasicDrawer` | 同一套头部/底部结构，body 直接内置 `ScrollArea`，不经过 `ModalWrapper` | `drawer/BasicDrawer.vue:283-327`、`:333-375`、`:378-418` |
| `useModal` / `useDrawer` | 把「开关弹窗」变成命令式句柄：父组件不需要维护 `open` 的 `ref`，也不必 `v-model` | `modal/useModal.ts:41-55`、`drawer/useDrawer.ts:40-54` |
| `useModalInner` | 让弹窗内的子组件收到 `openModal(true, data)` 传进来的 `data` | `modal/useModalInner.ts:38-52` |

两个包装器都把原语自带的关闭按钮关掉，自己重画一份头部（`BasicModal.vue:199` 的 `:show-close-button="false"`，抽屉则整块头部由 `:283-327` 自绘），底部按钮栏同理。所以 **原语/旧 antd 的 `confirmLoading`、`closeIcon`、`footer` 这套东西在这里都不生效** —— 本仓库的 `ModalProps`/`DrawerProps` 里也没有 `confirmLoading` 字段（`types.ts:17-100`、`drawer/types.ts:8-62`）。确认按钮的 loading 走组件内部状态，见后文「确认按钮的 loading」。

## 句柄注册机制（读懂这段再看 API）

`BasicModal` 在挂载后**延迟一个宏任务**把方法对象 emit 出去：

```ts
// modal/BasicModal.vue:136-144
const { start: scheduleRegister } = useTimeoutFn(
  () => emit('register', innerMethods),
  0,
  { immediate: false },
);
onMounted(() => scheduleRegister());
```

`BasicDrawer` 一模一样（`drawer/BasicDrawer.vue:180-189`）。父组件的 `useModal()` 把 emit 的函数存成实例引用，并且**在调用时等待**：

```ts
// modal/useModal.ts:26-39
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

- `openModal` / `closeModal` / `setModalProps` 是 `async`（`useModal.ts:42-53`；抽屉版 `useDrawer.ts:41-52`）。等待上限约 10 轮 `nextTick` + 500ms，超时**抛错**而不是静默返回，所以不 `await` 的话错误会变成 unhandled rejection。
- `getVisible()` 是同步的，**不等待**：`useModal.ts:54`（`modalInstance.value?.getVisible() || false`）。在 `register` 之前调用必然得到 `false`。
- 卸载钩子挂在调用方的 setup 上（`useModal.ts:18-20`、`useDrawer.ts:18-20`）。源码注释记录了原因：`register` 是子组件 emit 的回调，那时 `currentInstance` 已经不可用，钩子写在回调里只会告警且挂不上（`useDrawer.ts:13-17` 的注释）。
- 实例引用存在就复用，所以同一句柄连开两个弹窗组件时，**后注册者覆盖前者**（`useModal.ts:22-24`）。

### data 通道：只有注册过 `useModalInner` 的子组件收得到

`BasicModal.openModal(visible, data)` 的第二个参数**在组件内部被直接丢掉** —— `modal/BasicModal.vue:103-105` 里只有 `setVisible(true)`，没有任何地方保存 `data`。数据能传进去全靠 `useModalInner` 在注册时**原地改写同一个实例对象上的 `openModal`**：

```ts
// modal/useModalInner.ts:38-52
const register = (instance: ModalInnerMethods) => {
  modalInstance.value = instance;
  if (callback && instance.openModal) {
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

因为外层 `useModal` 保存的是**同一个对象引用**，它调用 `instance.openModal(...)` 时取到的是包装后的版本（`useModal.ts:42-45`），所以父页面 `openModal(true, data)` 会先进子组件回调。两个注册函数能被同一个 emit 喂到，靠的是 attrs 透传 —— 示例里 `InnerForm` 没有声明 `register` 这个 emit，父级的监听函数留在 `$attrs` 里，再由 `v-bind="$attrs"` 交给 `BasicModal`（`views/components/modal-drawer/components/InnerForm.vue:71`，机制解释在 `:7-21` 注释）；`inheritAttrs: false`（`:22`）是为了避免单根组件的默认透传把 `onRegister` 调用两遍。

::: tip

什么时候不必用 useModalInner 弹窗内容直接写在页面模板里（示例页第 2、3、5 节就是这样），子组件根本不存在，`data` 也就没人收 —— 直接读页面自己的 `ref` 即可。示例页把这句话印在了信息条里（`modal-drawer/index.vue:305-310`）。
:::

## BasicModal 的 API

### Props（只列**真被读到**的）

默认值来自 `modal/BasicModal.vue:30-44` 的 `withDefaults`，行为列给出读取位置。

| prop | 默认 | 实际作用 / 位置 |
| --- | --- | --- |
| `open` | 无（`undefined`） | 唯一能驱动显隐的 prop：`watch(() => props.open, ...)` 且 `immediate: true`（`:146-152`）；`v-model:open` 可回写（emit `update:open`，`:50`、`:99`） |
| `title` | 无 | 自绘头部标题（`:213-217`），并拼进关闭按钮的 `aria-label`（`:229`） |
| `width` | 无 → `'520px'` | `getWidth` 兜底 `'520px'`（`:73-77`），数字按 px 处理，进面板内联 style（`:80`） |
| `height` | 无 | 固定内容区高度（px），交给 `ModalWrapper` 短路掉最大高度（`ModalWrapper.vue:21-23`） |
| `minHeight` | 无 | 内容区最小高度，缺省时是 `200px`（`ModalWrapper.vue:29`） |
| `wrapperFooterOffset` | `0` | 从最大高度里再扣掉的像素（`BasicModal.vue:41`、`:246` → `ModalWrapper.vue:25`） |
| `useWrapper` | `true` | `false` 时 `wrapperStyle` 直接返回 `{}`，即**不加高度上限、不做内部滚动**（`ModalWrapper.vue:19`） |
| `centered` | **`true`** | `false` 时面板改成 `!top-20 translate-y-0` 并关掉入场动画（`:89-91`）。注意 `types.ts:34-35` 的注释写「默认 true」，与代码一致，但值确实在 `:40` 的 `withDefaults` 里 |
| `loading` | 无 | 初值进 `loadingRef`（`:67`），驱动内容区遮罩（`:242`） |
| `loadingTip` | 无 | 遮罩里 spinner 下方的文字（`:243` → `ModalWrapper.vue:54-56`） |
| `showFooter` | `true` | 与 `slots.footer`、`showCancelBtn/showOkBtn` 一起决定默认按钮栏是否渲染（`:256`） |
| `showCancelBtn` / `showOkBtn` | `true` / `true` | 两个按钮各自的开关（`:265`、`:276`） |
| `cancelText` / `okText` | `'关闭'` / `'保存'` | 按钮文案（`:272`、`:284`） |
| `okType` | 无 → `'primary'` | `resolvePopupButton` 里 `okType ?? 'primary'` 映射成 shadcn 的 `variant`（`:185-187`、`shared/button.ts`） |
| `okButtonProps` / `cancelButtonProps` | 无 | 同上，`disabled` / `loading` / `class` / `type` 都从这里走（`:266-268`、`:277-279`） |
| `closable` | `true` | 控制自绘 X 按钮是否渲染（`:222`），**同时也决定点蒙层能不能关**（`:175`） |
| `maskClosable` / `keyboard` | `true` / `true` | 分别拦住蒙层（`:175`）与 ESC（`:181`）这两条关闭路径 |
| `mask` | `true` | 传给原语的 `:modal`（`:194`）—— `false` 时不渲染蒙层，也不再锁背景滚动 |
| `dialogStyle` | 无 | 并进面板内联 style（`:82`） |
| `zIndex` | 无（即 `z-50`） | 只在显式传入时才写进内联 style（`:81`），嵌套场景就靠它，见示例页第 5 节 |
| `wrapClassName` | 无 | 拼进面板 class，固定类名为 `basic-modal`（`:87`、`:92`） |
| `destroyOnHidden` | **`true`** | 映射到原语的 `:force-mount="!destroyOnHidden"`（`:198`）；关闭态若仍挂载，由 `CLOSED_PANEL_INERT` 兜住点击（`:88`） |
| `closeFunc` | 无 | `closeModal()` 里 `await`，返回假值就不关闭（`:107-110`） |
| `afterClose` | 无 | 关闭流程末尾调用（`:116`），与 `DrawerProps` 同名字段一致 |

`ModalProps` 里另外声明了**组件从不读取的三个字段**：`helpMessage`（`types.ts:23`）、`maskStyle`（`:82`）、`bodyStyle`（`:84`）。蒙层的样式由原语的 `DialogContent` 内部的 Overlay 决定，改它得去 `@antdv/shadcn-ui`；`bodyStyle` 虽然被传给了 `ModalWrapper`（`BasicModal.vue:249`），但 `ModalWrapperProps`（`types.ts:137-145`）里没有这一项，所以到不了内容区。另外还有 `onOk` / `onCancel` / `'onVisible-change'` / `'onUpdate:open'` 四个函数式字段（`:93-99`）—— 它们是 `defineEmits`（`:46-52`）的类型重复，组件内部一次都没引用。

### 关闭路径：X、取消、蒙层、ESC 都会过 `closeFunc`

原语的拦截事件被逐个接管，四条路径最后都汇到 `handleCancel()` → `closeModal()`（`:159-162`）：

- 蒙层：`@interact-outside` 先 `preventDefault()`，再排除「只是焦点被甩回 body」的伪事件（`isFocusOutsideEvent`，`shared/dismiss.ts`），然后按 `maskClosable && closable` 决定要不要关（`:172-177`）。
- ESC：`@escape-key-down` 同样先 `preventDefault()`，由 `keyboard` 决定（`:179-183`）。
- X 与底部取消按钮：直接 `@click="handleCancel"`（`:230`、`:269`）。
- 原语自己发出的 `update:open(false)` 也接了（`:194`），保证显隐状态不会被组件外部改掉而绕过 `closeFunc`。

之所以要 `preventDefault()` 再由自己走一遍 `closeModal()`，是因为 `closeFunc` 是异步闸门：交给原语关就等不到这个 `await`。蒙层与 ESC 现在**都能**关闭弹窗，并且都能被 `closeFunc` 拦下 —— 与抽屉的行为一致。

### 事件

| 事件 | 载荷 | 触发点 |
| --- | --- | --- |
| `register` | `ModalInnerMethods & ModalMethods` | 挂载后延迟 emit（`:136-144`），给 `useModal` 与 `useModalInner` 共用 |
| `ok` | `MouseEvent` | 确认按钮点击（`:154-157`）；同时内部把确认按钮置 loading |
| `cancel` | `MouseEvent` | X、取消按钮、蒙层、ESC 四条路径（`:159-162`） |
| `visible-change` | `boolean` | `setVisible()` 与 `closeModal()` 内部（`:98`、`:114`） |
| `update:open` | `boolean` | 同上（`:99`、`:115`），所以 `v-model:open` 可用 |

### 插槽

`titleTip`（标题右侧，`:218`）、默认插槽（内容，`:251`）、`insertFooter` / `centerFooter` / `appendFooter`（嵌在默认按钮栏里，`:263`、`:274`、`:286`）、`footer`（**一旦提供就整条替换默认按钮栏**，`:288-293` 与 `:256` 的条件互斥）。

### 实例方法（`ModalMethods`）

| 方法 | 声明 | 真实行为 |
| --- | --- | --- |
| `openModal(visible = true, data?)` | `types.ts:104` | 只有 `visible` 为真才打开，**关闭方向（传 `false`）不做任何事**（`BasicModal.vue:103-105`）；`data` 见上文 |
| `closeModal()` | `types.ts:106` | 先 `await closeFunc()`，返回假值直接 return；否则复位 `okLoadingRef`/`loadingRef`、emit 两个事件并调 `afterClose`（`:106-117`） |
| `getVisible()` | `types.ts:110` | 读内部 `visibleRef`（`:123`） |
| `setModalProps(partial)` | `types.ts:108` | **真生效**：覆盖值并进 `propOverrides`，`merged` 重算（`:118-122`）；传 `open` / `loading` 还会同步改内部 ref |

::: warning

确认按钮的 loading 要么关窗要么自己复位 `handleOk` 无条件把 `okLoadingRef` 置 `true`（`:154-156`），组件内部唯一的自动复位点是 `closeModal()`（`:112`）。`BasicModal` emit 出去的是**含 `changeOkLoading` / `changeLoading` 的 `innerMethods`**（`:126-134`、`:137`），所以只有在弹窗内部用 `useModalInner()` 解构才拿得到这两个方法（`useModalInner.ts:64-69`）；页面级 `useModal()` 只转发四个键（`useModal.ts:41-55`）。结论：`@ok` 的处理函数如果决定留着弹窗（例如校验失败），要么在子组件里调 `changeOkLoading(false)`，要么就关窗。示例页第 1 节所有提交路径都会关窗，并把这个前提写在页面上（`modal-drawer/index.vue:360-377`）。
:::

## BasicDrawer 的 API

`BasicDrawer` 是 shadcn-vue 的 **Drawer 原语**（reka-ui 的 `DrawerRoot` / `DrawerContent` / `DrawerTitle` / `DrawerDescription`）之上的一层壳，默认值来自 `drawer/BasicDrawer.vue:23-37`。与 `BasicModal` 同名的 props（`title`/`showFooter`/`showCancelBtn`/`showOkBtn`/`cancelText`/`okText`/`okType`/`okButtonProps`/`cancelButtonProps`/`closable`/`maskClosable`/`keyboard`/`mask`/`bodyStyle`/`wrapClassName`/`zIndex`/`destroyOnHidden`/`loading`/`loadingTip`/`closeFunc`）作用一致，这里只写**差异**。

| prop | 默认 | 差异点 |
| --- | --- | --- |
| `placement` | `'right'` | 决定 `size` 取宽还是高（`:61-78`），并换成原语的 `swipe-direction`（`:87-96`，`top/bottom` → `up/down`） |
| `size` | 无 | 推荐用法；左右缺省 `520`，上下缺省 `400`（`:67`、`:69`、`:75`、`:77`） |
| `width` | 无 | 只在 left/right 下作为 `size` 的备选（`:65`） |
| `height` | 无 | 只在 top/bottom 下作为 `size` 的备选（`:73`） |
| `useWrapper` | `true` | 抽屉里**只决定 body 加不加 `p-4`**（`:335-336`），没有高度逻辑 |
| `mask` | `true` | 关掉就不渲染蒙层，并把原语的 `modal` 从 `'trap-focus'` 降到 `false`（`:105-106`） |
| `maskClosable` | `true` | 蒙层与**甩动关闭**共用的开关（`:243-248`、`:228-236`）；与弹窗侧不同，抽屉的 `closable` 只管 X 按钮（`:303`），不影响这两条路径 |
| `keyboard` | `true` | ESC 的开关（`:250-252`） |
| `bodyScroll` | `true` | 内容区交给内置 `ScrollArea`；调用方自己管滚动时关掉（`:371-374`，注释见 `types.ts:50-55`） |
| `open` / `visible` | 无 | 两个都读（`:53`、`:194-200`），`v-model:open` 与 `v-model:visible` 双向都通（emit 见 `:39-46`、`:132-137`） |

`zIndex` 只在显式传入时才写进面板的内联 style（`:109-113`）；不传就跟页面里其他 `z-50` 浮层一样按挂载顺序叠——这是抽屉之上还能压确认弹窗的原因（示例页第 5 节用 `:z-index="1100"`）。`drawerStyle` 同样并进内联 style，`wrapClassName` 并进面板 class，`headerStyle`/`footerStyle`/`bodyStyle` 各归各的区域；`maskStyle` 目前没有落点（蒙层是原语的 `DrawerOverlay`，样式在 `@antdv/shadcn-ui` 的 `drawer/DrawerOverlay.vue`）。

### 选型：为什么落在 Drawer 原语上

这条决策换过一次方向：早期实现用 Sheet（Dialog 语义 + `side`），现在用 Drawer。按维度摊开写清楚，免得下一次改动再把结论当 folklore。

**功能适配性。** 两者都是"贴边面板 + 蒙层"，能力面几乎重合：`DrawerTitle`/`DrawerDescription`/`Portal` 与 Sheet 的对应物同源，`placement` 与 Sheet 的 `side` 是一对一映射（Drawer 只多一个词汇转换）。真正的差别在两条开关上：Drawer 的 `modal` 接受 `'trap-focus'` 这个中间档（收焦但不改别人的 `aria-hidden`），Dialog/Sheet 只有布尔；Drawer 自带 `swipe-direction` 与滑动关闭，Sheet 没有。

**交互体验要求。** 抽屉的关闭路径有五条：底部按钮、右上角 X、点蒙层、ESC、**按住面板往开口方向甩**。前四条 Sheet 也做得到；第五条是抽屉这种控件在触屏上的默认预期，只有 Drawer 原语提供（`useSwipeDismiss`：位移过 `40px` 阈值，或释放速度高于 `0.3px/ms` 即判甩出；手势起点落在 `button/a/input/select/textarea/label/[role=button]` 时原语主动放弃，所以拖动区是头部空白而不是按钮）。关键是这条新路径没有绕开拦截：它同样从 `update:open(false, { reason: 'swipe' })` 出去（`:228-236`），于是 `closeFunc` 与 `maskClosable` 都管得着——先在同步过程里 `details.cancel()` 把已经拖出屏外的面板弹回原位，关不关交给 `closeDrawer()` 里那道 `await closeFunc()` 决定（`:143-155`）。`cancel()` 只能同步生效，等 `await` 完再调已经来不及。

**自定义扩展能力。** `DrawerContent` 的 class/style 完全开放，所以尺寸用内联 `width`/`height` 给（`:109-113`），面板只要再用 `max-w-none!` 解开原语自带的 `sm:max-w-sm` 上限（`:122`）——不能再叠 `w-auto!`，`important` 会反过来把内联宽度顶掉。`destroyOnHidden: false` 直接映射到原语的 `force-mount`（`:278`）。代价是原语留了两个缺口，得在组件里补：

- `DrawerContent` 在 `modal === true` 时跑 `useHideOthers`，而且少了 Dialog 那层的 `present` 闸门 —— force-mount 的关闭态面板一直挂在 DOM 里，会把整个应用标成 `aria-hidden="true"`。所以这里固定用 `'trap-focus'`，并且**不能**在开合时切成 `true`：full-modal 与非 modal 是两棵 keyed 子树，翻 `modal` 会整棵重挂载，调用方插槽里的状态全丢。
- 蒙层用 `document.body.style.pointerEvents = 'none'` 锁背景，走的是 `useBodyScrollLock` 的 owner 记账，不是 DismissableLayer 的"谁锁谁认领"。于是面板自己（`:126`）和所有 portal 到 body 的浮层（`@antdv/shadcn-ui` 的 Popover/Select/DropdownMenu/ContextMenu/Menubar/HoverCard 内容组件）都必须带 `data-[state=open]:pointer-events-auto`，否则浮层能看见、点不动。

**业务场景匹配度。** 本仓库的抽屉承载表单编辑、详情长文、偏好设置三类：桌面为主、偶尔窄屏。桌面要的是"五条关闭路径都能被脏数据拦住"，窄屏要的是"单手甩掉"，前者是既有语义（`closeFunc`），后者正是换到 Drawer 白捡的。偏好抽屉这类"顶部切换条固定 + 面板内滚动 + 内嵌浮层取色"的场景，则把上面那个 `pointer-events` 缺口第一次暴露出来。

**版本兼容性。** 不换依赖：Drawer 与 Sheet 都在仓库内 vendor 的 `@antdv/shadcn-ui` 里，底层同为 reka-ui 2.11.0，不需要 vaul 之类的第三方抽屉。对外 API 面零变化——`DrawerProps`、`useDrawer()` 的 `[register, methods]` 与四个方法名原样保留，所以既有调用点一行没改：`apps/web` 里 13 处（弹窗与抽屉示例页 5 处、系统页 8 处，其中角色管理页就占两处），布局的账户抽屉另有 1 处。

**性能表现。** 关闭态默认 `destroyOnHidden: true`，面板根本不挂载；需要保留状态时用 `force-mount`，此时靠 `CLOSED_PANEL_INERT`（`shared/presence.ts`）把关闭态置为 `pointer-events-none` 并让退场动画停在终点（`fill-mode-forwards`），否则那层透明的 `fixed` 面板会吃掉整页点击。开合期间不做重挂载，滚动与输入状态由 DOM 自身保留。

### 仍需按实记录的四点

- **`wrapperFooterOffset` 在抽屉里没人读**：它是弹窗侧的共用 prop（`src/types.ts:38`，`BasicModal.vue:41`、`:246` 会读进 `ModalWrapper` 的 `footer-offset`），而 `DrawerProps`（`drawer/types.ts:8-62`）干脆没声明，也没有 `DrawerWrapperProps` 那样的 wrapper 组件；`ModalWrapper` 那套 `height` / `minHeight` / `footerOffset` 在抽屉里一个都不适用。
- **`helpMessage` 声明了但没渲染**：`drawer/types.ts:13`，`BasicDrawer.vue` 里没有任何引用点。`maskStyle`（`:41`）同样只声明不落地。
- **字符串尺寸会被 `parseInt` 吃掉**：`getSize` 对字符串走 `Number.parseInt(size, 10)`（`:67`、`:75`），所以 `width="40%"` 会变成 `40` 像素。示例页统一给数字，并把这条写在信息条里。
- **`closeDrawer()` 之外的显隐不受 `closeFunc` 约束**：钩子只在 `closeDrawer` 里 `await`（`:144-146`），打开方向没有等价的拦截点。

`useDrawer()` 的返回是 `openDrawer / closeDrawer / setDrawerProps / getVisible`（`useDrawer.ts:40-54`），语义与 `useModal` 完全对称：`waitForInstance` 同样是 10 轮 `nextTick` + 50ms、超时抛 `[useDrawer] Drawer instance not found`（`:26-38`）；`getVisible` 同样同步不等待（`:53`）。`setDrawerProps` 这次是真生效的——它把覆盖值并进 `propOverrides`（`BasicDrawer.vue:156-161`），标题、按钮文案、宽度都会按覆盖值重渲染。

::: warning

`useDrawerInner` 不是「内层专用」 `drawer/index.ts:13-15` 是同一模块的两行导出：

```ts
export { useDrawer } from './useDrawer';
// 与旧实现一致：本仓库的 useDrawerInner 就是 useDrawer 的别名导出
export { useDrawer as useDrawerInner } from './useDrawer';
```

所以 `useDrawerInner(callback)` 的 `callback` **不会被接收也不会被调用**（`useDrawer.ts:10` 的签名没有任何参数）—— 抽屉侧没有 `useModalInner` 那样的数据通道。解构出来的第二个元素实际只有 `openDrawer/closeDrawer/setDrawerProps/getVisible` 四个键，按 `DrawerInnerMethods`（`drawer/types.ts:71-78`）去解构 `changeOkLoading` / `changeLoading` 会得到 `undefined`，调用即 `TypeError`。`BasicDrawer` 确实准备好了含这两个方法的 `innerMethods` 并把它作为 `register` 的载荷发出去（`:165-173`、`:180-189`），但 `useDrawer` 侧只转发四个键（`useDrawer.ts:40-54`），两头还是没接上。示例页第 4 节因此只用 `openDrawer/closeDrawer`。
:::

## 内容区滚动与 loading 遮罩

`BasicModal` 把滚动外包给 `modal/ModalWrapper.vue`，规则很短：

| 条件 | 结果 | 位置 |
| --- | --- | --- |
| `useWrapper: false` | 样式对象为 `{}`，没有高度上限 | `ModalWrapper.vue:19` |
| 传了 `height` | `height: Npx` 固定，`maxHeight`/`minHeight` 全部让路 | `:21-23` |
| 其余情况 | `maxHeight = 视口高 - 200 - footerOffset`，`minHeight` 缺省 `200px` | `:25`、`:27-30` |

外层 `div.modal-wrapper` 是 `relative`（`:37`），loading 时叠一层 `absolute inset-0` 的半透明遮罩 + spinner（`:38-58`），内容包在 shadcn 的 `ScrollArea` 里（`:60-66`，`modal-body h-full p-6`，`type="scroll"`）—— 自绘滚动条，没有开关可以换回浏览器默认那条。窗口尺寸变化由 `useWindowSize` 响应（`:16`），不需要手动重算。

标题区与底部按钮栏在滚动容器**之外**（`BasicModal.vue:206-235` 与 `:255-293`），所以内容滚动时它们固定。抽屉的做法不同：面板自己是 `flex flex-col`（`:117-130` 的 `basic-drawer`），body 是 `drawer-body relative min-h-0 flex-1 overflow-hidden!`（`:333-338`，`useWrapper` 时再加 `p-4`），里面直接放 `ScrollArea class="h-full"`（`:371-373`）；`bodyScroll: false` 时这层 `ScrollArea` 整块不渲染，滚动交给插槽内容（`:374`）。`ModalWrapper` 里那套 `height` / `minHeight` / `footerOffset` 在抽屉里一个都不适用。另外 `ModalWrapperProps` 声明了一个 `visible`（`types.ts:144`），`BasicModal.vue:247` 每次都传，组件内部从不读 —— 想监听显隐请用 `BasicModal` 的 `visible-change` 事件。

## 在线示例：`/components/modal-drawer`

打开方式：`pnpm dev:web` + `pnpm --filter @antdv/backend-mock dev`，访问 `http://localhost:6080/#/components/modal-drawer`（hash 路由），或左侧栏「组件示例 → 弹窗与抽屉」（菜单项 `apps/backend-mock/server/api/menus.get.ts:264-269`，`name: 'DemoModalDrawer'`）。页面共 5 个小节，源码 `apps/web/src/views/components/modal-drawer/index.vue`（760 行）+ 私有子组件 `components/InnerForm.vue`（124 行）；本节所有数据都是本地 `ref`，没有后端请求。

### 1. 基础弹窗（`index.vue:285-381`，逻辑 `:37-99`）

| 点什么 | 看到什么 |
| --- | --- |
| `openModal(true, data) 打开并传数据`（`:292-294`，逻辑 `:49-72`） | 弹出 `InnerForm`：左栏显示父页面发出去的 JSON（`:311-323`），弹窗内部标题下显示「useModalInner 回调第 N 次收到数据」和收到的 JSON（`InnerForm.vue:80-88`）。payload 里带了一个 `onSubmit` 函数（`index.vue:57-64`），证明数据通道原样透传 |
| 弹窗里改字段 → 底部「提交」（`InnerForm.vue:57-61`） | 右栏「弹窗点提交后回传的值」出现 JSON（`index.vue:324-342`），弹窗关闭 —— 关闭顺带把确认按钮的 loading 复位 |
| 底部「重置」（`centerFooter` 插槽，`InnerForm.vue:120-122`） | 表单清空但**弹窗保持打开**（`:63-66`），演示内置按钮栏的插槽位 |
| `closeModal() 关闭`（`:295-297`，逻辑 `:74-77`） | 关掉当前弹窗；没打开时点它会走 `waitForInstance`，实例已在就立刻返回 |
| `getVisible() 查询显隐`（`:298-300`，逻辑 `:79-81`） | 下方「方法返回值」打印时间戳 + `getVisible()` 结果（`:344-349`）—— 注意这个方法是同步的，弹窗还没注册好时只会得到 `false` |
| `setModalProps() 尝试改 props`（`:301-303`，逻辑 `:87-99`） | 弹窗标题改成「标题被 setModalProps 改掉」、确认按钮变成「确认修改」、宽度涨到 640px，日志追加一行覆盖内容（`:350-358`），并弹一条 success message。页面下面把这条与 `changeOkLoading` 的取法一起印成了实测结论（`:360-377`） |

### 2. 弹窗内滚动（`index.vue:383-470`，逻辑 `:101-150`）

| 点什么 | 看到什么 |
| --- | --- |
| `打开固定高度弹窗（:height="360"）`（`:387-389`，弹窗 `:409-440`） | 24 条单选记录只在内容区滚，标题与底部固定；选一条点「提交选择」→ 页面出现「已选择第 N 条」（逻辑 `:129-136`） |
| `打开自适应高度弹窗（minHeight + wrapperFooterOffset）`（`:390-392`，弹窗 `:442-470`） | 最大高度 = 视口 - 200 - 140；点「再追加 12 行」内容继续变长但窗口不超出视口（逻辑 `:147-150`） |
| —— | 上面的信息条（`:394-399`）逐字解释了 `ModalWrapper` 读到的四个 prop 各自作用，与本文表格一致 |

### 3. 抽屉基础与位置（`index.vue:472-600`，逻辑 `:152-195`）

| 点什么 | 看到什么 |
| --- | --- |
| `左侧抽屉 :width="360"`（`:479`，抽屉 `:500-530`） | 从左侧滑出，宽 360；`#footer` 插槽给的是「取消 / 应用」两个按钮（`:522-529`），内置按钮栏整条消失。点「应用」→ 页面蓝色结果块写入密度（逻辑 `:180-184`） |
| `右侧抽屉 :size="520"`（`:480`，抽屉 `:532-568`） | 默认右侧；footer 里再嵌「全选 / 清空」+「取消 / 完成」两组按钮（`:550-567`），演示自定义 footer 怎么排 |
| `底部抽屉 :height="280"`（`:481-483`，抽屉 `:570-600`） | `placement="bottom"` 时 `height` 才生效（`getSize`，`BasicDrawer.vue:61-78`），同时滑动方向换成 `down`（`:87-96`） |
| 每个抽屉的 X / 蒙层 / ESC | 都会走 `closeDrawer()`，因此都受 `closeFunc` 约束 —— 第 5 节专门验证这条 |
| 拖头部 | 按住抽屉头部**空白处**往开口方向甩：过了 40px（或松手时够快）就走滑动关闭，同样归 `closeFunc` 管；起点落在按钮/输入框上时原语不认这个手势 |

### 4. 抽屉内滚动（`index.vue:602-680`，逻辑 `:203-231`）

`打开长内容抽屉`（`:605`）弹出 `:size="560"` 的抽屉（`:631-680`）：外层 16 条条款在 `BasicDrawer` 内置的 `ScrollArea` 里滚（`bodyScroll` 默认为真），标题与底部固定；里面再嵌一个 `@antdv/common-ui` 的 `Scrollbar`（`root-class="h-60"`，即 240px，`:655-668`），通过它的 `@scroll` 事件把 `scrollTop` 写回页面状态（逻辑 `:218-225`，`wrap` 元素来自组件 `defineExpose`，见 `packages/core/ui-kit/common-ui/src/components/scrollbar/Scrollbar.vue:91-96`）。只有滚到底（`scrollTop + clientHeight >= scrollHeight - 4`）才能勾选「我已阅读完附加条款」（`:669-678`），没勾选时抽屉的确认按钮通过 `:ok-button-props="{ disabled: !agreement }"`（`:636`）保持禁用。

::: tip

高度为什么用 `root-class` 而不是 `max-height` 页面文字（`:607-621`）给了原因：`max-height` 属性会被 `Scrollbar` 内部的 `useResponsiveMaxHeight` 以 712px 为下限重新算掉，所以这里用 `root-class="h-60"` 固定高度；同一句里还写了内置那层 `ScrollArea` 可以用 `:body-scroll="false"` 关掉。细节见[数据与展示](/components/display)的滚动一节。
:::

### 5. 嵌套与关闭拦截（`index.vue:683-759`，逻辑 `:233-280`）

`打开可编辑抽屉`（`:690`）弹出带 `textarea` 的草稿抽屉（`:716-742`），`ok-text="保存草稿"`，并挂上 `:close-func="guardCloseDrawer"`（`:721`）。改几个字 → 顶部标签变「有未保存修改」（`isDirty`，`:248`）→ 依次用 **X、蒙层、ESC、底部「关闭抽屉」** 去关：四种路径最后都调用 `closeDrawer()`，`guardCloseDrawer` 被 `await` 且返回 `false`，抽屉不动，拦截计数 +1，同时 `openConfirmModal()` 弹出确认弹窗（逻辑 `:257-266`）。

叠放与放行的真实机制：

- 确认弹窗压在抽屉之上靠的是 `BasicModal` 的 `:z-index="1100"`（`:746`）。抽屉与弹窗默认都不带内联 `zIndex`，跟页面里其他浮层一样落在 shadcn 的 `z-50` 一档（`BasicDrawer.vue:109-113`、`BasicModal.vue:79-83`），只有显式给值才能钉死先后关系。
- 「放弃修改并关闭」先 `closeConfirmModal()` 再 `closeNestDrawer()`（`:275-280`）；第二次进入 `closeDrawer()` 时 `isDirty` 已为假，`guardCloseDrawer` 返回 `true` 才真正放行（`:258-261`）—— 也就是说「放行」不是绕过钩子，而是让钩子的条件先成立。
- 「保存草稿」走 `@ok` → `handleSaveDraft`：先写 `savedDraft` 再 `closeNestDrawer()`（`:268-273`），同理第二次才通过。
- 内容干净时（没改过）关闭不拦截，日志写「内容干净，直接放行」（`:259`）。
- 拦截计数与结果文本都在页面上（`:694`、`:707-712`），没有任何后端参与。

## 轻提示与通知（`message` / `notification`）

同一对入口在 `packages/core/ui-kit/popup-ui/src/message/index.ts`（75 行），底层都是 vue-sonner，签名沿用旧 `message.success/error/info/warning`；负责把它们画出来的那只 `<Toaster />` 是 `@antdv/common-ui` 的主题化外壳（挂在 `apps/web/src/App.vue:87-94`）。

| 入口 | 签名 | 默认停留 |
| --- | --- | --- |
| `message.success` / `.error` / `.info` / `.warning` | `(content: string, duration?: number)` | 3000ms（`MESSAGE_DURATION`，`:32`） |
| `message.loading` | `(content: string)` | 不自动消失（`toast.loading`，`:40`） |
| `notification.success` / `.error` / `.info` / `.warning` | `(content: string, description?: string, duration?: number)` | 8000ms（`NOTIFICATION_DURATION`，`:33`） |
| `toast` | vue-sonner 原样出口（`:75`） | 调用方自己给 |

`duration` 是**位置参数**而不是 options 对象：`message.success('已保存', 5000)`；只有不传时才回落默认值（`duration ?? MESSAGE_DURATION`）。要 sonner 的全部能力（`action`、`cancel`、`promise`、自定义 id）就直接用导出的 `toast`，这两个包装器只是把最常见的两种调用形状钉住。

### 为什么根部要挂**两只** `<Toaster />`

宿主在 `apps/web/src/App.vue:87-94` 挂了两只（`Toaster` 从 `@antdv/common-ui` 导入）：无 `id` 的那只 `position="top-center"` 收 `message.*`，`:id="NOTIFICATION_TOASTER_ID"`（常量值 `'notification'`，`message/index.ts:23`）的那只收 `notification.*`，位置取偏好 `notificationPosition`，并且**只有它开 `close-button`**。

- **不是一只 toaster 给每条 toast 传 `position`**：sonner 同一个位置只维护一个堆栈，轻提示与通知的出场位置、停留时长、堆叠上限是两回事，混进同一只就会互相顶位（一条通知把三条轻提示挤下去）。
- **路由规则**（vue-sonner 2.0.9）：不带 `toasterId` 的 toast 只进**没有 id** 的那只，带了 `toasterId` 的只进同名的那只。所以 `message.*` 一律不传 —— 宿主漏挂通知那只时轻提示仍然可见，反过来也不会串位。
- **轻提示不带关闭按钮**：3 秒自己走，读完即走，多一块可点区域反而与语义相悖；通知会一直停在角落，必须能主动关。

### 配色：底色中性，状态只在徽标上

样式全部收在 `packages/core/ui-kit/common-ui/src/components/toast/Toaster.vue`（201 行），应用侧不需要再配：

- **为什么这层在 common-ui 而不是 `@antdv/shadcn-ui` 的 `Sonner.vue` 里**：shadcn 那只把 `rich-colors` 写死在 `v-bind` 之后（外部传不进来），四枚状态图标也是写死的 `<template #xxx-icon>`（外部传不进去，SFC 不转发插槽）。要在不改它源码的前提下换掉这两样，只能用选择器去赌它内部选了哪几个 lucide 图标，子包一升级就失效。所以样式层自建：底座仍然是 vue-sonner，props 与插槽与它同形（`ToasterProps` 原样透传，`@antdv/shadcn-ui` 一行未动），那边新增/删除/迭代任何组件都波及不到这里。
- 底色/边框/正文走 sonner 的 `--normal-*` 变量组（`:43-48`），值取自 `--app-popover` / `--app-popover-foreground` / `--app-border`，圆角取 `--app-border-radius`。**四种类型共用同一块中性底，不做富色** —— `rich-colors` 会把整块底色换成 `--{type}-bg` 并连带把描述染成彩色，正文对比度当场掉下去。
- 状态体现在左侧那枚 **20px 实色圆徽 + 反白笔画**（`:96-165`）：成功 `bg-success`、信息 `bg-info`、警告 `bg-warning`、错误 `bg-destructive`，色板是刻意与主题预设解耦的语义色（换主色不跟着变）。勾与叉取 `@lucide/vue`，感叹号与信息符手写 path —— lucide 的 `CircleAlert` / `Info` 自带一圈，画进圆底就成了框中框。六档插槽（四类 + loading + close）都写成"具名插槽 + 默认内容"，宿主传同名插槽即可替换，不必改这层源码。
- 微调一律走 `toastOptions.classes` 且**带 `!`**（`:58-63`）：sonner 内置规则是 `[data-sonner-toast][data-styled='true'] [data-icon]` 这类三选择器特异度，不带 important 的工具类压不住。宿主的 `toast-options` 与这组默认值**逐档合并、宿主优先**（`:69-72`），传 `{ duration: 1000 }` 不会顺手把配色整体替换掉。
- 关闭按钮 `border-0! bg-transparent!`，并用 `[data-close-button-position]` 把它从"骑在边框上"收回卡片内侧 8px（`:188-199`）。注意选择器用的是**按钮**的朝向属性，不是 toaster 的 `data-x/y-position`，两者互不跟随；前缀 `.antdv-toaster` 是本包自己的钩子，不依赖 shadcn-ui 的任何类名。
- 层级不用操心：vue-sonner 给 `[data-sonner-toaster]` 钉了 `z-index: 999999999`，而每条 toast 的 `--z-index` 由库内联写成 `toasts.length - index`，在父级设 `--z-index` 会被盖掉 —— 加了等于没加。

::: warning `message/index.ts` 顶部这一段不要动

`:16-20` 依次是「CSS 副作用导入的类型声明说明注释」+ `// oxlint-disable-next-line typescript/triple-slash-reference` + `<reference path="../types/css.d.ts" />` 指令 + `import { toast } from 'vue-sonner'` + `import 'vue-sonner/style.css'`。本包按源码发布，下游看不见 popup-ui 自己的 tsconfig include，那条 `<reference>` 指令是 CSS 副作用导入唯一的类型出口。**它必须是三斜线指令形式（`/// <reference … />`）**：`eslint --fix` 的 `spaced-comment` 规则会把 `///` 顶成带空格的 `// /`，指令随之失效、下游 `vue-tsc` 立刻报 TS2882 —— 当前源码的 `:18` 正是这种被拆开的 `// /` 形式，所以这一段要留在 `--fix` 射程之外。
:::

### 在线示例：`/components/feedback`

侧栏「反馈与交互」：四个 `message.*` 与四个 `notification.*` 各一枚按钮，外加加载提示与「默认 / Promise」两枚（走导出的 `toast`，用来验证无徽标的 `default` 与 pending 阶段的转圈），页面上写明了「点右上角 ✕ 或等 8 秒都会收起」。同一页也是 toast 配色的回归现场（`apps/web/e2e/preference-effects.spec.ts` 按 `--app-popover`、圆徽底色与关闭按钮位移逐项断言）。

## 这页没有的能力

按实际读过的源码说明「不存在」，别按其他组件库模板的文档来找：

- **没有拖拽移动、没有全屏切换**。旧实现里的 `useDragMove` / `useModalFullScreen` / `useModalHeight` 三个 hook 文件已随迁移删掉，`modal/index.ts` 的导出清单里也没有（`modal/index.ts:1-20`）。`ModalProps` 与 `DrawerProps` 里同样没有 `draggable` / `fullscreen` / `canFullscreen` 字段（`types.ts:17-100`、`drawer/types.ts:8-62`）；抽屉这边只有原语自带的**滑动关闭**（`drawer/BasicDrawer.vue:87-96`、`:228-236`），拖拽不会移动面板。
- **没有 `confirmLoading`**：props 定义里不存在这个字段，确认按钮的 loading 由组件内部状态驱动（`BasicModal.vue:154-157`、`BasicDrawer.vue` 同名逻辑），要改只能用 `okButtonProps.disabled` 或内部的 `changeOkLoading`。
- **没有「打开前确认」的钩子**：`closeFunc` 只作用于关闭（`BasicModal.vue:107-110`、`BasicDrawer.vue:144-146`）。
- **没有 Modal 的 `destroyOnHidden` 之外的销毁控制**，也**没有抽屉的数据回调**（见 `useDrawerInner` 一节）。
- **`openModal(false)` / `openDrawer(false)` 不能用来关闭**（`BasicModal.vue:103-105`、`BasicDrawer.vue:140-142` 里 `visible` 为假时什么都不做），要关只能调 `closeModal()` / `closeDrawer()`。

## 相关页面

- [组件示例](/components/) —— 本章目录、示例页打开方式与统一约定
- [表格](/components/table) —— 表格页里用 `BasicModal` 承载新增/编辑时的完整上下文
- [图标指南](/guide/essentials/icons) —— 抽屉/弹窗里 `IconifyIcon` 与离线图标集合
