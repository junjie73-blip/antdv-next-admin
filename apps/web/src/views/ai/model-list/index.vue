<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'AiModelList' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '模型列表',
  description: '可调用的大模型清单、调用协议与启用状态。',
  icon: 'carbon:model',
  stats: [
    {
      label: '模型总数',
      value: '14',
      icon: 'carbon:model',
      tone: 'blue',
    },
    {
      label: '在线',
      value: '11',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '调用量(今日)',
      value: '28.4k',
      icon: 'carbon:activity',
      tone: 'violet',
    },
    {
      label: '异常',
      value: '1',
      icon: 'carbon:warning-alt',
      tone: 'red',
    },
  ],
  columns: [
    {
      key: 'id',
      title: '模型 ID',
    },
    {
      key: 'name',
      title: '模型名称',
    },
    {
      key: 'provider',
      title: '供应商',
    },
    {
      key: 'protocol',
      title: '调用协议',
    },
    {
      key: 'context',
      title: '上下文',
    },
    {
      key: 'status',
      title: '状态',
    },
  ],
  rows: [
    {
      id: 'M-01',
      name: 'hunyuan-pro',
      provider: '腾讯云',
      protocol: 'OpenAI 兼容',
      context: '128K',
      status: '在线',
    },
    {
      id: 'M-02',
      name: 'hunyuan-turbo',
      provider: '腾讯云',
      protocol: 'OpenAI 兼容',
      context: '64K',
      status: '在线',
    },
    {
      id: 'M-03',
      name: 'deepseek-v3',
      provider: 'DeepSeek',
      protocol: 'OpenAI 兼容',
      context: '64K',
      status: '在线',
    },
    {
      id: 'M-04',
      name: 'qwen-max',
      provider: '阿里云',
      protocol: 'DashScope',
      context: '32K',
      status: '在线',
    },
    {
      id: 'M-05',
      name: 'glm-4',
      provider: '智谱',
      protocol: 'OpenAI 兼容',
      context: '128K',
      status: '维护中',
    },
    {
      id: 'M-06',
      name: 'local-embedding',
      provider: '自建',
      protocol: 'HTTP',
      context: '8K',
      status: '离线',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '运行状态',
      options: [
        {
          label: '在线',
          value: '在线',
        },
        {
          label: '离线',
          value: '离线',
        },
        {
          label: '维护中',
          value: '维护中',
        },
      ],
    },
  ],
  statusKey: 'status',
  statusColors: {
    进行中: 'blue',
    已完成: 'green',
    已暂停: 'default',
    待开始: 'gold',
    已逾期: 'red',
    待审批: 'gold',
    已通过: 'green',
    已驳回: 'red',
    草稿: 'default',
    启用: 'green',
    停用: 'default',
    在线: 'green',
    离线: 'red',
    维护中: 'gold',
    高: 'red',
    中: 'gold',
    低: 'green',
    紧急: 'red',
    待处理: 'gold',
    处理中: 'blue',
    已解决: 'green',
    已关闭: 'default',
    已发布: 'green',
    草稿箱: 'default',
    审核中: 'blue',
  },
  createLabel: '接入模型',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
