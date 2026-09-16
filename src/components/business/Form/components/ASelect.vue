<script setup lang="ts">
import type { SelectProps } from "antdv-next";
import { http } from "@/utils";
import type { DataNode } from "antdv-next/dist/tree/index";
import { onMounted, ref } from "vue";
interface Props extends /* @vue-ignore */ SelectProps {
  api: string;
}
const { api, ...props } = defineProps<Props>();
const options = ref<DataNode[]>([]);
async function getTreeData() {
  const { data: res } = await http
    .Get<{ data: DataNode[] }>(api, {
      cacheFor: 0,
    })
    .send(true);
  options.value = res;
}
onMounted(() => {
  getTreeData();
});
</script>

<template>
  <a-select v-bind="props" :options />
</template>

<style scoped></style>
