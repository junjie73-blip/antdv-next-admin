<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'AiProvider' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '模型供应商',
  description: '模型供应商接入、调用协议与密钥状态管理。',
  icon: 'carbon:api',
  stats: [
    {
      label: '供应商',
      value: '6',
      icon: 'carbon:api',
      tone: 'blue',
    },
    {
      label: '已启用',
      value: '5',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '密钥待轮换',
      value: '2',
      icon: 'carbon:time',
      tone: 'amber',
    },
    {
      label: '异常',
      value: '0',
      icon: 'carbon:warning-alt',
      tone: 'red',
    },
  ],
  columns: [
    {
      key: 'id',
      title: '编号',
    },
    {
      key: 'name',
      title: '供应商名称',
    },
    {
      key: 'protocol',
      title: '调用协议',
    },
    {
      key: 'endpoint',
      title: 'API Endpoint',
    },
    {
      key: 'key',
      title: 'API Key',
    },
    {
      key: 'status',
      title: '状态',
    },
  ],
  rows: [
    {
      id: 'V-01',
      name: '腾讯云',
      protocol: 'OpenAI 兼容',
      endpoint: 'api.hunyuan.cloud/v1',
      key: 'sk-****9f2a',
      status: '启用',
    },
    {
      id: 'V-02',
      name: 'DeepSeek',
      protocol: 'OpenAI 兼容',
      endpoint: 'api.deepseek.com/v1',
      key: 'sk-****3c81',
      status: '启用',
    },
    {
      id: 'V-03',
      name: '阿里云',
      protocol: 'DashScope',
      endpoint: 'dashscope.aliyuncs.com',
      key: 'sk-****b704',
      status: '启用',
    },
    {
      id: 'V-04',
      name: '智谱',
      protocol: 'OpenAI 兼容',
      endpoint: 'open.bigmodel.cn/api',
      key: 'sk-****1d55',
      status: '启用',
    },
    {
      id: 'V-05',
      name: '自建推理服务',
      protocol: 'HTTP',
      endpoint: 'internal://llm-gateway',
      key: '—',
      status: '停用',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '启用状态',
      options: [
        {
          label: '启用',
          value: '启用',
        },
        {
          label: '停用',
          value: '停用',
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
  createLabel: '新增供应商',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
