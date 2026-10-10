/**
 * `@antdv/router` —— 路由守卫子包。
 *
 * 边界：包内**不 import** pinia store、api、nprogress、@vueuse，
 * 所有外部状态（登录态、菜单是否加载、进度条实现、站点标题）
 * 都通过依赖注入传入。于是：
 * - 换一个状态管理方案（甚至 SSR）守卫照用；
 * - 单测能直接调用工厂产物，不需要 mock 整个应用。
 */

export * from './guards';
export * from './meta';
