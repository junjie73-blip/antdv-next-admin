<script setup lang="ts">
import type { RecordDetailData } from '~/api/monitor';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  Alert,
  Card,
  Descriptions,
  DescriptionsItem,
  PageHeader,
} from '@antdv/common-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { getRecordDetail } from '~/api/monitor';
import { displayValue, unwrapApi } from '~/utils/log-format';

import AsyncState from '../components/AsyncState.vue';

/**
 * 通用记录详情。
 *
 * 参考实现里每个模块各有一个独立的 detail 页；本仓库用一页承接，靠
 * `?module=&id=` 取数，分组定义由 mock 下发，新增业务模块不用再复制一遍页面。
 * 列表页的「详情」按钮统一跳这里，返回按钮按模块映射回原列表。
 */
defineOptions({ name: 'SystemRecordDetail' });

const MODULE_PATH: Record<string, string> = {
  dept: '/system/dept',
  file: '/system/file',
  log: '/system/log',
  loginLog: '/system/login-log',
  notice: '/system/notice',
  online: '/system/online',
  post: '/system/post',
  role: '/system/role',
  settings: '/system/settings',
  user: '/system/user',
};

const route = useRoute();
const router = useRouter();

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const hintClassName = cn('text-muted-foreground text-xs');

const moduleKey = computed(() => String(route.query.module ?? 'user'));
const recordId = computed(() => String(route.query.id ?? '1'));
const detail = ref<null | RecordDetailData>(null);
const loading = ref(false);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getRecordDetail(moduleKey.value, recordId.value);
    detail.value = unwrapApi<null | RecordDetailData>(res) ?? null;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '详情接口暂不可用';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([moduleKey, recordId], load);

function goBack() {
  router.push(MODULE_PATH[moduleKey.value] ?? '/system/overview');
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      :title="detail?.title ?? '记录详情'"
      :description="`记录编号 ${recordId} · 模块 ${moduleKey} · 数据来自系统管理数据源`"
      :icon="detail?.icon ?? 'carbon:document'"
    >
      <template #extra>
        <Button variant="outline" size="sm" @click="goBack">
          <Icon icon="carbon:arrow-left" />
          返回列表
        </Button>
        <Button variant="outline" size="sm" :disabled="loading" @click="load">
          <Icon icon="carbon:renew" />
          刷新
        </Button>
      </template>
    </PageHeader>

    <AsyncState :loading="loading" :error="error" :empty="false" @retry="load">
      <template v-if="detail && detail.record">
        <Card
          v-for="section in detail.sections"
          :key="section.title"
          :title="section.title"
          :class="cardClassName"
        >
          <Descriptions :column="2" bordered size="middle">
            <DescriptionsItem
              v-for="field in section.fields"
              :key="`${section.title}-${field.key}`"
              :label="field.label"
            >
              {{ displayValue(detail.record[field.key]) }}
            </DescriptionsItem>
          </Descriptions>
        </Card>
        <p :class="hintClassName">
          记录为只读快照；编辑与删除请返回对应列表页操作。
        </p>
      </template>

      <Alert
        v-else-if="detail && !detail.record"
        type="warning"
        show-icon
        message="记录不存在或已被删除"
      />
    </AsyncState>
  </div>
</template>
