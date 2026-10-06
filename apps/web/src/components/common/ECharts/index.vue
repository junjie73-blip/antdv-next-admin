<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import * as echarts from 'echarts';

defineOptions({ name: 'ECharts' });

const props = withDefaults(
  defineProps<{
    option: echarts.EChartsOption;
    height?: string;
    loading?: boolean;
  }>(),
  { height: '320px', loading: false },
);

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
