<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'TemplateChart' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '图表设计器',
  description: '图表模板的配置清单，可预览图表类型与数据集绑定。',
  icon: 'carbon:data-vis-4',
  stats: [
    {
      label: '图表模板',
      value: '16',
      icon: 'carbon:data-vis-4',
      tone: 'blue',
    },
    {
      label: '数据集',
      value: '7',
      icon: 'carbon:data-base',
      tone: 'violet',
    },
    {
      label: '已发布',
      value: '12',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '草稿',
      value: '4',
      icon: 'carbon:document',
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
      title: '图表名称',
    },
    {
      key: 'type',
      title: '图表类型',
    },
    {
      key: 'dataset',
      title: '数据集',
    },
    {
      key: 'owner',
      title: '维护人',
    },
    {
      key: 'status',
      title: '状态',
    },
  ],
  rows: [
    {
      id: 'C-01',
      name: '销售趋势',
      type: '折线图',
      dataset: '销售分析',
      owner: '周珂',
      status: '已发布',
    },
    {
      id: 'C-02',
      name: '用户增长',
      type: '面积图',
      dataset: '用户增长',
      owner: '林晓',
      status: '已发布',
    },
    {
      id: 'C-03',
      name: '渠道占比',
      type: '饼图',
      dataset: '销售分析',
      owner: '苏叶',
      status: '已发布',
    },
    {
      id: 'C-04',
      name: '地区分布',
      type: '柱状图',
      dataset: '区域数据',
      owner: '陈默',
      status: '审核中',
    },
    {
      id: 'C-05',
      name: '转化漏斗',
      type: '漏斗图',
      dataset: '用户增长',
      owner: '林晓',
      status: '草稿箱',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '发布状态',
      options: [
        {
          label: '已发布',
          value: '已发布',
        },
        {
          label: '审核中',
          value: '审核中',
        },
        {
          label: '草稿箱',
          value: '草稿箱',
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
  createLabel: '新建图表',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
