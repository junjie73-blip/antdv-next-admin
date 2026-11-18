<script setup lang="ts">
/**
 * 日志详情抽屉：统一「操作日志 / 登录日志 / 客户端日志 / 验证码日志」四类详情的渲染，
 * 消除各页面手写 timeline / Descriptions / Description 三套互不一致的实现。
 * 内部基于 common-ui 的 `Description`（接受 DescriptionItem[]，支持 render 自定义），
 * 调用方只需传入 schema 与记录即可。
 */
import type { DescriptionItem } from '@antdv/common-ui';

import { ref } from 'vue';

import { Description } from '@antdv/common-ui';
import { BasicDrawer, useDrawer } from '@antdv/popup-ui';

const props = withDefaults(
  defineProps<{
    title?: string;
    width?: number;
    column?: number;
    schema: DescriptionItem[];
  }>(),
  { title: '日志详情', width: 560, column: 2 },
);

const record = ref<null | Record<string, any>>(null);
const [register, methods] = useDrawer();

function open(rec: Record<string, any>) {
  record.value = rec;
  methods.openDrawer();
}

defineExpose({ open });
</script>

<template>
  <BasicDrawer
    :title="title"
    :width="width"
    :show-footer="false"
    @register="register"
  >
    <Description
      v-if="record"
      :data="record"
      :schema="schema"
      :column="column"
      :label-width="96"
    />
  </BasicDrawer>
</template>
