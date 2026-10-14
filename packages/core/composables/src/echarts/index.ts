/**
 * ECharts 方向的统一入口。
 *
 * 分成四个模块而不是一个大文件，是因为它们的变更原因不同：
 * - constants：设计令牌（配色 / 类名），跟着视觉走
 * - setup：按需注册的图表与组件清单，跟着"用到哪些图"走
 * - theme：明暗两套取色函数，跟着主题走
 * - useEcharts：生命周期与 resize 调度，跟着交互走
 */
export * from './constants';
export { setupEcharts } from './setup';
export * from './theme';
export * from './useEcharts';
