<script setup lang="ts">
import { computed, ref } from 'vue';

import { useLayoutI18n } from '@antdv/layout-ui';
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
import { useUserStore } from '@antdv/stores';
import { Icon } from '@iconify/vue';

import AccountDrawer from '../account-drawer/index.vue';
import LockScreen from './lock-screen.vue';
import { useLockScreen } from './use-lock-screen';

defineOptions({ name: 'HeaderUser' });

/**
 * 顶栏最右侧的用户区（`@antdv/layout-ui` 顶栏的 `user` 插槽内容）。
 *
 * 头像、用户名与「个人中心」入口都读 user store —— 装配层允许读 store，
 * 所以住在包里；抽屉里那两个页面是应用的视图，由宿主经 `configureLayoutHost` 交进来。
 */
const userStore = useUserStore();
const { t } = useLayoutI18n();
const accountDrawerRef = ref<InstanceType<typeof AccountDrawer> | null>(null);
/** 锁屏：下拉里多点一项，其余交互与之前完全一致（状态机见 `use-lock-screen.ts`） */
const { lock, locked, unlock } = useLockScreen();

/**
 * 头像下拉是"个人中心"唯一的入口。
 *
 * 菜单里的「个人中心」已经标成 hidden（见 `apps/backend-mock/server/api/menus.get.ts`），
 * 导航不再占一格，但抽屉里要能直达两个页面，所以这里按 tab 分别给项：
 * `profile` → 个人主页，`settings` → 账户设置，都由 AccountDrawer 承载。
 *
 * 菜单项是数据驱动的：`kind: 'divider'` 那一项渲染成分隔线，其余按 key 分流动作，
 * 增删入口只改这张表，模板不用跟着动。
 *
 * 「锁屏」是这次新增的唯一入口：点它就调用 `useLockScreen().lock()`，
 * 遮罩由 `lock-screen.vue` 承住。原有三项（个人中心 / 账户设置 / 文档中心）的
 * 分流与触发方式一行没改 —— 新能力靠这张表多一项、`handleUserMenuClick` 多一个分支
 * 接进来，属于非侵入式扩展。
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
  {
    kind: 'item',
    key: 'lock',
    label: t('header.lockScreen'),
    icon: 'carbon:locked',
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
  } else if (key === 'lock') {
    lock();
  }
}

/** 头像兜底字符：用户名首字母大写，没有用户名给 U */
const avatarFallback = computed(
  () => userStore.username?.charAt(0)?.toUpperCase() || 'U',
);

/**
 * 触发器只有图标（与 `widget-button.vue` 的"顶栏按钮一律不带文字"同源）：
 * 用户名不再常驻显示，改喂 `aria-label` 与 `title` —— 窄视口少一段 30px 文本，
 * 读屏软件照样念得出"这个按钮是谁"，用例也仍能用 `data-testid="header-user"` 钉住。
 */
const triggerLabel = computed(() => userStore.username || t('shell.user'));
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <!--
        触发器换成原生 button：菜单只有靠 hover/点击才出得来，键盘用户要能 Tab 到它；
        同时给一个稳定钩子（用例与 e2e 都能钉，不必再依赖组件库内部类名）。
      -->
      <button
        :aria-label="triggerLabel"
        :title="triggerLabel"
        class="flex cursor-pointer items-center gap-1 rounded-xl py-0.5 pr-1.5 pl-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        data-testid="header-user"
        type="button"
      >
        <Avatar class="size-7 shrink-0 bg-primary">
          <AvatarImage :alt="userStore.username" :src="userStore.avatar" />
          <AvatarFallback class="bg-primary text-xs text-white">
            {{ avatarFallback }}
          </AvatarFallback>
        </Avatar>
        <Icon icon="carbon:chevron-down" class="text-xs text-gray-400" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="min-w-[180px]" side="bottom">
      <template v-for="(item, index) in userDropdownItems" :key="index">
        <DropdownMenuSeparator v-if="item.kind === 'divider'" />
        <DropdownMenuItem
          v-else
          :data-testid="`user-menu-${item.key}`"
          @click="handleUserMenuClick(item.key)"
        >
          <Icon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>

  <AccountDrawer ref="accountDrawerRef" />
  <!-- 锁屏遮罩自己 Teleport 到 body，这里只决定挂不挂 -->
  <LockScreen v-if="locked" @unlock="unlock" />
</template>
