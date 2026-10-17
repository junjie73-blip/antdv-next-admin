<script setup lang="ts">
import { useLayoutI18n } from '@antdv/layout-ui';

import { confirm, message } from '@antdv/popup-ui';
import { cache } from '@antdv/shared/cache';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { useClipboard } from '@vueuse/core';
import { useAppStore, useUserStore } from '@antdv/stores';
defineOptions({ name: 'SettingFooter' });

const emit = defineEmits<{ close: [] }>();

const appStore = useAppStore();
const userStore = useUserStore();
const { t } = useLayoutI18n();
const { copy } = useClipboard({
  source: JSON.stringify(appStore.appSetting, null, 2),
});
const btnClass = cn(
  'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg',
  'text-xs font-medium',
  'outline outline-1',
  'transition-all duration-200',
);

/** 复制主题配置 */
function handleCopy() {
  try {
    copy(JSON.stringify(appStore.appSetting, null, 2));
    message.success(t('preferences.configCopied'));
  } catch {
    message.error(t('preferences.copyFailed'));
  }
}

/** 清除缓存 & 退出登录 */
function handleClearAndLogout() {
  confirm({
    title: t('preferences.clearAndLogoutTitle'),
    content: t('preferences.clearAndLogoutConfirm'),
    danger: true,
    okText: t('preferences.confirmLogout'),
    cancelText: t('common.cancel'),
    async onOk() {
      try {
        cache.clear();
        localStorage.clear();
        sessionStorage.clear();
        await userStore.logout();
        emit('close');
        message.success(t('preferences.signedOut'));
      } catch {
        message.error(t('preferences.logoutFailed'));
      }
    },
  });
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-2">
    <button
      type="button"
      :class="
        cn(
          btnClass,
          'bg-white text-slate-600 outline-slate-200',
          'hover:border-primary/40 hover:text-primary hover:bg-slate-50',
          'dark:bg-slate-800 dark:text-slate-300 dark:outline-slate-700 dark:hover:bg-slate-700',
        )
      "
      @click="handleCopy"
    >
      <Icon icon="carbon:copy" class="text-sm" />
      {{ t('preferences.copyConfig') }}
    </button>

    <button
      type="button"
      :class="
        cn(
          btnClass,
          'bg-rose-500 text-white outline-rose-500',
          'hover:bg-rose-600 hover:outline-rose-600',
        )
      "
      @click="handleClearAndLogout"
    >
      <Icon icon="carbon:logout" class="text-sm" />
      {{ t('preferences.clearAndLogout') }}
    </button>
  </div>
</template>
