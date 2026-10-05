<script setup lang="ts">
import { ShopOutlined } from '@antdv-next/icons'
import { useVModel } from '@vueuse/core'
import { Select } from 'antdv-next'
import { computed, onMounted } from 'vue'

import { useTenantStore } from '~/stores/modules/tenant'

interface Props {
  modelValue?: string
  valueType?: 'code' | 'id'
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
  size?: 'small' | 'middle' | 'large'
  onlyEnabled?: boolean
  immediate?: boolean
  showSearch?: boolean
  class?: string
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

// useVModel：标准 v-model 双向绑定
const innerValue = useVModel(props, 'modelValue', emit, { passive: true })

const selectOptions = computed(() =>
  tenantStore.options.map((t) => ({
    value: props.valueType === 'id' ? t.tenantId : t.tenantCode,
    label: t.tenantName,
    code: t.tenantCode,
    tenantId: t.tenantId,
  })),
)

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

function handleChange(value: string | undefined) {
  const option = selectOptions.value.find((o) => o.value === value)
  emit('change', value, option)
}

onMounted(() => {
  if (props.immediate) {
    tenantStore.load().catch(() => {})
  }
})

defineExpose({
  refresh: () => tenantStore.load(true),
})
</script>

<template>
  <Select
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

    <template #optionRender="{ option }">
      <div class="flex items-center justify-between gap-3">
        <span>{{ option.data.label }}</span>
        <span class="text-xs text-stone-400">{{ option.data.code }}</span>
      </div>
    </template>

    <template #notFoundContent>
      <a-empty :image="false" description="暂无租户数据" class="!py-4 !text-xs !text-stone-400" />
    </template>
  </Select>
</template>
