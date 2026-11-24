<script setup lang="ts">
/**
 * 通用记录详情抽屉。
 *
 * 取代原先的「记录详情」独立页面路由：列表页（如系统管理-用户）的「详情」按钮
 * 统一在这里以抽屉展示，不再跳出当前页。数据契约与 `GET /system/record/:module/:id`
 * 完全沿用原 `system/record-detail` 页面 —— 后端分组定义、sections/record 结构、
 * 格式化逻辑都不变，因此「统一走抽屉」不涉及任何接口或数据结构改动。
 */
import type { RecordDetailData } from '~/api/monitor';

import { ref } from 'vue';

import { Alert, Descriptions, DescriptionsItem } from '@antdv/common-ui';
import { BasicDrawer, useDrawer } from '@antdv/popup-ui';
import { getRecordDetail } from '~/api/monitor';
import { displayValue, unwrapApi } from '~/utils/log-format';

const detail = ref<null | RecordDetailData>(null);
const loading = ref(false);
const error = ref('');
const [register, methods] = useDrawer();

/** 打开抽屉并按 module + id 拉取详情；module 由调用方按业务模块传入 */
async function open(module: string, id: string) {
  detail.value = null;
  error.value = '';
  loading.value = true;
  methods.openDrawer();
  try {
    const res = await getRecordDetail(module, id);
    detail.value = unwrapApi<null | RecordDetailData>(res) ?? null;
  } catch (error) {
    error.value = error instanceof Error ? error.message : '详情接口暂不可用';
  } finally {
    loading.value = false;
  }
}

defineExpose({ open });
</script>

<template>
  <BasicDrawer
    :title="detail?.title ?? '记录详情'"
    :width="640"
    :show-footer="false"
    :loading="loading"
    @register="register"
  >
    <template v-if="detail && detail.record">
      <div
        v-for="section in detail.sections"
        :key="section.title"
        class="mb-5 last:mb-0"
      >
        <div class="mb-2 text-sm font-semibold">{{ section.title }}</div>
        <Descriptions :column="2" bordered size="middle">
          <DescriptionsItem
            v-for="field in section.fields"
            :key="`${section.title}-${field.key}`"
            :label="field.label"
          >
            {{ displayValue(detail.record[field.key]) }}
          </DescriptionsItem>
        </Descriptions>
      </div>
      <p class="text-muted-foreground mt-4 text-xs">
        记录为只读快照；编辑与删除请返回对应列表页操作。
      </p>
    </template>

    <Alert
      v-else-if="!loading && error"
      type="error"
      show-icon
      :message="error"
    />
    <Alert
      v-else-if="detail && !detail.record"
      type="warning"
      show-icon
      message="记录不存在或已被删除"
    />
  </BasicDrawer>
</template>
