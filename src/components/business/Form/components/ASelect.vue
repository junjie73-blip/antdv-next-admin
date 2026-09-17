<script setup lang="ts">

import { nextTick, onMounted, ref, watch } from "vue";

import type { SelectProps } from "antdv-next";
import type { DataNode } from "antdv-next/dist/tree/index";

import { http } from "@/utils";
interface Props extends /* @vue-ignore */ SelectProps {
  api: string;
}
const { api = "", ...props } = defineProps<Props>();
const options = ref<DataNode[]>([]);
async function getTreeData() {
  const { data: res } = await http
    .Get<{ data: DataNode[] }>(api, {
      cacheFor: 0,
    })
    .send(true);
  options.value = res;
}
watch(
  () => api,
  (newVal) => {
    if (newVal) {
      getTreeData();
    }
  },
);
</script>

<template>
  <a-select v-bind="props"
:options />
</template>

<style scoped></style>
