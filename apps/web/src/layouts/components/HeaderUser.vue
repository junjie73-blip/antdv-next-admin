<script setup lang="ts">
import type { MenuProps } from 'antdv-next';

import { computed, h, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';
import { Avatar as AAvatar, Dropdown } from 'antdv-next';
import { useUserStore } from '~/stores/modules/user';

import AccountDrawer from './AccountDrawer.vue';

defineOptions({ name: 'HeaderUser' });

/**
 * 顶栏最右侧的用户区（`@antdv/layout-ui` 顶栏的 `user` 插槽内容）。
 *
 * 头像、用户名与「个人中心」入口都要吃 user store，属于业务侧，
 * 所以留在应用里，外壳只负责把它放在工具条旁边。
 */
const userStore = useUserStore();
const { t } = useI18n({ useScope: 'global' });
const accountDrawerRef = ref<InstanceType<typeof AccountDrawer> | null>(null);

/**
 * 头像下拉是"个人中心"唯一的入口。
 *
 * 菜单里的「个人中心」已经标成 hidden（见 `apps/backend-mock/server/api/menus.get.ts`），
 * 导航不再占一格，但抽屉里要能直达两个页面，所以这里按 tab 分别给项：
 * `profile` → 个人主页，`settings` → 账户设置，都由 AccountDrawer 承载。
 */
const userDropdownItems = computed<MenuProps['items']>(() => [
  {
    key: 'profile',
    label: t('header.profile'),
    icon: () => h(Icon, { icon: 'carbon:user-avatar' }),
  },
  {
    key: 'settings',
    label: t('header.accountSettings'),
    icon: () => h(Icon, { icon: 'carbon:settings' }),
  },
  { type: 'divider' },
  {
    key: 'docs',
    label: t('header.docs'),
    icon: () => h(Icon, { icon: 'carbon:book' }),
  },
]);

function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'profile' || key === 'settings') {
    accountDrawerRef.value?.open(key === 'settings' ? 'settings' : 'center');
  } else if (key === 'docs') {
    window.open('https://junjie73-blip.github.io/antdv-next-admin/', '_blank');
  }
}
</script>

<template>
  <Dropdown
    :menu="{ items: userDropdownItems, onClick: handleUserMenuClick }"
    placement="bottomRight"
  >
    <div
      class="flex cursor-pointer items-center gap-2 rounded-xl py-0.5 pr-2 pl-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      <AAvatar :size="28" :src="userStore.avatar" class="bg-ant-primary">
        {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
      </AAvatar>
      <span class="hidden text-sm text-gray-700 sm:inline dark:text-gray-200">
        {{ userStore.username || t('shell.user') }}
      </span>
      <Icon icon="carbon:chevron-down" class="text-xs text-gray-400" />
    </div>
  </Dropdown>

  <AccountDrawer ref="accountDrawerRef" />
</template>

<style>
/*
 * Popover 内边距归零，让内部面板自己控制圆角和间距。
 * 迁移前这条写在 `LayoutHeader.vue` 的 `:global()` 里，随顶栏一起生效，
 * 拆出来以后保持同一份效果（下拉、通知、偏好面板的浮层都靠它）。
 */
.ant-popover-inner {
  padding: 0 !important;
}
</style>
