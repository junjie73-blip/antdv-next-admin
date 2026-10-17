<script setup lang="ts">
import { useLayoutI18n } from '@antdv/layout-ui';
import { Icon } from '@iconify/vue';

import WidgetButton from '../widget-button.vue';

defineOptions({ name: 'WidgetPreferences' });

const emit = defineEmits<{ open: [] }>();
const { t } = useLayoutI18n();
</script>

<template>
  <WidgetButton :label="t('header.preferences')" @click="emit('open')">
    <Icon icon="carbon:settings" class="text-lg" />
  </WidgetButton>
</template>
