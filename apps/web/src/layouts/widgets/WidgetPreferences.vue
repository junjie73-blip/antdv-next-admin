<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import WidgetButton from './components/WidgetButton.vue';

defineOptions({ name: 'WidgetPreferences' });

const emit = defineEmits<{ open: [] }>();
const { t } = useI18n({ useScope: 'global' });
</script>

<template>
  <WidgetButton :label="t('header.preferences')" @click="emit('open')">
    <Icon icon="carbon:settings" class="text-lg" />
  </WidgetButton>
</template>
