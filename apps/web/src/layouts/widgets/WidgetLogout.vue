<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';
import { message, Modal } from 'antdv-next';
import { useUserStore } from '~/stores/modules/user';

import WidgetButton from './components/WidgetButton.vue';

defineOptions({ name: 'WidgetLogout' });

const { t } = useI18n({ useScope: 'global' });
const userStore = useUserStore();

function handleLogout() {
  Modal.confirm({
    title: t('header.logout'),
    content: t('header.logoutConfirm'),
    okType: 'danger',
    okText: t('header.logoutOk'),
    cancelText: t('common.cancel'),
    async onOk() {
      await userStore.logout();
      message.success(t('header.logoutDone'));
    },
  });
}
</script>

<template>
  <!-- data-testid 保留给已有用例；aria-label 由 WidgetButton 统一给出（图标按钮要有可读名字） -->
  <WidgetButton
    :label="t('header.logout')"
    data-testid="logout-widget"
    @click="handleLogout"
  >
    <Icon icon="carbon:logout" class="text-lg" />
  </WidgetButton>
</template>
