<script setup lang="ts">
import type { LocaleType } from '~/composables/web/useLocale';

import { computed } from 'vue';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import { localeLabels, useLocale } from '~/composables/web/useLocale';

import WidgetButton from '../widgets/components/WidgetButton.vue';

defineOptions({ name: 'LocaleSwitcher' });

const { locale, t, setLocale, availableLocales } = useLocale();

/** 选项取自文案表里已注册的 locale：新增一门语言只改 `lang/`，这里不用跟着动 */
const items = computed(() =>
  availableLocales.map((code: string) => ({
    key: code,
    label: localeLabels[code as LocaleType],
  })),
);

const currentLabel = computed(() => localeLabels[locale.value]);

function handleSelect(code: string) {
  setLocale(code as LocaleType);
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
        :key="item.key"
        :aria-current="item.key === locale ? 'true' : undefined"
        :class="itemClass(item.key)"
        :data-testid="`locale-option-${item.key}`"
        @click="handleSelect(item.key)"
      >
        <span class="truncate">{{ item.label }}</span>
        <Icon
          v-if="item.key === locale"
          class="ml-auto size-4 shrink-0"
          icon="carbon:checkmark"
        />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
