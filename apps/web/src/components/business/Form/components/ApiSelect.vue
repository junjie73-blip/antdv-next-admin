<script setup lang="ts">
import type { SelectProps } from 'antdv-next';

import { watchDebounced } from '@vueuse/core';
import { useRequest } from '~/composables';

interface Props extends /* @vue-ignore */ SelectProps {
  api: string;
}
const { api = '', ...props } = defineProps<Props>();
const { refresh, data } = useRequest(api, {
  immediate: false,
});

watchDebounced(api, () => refresh(), { immediate: true, debounce: 200 });
</script>

<template>
  <a-select v-bind="props" :options="data" />
</template>
