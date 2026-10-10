import type { Component } from 'vue';

export type WidgetKey =
  | 'fullscreen'
  | 'logout'
  | 'notice'
  | 'preferences'
  | 'search'
  | 'theme'
  | 'timezone';

export interface WidgetMeta {
  key: WidgetKey;
  title: string;
  icon: string;
  /**
   * 已经 `defineAsyncComponent` 包好的**稳定引用**。
   *
   * 以前这里存的是 loader 函数，由 `<component :is="defineAsyncComponent(meta.component)">`
   * 在模板里现包 —— 每次顶栏重渲染都生成一个新的组件类型，Vue 只能卸载旧的、再挂载新的。
   * 于是顶栏小部件（含 `useMagicKeys` 的搜索）在导航切换后会短暂失去事件监听，
   * 快捷键有概率落空，入场动画也会反复重播。包在模块作用域里就没有这个问题。
   */
  component: Component;
}
