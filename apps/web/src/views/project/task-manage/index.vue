<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'ProjectTaskManage' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '任务管理',
  description: '任务的拆解、排期与依赖维护，支持批量处理。',
  icon: 'carbon:edit',
  stats: [
    {
      label: '任务总数',
      value: '48',
      icon: 'carbon:task',
      tone: 'blue',
    },
    {
      label: '待办',
      value: '16',
      icon: 'carbon:time',
      tone: 'amber',
    },
    {
      label: '进行中',
      value: '21',
      icon: 'carbon:in-progress',
      tone: 'violet',
    },
    {
      label: '已完成',
      value: '11',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
  ],
  columns: [
    {
      key: 'id',
      title: '编号',
    },
    {
      key: 'title',
      title: '任务标题',
    },
    {
      key: 'project',
      title: '所属项目',
    },
    {
      key: 'owner',
      title: '负责人',
    },
    {
      key: 'priority',
      title: '优先级',
    },
    {
      key: 'progress',
      title: '进度',
    },
    {
      key: 'status',
      title: '状态',
    },
  ],
  rows: [
    {
      id: 'TK-301',
      title: '需求评审与拆解',
      project: '管理后台 2.0',
      owner: '林晓',
      priority: '高',
      progress: '100%',
      status: '已完成',
    },
    {
      id: 'TK-302',
      title: '表结构设计',
      project: '数据平台重构',
      owner: '周珂',
      priority: '高',
      progress: '70%',
      status: '进行中',
    },
    {
      id: 'TK-303',
      title: '组件单元测试',
      project: '组件库 1.5',
      owner: '苏叶',
      priority: '中',
      progress: '55%',
      status: '进行中',
    },
    {
      id: 'TK-304',
      title: '流程引擎联调',
      project: '审批中心',
      owner: '陈默',
      priority: '高',
      progress: '20%',
      status: '进行中',
    },
    {
      id: 'TK-305',
      title: '视觉走查',
      project: '移动端 H5',
      owner: '林晓',
      priority: '低',
      progress: '0%',
      status: '待开始',
    },
    {
      id: 'TK-306',
      title: '告警规则梳理',
      project: '监控告警治理',
      owner: '周珂',
      priority: '中',
      progress: '0%',
      status: '已暂停',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '任务状态',
      options: [
        {
          label: '进行中',
          value: '进行中',
        },
        {
          label: '已完成',
          value: '已完成',
        },
        {
          label: '待开始',
          value: '待开始',
        },
        {
          label: '已暂停',
          value: '已暂停',
        },
      ],
    },
    {
      key: 'priority',
      label: '优先级',
      options: [
        {
          label: '高',
          value: '高',
        },
        {
          label: '中',
          value: '中',
        },
        {
          label: '低',
          value: '低',
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
  createLabel: '新建任务',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
