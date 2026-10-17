<script setup lang="ts">
import { inject, provide, reactive, watch } from 'vue';

import type { GlobalConfig, ResolvedGlobalConfig } from './types';

import { DEFAULT_GLOBAL_CONFIG, GLOBAL_CONFIG_KEY, textsByLocale } from './types';

defineOptions({ name: 'ConfigProvider' });

const props = withDefaults(defineProps<GlobalConfig>(), {
  cancelText: undefined,
  componentSize: undefined,
  locale: undefined,
  okText: undefined,
  placeholder: undefined,
});

/**
 * 嵌套语义：内层只覆盖自己显式给出的字段，其余继承外层。
 *
 * 继承的是外层的**成品文案**，所以外层写死 `okText: 'Confirm'` 时内层不会退回
 * "确定/OK"；但内层自己改了 `locale` 就按新语言重新展开词条 —— 换语言的人
 * 要的是那种语言的说法，不是祖先的自定义词。
 */
const outer = inject(GLOBAL_CONFIG_KEY, null);

/**
 * 提供 reactive 对象而不是 computed 的快照：注入值是"引用"，
 * 给 `.value` 会让外层改配置时内层与消费方都收不到更新。
 */
const config = reactive<ResolvedGlobalConfig>({
  ...DEFAULT_GLOBAL_CONFIG,
  ...outer,
});

watch(
  () => [
    props.cancelText,
    props.componentSize,
    props.locale,
    props.okText,
    props.placeholder,
  ],
  () => {
    const base = outer ?? DEFAULT_GLOBAL_CONFIG;
    const locale = props.locale ?? base.locale;
    const texts = outer && props.locale === undefined ? outer : textsByLocale(locale);
    config.cancelText = props.cancelText ?? texts.cancelText;
    config.componentSize = props.componentSize ?? base.componentSize;
    config.locale = locale;
    config.okText = props.okText ?? texts.okText;
    config.placeholder = props.placeholder ?? base.placeholder;
  },
  { immediate: true },
);

provide(GLOBAL_CONFIG_KEY, config);
</script>

<template>
  <slot></slot>
</template>
