/**
 * reka 把「外部按下」和「焦点移出」都汇总进 `interactOutside`，得按事件类型分开：
 * 焦点移出不是关闭请求（antd 语义），点掉一个会被重新渲染的控件后焦点会短暂落到 body，
 * 若一并当成蒙层点击，抽屉会在用户按下确认按钮之前自己关掉。
 */
export function isFocusOutsideEvent(event: Event) {
  return event.type.toLowerCase().includes('focus');
}
