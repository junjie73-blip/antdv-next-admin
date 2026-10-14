/**
 * force-mount（`destroyOnHidden: false`）关闭后面板仍留在 DOM 里，reka 不会补 `hidden`：
 * 退场动画一结束就回落到原位，变成一层吃掉整页点击的透明面板。
 * - `pointer-events-none`：关闭中/关闭后都不该被点；
 * - `fill-mode-forwards`：让退场动画停在终点（屏外 / 透明）。
 */
export const CLOSED_PANEL_INERT =
  'data-[state=closed]:pointer-events-none data-[state=closed]:fill-mode-forwards';
