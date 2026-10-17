<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { Empty } from '@antdv/common-ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';
import { useTenantStore } from '~/stores/modules/tenant';

interface Props {
  modelValue?: string;
  valueType?: 'code' | 'id';
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  size?: 'large' | 'middle' | 'small';
  onlyEnabled?: boolean;
  immediate?: boolean;
  showSearch?: boolean;
  class?: string;
  dropdownClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  valueType: 'code',
  placeholder: '请选择租户',
  disabled: false,
  allowClear: true,
  class: undefined,
  dropdownClass: undefined,
  modelValue: undefined,
  size: 'middle',
  onlyEnabled: true,
  immediate: true,
  showSearch: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined];
  change: [value: string | undefined, option: any];
}>();

const tenantStore = useTenantStore();

// useVModel：标准 v-model 双向绑定（对外契约仍是 code 字符串 / id 数字原样回抛）
const innerValue = useVModel(props, 'modelValue', emit, { passive: true });

const selectOptions = computed(() =>
  tenantStore.options.map((t: any) => ({
    value: props.valueType === 'id' ? t.tenantId : t.tenantCode,
    label: t.tenantName,
    code: t.tenantCode,
    tenantId: t.tenantId,
  })),
);

/** reka Select 的取值只能是字符串：用 String() 桥接数字 id */
const selectValue = computed(() =>
  innerValue.value === undefined || innerValue.value === null
    ? undefined
    : String(innerValue.value),
);

function handleChange(val: any) {
  // 回填时按 valueType 还原成调用方期望的类型（id → Number）
  const str = String(val);
  const raw: number | string = props.valueType === 'id' ? Number(str) : str;
  innerValue.value = raw as unknown as string | undefined;
  const option = selectOptions.value.find(
    (o: any) => String(o.value) === String(raw),
  );
  emit('change', raw as unknown as string | undefined, option);
}

onMounted(() => {
  if (props.immediate) {
    tenantStore.load().catch(() => {});
  }
});

defineExpose({
  refresh: () => tenantStore.load(true),
});
</script>

<template>
  <Select
    :model-value="selectValue"
    :disabled="disabled || tenantStore.loading"
    @update:model-value="handleChange"
  >
    <SelectTrigger
      :class="props.class"
      :size="size === 'small' ? 'sm' : 'default'"
    >
      <span class="flex items-center gap-2">
        <Icon icon="carbon:store" class="size-4 text-stone-400" />
        <SelectValue :placeholder="placeholder" />
      </span>
    </SelectTrigger>
    <SelectContent :class="dropdownClass">
      <SelectItem
        v-for="opt in selectOptions"
        :key="String(opt.value)"
        :value="String(opt.value)"
      >
        <span class="flex items-center justify-between gap-3">
          <span>{{ opt.label }}</span>
          <span class="text-xs text-stone-400">{{ opt.code }}</span>
        </span>
      </SelectItem>
      <div v-if="selectOptions.length === 0" class="px-2 py-3">
        <Empty :image="false" description="暂无租户数据" class="py-0 text-xs" />
      </div>
    </SelectContent>
  </Select>
</template>
