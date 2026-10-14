<script setup lang="ts">
import type { VNodeChild } from 'vue';

import type {
  DescriptionInstance,
  DescriptionItem,
  DescriptionProps,
} from './types';

import { computed, h, inject, useSlots } from 'vue';

import { Spinner } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';
import { dayjs } from '@antdv/shared/dayjs';
import { isNil, isString } from 'es-toolkit';
import { isArray } from 'es-toolkit/compat';

import { Descriptions, DescriptionsItem } from '../descriptions';
import { Image } from '../image';
import { DESCRIPTION_DICT_RESOLVER } from './context';

const props = withDefaults(defineProps<DescriptionProps>(), {
  column: 3,
  layout: 'horizontal',
  bordered: false,
  colon: true,
  loading: false,
  emptyText: '-',
});

const slots = useSlots();

/**
 * 字典解析器由宿主注入；缺省时回退到「空值给 `-`、其余显示原值」，
 * 与迁移前字典 store 未加载时的表现一致（见 ./context.ts）。
 */
const dictResolver = inject(DESCRIPTION_DICT_RESOLVER, undefined);

function resolveDictLabel(dictType: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  return dictResolver?.(dictType, value) ?? String(value);
}

function resolveDictLabels(
  dictType: string,
  value: string | string[],
): string {
  if (!value) return '-';
  const values = isArray(value) ? value : String(value).split(',');
  return values.map((v) => resolveDictLabel(dictType, v)).join('、');
}

const dataRef = computed(() => props.data || {});
const filteredSchema = computed(() =>
  (props.schema || []).filter((item) => item.show !== false),
);

/**
 * common-ui 的 `Descriptions` 只认 `default | middle | small` 三档；
 * 对外的 `large`（旧默认档的等价写法）落回 `default`。
 */
const descriptionsSize = computed(() =>
  props.size === 'small' || props.size === 'middle' ? props.size : 'default',
);

function getFieldValue(item: DescriptionItem): unknown {
  const value =
    item.value === undefined ? dataRef.value[item.field] : item.value;
  if (isNil(value) || value === '') return props.emptyText;
  return value;
}

function renderLabel(item: DescriptionItem): VNodeChild {
  const slotName = `${item.field}-label`;
  if (slots[slotName]) return slots[slotName]!({ item, data: dataRef.value });
  if (item.renderLabel)
    return item.renderLabel(item.label || item.field, dataRef.value);
  return item.label || item.field;
}

/** `label` / `content` 可能是字符串、VNode 或插槽数组，交给函数式组件渲染 */
function labelNode(item: DescriptionItem): () => VNodeChild {
  return () => renderLabel(item);
}

function valueNode(item: DescriptionItem): () => VNodeChild {
  return () => renderValue(item);
}

/** 提取 URL：支持字符串 / { url } / 数组 */
function pickUrl(v: unknown): string {
  if (isString(v)) return v;
  if (v && typeof v === 'object' && 'url' in v)
    return (v as { url: string }).url;
  return '';
}

function renderImage(value: unknown, size = 60): VNodeChild {
  if (isNil(value) || value === props.emptyText)
    return h('span', props.emptyText);
  return h(Image, { src: pickUrl(value), width: size, preview: true });
}

function renderImages(value: unknown, size = 60): VNodeChild {
  if (isNil(value) || value === props.emptyText)
    return h('span', props.emptyText);
  const list: string[] = isArray(value)
    ? value.map(pickUrl)
    : String(value).split(',').filter(Boolean);
  return h(
    'div',
    { class: 'flex flex-wrap gap-1' },
    list.map((url, i) =>
      h(Image, { key: i, src: url, width: size, height: size }),
    ),
  );
}

function renderValue(item: DescriptionItem): VNodeChild {
  const slotName = item.field;
  const value = getFieldValue(item);

  if (slots[slotName])
    return slots[slotName]!({ item, data: dataRef.value, value });

  if (item.render) {
    const result = item.render(value, dataRef.value);
    return isString(result) || typeof result === 'number'
      ? h('span', result)
      : result;
  }

  switch (item.type) {
    case 'dict': {
      if (!item.dictType) return h('span', value as string);
      const isMulti = isArray(value) || String(value).includes(',');
      const label = isMulti
        ? resolveDictLabels(item.dictType, value as string | string[])
        : resolveDictLabel(item.dictType, value);
      return h('span', label);
    }
    case 'image': {
      return renderImage(value, item.imageSize || 60);
    }
    case 'images': {
      return renderImages(value, item.imageSize || 60);
    }
    case 'date': {
      return h(
        'span',
        value === props.emptyText
          ? value
          : dayjs(value as string).format(item.dateFormat || 'YYYY-MM-DD'),
      );
    }
    case 'datetime': {
      return h(
        'span',
        value === props.emptyText
          ? value
          : dayjs(value as string).format(
              item.dateFormat || 'YYYY-MM-DD HH:mm:ss',
            ),
      );
    }
    case 'tag':
    case 'text':
    default: {
      return isString(value) || typeof value === 'number'
        ? h('span', value)
        : (value as VNodeChild);
    }
  }
}

const instance: DescriptionInstance = {
  getData: () => props.data,
  setData: () => {
    console.warn('[Description] setData 不支持在只读模式下使用');
  },
};
defineExpose(instance);
</script>

<template>
  <div :class="cn('description-wrapper relative', className)" :style="style">
    <div
      v-if="loading"
      class="description-loading flex items-center justify-center py-8"
    >
      <div class="relative flex h-10 w-full items-center justify-center">
        <Spinner class="size-6 text-gray-400" />
      </div>
    </div>

    <Descriptions
      v-else
      :title="title"
      :column="column"
      :size="descriptionsSize"
      :layout="layout"
      :bordered="bordered"
    >
      <DescriptionsItem
        v-for="item in filteredSchema"
        :key="item.field"
        :span="item.span || 1"
      >
        <template #label>
          <span :style="item.labelStyle">
            <component :is="labelNode(item)" />
            <template v-if="colon">:</template>
          </span>
        </template>
        <div :style="item.contentStyle" class="min-w-0">
          <component :is="valueNode(item)" />
        </div>
      </DescriptionsItem>
    </Descriptions>
  </div>
</template>
