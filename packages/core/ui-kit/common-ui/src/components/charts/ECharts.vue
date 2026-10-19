<script setup lang="ts">
import type { EChartsProps } from './types';

import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import * as echarts from 'echarts';

/**
 * ECharts 的最小声明式外壳：`option` 变化整体重绘，`loading` 映射到图表自带遮罩。
 *
 * 与 `@antdv/hooks/echarts`（`useEcharts`）的分工：那边管生命周期、resize 调度与主题重建，
 * 是「自己写渲染容器」时用的 composable；这里是「模板里直接摆一张图」的组件形态。
 * 两者都走 `setupEcharts()` 之外的全量 `echarts` 入口，因此任意 series 类型都能直接用，
 * 不依赖按需注册清单。
 */
defineOptions({ name: 'ECharts' });

const props = withDefaults(defineProps<EChartsProps>(), {
  height: '320px',
  loading: false,
});

const el = ref<HTMLDivElement>();
const chart = shallowRef<echarts.ECharts>();

function init() {
  if (!el.value) return;
  chart.value = echarts.init(el.value);
  chart.value.setOption(props.option);
}

function resize() {
  chart.value?.resize();
}

watch(
  () => props.option,
  (opt) => {
    chart.value?.setOption(opt, true);
  },
  { deep: true },
);

watch(
  () => props.loading,
  (loading) => {
    if (loading) chart.value?.showLoading();
    else chart.value?.hideLoading();
  },
);

onMounted(() => {
  init();
  window.addEventListener('resize', resize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart.value?.dispose();
});
</script>

<template>
  <div ref="el" :style="{ width: '100%', height: props.height }"></div>
</template>
