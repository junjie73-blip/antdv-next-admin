---
'@antdv/popup-ui': patch
'@antdv/shadcn-ui': patch
---

feat: `BasicDrawer` 改用 shadcn 的 **Drawer 原语**（不再走 Sheet），抽屉多出「甩动关闭」并补掉原语的两个无障碍缺口

现象（用户归纳）：`basic-drawer 使用 drawer 而不是 sheet`。此前 `BasicDrawer` 建在 Sheet（Dialog 语义 + `side`）上，能力面比 Drawer 窄，抽屉在触屏上缺少"往开口方向一甩就关"这条默认预期。

- **换原语而不换依赖**：`DrawerRoot` / `DrawerContent` / `DrawerTitle` / `DrawerDescription` 都在仓库内 vendor 的 `@antdv/shadcn-ui` 里，底层同为 reka-ui 2.11.0，不需要引入 vaul。`placement` 与原语的 `swipe-direction` 是一对一映射，只有 `top/bottom` 两档要换成原语的 `up/down` 词汇（`SWIPE_DIRECTIONS`）。对外 API 面零变化 —— `DrawerProps`、`useDrawer()` 的 `[register, methods]` 与四个方法名原样保留，`apps/web` 里 10 个消费点（系统页的编辑抽屉、布局的个人中心与偏好设置）一行没改。
- **`modal` 取 `'trap-focus'` 这一档，而且永远不翻**：Dialog/Sheet 的 `modal` 只有布尔，Drawer 多一个中间档（收焦但不改别人的 `aria-hidden`）。不能沿用 `true`：`DrawerContent` 在 `modal === true` 时会跑 `useHideOthers`，又少了 Dialog 那层的 `present` 闸门，`destroyOnHidden: false` 的关闭态面板会把整个应用置成 `aria-hidden="true"`（键盘 Tab 出得去面板，屏幕阅读器读不到页面）。也不能开合时切成 `true`：full-modal 与非 modal 是两棵 keyed 子树，翻 `modal` 会整棵重挂载，调用方插槽里的状态全丢。
- **代价是 pointer-events 要自己认领**：抽屉的蒙层靠 `useBodyScrollLock` 的 owner 记账把 `document.body` 置成 `pointer-events: none`，这条路不会填 `DismissableLayer` 的 `layersWithOutsidePointerEventsDisabled`，于是原语只把面板在 full-modal 分支里认领回来。我们走 `'trap-focus'`，所以面板与 9 个 vendor 的弹层内容组件（Popover / Select / DropdownMenu×2 / ContextMenu×2 / Menubar×2 / HoverCard）统一补 `data-[state=open]:pointer-events-auto`，否则抽屉里点不开的正是这些浮层。判据用 `elementFromPoint` 命中自己，`toBeVisible()` 在这条上是放行的。
- **第五条关闭路径没有绕开拦截**：`useSwipeDismiss` 的阈值是位移过 `40px` 或释放速度高于 `0.3px/ms`，手势起点落在 `button/a/input/select/textarea/label/[role=button]` 时原语主动放弃（所以拖动区是头部空白而不是按钮）。它同样只从 `update:open(false, { reason: 'swipe' })` 出去，组件在同步过程里先 `details.cancel()` 把已经拖出屏外的面板弹回原位，关不关交给 `closeDrawer()` 里那道 `await closeFunc()` 决定 —— `cancel()` 只能同步生效，等 `await` 完再调已经来不及。`maskClosable` 同时管蒙层与甩动；与弹窗侧不同，抽屉的 `closable` 只管 X 按钮。
- **`bodyScroll` 新增**：内容区默认由抽屉自带的 `ScrollArea class="h-full"` 负责滚动；调用方自己管滚动时关掉（偏好抽屉要"顶部切换条固定 + 面板单独滚"，两层滚动容器会让内层撑到内容高度、外层反过来把切换条一起滚走）。

验证：`popup-ui` 单测 49/49（drawer 20 条，含"未绑 open/visible 时父组件改其他 props 不会把抽屉顶关""默认不写内联 zIndex""甩动仍过 closeFunc"）；`npx turbo run type-check --filter=@antdv/popup-ui --force` 3/3 绿；`e2e/gallery-examples.spec.ts:984` 的「弹窗与抽屉页」7 条用例 × chromium/firefox/webkit 共 21/21 绿（含三方位抽屉、footer 插槽回写、抽屉内滚动到底才能同意、closeFunc 三条拦截路径）；偏好抽屉与图标选择器那 8 条用例同样 × 三引擎 24/24 绿，抽屉内浮层用 `elementFromPoint` 与几何断言核对。文档 `npx turbo run build --filter=@antdv/docs` 通过，zh 正文与 en 镜像口径一致，逐条代码引用对回当前行号，并新增「Drawer 选型说明」一节按功能适配性 / 交互体验 / 版本兼容性三个维度记录这次换向。
