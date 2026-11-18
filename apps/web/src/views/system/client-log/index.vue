<script setup lang="ts">
import type { DescriptionItem } from '@antdv/common-ui';
import type { FormSchema } from '@antdv/form-ui';
import type { BasicColumn } from '@antdv/table-ui';
import type { ClientLogRecord } from '~/api/monitor';

import { h, ref } from 'vue';

import { Card, PageHeader } from '@antdv/common-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { BasicTable, useTable } from '@antdv/table-ui';
import { Icon } from '@iconify/vue';
import { getClientLogList } from '~/api/monitor';
import { formatCount, levelTone, unwrapApi } from '~/utils/log-format';

import LogDetailDrawer from '../components/LogDetailDrawer.vue';
import MetricCard from '../components/MetricCard.vue';
import StatusPill from '../components/StatusPill.vue';

/**
 * 客户端日志：只读台账 + 详情抽屉。
 * 对齐参考实现的「客户端日志」列头（级别 / 内容 / 来源模块 / 页面地址 / 账号 / 时间）
 * 与「日志为服务端留存的只读记录」口径，不提供删除按钮。
 */
defineOptions({ name: 'SystemClientLog' });

const LEVEL_LABELS: Record<string, string> = {
  debug: '调试',
  error: '错误',
  info: '信息',
  warn: '警告',
};

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const statsGridClassName = cn(
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
);
const actionClassName = cn('flex items-center justify-center');
const btnClassName = cn('h-auto px-0.5!');

const stats = ref({ debug: 0, error: 0, info: 0, total: 0, warn: 0 });

const [tableRegister] = useTable();
const detailDrawer = ref<InstanceType<typeof LogDetailDrawer>>();

// 详情 schema：与全站日志详情统一走 LogDetailDrawer
const detailSchemas: DescriptionItem[] = [
  { field: 'id', label: '日志编号' },
  { field: 'traceId', label: 'Trace ID' },
  {
    field: 'level',
    label: '日志级别',
    render: (value) =>
      h(StatusPill, {
        label: LEVEL_LABELS[value as string] || value,
        tone: levelTone(value as string),
      }),
  },
  { field: 'source', label: '来源模块' },
  { field: 'username', label: '登录账号' },
  { field: 'time', label: '上报时间' },
  { field: 'page', label: '页面地址', span: 2 },
  { field: 'message', label: '日志内容', span: 2 },
];
/** 刷新用 key 重建表格，避开 useTable 返回值的类型歧义（既有用例已钉住这条口径） */
const reloadKey = ref(0);

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '日志内容',
    component: 'Input',
    componentProps: { placeholder: '搜索内容、模块或账号', allowClear: true },
    colProps: { span: 8 },
  },
  {
    field: 'level',
    label: '日志级别',
    component: 'Select',
    componentProps: {
      placeholder: '全部级别',
      allowClear: true,
      options: [
        { label: '全部级别', value: '' },
        { label: '信息', value: 'info' },
        { label: '警告', value: 'warn' },
        { label: '错误', value: 'error' },
        { label: '调试', value: 'debug' },
      ],
    },
    colProps: { span: 8 },
  },
  {
    field: 'source',
    label: '来源模块',
    component: 'Select',
    componentProps: {
      placeholder: '全部模块',
      allowClear: true,
      options: [
        { label: '全部模块', value: '' },
        { label: 'request', value: 'request' },
        { label: 'router', value: 'router' },
        { label: 'table', value: 'table' },
        { label: 'form', value: 'form' },
        { label: 'websocket', value: 'websocket' },
      ],
    },
    colProps: { span: 8 },
  },
];

interface ClientLogListData {
  list: ClientLogRecord[];
  stats: {
    debug: number;
    error: number;
    info: number;
    total: number;
    warn: number;
  };
  total: number;
}

async function listApi(params: Record<string, any>) {
  const res = await getClientLogList(params);
  const data = unwrapApi<ClientLogListData | null>(res);
  stats.value = data?.stats ?? {
    debug: 0,
    error: 0,
    info: 0,
    total: 0,
    warn: 0,
  };
  return { items: data?.list || [], total: data?.total || 0 };
}

function handleView(record: unknown) {
  detailDrawer.value?.open(record as ClientLogRecord);
}

const columns: BasicColumn[] = [
  {
    title: '#',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  {
    title: '级别',
    dataIndex: 'level',
    key: 'level',
    width: 90,
    align: 'center',
  },
  {
    title: '日志内容',
    dataIndex: 'message',
    key: 'message',
    width: 260,
    ellipsis: true,
  },
  { title: '来源模块', dataIndex: 'source', key: 'source', width: 120 },
  {
    title: '页面地址',
    dataIndex: 'page',
    key: 'page',
    width: 190,
    ellipsis: true,
  },
  { title: '登录账号', dataIndex: 'username', key: 'username', width: 120 },
  { title: '上报时间', dataIndex: 'time', key: 'time', width: 170 },
];
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="客户端日志"
      description="前端上报的运行与异常记录，只读留存；按级别、模块和内容检索"
      icon="carbon:terminal"
    >
      <template #extra>
        <Button variant="outline" size="sm" @click="reloadKey += 1">
          <Icon icon="carbon:renew" />
          刷新
        </Button>
      </template>
    </PageHeader>

    <div :class="statsGridClassName">
      <MetricCard
        title="日志总数"
        :value="formatCount(stats.total)"
        suffix="条"
        icon="carbon:document"
      />
      <MetricCard
        title="信息"
        :value="formatCount(stats.info)"
        suffix="条"
        icon="carbon:information"
        tone="info"
      />
      <MetricCard
        title="警告"
        :value="formatCount(stats.warn)"
        suffix="条"
        icon="carbon:warning"
        tone="warning"
      />
      <MetricCard
        title="错误"
        :value="formatCount(stats.error)"
        suffix="条"
        icon="carbon:error"
        tone="destructive"
      />
    </div>

    <Card title="上报记录" :class="cardClassName">
      <BasicTable
        :key="reloadKey"
        :columns="columns"
        :api="listApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :action-column="{ width: 100, title: '操作', fixed: 'right' }"
        :pagination="{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
        }"
        :scroll="{ x: 1200 }"
        @register="tableRegister"
      >
        <template #cell-level="{ record }">
          <StatusPill
            :label="LEVEL_LABELS[record.level] || record.level"
            :tone="levelTone(record.level)"
          />
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <Button
              variant="link"
              :class="btnClassName"
              @click="() => handleView(record)"
            >
              <Icon icon="ant-design:eye-outlined" />
              详情
            </Button>
          </div>
        </template>
      </BasicTable>
    </Card>

    <LogDetailDrawer
      ref="detailDrawer"
      title="客户端日志详情"
      :schema="detailSchemas"
      :width="680"
    />
  </div>
</template>
