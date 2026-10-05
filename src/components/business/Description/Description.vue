<script setup lang="ts">
import type { VNodeChild } from 'vue'

import { Descriptions, Image, type DescriptionsProps } from 'antdv-next'
import dayjs from 'dayjs'
import { isNil, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'
import { computed, h, useSlots } from 'vue'

import { cn } from '~/utils/cn'
import { getDictLabel, getDictLabels } from '~/utils/dict'

import type {
  DescriptionInstance,
  DescriptionItem,
  DescriptionProps,
} from './types'

const props = withDefaults(defineProps<DescriptionProps>(), {
  column: 3,
  layout: 'horizontal',
  bordered: false,
  colon: true,
  loading: false,
  emptyText: '-',
})

const slots = useSlots()

const dataRef = computed(() => props.data || {})
const filteredSchema = computed(() =>
  (props.schema || []).filter((item) => item.show !== false),
)

function getFieldValue(item: DescriptionItem): unknown {
  const value =
    item.value !== undefined ? item.value : dataRef.value[item.field]
  if (isNil(value) || value === '') return props.emptyText
  return value
}

function renderLabel(item: DescriptionItem): VNodeChild {
  const slotName = `${item.field}-label`
  if (slots[slotName]) return slots[slotName]!({ item, data: dataRef.value })
  if (item.renderLabel)
    return item.renderLabel(item.label || item.field, dataRef.value)
  return item.label || item.field
}

/** 提取 URL：支持字符串 / { url } / 数组 */
function pickUrl(v: unknown): string {
  if (isString(v)) return v
  if (v && typeof v === 'object' && 'url' in v)
    return (v as { url: string }).url
  return ''
}

function renderImage(value: unknown, size = 60): VNodeChild {
  if (isNil(value) || value === props.emptyText)
    return h('span', props.emptyText)
  return h(Image, { src: pickUrl(value), width: size, preview: true })
}

function renderImages(value: unknown, size = 60): VNodeChild {
  if (isNil(value) || value === props.emptyText)
    return h('span', props.emptyText)
  const list: string[] = isArray(value)
    ? value.map(pickUrl)
    : String(value).split(',').filter(Boolean)
  return h(
    'div',
    {},
    list.map((url, i) =>
      h(Image, { key: i, src: url, width: size, height: size }),
    ),
  )
}

function renderValue(item: DescriptionItem): VNodeChild {
  const slotName = item.field
  const value = getFieldValue(item)

  if (slots[slotName])
    return slots[slotName]!({ item, data: dataRef.value, value })

  if (item.render) {
    const result = item.render(value, dataRef.value)
    return isString(result) || typeof result === 'number'
      ? h('span', result)
      : result
  }

  switch (item.type) {
    case 'dict': {
      if (!item.dictType) return h('span', value as string)
      const isMulti = isArray(value) || String(value).includes(',')
      const label = isMulti
        ? getDictLabels(item.dictType, value as never)
        : getDictLabel(item.dictType, value as never)
      return h('span', label)
    }
    case 'image':
      return renderImage(value, item.imageSize || 60)
    case 'images':
      return renderImages(value, item.imageSize || 60)
    case 'date':
      return h(
        'span',
        value === props.emptyText
          ? value
          : dayjs(value as string).format(item.dateFormat || 'YYYY-MM-DD'),
      )
    case 'datetime':
      return h(
        'span',
        value === props.emptyText
          ? value
          : dayjs(value as string).format(
              item.dateFormat || 'YYYY-MM-DD HH:mm:ss',
            ),
      )
    case 'tag':
    case 'text':
    default:
      return isString(value) || typeof value === 'number'
        ? h('span', value)
        : (value as VNodeChild)
  }
}

const items = computed<DescriptionsProps['items']>(
  () =>
    filteredSchema.value.map((item) => ({
      key: item.field,
      label: renderLabel(item),
      content: renderValue(item),
      span: item.span || 1,
      labelStyle: item.labelStyle,
      contentStyle: item.contentStyle,
    })) as DescriptionsProps['items'],
)

const antSize = computed<'default' | 'middle' | 'small'>(() =>
  props.size === 'small' ? 'small' : 'default',
)

const instance: DescriptionInstance = {
  getData: () => props.data,
  setData: () => {
    console.warn('[Description] setData 不支持在只读模式下使用')
  },
}
defineExpose(instance)
</script>

<template>
  <div :class="cn('description-wrapper', className)" :style="style">
    <div
      v-if="loading"
      class="description-loading flex items-center justify-center py-8"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"
      />
    </div>

    <Descriptions
      v-else
      :title="title"
      :items="items"
      :column="column"
      :size="antSize"
      :layout="layout"
      :bordered="bordered"
      :colon="colon"
    />
  </div>
</template>
