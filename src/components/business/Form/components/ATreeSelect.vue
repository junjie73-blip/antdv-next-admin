<script setup lang="ts">

import { onMounted, ref } from "vue";

import type { TreeSelectProps } from "antdv-next";
import type { DataNode } from "antdv-next/dist/tree/index";

import { http } from "@/utils";
interface Props extends /* @vue-ignore */ TreeSelectProps {
  api: string;
}
const { api, ...props } = defineProps<Props>();
const treeData = ref<DataNode[]>([]);
async function getTreeData() {
  const { data: res } = await http
    .Get<{ data: DataNode[] }>(api, {
      cacheFor: null,
    })
    .send(true);
  console.log(res, "res");
  treeData.value = res;
}
onMounted(() => {
  getTreeData();
});
</script>

<template>
  <a-tree-select v-bind="props"
:tree-data />
</template>

<style scoped></style>
