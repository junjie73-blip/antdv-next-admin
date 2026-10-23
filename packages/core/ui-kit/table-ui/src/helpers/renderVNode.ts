import type { VNode } from 'vue';

import { defineComponent } from 'vue';

/**
 * VNode 渲染辅助组件。
 *
 * Vue 3 模板里无法把 `h()` 出来的 VNode 直接当插值渲染（`{{ vnode }}` 只会走 toString），
 * 需要一个"返回它收到的 vnode"的包装组件。表格的 `title` / `footer` / `summary` /
 * `customRender` 都允许调用方给 VNode，全靠它落进模板。
 *
 * `props.vnode` 的类型放宽到 `Object | Array | String | Number | Boolean`：
 * 调用方写 `title="用户列表"`（字符串）与写 `title: () => h(...)`（VNode/数组）都得能吃，
 * 而 `type: null`（= 任意）会让 Vue 跳过类型校验顺带丢掉 devtools 里的可读性。
 */
export const RenderVNode = defineComponent({
  name: 'RenderVNode',
  props: {
    vnode: {
      default: null,
      type: [Object, Array, String, Number, Boolean],
    },
  },
  setup(props) {
    return () => props.vnode as null | string | VNode | VNode[];
  },
});
