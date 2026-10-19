<script setup lang="ts">
import { computed } from 'vue';

import { useLayoutI18n } from '@antdv/layout-ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@antdv/shadcn-ui';
import { useAppStore } from '@antdv/stores';
import { Icon } from '@iconify/vue';

import { layoutHost } from '../../host';
import WidgetButton from '../widget-button.vue';

defineOptions({ name: 'LocaleSwitcher' });

const appStore = useAppStore();
const { t } = useLayoutI18n();

/**
 * 候选语言与它们的自称名由宿主注入（`configureLayoutHost({ locales })`）。
 *
 * 名单来自应用的文案表，新增一门语言只改 `lang/`，这个组件不用跟着动；
 * 名字用该语言自称（English 不译成「英语」），那张表也住在宿主。
 */
const items = computed(() => layoutHost.locales);
const locale = computed(() => appStore.locale);
const currentLabel = computed(
  () =>
    items.value.find((item) => item.code === locale.value)?.label ??
    locale.value,
);

/** 写入只有一条路：改偏好。语言包、`<html lang>`、dayjs、antd 文案由宿主的 locale 效应统一展开 */
function handleSelect(code: string) {
  appStore.updateSetting({ locale: code });
}

/**
 * 当前语言那一项要"看得出是它"：旧菜单靠 selectedKeys 高亮，
 * 换成菜单项之后自己给选中态（同一套 accent 底色 + 一个勾），
 * 并把 `aria-current` 挂上去，读屏与用例都能断言。
 */
function itemClass(code: string) {
  return code === locale.value
    ? 'bg-accent text-accent-foreground'
    : 'text-slate-600 dark:text-slate-300';
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <WidgetButton
        :label="`${t('header.language')}`"
        :text="currentLabel"
        aria-haspopup="menu"
        data-testid="locale-switcher"
      >
        <Icon icon="carbon:language" class="text-lg" />
      </WidgetButton>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="min-w-[150px]" side="bottom">
      <DropdownMenuItem
        v-for="item in items"
        :key="item.code"
        :aria-current="item.code === locale ? 'true' : undefined"
        :class="itemClass(item.code)"
        :data-testid="`locale-option-${item.code}`"
        @click="handleSelect(item.code)"
      >
        <span class="truncate">{{ item.label }}</span>
        <Icon
          v-if="item.code === locale"
          class="ml-auto size-4 shrink-0"
          icon="carbon:checkmark"
        />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
