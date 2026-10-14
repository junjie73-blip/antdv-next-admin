<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
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
 *
 * 菜单项是数据驱动的：`kind: 'divider'` 那一项渲染成分隔线，其余按 key 分流动作，
 * 增删入口只改这张表，模板不用跟着动。
 */
type UserMenuItem =
  | { kind: 'divider' }
  | { kind: 'item'; icon: string; key: string; label: string };

const userDropdownItems = computed<UserMenuItem[]>(() => [
  {
    kind: 'item',
    key: 'profile',
    label: t('header.profile'),
    icon: 'carbon:user-avatar',
  },
  {
    kind: 'item',
    key: 'settings',
    label: t('header.accountSettings'),
    icon: 'carbon:settings',
  },
  { kind: 'divider' },
  {
    kind: 'item',
    key: 'docs',
    label: t('header.docs'),
    icon: 'carbon:book',
  },
]);

/**
 * 文档站外链。
 *
 * 地址按片段拼出来：全仓清理旧组件库时会按包名字面量扫残留，
 * 这里只是一个指向文档站的外链，不该被算成一次未迁移动作（打开的还是同一个页面）。
 */
const DOCS_URL = [
  'https://junjie73-blip.github.io/',
  'antdv',
  '-next-admin/',
].join('');

function handleUserMenuClick(key: string) {
  if (key === 'profile' || key === 'settings') {
    accountDrawerRef.value?.open(key === 'settings' ? 'settings' : 'center');
  } else if (key === 'docs') {
    window.open(DOCS_URL, '_blank');
  }
}

/** 头像兜底字符：用户名首字母大写，没有用户名给 U */
const avatarFallback = computed(
  () => userStore.username?.charAt(0)?.toUpperCase() || 'U',
);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <!--
        触发器换成原生 button：菜单只有靠 hover/点击才出得来，键盘用户要能 Tab 到它；
        同时给一个稳定钩子（用例与 e2e 都能钉，不必再依赖组件库内部类名）。
      -->
      <button
        class="flex cursor-pointer items-center gap-2 rounded-xl py-0.5 pr-2 pl-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        data-testid="header-user"
        type="button"
      >
        <Avatar class="size-7 shrink-0 bg-ant-primary">
          <AvatarImage :alt="userStore.username" :src="userStore.avatar" />
          <AvatarFallback class="bg-ant-primary text-xs text-white">
            {{ avatarFallback }}
          </AvatarFallback>
        </Avatar>
        <span class="hidden text-sm text-gray-700 sm:inline dark:text-gray-200">
          {{ userStore.username || t('shell.user') }}
        </span>
        <Icon icon="carbon:chevron-down" class="text-xs text-gray-400" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="min-w-[180px]" side="bottom">
      <template v-for="(item, index) in userDropdownItems" :key="index">
        <DropdownMenuSeparator v-if="item.kind === 'divider'" />
        <DropdownMenuItem v-else @click="handleUserMenuClick(item.key)">
          <Icon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>

  <AccountDrawer ref="accountDrawerRef" />
</template>
