# Modal and drawer

This page covers exactly one demo route — `/components/modal-drawer` — and the four files behind it: `BasicModal.vue`, `BasicDrawer.vue`, `ModalWrapper.vue` and their `useXxx` handles. Afterwards you should be able to answer three things: **what these wrappers add on top of antdv-next's `Modal`/`Drawer`**, **how the data passed to `openModal(true, data)` actually reaches a child component**, and **which looks-usable methods are in fact empty**.

::: warning Three conclusions worth memorising

1. `setModalProps` / `setDrawerProps` are **silent no-ops** (`apps/web/src/components/business/Modal/BasicModal.vue:100-102`, `apps/web/src/components/business/Drawer/BasicDrawer.vue:113-115`).
2. `changeOkLoading` / `changeLoading` **have no reachable implementation** — the modal's internal `_innerMethods` is never handed out (`Modal/BasicModal.vue:107-115` versus `:118`).
3. `useDrawerInner` is **only an alias export of `useDrawer`** (`Drawer/index.ts:20`), not a second "inner-component" implementation.

Every claim below cites the behaviour code; do not copy those three into product code as working APIs. :::

## What problem they solve

| Wrapper | What it adds over raw antdv-next | Source |
| --- | --- | --- |
| `BasicModal` | Own header (with a title-tip slot and a self-drawn close button), own footer with four slots, body wrapped in a `ModalWrapper` that provides scrolling and a loading overlay | `Modal/BasicModal.vue:191-212` (header), `:215-226` (body), `:229-264` (footer) |
| `BasicDrawer` | Same header/footer structure, but the body embeds `Scrollbar` directly and skips `ModalWrapper` | `Drawer/BasicDrawer.vue:207-228`, `:262-264` |
| `useModal` / `useDrawer` | Turns opening and closing into imperative handles: the parent keeps no `open` ref and needs no `v-model` | `Modal/useModal.ts:37-51`, `Drawer/useDrawer.ts:43-57` |
| `useModalInner` | Lets the component _inside_ a modal receive the `data` passed by `openModal(true, data)` | `Modal/useModalInner.ts:36-50` |

Both wrappers switch antd's own header and footer off (`:title="null"` + `:footer="null"` + `:closable="false"`, see `Modal/BasicModal.vue:172-176` and `Drawer/BasicDrawer.vue:186-189,194`) and draw their own. **Consequently antd's `confirmLoading`, `closeIcon` and `footer` slot have no effect here** — and neither `ModalProps` nor `DrawerProps` even declares a `confirmLoading` field (`Modal/types.ts:8-87`, `Drawer/types.ts:13-96`). The OK button's loading is internal state; see "The OK button loading can only be reset by closing".

## The handle registration mechanism (read this before the API)

`BasicModal` emits its method object **one macrotask after mount**:

```ts
// Modal/BasicModal.vue:117-125
const { start: scheduleRegister } = useTimeoutFn(
  () => emit('register', modalMethods),
  0,
  { immediate: false },
);
onMounted(() => scheduleRegister());
```

`BasicDrawer` is identical (`Drawer/BasicDrawer.vue:135-144`). `useModal()` stores the emitted object in a ref and **waits for it at call time**:

```ts
// Modal/useModal.ts:22-35
const waitForInstance = async (): Promise<ModalMethods> => {
  if (modalInstance.value) return modalInstance.value;
  for (let i = 0; i < 10; i++) {
    // nextTick + delay(50) per round
    await nextTick();
    if (modalInstance.value) return modalInstance.value;
    await delay(50);
  }
  throw new Error('[useModal] Modal instance not found. ...');
};
```

Four **actual behaviours** follow from this, and they matter more than the type definitions:

- `openModal` / `closeModal` / `setModalProps` are `async` (`useModal.ts:38-49`; drawer equivalent `useDrawer.ts:44-55`). The wait is capped at roughly 10 `nextTick` rounds plus 500ms, and on timeout it **throws** rather than returning quietly — forget to `await` and the error becomes an unhandled rejection.
- `getVisible()` is synchronous and **does not wait**: `useModal.ts:50` (`modalInstance.value?.getVisible() || false`). Called before registration it always returns `false`.
- The unmount cleanup is registered on the caller's setup (`useModal.ts:14-16`, `useDrawer.ts:21-23`). The source comment explains why: `register` runs as a child `emit` callback, where `currentInstance` is already gone, so a hook registered there only warns and never attaches (`useDrawer.ts:12-20`).
- The stored reference is reused, so registering a second modal against the same handle **overwrites the first** (`useModal.ts:18-20`).

### The data channel: only a child that registered `useModalInner` receives it

The second parameter of `BasicModal.openModal(visible, data)` is **discarded inside the component** — `Modal/BasicModal.vue:82-88` only sets `visibleRef.value = true` and emits; `data` is never stored. The channel works solely because `useModalInner` **monkey-patches `openModal` on the very same instance object** while registering:

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
      originalOpenModal(visible, data); // ← data is consumed here
    };
  }
};
```

Because the outer `useModal` keeps the **same object reference**, its `instance.openModal(...)` call resolves to the patched function (`useModal.ts:38-41`), so a parent's `openModal(true, data)` enters the child callback first. A single `register` emit can feed both registrations thanks to attribute forwarding: `InnerForm` does not declare a `register` emit, so the parent's listener stays in `$attrs` and is forwarded to `BasicModal` via `v-bind="$attrs"` (`views/components/modal-drawer/components/InnerForm.vue:71`, mechanism described in the comment at `:12-23`); `inheritAttrs: false` (`:24`) exists so the default single-root forwarding does not call `onRegister` twice.

::: tip When you do not need useModalInner If the modal body is written directly in the page template (demo sections 2, 3 and 5), there is no child component at all and nobody can receive `data` — read the page's own `ref`s instead. The demo prints this in its info alert (`modal-drawer/index.vue:259-264`). :::

## BasicModal API

### Props (only the ones actually read)

Defaults come from the `withDefaults` call at `Modal/BasicModal.vue:14-29`; the behaviour column cites where each prop is consumed.

| prop | default | What it really does / where |
| --- | --- | --- |
| `open` | none (`undefined`) | The only prop that drives visibility: `watch(() => props.open, ...)` with `immediate: true` (`:127-133`); `v-model:open` works (emits `update:open` at `:36,86,98`). Note that `ref(props.visible |  | false)`at`:53`reads a`visible`key **that is not in`ModalProps`** (`types.ts:8-87`declares only`open`), so it is always `undefined` and the watcher above is what actually opens the modal |
| `title` | none | Rendered in the custom header (`:194-196`) and interpolated into the close button's `aria-label` (`:205`) |
| `width` | none → `'520px'` | `getWidth` falls back to `'520px'` (`:58-60`) and is bound to antd's `:width` |
| `height` | none | Fixed body height in px; short-circuits the max/min height logic (`ModalWrapper.vue:30-32`) |
| `minHeight` | none | Body min height; `200px` when absent (`ModalWrapper.vue:38`) |
| `wrapperFooterOffset` | `0` | Subtracted from the computed max height (`ModalWrapper.vue:34`) |
| `useWrapper` | `true` | With `false`, `wrapperStyle` returns `{}`: **no height cap and no internal scrolling** (`ModalWrapper.vue:28`) |
| `loading` | none | Seeds `loadingRef` (`:55`) and drives the body overlay (`:216`) |
| `loadingTip` | none | Text under the spinner in the overlay (`ModalWrapper.vue:64-66`) |
| `centered` | **`true`** | Passed through (`:174`). The comment at `Modal/types.ts:25-26` claims "default false", which contradicts the code |
| `showFooter` | `true` | Combined with `slots.footer` and `showCancelBtn/showOkBtn` to decide whether the default footer renders (`:230`) |
| `showCancelBtn` / `showOkBtn` | `true` / `true` | Per-button switches (`:235`, `:246`) |
| `cancelText` / `okText` | `'关闭'` ("Close") / `'保存'` ("Save") | Button labels (`:242`, `:255`) |
| `okType` | none → `'primary'` | `okType \|\| 'primary'` in the template (`:247`) |
| `okButtonProps` / `cancelButtonProps` | none | `v-bind` onto each `Button` (`:249`, `:236`); **this is how you disable the OK button** |
| `closable` | `true` | Only decides whether the self-drawn X renders (`:202`); antd's `:closable` is hardcoded `false` (`:176`) |
| `maskClosable` / `keyboard` | `true` / `true` | Passed through (`:178-179`), but see the warning below — they buy no behaviour |
| `mask` | `true` | Passed through (`:181`) |
| `maskStyle` / `dialogStyle` | none | Passed through (`:182-183`) |
| `bodyStyle` | none | Merged into antd's `styles.body`, overriding `padding: 0` (`:67-78`) |
| `zIndex` | `1000` | Passed through (`:180`); the nesting demo relies on it |
| `wrapClassName` | none | Concatenated with the fixed `basic-modal` class (`:63-65`) |
| `destroyOnHidden` | **`true`** | Passed through (`:184`). `Modal/types.ts:59` says "default false" — the code says otherwise |
| `closeFunc` | none | Awaited inside `closeModal()`; a falsy result aborts the close (`:89-93`) |

`ModalProps` additionally declares **`helpMessage` (`types.ts:13-14`) and `afterClose` (`:76-77`), which the component never reads**, plus the function-shaped `onOk` / `onCancel` / `'onVisible-change'` / `'onUpdate:open'` fields (`:79-86`) that merely duplicate `defineEmits` (`:31-37`).

::: warning A mask click and ESC cannot close a Modal antd's `cancel` event is typed `(e: MouseEvent | KeyboardEvent) => void` (`node_modules/.../antdv-next/dist/modal/interface.d.ts:121`; the runtime really passes the event — `dist/modal/Modal.js:61-66`), yet `BasicModal` binds it to a handler that treats the argument as a boolean:

```ts
// Modal/BasicModal.vue:146-150,188
function handleVisibleChange(visible: boolean) {
  if (!visible) {
    handleCancel();
  } // ← receives an event object: always truthy
}
```

Result: **clicking the mask or pressing ESC leaves the modal open** (`:open` is controlled, so antd will not close it on its own). The only working paths are the self-drawn X (`:206` → `handleCancel`), the footer cancel button (`:237`) and an external `closeModal()`. `maskClosable` and `keyboard` therefore reach antd but produce no behaviour in this wrapper. `BasicDrawer` is different: it binds `@close="handleCancel"` (`Drawer/BasicDrawer.vue:204,160-163`), so a drawer's mask / ESC / X / cancel button **all end up in `closeDrawer()` and all obey `closeFunc`** — demo section 5 exercises exactly that chain. :::

### Events

| event | payload | fired by |
| --- | --- | --- |
| `register` | `ModalMethods` | Deferred emit after mount (`:117-125`), consumed by `useModal` |
| `ok` | `MouseEvent` | OK button click (`:136-139`); also flips the internal OK loading on |
| `cancel` | `MouseEvent` | X button and cancel button (`:141-144`) |
| `visible-change` | `boolean` | Inside `openModal`/`closeModal` (`:85,97`) |
| `update:open` | `boolean` | Same places (`:86,98`), which is what makes `v-model:open` work |

### Slots

`titleTip` (right of the title, `:197`), default slot (body, `:225`), `insertFooter` / `centerFooter` / `appendFooter` (inside the default footer, `:233,244,257`), and `footer` — **providing `footer` replaces the whole default button bar** (`:259-264`, mutually exclusive with the condition at `:230`).

### Instance methods (`ModalMethods`)

| method | declared | real behaviour |
| --- | --- | --- |
| `openModal(visible = true, data?)` | `types.ts:93-94` | Only opens when `visible` is truthy — **passing `false` does nothing at all** (`BasicModal.vue:82-88`); see above for `data` |
| `closeModal()` | `types.ts:95-96` | Awaits `props.closeFunc()` first and returns early on a falsy result; otherwise resets `okLoadingRef`/`loadingRef` and emits (`:89-99`) |
| `getVisible()` | `types.ts:99-100` | Reads the internal `visibleRef` (`:103`) |
| `setModalProps(partial)` | `types.ts:97-98` | **No-op**: `Object.assign(props, newProps)` writes to readonly props (`:100-102`); DEV logs a readonly warning, and title / labels / width stay as they were |

::: warning The OK button loading can only be reset by closing `handleOk` unconditionally sets `okLoadingRef = true` (`:136-137`) and the only reset is inside `closeModal()` (`:95`). `changeOkLoading` is declared in `ModalInnerMethods` (`types.ts:111-114`) and returned by `useModalInner` (`useModalInner.ts:62-67`), but `BasicModal` emits **`modalMethods`, which does not contain it** (`:118`, versus the `innerMethods` built at `:107-115` and never handed out). `useModalInner.ts:63` uses optional chaining (`modalInstance.value?.changeOkLoading?.(loading)`), so the call **neither throws nor does anything**. Practical consequence: if your `@ok` handler decides to keep the modal open (validation failure, for instance), the OK button spins forever and only closing resets it — every submit path in the demo closes, and the page states that precondition out loud (`modal-drawer/index.vue:304-314`). :::

## BasicDrawer API

Defaults are at `Drawer/BasicDrawer.vue:12-26`. Props shared with `BasicModal` (`title`/`showFooter`/`showCancelBtn`/`showOkBtn`/`cancelText`/`okText`/`okType`/`okButtonProps`/`cancelButtonProps`/`closable`/`maskClosable`/`keyboard`/`mask`/`maskStyle`/`bodyStyle`/`wrapClassName`/`zIndex`/`destroyOnHidden`/`loading`/`loadingTip`/`closeFunc`) behave the same way, with the code now at `:184-302`; only the differences are listed here.

| prop | default | Difference |
| --- | --- | --- |
| `placement` | `'right'` | Decides whether `size` means width or height (`:48-64`) |
| `size` | none | The recommended prop; fallback `520` for left/right, `400` for top/bottom (`:54`, `:61`) |
| `width` | none | Used as the `size` fallback when placement is left/right (`:50`) |
| `height` | none | Used as the `size` fallback when placement is top/bottom (`:57`) |
| `useWrapper` | `true` | In a drawer it **only toggles `p-4` on the body** (`:71-76`) — there is no height logic at all |
| `open` | none | Still reads `props.open` (`:43,146-152`) |

::: warning The drawer's v-model direction is broken `BasicDrawer` reads `props.open` (`:43`, `:146-152`) but emits `update:visible` (`:33,99,111`), and `DrawerProps` declares only `open` (`types.ts:14-15`). So `v-model:visible` cannot bind (there is no `visible` prop — it falls into attrs), and `v-model:open` only flows one way (no `update:open` is ever emitted). **Two usages are reliable**: the imperative `@register` + `useDrawer()` handle, or `:open="x"` plus your own `@update:visible` write-back. The demo uses the former everywhere. :::

Three further points, stated as the code stands:

- **`wrapperFooterOffset` is never read by the drawer**: declared at `Drawer/types.ts:33-34`, absent from `BasicDrawer.vue`'s defaults and template (contrast with `Modal/BasicModal.vue:25,220`). Same for `helpMessage` (`types.ts:19`), `afterClose` (`:86`) and the whole `DrawerWrapperProps` interface (`:145-152` — there is no drawer wrapper component).
- **String sizes get `parseInt`ed**: `getSize` runs `Number.parseInt(size, 10)` on strings (`:52`, `:59`), so `width="40%"` becomes 40 **pixels**. The demo passes numbers only and says so in its info alert (`modal-drawer/index.vue:416-421`).
- **`closeFunc` guards closing, nothing else**: it is awaited only inside `closeDrawer` (`:102-106`); the open path has no equivalent hook.

`useDrawer()` returns `openDrawer / closeDrawer / setDrawerProps / getVisible` (`useDrawer.ts:43-57`) and mirrors `useModal` exactly: `waitForInstance` is the same 10 rounds of `nextTick` + 50ms and throws `[useDrawer] Drawer instance not found` on timeout (`:29-41`); `getVisible` is synchronous again (`:56`); `setDrawerProps` is the same `Object.assign(props, ...)` no-op (`BasicDrawer.vue:113-115`).

::: warning useDrawerInner is not an "inner" hook `Drawer/index.ts:19-20` exports the same module twice:

```ts
export { useDrawer } from './useDrawer';
export { useDrawer as useDrawerInner } from './useDrawer';
```

So the `callback` argument of `useDrawerInner(callback)` **is neither accepted nor invoked** (`useDrawer.ts:9` takes no parameters) — the drawer side has no data channel comparable to `useModalInner`. The second element really contains only `openDrawer/closeDrawer/setDrawerProps/getVisible`; destructuring `changeOkLoading` / `changeLoading` off it (as `DrawerInnerMethods`, `types.ts:115-124` invites you to) yields `undefined` and calling it throws a `TypeError`. `BasicDrawer` does build a `_innerMethods` containing those two methods (`:120-128`), but it only puts it on `defineExpose` (`:131-134`) while `register` emits `drawerMethods` (`:136`) — the two ends never meet. Demo section 4 therefore uses only `openDrawer/closeDrawer` (`modal-drawer/index.vue:165-171`). :::

## Body scrolling and the loading overlay

`BasicModal` delegates scrolling to `Modal/components/ModalWrapper.vue`; the rules are short:

| condition | result | where |
| --- | --- | --- |
| `useWrapper: false` | style object is `{}`, no height cap | `ModalWrapper.vue:28` |
| `height` given | `height: Npx` wins, `maxHeight`/`minHeight` step aside | `:30-32` |
| otherwise | `maxHeight = viewport height - 200 - footerOffset`, `minHeight` defaults to `200px` | `:34,38` |

The outer `div.modal-wrapper` is `relative`, and while `loading` an `absolute inset-0` translucent overlay with a spinner is layered on top (`:47-68`); the content always sits inside `@antdv/scrollbar-ui`'s `Scrollbar` (`:71-77`, with `p-6` padding), whose `native` flag comes from `projectConfig.scrollbar?.native` (`:4`, `:73`) — set it to `true` to fall back to the browser scrollbar. Viewport changes are picked up by `useWindowSize` (`:26`), so no manual recalculation is needed.

The header and footer live **outside** the scroll container (`BasicModal.vue:191-212` and `:229-264`), so they stay put while the body scrolls. The drawer solves it differently: the body is `h-full min-h-0 overflow-hidden` wrapping `Scrollbar root-class="h-full"` (`BasicDrawer.vue:231-236,262-264`), with `:deep(.ant-drawer-content)` turning the panel into a flex column (`:306-318`). None of `ModalWrapper`'s `height` / `minHeight` / `footerOffset` apply to drawers. `ModalWrapper` also declares a `visible` prop it never reads (`:17`).

## Live example: `/components/modal-drawer`

How to open it: `pnpm dev:web` + `pnpm dev:mock`, then visit `http://localhost:6080/#/components/modal-drawer` (hash routing), or the sidebar group "组件示例 → 弹窗与抽屉" ("Examples → Modal and drawer", menu entry `menus.get.ts:257-262`, `name: 'DemoModalDrawer'`). The page has five sections; sources are `apps/web/src/views/components/modal-drawer/index.vue` (667 lines) plus the private child `components/InnerForm.vue`. All data in this section is local `ref`s — no backend request is involved.

### 1. Basic modal (`index.vue:243-316`, logic `:25-83`)

| Click | You see |
| --- | --- |
| `openModal(true, data) 打开并传数据` (open with data) — `:246-248`, logic `:39-58` | `InnerForm` opens: the left column prints the JSON the page sent (`:266-273`), and inside the dialog a banner reads "useModalInner callback received data, attempt N" with the received JSON (`InnerForm.vue:80-88`). The payload carries an `onSubmit` **function** (`index.vue:47-54`), proving the channel forwards objects untouched |
| Edit a field, then the footer's 提交 (Submit) (`InnerForm.vue:57-61`) | The right column shows the returned JSON (`index.vue:276-288`) and the modal closes — closing is what resets the OK button loading |
| 重置 (Reset) in the footer (`centerFooter` slot, `InnerForm.vue:118-122`) | The form clears but **the modal stays open** (`:63-66`); demonstrates the built-in footer slot |
| `closeModal() 关闭` (`:249-251`, logic `:60-63`) | Closes the current modal; if nothing is open the call still goes through `waitForInstance` and returns immediately once the instance exists |
| `getVisible() 查询显隐` (`:252-254`, logic `:65-67`) | The line below prints a timestamp plus `getVisible()` (`:291-293`) — remember it is synchronous, so before registration it can only report `false` |
| `setModalProps() 尝试改 props` (`:255-257`, logic `:75-83`) | A log line is added saying it was dispatched "but title, button and width did not change", plus a warning message. **This is the live evidence of the no-op**, and the page prints the conclusion under the buttons (`:304-314`) |

### 2. Scrolling inside a modal (`index.vue:321-400`, logic `:85-129`)

| Click | You see |
| --- | --- |
| `打开固定高度弹窗（:height="360"）` (fixed height) — `:324-326`, modal `:346-373` | 24 radio rows scroll inside the body only; header and footer stay fixed. Pick one and press 提交选择 (Submit selection) → the page reports "已选择第 N 条" (logic `:108-115`) |
| `打开自适应高度弹窗（minHeight + wrapperFooterOffset）` — `:327-329`, modal `:375-400` | Max height = viewport − 200 − 140; each click on 再追加 12 行 (append 12 rows) grows the content without the dialog exceeding the viewport (logic `:117-129`) |
| —— | The info alert above (`:331-336`) walks through the four props `ModalWrapper` reads, matching the table in this page |

### 3. Drawer basics and placement (`index.vue:403-523`, logic `:131-161`)

| Click | You see |
| --- | --- |
| `左侧抽屉 :width="360"` (`:406-408`, drawer `:431-460`) | Slides in from the left at 360px; `#footer` supplies 取消 / 应用 (Cancel / Apply) (`:450-459`), replacing the built-in bar entirely. 应用 writes the density into the page's blue result block (logic `:146-150`) |
| `右侧抽屉 :size="520"` (`:409-411`, drawer `:462-494`) | Default placement; its footer nests a "全选 / 清空" group plus "取消 / 完成" (`:474-493`) |
| `底部抽屉 :height="280"` (`:412-414`, drawer `:496-523`) | `height` only takes effect with `placement="bottom"` (`getSize`, `BasicDrawer.vue:56-62`) |
| Each drawer's X / mask / ESC | All route into `closeDrawer()` and are therefore subject to `closeFunc` — section 5 verifies this |

### 4. Scrolling inside a drawer (`index.vue:526-599`, logic `:163-195`)

`打开长内容抽屉` (`:529-531`) opens a `:size="560"` drawer (`:553-599`): the 16 outer clauses scroll inside `BasicDrawer`'s built-in `Scrollbar` while header and footer stay fixed; nested inside is a second `@antdv/scrollbar-ui` `Scrollbar` with `root-class="h-60"` (240px, `:577-580`) whose `@scroll` event feeds `scrollTop` back into page state (logic `:183-189`; the `wrap` element comes from the component's `defineExpose`, see `packages/ui-kit/scrollbar-ui/src/Scrollbar.vue:257-258`). Only after reaching the bottom (`scrollTop + clientHeight >= scrollHeight - 4`) can the "我已阅读完附加条款" checkbox be enabled (`:591-597`), and while it is unchecked the drawer's OK button stays disabled through `:ok-button-props="{ disabled: !agreement }"` (`:558`).

::: tip Why the height uses root-class instead of max-height The page text (`:540-543`) gives the reason: the `max-height` prop gets recomputed by `Scrollbar`'s internal `useResponsiveMaxHeight` with a 712px floor, so the demo pins the height with `root-class="h-60"`. Details are in the scrolling section of [Data and display](/en/components/display). :::

### 5. Nesting and close interception (`index.vue:602-665`, logic `:196-237`)

`打开可编辑抽屉` (`:605-607`) opens the draft drawer with a `textarea` (`:630-650`), `ok-text="保存草稿"` and `:close-func="guardCloseDrawer"` (`:635`). Change a few characters → the tag flips to "有未保存修改" (`isDirty`, `:205`) → try closing with the **X, the mask, ESC and the footer's 关闭抽屉**: all four paths end in `closeDrawer()`, `guardCloseDrawer` is awaited and returns `false`, so the drawer stays put, the interception counter increments, and `openConfirmModal()` raises the confirmation dialog (logic `:214-223`).

How the stacking and the eventual release actually work:

- The confirmation dialog sits above the drawer purely because of `BasicModal`'s `:z-index="1100"` (`:654`) against the drawer's default `1000` (`BasicDrawer.vue:25`).
- "放弃修改并关闭" calls `closeConfirmModal()` then `closeNestDrawer()` (`:232-237`); on the second entry into `closeDrawer()` `isDirty` is already false, so `guardCloseDrawer` returns `true` and the close proceeds (`:215-218`) — releasing a close never bypasses the hook, it makes the hook's condition pass.
- "保存草稿" arrives through `@ok` → `handleSaveDraft`, which writes `savedDraft` before `closeNestDrawer()` (`:225-230`); same mechanism.
- With clean content (nothing edited) closing is not intercepted, and the log reads "内容干净，直接放行" (`:216-217`).
- The counter and result lines are all rendered in the page (`:608-611`, `:621-626`); no backend participates.

## What this page does not have

Stated from the code that was actually read — do not go looking for capabilities other templates document:

- **No dragging, no fullscreen.** `Modal/hooks/useDragMove.ts`, `useModalFullScreen.ts` and `useModalHeight.ts` exist, but nothing in the repository imports them and `Modal/index.ts` does not re-export them (the complete export list is `Modal/index.ts:1-19`). `ModalProps` has no `draggable` / `fullscreen` / `canFullscreen` field either (`types.ts:8-87`).
- **No `confirmLoading`.** The field does not exist in these props definitions, and antd's footer path is cut off by `:footer="null"` (`BasicModal.vue:173`).
- **No "confirm before opening" hook.** `closeFunc` guards closing only (`BasicModal.vue:89-93`, `BasicDrawer.vue:102-106`).
- **No data callback for drawers** (see the `useDrawerInner` warning) and **no extra destroy control** beyond `destroyOnHidden`.
- **`openModal(false)` does not close anything** (`BasicModal.vue:82-88` does nothing when `visible` is falsy); use `closeModal()`.

## Related

- [Component Examples](/en/components/) — chapter index, how to open demos, shared conventions
- [Table](/en/components/table) — where `BasicModal` carries create/edit dialogs in a real page
- [Icon guide](/en/guide/essentials/icons) — `IconifyIcon` and the offline icon set used inside these dialogs
