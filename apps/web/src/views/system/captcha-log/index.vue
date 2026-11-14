<script setup lang="ts">
import type { DescriptionItem } from '@antdv/common-ui';
import type { FormSchema } from '@antdv/form-ui';
import type { BasicColumn } from '@antdv/table-ui';
import type { CaptchaLogRecord } from '~/api/monitor';

import { h, ref } from 'vue';

import { Card, PageHeader } from '@antdv/common-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { BasicTable, useTable } from '@antdv/table-ui';
import { Icon } from '@iconify/vue';
import { getCaptchaLogList } from '~/api/monitor';
import {
  formatCount,
  maskReceiver,
  resultTone,
  unwrapApi,
} from '~/utils/log-format';

import LogDetailDrawer from '../components/LogDetailDrawer.vue';
import MetricCard from '../components/MetricCard.vue';
import StatusPill from '../components/StatusPill.vue';

/**
 * 验证码日志：只读台账 + 详情抽屉，接收方一律脱敏展示。
 * 对齐参考实现的「验证码日志」列头与「通过 / 未通过」状态语义。
 */
defineOptions({ name: 'SystemCaptchaLog' });

const TYPE_LABELS: Record<string, string> = {
  email: '邮箱',
  image: '图形',
  sms: '短信',
};

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const statsGridClassName = cn('grid grid-cols-1 gap-4 sm:grid-cols-3');
const actionClassName = cn('flex items-center justify-center');
const btnClassName = cn('h-auto px-0.5!');
const maskedClassName = cn('tabular-nums');

const stats = ref({ failed: 0, passed: 0, total: 0 });

const [tableRegister] = useTable();
const detailDrawer = ref<InstanceType<typeof LogDetailDrawer>>();

// 详情 schema：与全站日志详情统一走 LogDetailDrawer；接收方脱敏展示
const detailSchemas: DescriptionItem[] = [
  { field: 'id', label: '日志编号' },
  {
    field: 'type',
    label: '验证码类型',
    render: (value) => TYPE_LABELS[value as string] || value,
  },
  { field: 'scene', label: '使用场景' },
  {
    field: 'result',
    label: '校验结果',
    render: (value) =>
      h(StatusPill, {
        label: value === 'passed' ? '通过' : '未通过',
        tone: resultTone(value as string),
      }),
  },
  {
    field: 'receiver',
    label: '接收方',
    render: (value) => maskReceiver(value as string),
  },
  { field: 'code', label: '验证码' },
  { field: 'ip', label: '获取 IP' },
  { field: 'location', label: '归属地' },
  { field: 'time', label: '发送时间', span: 2 },
];
/** 刷新用 key 重建表格，避开 useTable 返回值的类型歧义 */
const reloadKey = ref(0);

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '接收方 / IP',
    component: 'Input',
    componentProps: {
      placeholder: '搜索接收方、IP 或归属地',
      allowClear: true,
    },
    colProps: { span: 6 },
  },
  {
    field: 'type',
    label: '验证码类型',
    component: 'Select',
    componentProps: {
      placeholder: '全部类型',
      allowClear: true,
      options: [
        { label: '全部类型', value: '' },
        { label: '图形', value: 'image' },
        { label: '短信', value: 'sms' },
        { label: '邮箱', value: 'email' },
      ],
    },
    colProps: { span: 6 },
  },
  {
    field: 'scene',
    label: '使用场景',
    component: 'Select',
    componentProps: {
      placeholder: '全部场景',
      allowClear: true,
      options: [
        { label: '全部场景', value: '' },
        { label: '账号登录', value: '账号登录' },
        { label: '注册验证', value: '注册验证' },
        { label: '找回密码', value: '找回密码' },
        { label: '修改手机号', value: '修改手机号' },
        { label: '敏感操作', value: '敏感操作' },
      ],
    },
    colProps: { span: 6 },
  },
  {
    field: 'result',
    label: '校验结果',
    component: 'Select',
    componentProps: {
      placeholder: '全部结果',
      allowClear: true,
      options: [
        { label: '全部结果', value: '' },
        { label: '通过', value: 'passed' },
        { label: '未通过', value: 'failed' },
      ],
    },
    colProps: { span: 6 },
  },
];

interface CaptchaLogListData {
  list: CaptchaLogRecord[];
  stats: { failed: number; passed: number; total: number };
  total: number;
}

async function mockApi(params: Record<string, any>) {
  const res = await getCaptchaLogList(params);
  const data = unwrapApi<CaptchaLogListData | null>(res);
  stats.value = data?.stats ?? { failed: 0, passed: 0, total: 0 };
  return { items: data?.list || [], total: data?.total || 0 };
}

function handleView(record: unknown) {
  detailDrawer.value?.open(record as CaptchaLogRecord);
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
    title: '验证码类型',
    dataIndex: 'type',
    key: 'type',
    width: 110,
    align: 'center',
  },
  { title: '使用场景', dataIndex: 'scene', key: 'scene', width: 120 },
  {
    title: '接收方',
    dataIndex: 'receiver',
    key: 'receiver',
    width: 190,
    ellipsis: true,
  },
  { title: '验证码', dataIndex: 'code', key: 'code', width: 100 },
  {
    title: '校验结果',
    dataIndex: 'result',
    key: 'result',
    width: 100,
    align: 'center',
  },
  { title: '获取 IP', dataIndex: 'ip', key: 'ip', width: 140 },
  {
    title: '归属地',
    dataIndex: 'location',
    key: 'location',
    width: 160,
    ellipsis: true,
  },
  { title: '发送时间', dataIndex: 'time', key: 'time', width: 170 },
];
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="验证码日志"
      description="验证码发送与校验结果留痕，接收方脱敏展示；按类型、场景与结果检索"
      icon="carbon:scan"
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
        title="发送总数"
        :value="formatCount(stats.total)"
        suffix="条"
        icon="carbon:document"
      />
      <MetricCard
        title="校验通过"
        :value="formatCount(stats.passed)"
        suffix="条"
        icon="carbon:checkmark-outline"
        tone="success"
      />
      <MetricCard
        title="校验未通过"
        :value="formatCount(stats.failed)"
        suffix="条"
        icon="carbon:close-outline"
        tone="destructive"
      />
    </div>

    <Card title="发送记录" :class="cardClassName">
      <BasicTable
        :key="reloadKey"
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 90 }"
        :action-column="{ width: 100, title: '操作', fixed: 'right' }"
        :pagination="{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
        }"
        :scroll="{ x: 1300 }"
        @register="tableRegister"
      >
        <template #cell-type="{ record }">
          <span>{{ TYPE_LABELS[record.type] || record.type }}</span>
        </template>
        <template #cell-receiver="{ record }">
          <span :class="maskedClassName" :title="record.receiver">{{
            maskReceiver(record.receiver)
          }}</span>
        </template>
        <template #cell-result="{ record }">
          <StatusPill
            :label="record.result === 'passed' ? '通过' : '未通过'"
            :tone="resultTone(record.result)"
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
      title="验证码日志详情"
      :schema="detailSchemas"
      :width="680"
    />
  </div>
</template>
