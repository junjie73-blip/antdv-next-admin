# Modal and drawer

This page covers exactly one demo route — `/components/modal-drawer` — and the files behind it: `BasicModal.vue`, `BasicDrawer.vue`, `ModalWrapper.vue` and their `useXxx` handles. Afterwards you should be able to answer three things: **what these wrappers add on top of using `@antdv/shadcn-ui`'s Dialog / Drawer primitives directly**, **how the data passed to `openModal(true, data)` actually flows into a child component**, and **which props are declared but have no place to land**.

::: warning Three conclusions to remember first

1. `setModalProps` / `setDrawerProps` **genuinely work**: the implementation does not write to the readonly props handed out by `defineProps`; it merges the overrides into an internal `propOverrides`, and rendering reads `merged` everywhere (`modal/BasicModal.vue:70-71`, `:118-122`; `drawer/BasicDrawer.vue:57-58`, `:156-161`).
2. `ModalProps` / `DrawerProps` contain fields that are **declared but never read by the components**: `helpMessage`, `maskStyle`, plus `bodyStyle` on the modal side (see the two props tables below).
3. `useDrawerInner` **is only an alias export of `useDrawer`** (`drawer/index.ts:13-15`), not a second "inner-component" implementation; the drawer side has no data channel, only `useModalInner` does.

Every section below cites the behaviour code; do not copy the fields from item 2 into product code as if they were API.
:::

## What problem they solve

| Wrapper | What it adds over the raw primitives | Source |
| --- | --- | --- |
| `BasicModal` | Ships its own header (with a right-side slot and a self-drawn close button), its own footer button bar with four slots, and wraps the content in a `ModalWrapper` that provides scrolling and a loading overlay | `modal/BasicModal.vue:206-235` (header), `:241-252` (content), `:255-293` (footer) |
| `BasicDrawer` | The same header/footer structure, but the body embeds `ScrollArea` directly and never goes through `ModalWrapper` | `drawer/BasicDrawer.vue:283-327`, `:333-375`, `:378-418` |
| `useModal` / `useDrawer` | Turns "open a modal" into imperative handles: the parent maintains no `open` ref and needs no `v-model` | `modal/useModal.ts:41-55`, `drawer/useDrawer.ts:40-54` |
| `useModalInner` | Lets the component inside a modal receive the `data` passed by `openModal(true, data)` | `modal/useModalInner.ts:38-52` |

Both wrappers disable the primitive's own close button and redraw the header themselves (`:show-close-button="false"` at `BasicModal.vue:199`; the drawer draws its entire header at `:283-327`), and the footer button bar works the same way. **So none of the primitive's — or the old antd's — `confirmLoading`, `closeIcon`, `footer` behaviour applies here** — and this repository's `ModalProps`/`DrawerProps` do not even declare a `confirmLoading` field (`types.ts:17-100`, `drawer/types.ts:8-62`). The OK button's loading runs on component-internal state; see "The OK button loading" further down.

## The handle registration mechanism (read this before the API)

`BasicModal` emits its method object **one macrotask after mount**:

```ts
// modal/BasicModal.vue:136-144
const { start: scheduleRegister } = useTimeoutFn(
  () => emit('register', innerMethods),
  0,
  { immediate: false },
);
onMounted(() => scheduleRegister());
```

`BasicDrawer` is identical (`drawer/BasicDrawer.vue:180-189`). The parent's `useModal()` stores the emitted functions as an instance reference and **waits at call time**:

```ts
// modal/useModal.ts:26-39
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

Four **actual behaviours** follow from this, and they matter more than the type definitions when you write product code:

- `openModal` / `closeModal` / `setModalProps` are `async` (`useModal.ts:42-53`; drawer equivalent `useDrawer.ts:41-52`). The wait is capped at roughly 10 `nextTick` rounds plus 500ms, and on timeout it **throws** instead of returning quietly — so forgetting to `await` turns the error into an unhandled rejection.
- `getVisible()` is synchronous and **does not wait**: `useModal.ts:54` (`modalInstance.value?.getVisible() || false`). Called before `register` it always yields `false`.
- The unmount hook is registered on the caller's setup (`useModal.ts:18-20`, `useDrawer.ts:18-20`). The source comment records the reason: `register` is a callback emitted by the child component, at which point `currentInstance` is no longer available, so a hook registered inside that callback only warns and never attaches (`useDrawer.ts:13-17`).
- An existing instance reference is reused, so opening two modal components through the same handle means **the later registration overwrites the earlier one** (`useModal.ts:22-24`).

### The data channel: only a child that registered `useModalInner` receives it

The second parameter of `BasicModal.openModal(visible, data)` is **dropped inside the component** — `modal/BasicModal.vue:103-105` only calls `setVisible(true)` and `data` is never stored anywhere. The data reaches the child solely because `useModalInner` **rewrites `openModal` in place on that same instance object** while registering:

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
      originalOpenModal(visible, data); // ← data is consumed here
    };
  }
};
```

Because the outer `useModal` keeps the **same object reference**, its `instance.openModal(...)` call resolves to the wrapped version (`useModal.ts:42-45`), so a parent page's `openModal(true, data)` enters the child callback first. Two registrations can be fed by a single `register` emit thanks to attribute forwarding: in the demo `InnerForm` does not declare a `register` emit, so the parent's listener stays in `$attrs` and `v-bind="$attrs"` passes it on to `BasicModal` (`views/components/modal-drawer/components/InnerForm.vue:71`, mechanism explained in the comment at `:7-21`); `inheritAttrs: false` (`:22`) exists so the default single-root forwarding does not call `onRegister` twice.

::: tip

When you do not need useModalInner Modal content written directly in the page template (demo sections 2, 3 and 5 work that way) has no child component at all, so nobody can receive `data` — read the page's own `ref`s instead. The demo page prints this sentence in its info bar (`modal-drawer/index.vue:305-310`).
:::

## BasicModal API

### Props (only the ones **actually read**)

Defaults come from the `withDefaults` call at `modal/BasicModal.vue:30-44`; the behaviour column cites where each prop is read.

| prop | default | What it really does / where |
| --- | --- | --- |
| `open` | none (`undefined`) | The only prop that can drive visibility: `watch(() => props.open, ...)` with `immediate: true` (`:146-152`); `v-model:open` writes back (emits `update:open` at `:50`, `:99`) |
| `title` | none | The title in the self-drawn header (`:213-217`), also interpolated into the close button's `aria-label` (`:229`) |
| `width` | none → `'520px'` | `getWidth` falls back to `'520px'` (`:73-77`), numbers are treated as px, and it goes into the panel's inline style (`:80`) |
| `height` | none | Fixed content height (px); handed to `ModalWrapper`, which short-circuits the max-height logic (`ModalWrapper.vue:21-23`) |
| `minHeight` | none | Content min height; `200px` when absent (`ModalWrapper.vue:29`) |
| `wrapperFooterOffset` | `0` | Pixels subtracted on top of the max height (`BasicModal.vue:41`, `:246` → `ModalWrapper.vue:25`) |
| `useWrapper` | `true` | With `false`, `wrapperStyle` returns `{}` outright: **no height cap and no internal scrolling** (`ModalWrapper.vue:19`) |
| `centered` | **`true`** | With `false` the panel switches to `!top-20 translate-y-0` and the enter animation is turned off (`:89-91`). Note that the comment at `types.ts:34-35` says "default true", which agrees with the code, but the value really does live in the `withDefaults` at `:40` |
| `loading` | none | Seeds `loadingRef` (`:67`) and drives the content overlay (`:242`) |
| `loadingTip` | none | The text under the spinner in the overlay (`:243` → `ModalWrapper.vue:54-56`) |
| `showFooter` | `true` | Together with `slots.footer` and `showCancelBtn/showOkBtn` decides whether the default button bar renders (`:256`) |
| `showCancelBtn` / `showOkBtn` | `true` / `true` | Each button's own switch (`:265`, `:276`) |
| `cancelText` / `okText` | `'关闭'` / `'保存'` ("Close" / "Save") | Button labels (`:272`, `:284`) |
| `okType` | none → `'primary'` | `resolvePopupButton` maps `okType ?? 'primary'` onto shadcn's `variant` (`:185-187`, `shared/button.ts`) |
| `okButtonProps` / `cancelButtonProps` | none | Same path — `disabled` / `loading` / `class` / `type` all come from here (`:266-268`, `:277-279`) |
| `closable` | `true` | Controls whether the self-drawn X renders (`:222`), **and it also decides whether a mask click can close** (`:175`) |
| `maskClosable` / `keyboard` | `true` / `true` | Gate the mask (`:175`) and ESC (`:181`) — two separate close paths |
| `mask` | `true` | Passed to the primitive as `:modal` (`:194`) — with `false` no overlay is rendered and background scrolling is no longer locked |
| `dialogStyle` | none | Merged into the panel's inline style (`:82`) |
| `zIndex` | none (i.e. `z-50`) | Only written into the inline style when passed explicitly (`:81`); nesting relies on it — see demo section 5 |
| `wrapClassName` | none | Appended to the panel class; the fixed class name is `basic-modal` (`:87`, `:92`) |
| `destroyOnHidden` | **`true`** | Maps to the primitive's `:force-mount="!destroyOnHidden"` (`:198`); when a closed panel stays mounted, `CLOSED_PANEL_INERT` absorbs its clicks (`:88`) |
| `closeFunc` | none | Awaited inside `closeModal()`; a falsy return keeps the modal open (`:107-110`) |
| `afterClose` | none | Called at the end of the close sequence (`:116`); the same field name as in `DrawerProps` |

`ModalProps` additionally declares **three fields the component never reads**: `helpMessage` (`types.ts:23`), `maskStyle` (`:82`) and `bodyStyle` (`:84`). The overlay's styling is decided by the Overlay inside the primitive's `DialogContent`; to change it you have to go into `@antdv/shadcn-ui`. `bodyStyle` is passed to `ModalWrapper` (`BasicModal.vue:249`), but `ModalWrapperProps` (`types.ts:137-145`) has no such entry, so it never reaches the content area. There are also four function-shaped fields — `onOk` / `onCancel` / `'onVisible-change'` / `'onUpdate:open'` (`:93-99`) — which duplicate `defineEmits` (`:46-52`) and are never referenced inside the component.

### Close paths: X, cancel, mask and ESC all go through `closeFunc`

The primitive's interception events are taken over one by one, and all four paths converge on `handleCancel()` → `closeModal()` (`:159-162`):

- Mask: `@interact-outside` calls `preventDefault()` first, then discards the fake event where "focus merely bounced back to body" (`isFocusOutsideEvent`, `shared/dismiss.ts`), and finally decides whether to close based on `maskClosable && closable` (`:172-177`).
- ESC: `@escape-key-down` likewise calls `preventDefault()` first, gated by `keyboard` (`:179-183`).
- X and the footer cancel button: plain `@click="handleCancel"` (`:230`, `:269`).
- The `update:open(false)` the primitive emits itself is handled too (`:194`), so visibility cannot be changed from outside the component and bypass `closeFunc`.

The reason for calling `preventDefault()` and then running `closeModal()` ourselves is that `closeFunc` is an async gate: let the primitive close and this `await` never happens. Mask clicks and ESC **both** close the modal now, and both can be stopped by `closeFunc` — consistent with the drawer's behaviour.

### Events

| event | payload | fired by |
| --- | --- | --- |
| `register` | `ModalInnerMethods & ModalMethods` | Deferred emit after mount (`:136-144`), shared by `useModal` and `useModalInner` |
| `ok` | `MouseEvent` | OK button click (`:154-157`); the internal OK loading is set at the same time |
| `cancel` | `MouseEvent` | The four paths: X, cancel button, mask, ESC (`:159-162`) |
| `visible-change` | `boolean` | Inside `setVisible()` and `closeModal()` (`:98`, `:114`) |
| `update:open` | `boolean` | The same places (`:99`, `:115`), which is what makes `v-model:open` work |

### Slots

`titleTip` (right of the title, `:218`), the default slot (content, `:251`), `insertFooter` / `centerFooter` / `appendFooter` (nested inside the default button bar, `:263`, `:274`, `:286`), and `footer` — **providing `footer` replaces the whole default button bar** (`:288-293`, mutually exclusive with the condition at `:256`).

### Instance methods (`ModalMethods`)

| method | declared | real behaviour |
| --- | --- | --- |
| `openModal(visible = true, data?)` | `types.ts:104` | Only opens when `visible` is truthy — **the closing direction (passing `false`) does nothing at all** (`BasicModal.vue:103-105`); see above for `data` |
| `closeModal()` | `types.ts:106` | Awaits `closeFunc()` first and returns immediately on a falsy result; otherwise resets `okLoadingRef`/`loadingRef`, emits both events and calls `afterClose` (`:106-117`) |
| `getVisible()` | `types.ts:110` | Reads the internal `visibleRef` (`:123`) |
| `setModalProps(partial)` | `types.ts:108` | **Works**: the overrides are merged into `propOverrides` and `merged` recomputes (`:118-122`); passing `open` / `loading` also updates the internal refs |

::: warning

The OK button loading: either close the modal or reset it yourself `handleOk` sets `okLoadingRef` to `true` unconditionally (`:154-156`), and the component's only automatic reset point is `closeModal()` (`:112`). What `BasicModal` emits is **`innerMethods`, which contains `changeOkLoading` / `changeLoading`** (`:126-134`, `:137`), so only a component that destructures `useModalInner()` inside the modal gets those two methods (`useModalInner.ts:64-69`); the page-level `useModal()` forwards only four keys (`useModal.ts:41-55`). Consequence: if your `@ok` handler decides to keep the modal open (validation failure, for instance), either call `changeOkLoading(false)` in the child component, or close the modal. Every submit path in demo section 1 closes, and the page prints that precondition on screen (`modal-drawer/index.vue:360-377`).
:::

## BasicDrawer API

`BasicDrawer` is a shell over the shadcn-vue **Drawer primitives** (reka-ui's `DrawerRoot` / `DrawerContent` / `DrawerTitle` / `DrawerDescription`), with defaults at `drawer/BasicDrawer.vue:23-37`. Props sharing a name with `BasicModal` (`title`/`showFooter`/`showCancelBtn`/`showOkBtn`/`cancelText`/`okText`/`okType`/`okButtonProps`/`cancelButtonProps`/`closable`/`maskClosable`/`keyboard`/`mask`/`bodyStyle`/`wrapClassName`/`zIndex`/`destroyOnHidden`/`loading`/`loadingTip`/`closeFunc`) behave the same way; only the **differences** are listed here.

| prop | default | Difference |
| --- | --- | --- |
| `placement` | `'right'` | Decides whether `size` means width or height (`:61-78`), and maps to the primitive's `swipe-direction` (`:87-96`, `top/bottom` → `up/down`) |
| `size` | none | The recommended usage; left/right default to `520`, top/bottom to `400` (`:67`, `:69`, `:75`, `:77`) |
| `width` | none | Only a `size` fallback under left/right (`:65`) |
| `height` | none | Only a `size` fallback under top/bottom (`:73`) |
| `useWrapper` | `true` | In a drawer it **only decides whether the body gets `p-4`** (`:335-336`) — there is no height logic at all |
| `mask` | `true` | Off means no overlay is rendered, and the primitive's `modal` drops from `'trap-focus'` to `false` (`:105-106`) |
| `maskClosable` | `true` | One switch shared by the mask **and swipe-to-close** (`:243-248`, `:228-236`); unlike the modal side, the drawer's `closable` only covers the X button (`:303`) and affects neither of these two paths |
| `keyboard` | `true` | The ESC switch (`:250-252`) |
| `bodyScroll` | `true` | Hands the content area to the built-in `ScrollArea`; turn it off when the caller manages scrolling itself (`:371-374`, comment at `types.ts:50-55`) |
| `open` / `visible` | none | Both are read (`:53`, `:194-200`), so `v-model:open` and `v-model:visible` both work two-way (emits at `:39-46`, `:132-137`) |

`zIndex` only reaches the panel's inline style when passed explicitly (`:109-113`); otherwise it stacks by mount order like every other `z-50` overlay on the page — which is why a confirmation dialog can still sit on top of a drawer (demo section 5 passes `:z-index="1100"`). `drawerStyle` is likewise merged into the inline style, `wrapClassName` into the panel class, and `headerStyle`/`footerStyle`/`bodyStyle` each go to their own region; `maskStyle` currently has no landing point (the overlay is the primitive's `DrawerOverlay`, styled by `@antdv/shadcn-ui`'s `drawer/DrawerOverlay.vue`).

### Why the Drawer primitives won

This decision changed direction once: the early implementation used Sheet (Dialog semantics plus `side`), the current one uses Drawer. Laid out dimension by dimension so the next change does not have to treat the conclusion as folklore.

**Functional fit.** Both are "edge-anchored panel plus overlay" and their capability surfaces almost coincide: `DrawerTitle`/`DrawerDescription`/`Portal` share their origin with Sheet's counterparts, and `placement` maps one-to-one onto Sheet's `side` (Drawer adds only a vocabulary conversion). The real difference sits in two switches: Drawer's `modal` accepts the intermediate `'trap-focus'` setting (traps focus without touching other elements' `aria-hidden`), whereas Dialog/Sheet offer only a boolean; and Drawer ships `swipe-direction` and sliding close natively, which Sheet does not have.

**Interaction requirements.** A drawer has five close paths: the footer button, the top-right X, a mask click, ESC, and **holding the panel and flicking it toward the opening edge**. Sheet can do the first four; the fifth is what touch users expect from a drawer by default, and only the Drawer primitives provide it (`useSwipeDismiss`: past a `40px` displacement, or a release velocity above `0.3px/ms`, the gesture counts as a flick; when the gesture starts on `button/a/input/select/textarea/label/[role=button]` the primitive deliberately abandons it, so the drag region is the header's empty space rather than its buttons). Crucially, this new path does not bypass interception: it exits through `update:open(false, { reason: 'swipe' })` as well (`:228-236`), so both `closeFunc` and `maskClosable` still govern it — first `details.cancel()` runs inside the synchronous step to spring the already off-screen panel back into place, and whether it closes is left to the `await closeFunc()` in `closeDrawer()` (`:143-155`). `cancel()` only works synchronously; calling it after the `await` is too late.

**Customization headroom.** `DrawerContent`'s class and style are fully open, so the size is applied via inline `width`/`height` (`:109-113`), and the panel only additionally needs `max-w-none!` to release the primitive's own `sm:max-w-sm` cap (`:122`) — do not also stack `w-auto!`, because the `important` would then push the inline width aside. `destroyOnHidden: false` maps straight onto the primitive's `force-mount` (`:278`). The price is two gaps the primitive leaves open, which the component has to fill:

- `DrawerContent` runs `useHideOthers` when `modal === true`, and it lacks the `present` gate that Dialog has — a force-mounted closed panel keeps hanging in the DOM and would mark the whole application `aria-hidden="true"`. So this component uses `'trap-focus'` fixed, and it **must not** be flipped to `true` while opening or closing: full-modal and non-modal are two keyed subtrees, so toggling `modal` remounts the whole tree and every bit of state in the caller's slots is lost.
- The overlay locks background scrolling through `document.body.style.pointerEvents = 'none'`, accounted by `useBodyScrollLock`'s owner bookkeeping rather than DismissableLayer's "whoever locked it claims it". Consequently the panel itself (`:126`) and every overlay portalled to body (`@antdv/shadcn-ui`'s Popover/Select/DropdownMenu/ContextMenu/Menubar/HoverCard content components) must carry `data-[state=open]:pointer-events-auto`, otherwise the floating layer is visible but unclickable.

**Business-scenario match.** This repository's drawers carry three kinds of content: form editing, long detail text, and preference settings — desktop-first, occasionally narrow screens. Desktop needs "all five close paths interceptable by dirty data"; narrow screens need "flick it away one-handed". The former is existing semantics (`closeFunc`); the latter is exactly what switching to Drawer yielded for free. The preferences drawer case — fixed top switcher bar, scrolling inside the panel, an embedded overlay colour picker — is what first exposed that `pointer-events` gap.

**Version compatibility.** No dependency swap: Drawer and Sheet both live in the repository's vendored `@antdv/shadcn-ui`, both sit on reka-ui 2.11.0 underneath, and no third-party drawer such as vaul is needed. The external API surface is unchanged — `DrawerProps`, `useDrawer()`'s `[register, methods]` and the four method names are preserved as-is, so none of the existing call sites needed a single line changed: 13 of them in `apps/web` (5 in the modal-and-drawer demo page plus 8 across the system pages, two of those in role management), and one more in the layout's account drawer.

**Performance.** Closed state defaults to `destroyOnHidden: true`, so the panel is not mounted at all; when state must survive, `force-mount` is used and `CLOSED_PANEL_INERT` (`shared/presence.ts`) makes the closed panel `pointer-events-none` while pinning the exit animation to its end point (`fill-mode-forwards`) — otherwise that transparent `fixed` panel would swallow clicks across the whole page. No remount happens while opening and closing, so scrolling and input state are retained by the DOM itself.

### Four points that still need recording as they stand

- **`wrapperFooterOffset` is read by nobody in the drawer**: it is a prop shared with the modal side (`src/types.ts:38`; `BasicModal.vue:41`, `:246` read it into `ModalWrapper`'s `footer-offset`), while `DrawerProps` (`drawer/types.ts:8-62`) does not declare it at all, and there is no wrapper component equivalent to `DrawerWrapperProps`; none of `ModalWrapper`'s `height` / `minHeight` / `footerOffset` applies to drawers.
- **`helpMessage` is declared but never rendered**: `drawer/types.ts:13`, with no reference anywhere in `BasicDrawer.vue`. `maskStyle` (`:41`) is likewise declare-only.
- **String sizes get eaten by `parseInt`**: `getSize` runs `Number.parseInt(size, 10)` on strings (`:67`, `:75`), so `width="40%"` becomes 40 **pixels**. The demo passes numbers throughout and prints this in its info bar.
- **Only `closeDrawer()` is guarded**: the hook is awaited there and nowhere else (`:144-146`); the opening direction has no equivalent interception point.

`useDrawer()` returns `openDrawer / closeDrawer / setDrawerProps / getVisible` (`useDrawer.ts:40-54`), and its semantics are perfectly symmetric with `useModal`: `waitForInstance` is the same 10 rounds of `nextTick` + 50ms and throws `[useDrawer] Drawer instance not found` on timeout (`:26-38`); `getVisible` is synchronous and does not wait again (`:53`). `setDrawerProps` genuinely works this time — it merges the overrides into `propOverrides` (`BasicDrawer.vue:156-161`), so the title, button labels and width all re-render with the override values.

::: warning

useDrawerInner is not an "inner" hook `drawer/index.ts:13-15` is the same module exported on two lines:

```ts
export { useDrawer } from './useDrawer';
// Consistent with the old implementation: useDrawerInner in this repository is an alias export of useDrawer
export { useDrawer as useDrawerInner } from './useDrawer';
```

So the `callback` of `useDrawerInner(callback)` **is neither accepted nor invoked** (the signature at `useDrawer.ts:10` takes no parameters at all) — the drawer side has no data channel comparable to `useModalInner`. The destructured second element really contains only the four keys `openDrawer/closeDrawer/setDrawerProps/getVisible`; destructuring `changeOkLoading` / `changeLoading` off it (as `DrawerInnerMethods`, `drawer/types.ts:71-78` invites you to) yields `undefined`, and calling it throws a `TypeError`. `BasicDrawer` does prepare an `innerMethods` containing those two methods and sends it as the `register` payload (`:165-173`, `:180-189`), but `useDrawer` only forwards four keys (`useDrawer.ts:40-54`), so the two ends still never meet. Demo section 4 therefore uses only `openDrawer/closeDrawer`.
:::

## Body scrolling and the loading overlay

`BasicModal` delegates scrolling to `modal/ModalWrapper.vue`; the rules are short:

| condition | result | where |
| --- | --- | --- |
| `useWrapper: false` | the style object is `{}`, no height cap | `ModalWrapper.vue:19` |
| `height` given | `height: Npx` fixed, `maxHeight`/`minHeight` step aside | `:21-23` |
| otherwise | `maxHeight = viewport height - 200 - footerOffset`, `minHeight` defaults to `200px` | `:25`, `:27-30` |

The outer `div.modal-wrapper` is `relative` (`:37`), and while loading an `absolute inset-0` translucent overlay plus a spinner is layered on top (`:38-58`); the content is wrapped in shadcn's `ScrollArea` (`:60-66`, `modal-body h-full p-6`, `type="scroll"`) — a self-drawn scrollbar, with no switch to fall back to the browser's default one. Viewport changes are picked up by `useWindowSize` (`:16`), so no manual recalculation is needed.

The header and the footer button bar live **outside** the scroll container (`BasicModal.vue:206-235` and `:255-293`), so they stay put while the content scrolls. The drawer solves it differently: the panel itself is a flex column (`basic-drawer`, `:117-130`), the body is `drawer-body relative min-h-0 flex-1 overflow-hidden!` (`:333-338`, plus `p-4` when `useWrapper`), and a `ScrollArea class="h-full"` goes straight inside it (`:371-373`); with `bodyScroll: false` that `ScrollArea` is not rendered at all and scrolling is left to the slot content (`:374`). None of `ModalWrapper`'s `height` / `minHeight` / `footerOffset` applies to drawers. Also, `ModalWrapperProps` declares a `visible` (`types.ts:144`) that `BasicModal.vue:247` passes every time and the component never reads — to observe visibility, use `BasicModal`'s `visible-change` event.

## Live example: `/components/modal-drawer`

How to open it: `pnpm dev:web` + `pnpm --filter @antdv/backend-mock dev`, then visit `http://localhost:6080/#/components/modal-drawer` (hash routing), or the sidebar group "组件示例 → 弹窗与抽屉" ("Examples → Modal and drawer"; menu entry `apps/backend-mock/server/api/menus.get.ts:264-269`, `name: 'DemoModalDrawer'`). The page has five sections; sources are `apps/web/src/views/components/modal-drawer/index.vue` (760 lines) plus the private child `components/InnerForm.vue` (124 lines). All data in this section is local `ref` state — no backend requests.

### 1. Basic modal (`index.vue:285-381`, logic `:37-99`)

| Click | You see |
| --- | --- |
| `openModal(true, data) 打开并传数据` (`:292-294`, logic `:49-72`) | `InnerForm` opens: the left column shows the JSON the parent page sent (`:311-323`), and inside the modal, under the title, it shows 「useModalInner 回调第 N 次收到数据」 with the received JSON (`InnerForm.vue:80-88`). The payload carries an `onSubmit` function (`index.vue:57-64`), proving the channel forwards it untouched |
| Edit fields in the modal → the footer's 「提交」 (`InnerForm.vue:57-61`) | The right column's 「弹窗点提交后回传的值」 shows the JSON (`index.vue:324-342`) and the modal closes — closing is what resets the OK button's loading on the way |
| The footer's 「重置」 (`centerFooter` slot, `InnerForm.vue:120-122`) | The form clears but **the modal stays open** (`:63-66`); demonstrates the built-in button bar's slot |
| `closeModal() 关闭` (`:295-297`, logic `:74-77`) | Closes the current modal; when nothing is open the call still goes through `waitForInstance` and returns immediately once the instance exists |
| `getVisible() 查询显隐` (`:298-300`, logic `:79-81`) | The 「方法返回值」 line below prints a timestamp plus the `getVisible()` result (`:344-349`) — note this method is synchronous, so before the modal has registered it can only report `false` |
| `setModalProps() 尝试改 props` (`:301-303`, logic `:87-99`) | The modal title becomes 「标题被 setModalProps 改掉」, the OK button becomes 「确认修改」 and the width grows to 640px; a log line appends the override content (`:350-358`) and a success message pops. The page prints this together with how to obtain `changeOkLoading` as a tested conclusion (`:360-377`) |

### 2. Scrolling inside a modal (`index.vue:383-470`, logic `:101-150`)

| Click | You see |
| --- | --- |
| `打开固定高度弹窗（:height="360"）` (`:387-389`, modal `:409-440`) | 24 radio rows scroll inside the content area only, with the header and footer fixed. Pick one and press 「提交选择」 → the page shows 「已选择第 N 条」 (logic `:129-136`) |
| `打开自适应高度弹窗（minHeight + wrapperFooterOffset）` (`:390-392`, modal `:442-470`) | Max height = viewport − 200 − 140; press 「再追加 12 行」 and the content keeps growing without the dialog exceeding the viewport (logic `:147-150`) |
| —— | The info bar above (`:394-399`) spells out, word for word, what each of the four props read by `ModalWrapper` does, matching this page's table |

### 3. Drawer basics and placement (`index.vue:472-600`, logic `:152-195`)

| Click | You see |
| --- | --- |
| `左侧抽屉 :width="360"` (`:479`, drawer `:500-530`) | Slides in from the left at width 360; the `#footer` slot supplies two buttons, 「取消 / 应用」 (`:522-529`), and the built-in button bar disappears entirely. Pressing 「应用」 writes the density into the page's blue result block (logic `:180-184`) |
| `右侧抽屉 :size="520"` (`:480`, drawer `:532-568`) | Default placement; its footer nests two groups, 「全选 / 清空」 plus 「取消 / 完成」 (`:550-567`), demonstrating how to lay out a custom footer |
| `底部抽屉 :height="280"` (`:481-483`, drawer `:570-600`) | `height` only takes effect with `placement="bottom"` (`getSize`, `BasicDrawer.vue:61-78`), and the swipe direction becomes `down` at the same time (`:87-96`) |
| Each drawer's X / mask / ESC | All go through `closeDrawer()` and are therefore bound by `closeFunc` — section 5 verifies exactly this |
| Drag the header | Hold the drawer header's **empty space** and flick toward the opening edge: past 40px (or fast enough on release) the swipe-close runs, still governed by `closeFunc`; when the gesture starts on a button or an input the primitive does not accept it |

### 4. Scrolling inside a drawer (`index.vue:602-680`, logic `:203-231`)

`打开长内容抽屉` (`:605`) opens a `:size="560"` drawer (`:631-680`): the 16 outer clauses scroll inside `BasicDrawer`'s built-in `ScrollArea` (`bodyScroll` defaults to true) while the header and footer stay fixed; nested inside is a second `Scrollbar` from `@antdv/common-ui` with `root-class="h-60"` (i.e. 240px, `:655-668`), which writes `scrollTop` back into page state through its `@scroll` event (logic `:218-225`; the `wrap` element comes from the component's `defineExpose`, see `packages/core/ui-kit/common-ui/src/components/scrollbar/Scrollbar.vue:91-96`). Only after reaching the bottom (`scrollTop + clientHeight >= scrollHeight - 4`) can 「我已阅读完附加条款」 be checked (`:669-678`), and while it is unchecked the drawer's OK button stays disabled through `:ok-button-props="{ disabled: !agreement }"` (`:636`).

::: tip

Why the height uses `root-class` instead of `max-height` The page text (`:607-621`) gives the reason: the `max-height` prop is recomputed by `Scrollbar`'s internal `useResponsiveMaxHeight` with a 712px floor, so the height is pinned with `root-class="h-60"` here; the same sentence also notes that the built-in `ScrollArea` layer can be turned off with `:body-scroll="false"`. Details in the scrolling section of [Data and display](/en/components/display).
:::

### 5. Nesting and close interception (`index.vue:683-759`, logic `:233-280`)

`打开可编辑抽屉` (`:690`) opens the draft drawer with a `textarea` (`:716-742`), `ok-text="保存草稿"`, and `:close-func="guardCloseDrawer"` (`:721`). Change a few characters → the tag at the top flips to 「有未保存修改」 (`isDirty`, `:248`) → then try closing with the **X, the mask, ESC and the footer's 「关闭抽屉」**: all four paths end up calling `closeDrawer()`, `guardCloseDrawer` is awaited and returns `false`, so the drawer does not move, the interception counter increments, and `openConfirmModal()` raises the confirmation dialog (logic `:257-266`).

The real mechanism behind the stacking and the release:

- The confirmation dialog sits above the drawer because of `BasicModal`'s `:z-index="1100"` (`:746`). Neither the drawer nor the modal carries an inline `zIndex` by default — both land on shadcn's `z-50` tier like every other overlay on the page (`BasicDrawer.vue:109-113`, `BasicModal.vue:79-83`), so only an explicit value can pin the order.
- 「放弃修改并关闭」 calls `closeConfirmModal()` and then `closeNestDrawer()` (`:275-280`); on the second entry into `closeDrawer()`, `isDirty` is already false, so `guardCloseDrawer` returns `true` and the close finally proceeds (`:258-261`) — releasing a close never bypasses the hook, it makes the hook's condition pass first.
- 「保存草稿」 arrives through `@ok` → `handleSaveDraft`, which writes `savedDraft` before `closeNestDrawer()` (`:268-273`); same mechanism.
- With clean content (nothing edited) closing is not intercepted, and the log reads 「内容干净，直接放行」 (`:259`).
- The interception counter and the result text are both rendered on the page (`:694`, `:707-712`); no backend participates.

## Messages and notifications (`message` / `notification`)

Both live in `packages/core/ui-kit/popup-ui/src/message/index.ts` (128 lines) on top of vue-sonner, keeping the old `message.success/error/info/warning` call shape. What draws them is the themed `<Toaster />` shell exported by `@antdv/common-ui` (mounted at `apps/web/src/App.vue:59-71`).

The two channels are **two instances of the same `createFeedback(toasterId?)` factory** (`:123`, `:126`): same method roster, same default dwell time, same clearing logic. The only difference is which toaster they land in.

| Entry | Signature | Default duration |
| --- | --- | --- |
| `message` / `notification` `.success` / `.error` / `.info` / `.warning` | `(content: string, init?: number \| string \| ToastInit)` | 3000ms (`TOAST_DURATION`, `:43`) |
| `.loading` | `(content: string)` | stays until dismissed (`:113`) |
| `.close(id)` / `.closeAll()` | vue-sonner's `toast.dismiss` (`:99`, `:104`) | — |
| `toast` | re-exported vue-sonner as-is (`:128`) | caller's business |

The second argument accepts three shapes: a number is the dwell time (`message.success('已保存', 5000)` — exactly the old call), a string is the description (`notification.info('标题', '描述')`), an object is `{ description, duration }`. Only keys that actually carry a value are written into the payload, so a message emits neither a `description` nor a `toasterId` key at all. For anything beyond these shapes (`action`, `cancel`, `promise`, custom ids) use the exported `toast`.

### Why the host mounts **two** `<Toaster />` elements

`apps/web/src/App.vue:59-71` mounts both (importing `Toaster` from `@antdv/common-ui`): the id-less one (`position="top-center"`) receives `message.*`, the one with `:id="NOTIFICATION_TOASTER_ID"` (the constant is `'notification'`, `message/index.ts:33`) receives `notification.*` and takes its position from the `notificationPosition` preference. **Both enable `close-button`**, with the ✕ in the card's top-right corner.

- **Not one toaster with a per-toast `position`**: sonner keeps exactly one stack per position. Messages and notifications differ in exit position and stack limit, so sharing a toaster makes them evict each other (one notification pushes three messages out).
- **Routing rule** (vue-sonner 2.0.9): a toast without `toasterId` only enters the **id-less** toaster, one with `toasterId` only enters the matching one. `message.*` therefore never passes it — if the host forgets the notification toaster, messages are still visible, and nothing can cross over the other way.
- **Both can be closed by hand**: messages used to omit the ✕ ("3 seconds and it's gone, an extra hit area contradicts that"). The cost was that the same sentence behaved differently per channel — 3s versus 8s, closable versus not — so users had to learn two rules. Dwell time and the dismiss action are now one implementation; what still separates the channels is the exit position and the optional description line.

### Colour contract: neutral card, state only in the badge

All of it lives in `packages/core/ui-kit/common-ui/src/components/toast/Toaster.vue` (204 lines); applications configure nothing:

- **Why this layer sits in common-ui instead of `@antdv/shadcn-ui`'s `Sonner.vue`**: that component hardcodes `rich-colors` *after* `v-bind` (so nothing can pass it in) and hardcodes its four state icons as `<template #xxx-icon>` (so nothing can pass them out — SFCs do not forward slots). Replacing those two things without editing its source would mean betting our selectors on which lucide icons it happens to use, and the bet expires on the next upgrade. So the styling layer is its own component: the engine is still vue-sonner, props and slots are the same shape (`ToasterProps` passes through untouched, `@antdv/shadcn-ui` did not change by a line), and nothing that package adds, removes or iterates can reach this one.
- Background, border, text and radius come from sonner's `--normal-*` variable group (`:43-48`), fed by `--app-popover` / `--app-popover-foreground` / `--app-border` / `--app-border-radius`. **All four types share one neutral card — no rich colours**: `rich-colors` makes sonner repaint the whole card with `--{type}-bg` and recolors `[data-description]` along with it, which destroys body-text contrast.
- State is the **20px solid disc badge with reversed-out strokes** on the left (`:96-165`): `bg-success`, `bg-info`, `bg-warning`, `bg-destructive` — a semantic palette deliberately decoupled from the theme presets, so changing the primary colour does not move them. Check and cross come from `@lucide/vue`; the exclamation and the info dot are hand-written paths, because lucide's `CircleAlert` / `Info` already carry a ring and would produce a box inside a box. All six slots (four states plus loading and close) are "named slot with default content", so a host can swap any badge by passing the same slot name — no edit to this layer.
- Per-part tweaks go through `toastOptions.classes` **with `!`** (`:58-63`): sonner's built-in rules sit at `[data-sonner-toast][data-styled='true'] [data-icon]` specificity inside package CSS, so a non-important utility cannot beat them. The host's `toast-options` is merged **entry by entry with the host winning** (`:69-72`), so passing `{ duration: 1000 }` does not silently replace the whole palette.
- The close button is `border-0! bg-transparent!`, and `[data-close-button-position]` pulls it 8px inside the card instead of letting it straddle the border (`:188-199`). Note that selector keys off the **button's** position attribute, not the toaster's `data-x/y-position` — the two do not follow each other. The `.antdv-toaster` prefix is this package's own hook, not a shadcn-ui class name.
- Z-index needs no handling: vue-sonner pins `[data-sonner-toaster]` at `z-index: 999999999` and writes each toast's `--z-index` inline as `toasts.length - index`, so setting it on the parent is overwritten — it looks like you raised the layer and changes nothing.

::: warning

Do not touch the top block of `message/index.ts`
`:16-20` are, in order, the CSS side-effect type-declaration comment, `// oxlint-disable-next-line typescript/triple-slash-reference`, the `<reference path="../types/css.d.ts" />` directive, `import { toast } from 'vue-sonner'`, and `import 'vue-sonner/style.css'`. This package ships source, so downstream cannot see popup-ui's own tsconfig include — that `<reference>` directive is the only thing typing the CSS side-effect import for consumers. **It has to stay a real triple-slash directive (`/// <reference … />`)**: `eslint --fix`'s `spaced-comment` rule rewrites `///` into the space-separated `// /`, which silently disables the directive and makes downstream `vue-tsc` fail with TS2882 — line `:18` in the current source already shows that split `// /` form, so this block must stay out of `--fix` range.
:::

### Live example: `/components/feedback`

One button per channel and per state (four `message.*`, four `notification.*`) plus the loading prompt and a "default / Promise" pair (through the exported `toast`, covering the badge-less `default` type and the pending spinner), with the page itself stating "click the ✕ in the corner or wait 3 seconds". The same page is the regression scene for the toast palette — `apps/web/e2e/preference-effects.spec.ts` asserts the `--app-popover` card colour, the badge colours, the close-button offset and the two-toaster separation item by item.

## What this page does not have

Stated from the source that was actually read — do not go looking for capabilities documented by other component libraries' templates:

- **No drag-to-move, no fullscreen toggle.** The old implementation's three hook files — `useDragMove` / `useModalFullScreen` / `useModalHeight` — were deleted during the migration and are absent from `modal/index.ts`'s export list (`modal/index.ts:1-20`). Neither `ModalProps` nor `DrawerProps` has a `draggable` / `fullscreen` / `canFullscreen` field either (`types.ts:17-100`, `drawer/types.ts:8-62`); on the drawer side there is only the primitive's own **swipe-to-close** (`drawer/BasicDrawer.vue:85-103`, `:226-234`), and dragging does not move the panel.
- **No `confirmLoading`.** The field does not exist in the props definitions, and the OK button's loading is driven by component-internal state (`BasicModal.vue:154-157`, same logic in `BasicDrawer.vue`); to change it you use `okButtonProps.disabled` or the internal `changeOkLoading`.
- **No "confirm before opening" hook.** `closeFunc` only guards closing (`BasicModal.vue:107-110`, `BasicDrawer.vue:142-144`).
- **No destroy control for Modal beyond `destroyOnHidden`**, and **no data callback for drawers** (see the `useDrawerInner` section).
- **`openModal(false)` / `openDrawer(false)` cannot be used to close** (`BasicModal.vue:103-105` and `BasicDrawer.vue:138-140` do nothing when `visible` is falsy); closing means calling `closeModal()` / `closeDrawer()`.

## Related pages

- [Component examples](/en/components/) — chapter index, how to open the demos, shared conventions
- [Table](/en/components/table) — the full context where the table page uses `BasicModal` for create/edit
- [Icon guide](/en/guide/essentials/icons) — `IconifyIcon` and the offline icon set inside drawers and modals
