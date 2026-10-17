<script setup lang="ts">
defineOptions({ name: 'LayoutTabbar' });

/**
 * 标签页那一行的容器。
 *
 * 行高、底色、内边距都由 `@antdv/tabs-ui` 的 TabsBar 自己给出（它才是懂五种
 * 标签风格的那一层），这一层只补上外壳其余区域都有的东西：
 * `data-layout-region="tabs"` 这个稳定钩子，以及在纵向 flex 里"不许被压扁"。
 * 没有它，端到端用例只能靠 `.tab-bar` 这个组件库内部类名定位这一行。
 *
 * **这里刻意不是 flex**：TabsBar 的根带 `shrink-0`（那一句是给纵向列用的，别让 40px 行高被压扁），
 * 若本层再开一个横向 flex，`shrink-0` 就变成"水平方向也不许缩"，整条标签栏会顶穿外壳
 * （`scrollWidth > clientWidth`），TabsBar 内部的滚动层反倒拿到的是内容的宽度、
 * 永远量不出溢出，左右箭头因此不出现。做成块级容器，宽度由外壳给定，溢出才归滚动层管。
 */
</script>

<template>
  <div data-layout-region="tabs" class="min-w-0 shrink-0">
    <slot></slot>
  </div>
</template>
