<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'AiKnowledge' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '知识库',
  description: '知识库文档、向量状态与检索配置管理。',
  icon: 'carbon:book',
  stats: [
    {
      label: '知识库',
      value: '9',
      icon: 'carbon:book',
      tone: 'blue',
    },
    {
      label: '文档总数',
      value: '1,286',
      icon: 'carbon:document',
      tone: 'violet',
    },
    {
      label: '已向量化',
      value: '1,240',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '待处理',
      value: '46',
      icon: 'carbon:time',
      tone: 'amber',
    },
  ],
  columns: [
    {
      key: 'id',
      title: '编号',
    },
    {
      key: 'name',
      title: '知识库名称',
    },
    {
      key: 'docs',
      title: '文档数',
    },
    {
      key: 'model',
      title: '向量模型',
    },
    {
      key: 'scope',
      title: '可见范围',
    },
    {
      key: 'status',
      title: '状态',
    },
  ],
  rows: [
    {
      id: 'K-01',
      name: '产品手册',
      docs: '328',
      model: 'bge-large-zh',
      scope: '全员',
      status: '启用',
    },
    {
      id: 'K-02',
      name: '研发规范',
      docs: '241',
      model: 'bge-large-zh',
      scope: '研发',
      status: '启用',
    },
    {
      id: 'K-03',
      name: '工单历史',
      docs: '512',
      model: 'text-embedding-3',
      scope: '客服',
      status: '启用',
    },
    {
      id: 'K-04',
      name: '接口文档',
      docs: '163',
      model: 'bge-large-zh',
      scope: '研发',
      status: '启用',
    },
    {
      id: 'K-05',
      name: '归档资料',
      docs: '42',
      model: '—',
      scope: '管理员',
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
  createLabel: '新建知识库',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
