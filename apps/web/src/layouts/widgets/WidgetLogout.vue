<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { confirm, message } from '@antdv/popup-ui';
import { Icon } from '@iconify/vue';
import { useUserStore } from '~/stores/modules/user';

import WidgetButton from './components/WidgetButton.vue';

defineOptions({ name: 'WidgetLogout' });

const { t } = useI18n({ useScope: 'global' });
const userStore = useUserStore();

function handleLogout() {
  void confirm({
    title: t('header.logout'),
    content: t('header.logoutConfirm'),
    // 退出是不可逆操作，确认按钮走 destructive 配色（旧 okType: 'danger'）
    danger: true,
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
