<script setup lang="ts">
import type { LocaleType } from '~/composables/web/useLocale';

import { computed } from 'vue';

import { Icon } from '@iconify/vue';
import { Dropdown } from 'antdv-next';
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

function handleSelect({ key }: { key: string }) {
  setLocale(key as LocaleType);
}
</script>

<template>
  <Dropdown
    placement="bottomRight"
    :trigger="['click']"
    :menu="{ items, selectedKeys: [locale], onClick: handleSelect }"
  >
    <WidgetButton
      :label="`${t('header.language')}`"
      :text="currentLabel"
      aria-haspopup="menu"
      data-testid="locale-switcher"
    >
      <Icon icon="carbon:language" class="text-lg" />
    </WidgetButton>
  </Dropdown>
</template>
