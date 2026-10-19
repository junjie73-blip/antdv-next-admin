<script setup lang="ts">
import type { ComponentType } from '@antdv/form-ui';

import type { BasicColumn, Recordable } from '../types';

import { computed, nextTick, ref, watch } from 'vue';

import { getComponent } from '@antdv/form-ui';
import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

const props = defineProps<{
  column?: any | BasicColumn;
  dataIndex?: any | string | string[];
  record: Recordable;
  value?: any;
}>();

const emit = defineEmits<{
  (
    e: 'save',
    payload: {
      record: Recordable;
      dataIndex: any;
      value: any;
      column: any;
    },
  ): void;
  (
    e: 'cancel',
    payload: { record: Recordable; dataIndex: any; column: any },
  ): void;
  (
    e: 'change',
    payload: {
      record: Recordable;
      dataIndex: any;
      value: any;
      column: any;
    },
  ): void;
}>();

// 是否处于编辑状态
const isEditing = ref(false);
// 编辑值
const editValue = ref<any>(props.value);
const inputRef = ref<any>(null);

// 监听值变化
watch(
  () => props.value,
  (newVal) => {
    editValue.value = newVal;
  },
);

// 获取编辑组件类型
const getEditComponent = computed(() => {
  const editComponent = props.column?.editComponent;
  if (editComponent) return editComponent;

  // 根据值类型推断组件
  const val = props.value;
  if (typeof val === 'boolean') return 'Switch';
  if (typeof val === 'number') return 'InputNumber';
  return 'Input';
});

/** 只有文本类组件靠回车保存，其余组件改值即保存（与旧行为一致） */
const isTextLike = computed(() => {
  const component = getEditComponent.value;
  return component === 'Input' || component === 'InputNumber';
});

const editComponentIs = computed(() => {
  const name = getEditComponent.value as ComponentType;
  // ApiSelect/ApiTreeSelect 等未内置类型退回 Input（旧实现的 default 分支）
  return getComponent(name) ?? getComponent('Input');
});

// 开始编辑
const startEdit = () => {
  isEditing.value = true;
  editValue.value = props.value;
  nextTick(() => {
    inputRef.value?.focus?.();
  });
};

// 保存编辑
const handleSave = () => {
  isEditing.value = false;
  emit('save', {
    record: props.record,
    dataIndex: props.dataIndex,
    value: editValue.value,
    column: props.column,
  });
};

// 取消编辑
const handleCancel = () => {
  isEditing.value = false;
  editValue.value = props.value;
  emit('cancel', {
    record: props.record,
    dataIndex: props.dataIndex,
    column: props.column,
  });
};

// 处理值变化
const handleChange = (val: any) => {
  editValue.value = val;
  emit('change', {
    record: props.record,
    dataIndex: props.dataIndex,
    value: val,
    column: props.column,
  });

  // 文本组件等回车/点勾保存，其他组件改完即保存
  if (!isTextLike.value) {
    handleSave();
  }
};

const handleKeydownEnter = (e: KeyboardEvent) => {
  if (isTextLike.value) {
    e.preventDefault?.();
    handleSave();
  }
};
</script>

<template>
  <span v-if="!column?.edit && !column?.editRow" :class="cn('inline-block')">{{
    value
  }}</span>

  <div
    v-else-if="isEditing"
    class="flex items-center gap-2"
    @keydown.enter="handleKeydownEnter"
  >
    <div class="flex-1">
      <component
        :is="editComponentIs"
        ref="inputRef"
        :value="editValue"
        v-bind="column?.editComponentProps || {}"
        @update:value="handleChange"
      />
    </div>
    <div class="flex gap-1">
      <Button variant="ghost" size="sm" title="保存" @click="handleSave">
        <Icon icon="ant-design:check-outlined" />
      </Button>
      <Button variant="ghost" size="sm" title="取消" @click="handleCancel">
        <Icon icon="ant-design:close-outlined" />
      </Button>
    </div>
  </div>

  <div
    v-else
    class="group flex cursor-pointer items-center gap-1"
    title="点击编辑"
    @click="startEdit"
  >
    <span>{{ value }}</span>
    <Icon
      class="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500"
      icon="ant-design:edit-outlined"
    />
  </div>
</template>
