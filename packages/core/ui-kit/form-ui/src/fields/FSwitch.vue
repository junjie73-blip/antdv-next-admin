<script setup lang="ts">
import { Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

interface Props {
  checkedChildren?: any;
  checkedValue?: any;
  disabled?: boolean;
  id?: string;
  size?: string;
  unCheckedChildren?: any;
  unCheckedValue?: any;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  checkedChildren: undefined,
  checkedValue: undefined,
  disabled: false,
  size: undefined,
  unCheckedChildren: undefined,
  unCheckedValue: undefined,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const onValue = () =>
  props.checkedValue === undefined ? true : props.checkedValue;
const offValue = () =>
  props.unCheckedValue === undefined ? false : props.unCheckedValue;

const checked = () => props.value === onValue();
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <Switch
      :model-value="checked()"
      :disabled="disabled"
      :id="id"
      data-field-control
      :class="cn()"
      @update:model-value="
        (v: boolean) => emit('update:value', v ? onValue() : offValue())
      "
    />
    <span v-if="checked() && checkedChildren !== undefined" class="text-sm">
      {{ checkedChildren }}
    </span>
    <span
      v-else-if="!checked() && unCheckedChildren !== undefined"
      class="text-sm text-muted-foreground"
    >
      {{ unCheckedChildren }}
    </span>
  </span>
</template>
