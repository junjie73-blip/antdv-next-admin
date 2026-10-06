// 导出函数式创建方法
export {
  createContainerLoading,
  createFullscreenLoading,
  createLoading,
} from './createLoading'

// 导出指令
export { default as vLoading } from './directive'

// 导出组件
export { default as Loading } from './Loading.vue'

// 导出类型定义
export type {
  ComponentPublicInstance,
  CreateLoadingOptions,
  DirectiveBinding,
  LoadingDirectiveBinding,
  LoadingInstance,
  LoadingProps,
  LoadingSize,
  LoadingTheme,
  UseLoadingOptions,
} from './types'

// 导出组合式函数
export { useLoading } from './useLoading'
