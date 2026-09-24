<script setup lang="ts">
import { ShopOutlined } from '@antdv-next/icons'
import { computed, onMounted, watch } from 'vue'

import { useTenantStore } from '~/stores/modules/tenant'

interface Props {
  /** v-model 绑定的值：租户编码 or 租户 ID */
  modelValue?: string
  /** 绑定类型：'code'（默认，登录用）| 'id'（管理端用） */
  valueType?: 'code' | 'id'
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
  size?: 'small' | 'middle' | 'large'
  /** 是否只返回启用租户 */
  onlyEnabled?: boolean
  /** 是否立即加载 */
  immediate?: boolean
  /** 是否显示搜索 */
  showSearch?: boolean
  /** 支持传入自定义样式类 */
  class?: string
  /** 支持下拉框样式 */
  dropdownClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  valueType: 'code',
  placeholder: '请选择租户',
  disabled: false,
  allowClear: true,
  size: 'middle',
  onlyEnabled: true,
  immediate: true,
  showSearch: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
  change: [value: string | undefined, option: any]
}>()

const tenantStore = useTenantStore()

// ============================================================
// v-model 双向绑定
// ============================================================
const innerValue = computed<string | undefined>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// ============================================================
// 下拉选项（根据 valueType 决定 value 是 code 还是 id）
// ============================================================
const selectOptions = computed(() => {
  return tenantStore.options.map((t) => ({
    value: props.valueType === 'id' ? t.tenantId : t.tenantCode,
    label: t.tenantName,
    code: t.tenantCode,
    tenantId: t.tenantId,
  }))
})

// ============================================================
// 搜索过滤
// ============================================================
function filterOption(input: string, option: any): boolean {
  if (!input) return true
  const keyword = input.toLowerCase()
  return (
    String(option.label || '')
      .toLowerCase()
      .includes(keyword) ||
    String(option.code || '')
      .toLowerCase()
      .includes(keyword)
  )
}

// ============================================================
// 事件
// ============================================================
function handleChange(value: string | undefined) {
  const option = selectOptions.value.find((o) => o.value === value)
  emit('change', value, option)
}

// ============================================================
// 生命周期
// ============================================================
onMounted(() => {
  if (props.immediate) {
    // ⭐ 静默失败：不弹 message，父组件自行处理
    tenantStore.load().catch(() => {})
  }
})

// ⭐ 暴露 refresh 给父组件
defineExpose({
  refresh: () => tenantStore.load(true),
})
</script>

<template>
  <a-select
    v-model:value="innerValue"
    :loading="tenantStore.loading"
    :placeholder="placeholder"
    :disabled="disabled"
    :allow-clear="allowClear"
    :size="size"
    :show-search="showSearch"
    :filter-option="filterOption"
    :options="selectOptions"
    :class="props.class"
    :dropdown-class-name="dropdownClass"
    @change="handleChange"
  >
    <template #suffixIcon>
      <ShopOutlined class="text-stone-400" />
    </template>

    <!-- 自定义选项渲染 -->
    <template #optionRender="{ option }">
      <div class="flex items-center justify-between gap-3">
        <span>{{ option.data.label }}</span>
        <span class="text-xs text-stone-400">{{ option.data.code }}</span>
      </div>
    </template>

    <!-- 无数据 -->
    <template #notFoundContent>
      <a-empty :image="false" description="暂无租户数据" class="!py-4 !text-xs !text-stone-400" />
    </template>
  </a-select>
</template>
