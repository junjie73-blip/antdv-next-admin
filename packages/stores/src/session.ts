/**
 * 会话作废信号。
 *
 * 换账号 / 退出登录时，"由上一个账号推导出来的状态"要整体作废。store 侧能自己清的
 * （路由授权集、标签页）都在同一个包里解决；但还有一批状态住在别处 ——
 * 布局层的页面缓存里存着上一个账号的组件实例（表单草稿、分页、图表数据都在里面），
 * 通知小部件的未读计数也同理。
 *
 * 这里不放具体状态，只放"清一下"的登记处：谁持有需要作废的东西，谁登记一个回调。
 * 直接 import 那些模块会把依赖方向倒过来（stores → layouts），包图就此成环。
 */

type SessionResetHandler = () => void;

const handlers = new Set<SessionResetHandler>();

/** 登记回调，返回注销函数（组件里应在卸载时调用，避免重复登记） */
export function onSessionReset(handler: SessionResetHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/**
 * 逐个通知，但**绝不让一个回调的异常中断后面的回调**：
 * 广播里既跟着"清页面缓存"也跟着"清路由授权集"，前者抛错就把后者跳过了 ——
 * 表现是换账号后仍带着别人的 `allowedNames` 跑（越权），而这条失效看不见。
 * 也不往外抛：调用它的是登录/退出主流程，为了一个清理回调把用户卡在已登录态更糟。
 */
export function notifySessionReset(): void {
  for (const handler of [...handlers]) {
    try {
      handler();
    } catch (error) {
      console.error('[stores] 会话作废回调失败，其余回调继续', error);
    }
  }
}
