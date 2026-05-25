<script setup lang="ts">
import type { DescriptionInstance, DescriptionItem, DescriptionProps } from './types'
import { computed, ref } from 'vue'
import { cn } from '@/utils/cn'

/**
 * Description - 描述列表组件
 * 对标 Vben Admin 的 Description 组件
 */

const props = withDefaults(defineProps<DescriptionProps>(), {
  column: 3,
  size: 'default',
  layout: 'horizontal',
  bordered: false,
  colon: true,
  loading: false,
  emptyText: '-',
})

// 数据源
const dataRef = ref(props.data)

/**
 * 计算尺寸类名
 */
const sizeClassName = computed(() => {
  const sizeMap: Record<string, string> = {
    small: 'text-sm',
    default: 'text-base',
    large: 'text-lg',
  }
  return sizeMap[props.size] || sizeMap.default
})

/**
 * 计算过滤后的 schema
 */
const filteredSchema = computed(() => {
  return props.schema?.filter(item => item.show !== false) || []
})

/**
 * 获取字段值
 */
function getFieldValue(item: DescriptionItem) {
  const value = item.value !== undefined ? item.value : dataRef.value?.[item.field]
  return value !== undefined && value !== null && value !== '' ? value : props.emptyText
}

/**
 * 计算内容样式
 */
function getContentStyle(item: DescriptionItem) {
  return {
    ...item.contentStyle,
  }
}

/**
 * 计算标签样式
 */
function getLabelStyle(item: DescriptionItem) {
  return {
    ...item.labelStyle,
  }
}

/**
 * 计算网格列宽
 */
const gridStyle = computed(() => {
  return {
    gridTemplateColumns: `repeat(${props.column}, minmax(0, 1fr))`,
  }
})

/**
 * 组件实例方法
 */
const instance: DescriptionInstance = {
  getData: () => dataRef.value,
  setData: (data: Recordable) => {
    dataRef.value = data
  },
}

defineExpose(instance)
</script>

<template>
  <div
    :class="cn(
      'description',
      'bg-white',
      sizeClassName,
      className,
    )"
    :style="style"
  >
    <!-- 标题 -->
    <div
      v-if="title"
      class="description-title mb-4 font-medium text-gray-900"
    >
      {{ title }}
    </div>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="description-loading flex items-center justify-center py-8"
    >
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>

    <!-- 内容区域 -->
    <div
      v-else
      :class="cn(
        'description-content',
        bordered && 'border border-gray-200 rounded',
        !bordered && 'border-b border-gray-200',
      )"
    >
      <!-- 无边框模式 - 网格布局 -->
      <div
        v-if="!bordered"
        class="grid gap-4"
        :style="gridStyle"
      >
        <div
          v-for="item in filteredSchema"
          :key="item.field"
          :class="cn(
            'description-item',
            'flex',
            layout === 'horizontal' && 'flex-row items-start',
            layout === 'vertical' && 'flex-col',
            item.span && item.span > 1 && `col-span-${item.span}`,
          )"
          :style="{ gridColumn: item.span ? `span ${item.span} / span ${item.span}` : undefined }"
        >
          <!-- 标签 -->
          <div
            :class="cn(
              'description-label',
              'text-gray-500 flex-shrink-0',
              layout === 'horizontal' && 'w-24 mr-4',
              layout === 'vertical' && 'mb-1',
            )"
            :style="getLabelStyle(item)"
          >
            <template v-if="item.renderLabel">
              <component :is="item.renderLabel(item.label || item.field, dataRef)" />
            </template>
            <template v-else>
              {{ item.label || item.field }}{{ colon && layout === 'horizontal' ? '：' : '' }}
            </template>
          </div>

          <!-- 内容 -->
          <div
            class="description-content-value text-gray-900 flex-1"
            :style="getContentStyle(item)"
          >
            <template v-if="item.render">
              <component :is="item.render(getFieldValue(item), dataRef)" />
            </template>
            <template v-else>
              {{ getFieldValue(item) }}
            </template>
          </div>
        </div>
      </div>

      <!-- 有边框模式 - 表格布局 -->
      <table
        v-else
        class="description-table w-full border-collapse"
      >
        <tbody>
          <tr
            v-for="(row, rowIndex) in Math.ceil(filteredSchema.length / column)"
            :key="rowIndex"
            class="border-b border-gray-200 last:border-b-0"
          >
            <template
              v-for="(item, colIndex) in filteredSchema.slice(rowIndex * column, (rowIndex + 1) * column)"
              :key="item.field"
            >
              <!-- 标签单元格 -->
              <td
                :class="cn(
                  'description-label-cell',
                  'py-3 px-4 bg-gray-50 text-gray-500 font-medium',
                  'border-r border-gray-200 last:border-r-0',
                  'w-1/6',
                )"
              >
                <template v-if="item.renderLabel">
                  <component :is="item.renderLabel(item.label || item.field, dataRef)" />
                </template>
                <template v-else>
                  {{ item.label || item.field }}{{ colon ? '：' : '' }}
                </template>
              </td>

              <!-- 内容单元格 -->
              <td
                :class="cn(
                  'description-content-cell',
                  'py-3 px-4 text-gray-900',
                  'border-r border-gray-200 last:border-r-0',
                  item.span && item.span > 1 ? `w-${(item.span * 2 - 1)}/6` : 'w-1/6',
                )"
                :colspan="item.span ? item.span * 2 - 1 : 1"
              >
                <template v-if="item.render">
                  <component :is="item.render(getFieldValue(item), dataRef)" />
                </template>
                <template v-else>
                  {{ getFieldValue(item) }}
                </template>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.description-item:last-child {
  border-bottom: none;
}
</style>
