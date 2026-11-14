<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'ProjectList' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '项目列表',
  description: '全部项目的检索与管理，支持按状态筛选与批量操作。',
  icon: 'carbon:list',
  stats: [
    {
      label: '项目总数',
      value: '12',
      icon: 'carbon:folder',
      tone: 'blue',
    },
    {
      label: '进行中',
      value: '7',
      icon: 'carbon:in-progress',
      tone: 'violet',
    },
    {
      label: '已完成',
      value: '3',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '延期风险',
      value: '2',
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
      title: '项目名称',
    },
    {
      key: 'owner',
      title: '负责人',
    },
    {
      key: 'members',
      title: '成员数',
    },
    {
      key: 'progress',
      title: '进度',
    },
    {
      key: 'status',
      title: '状态',
    },
    {
      key: 'deadline',
      title: '交付日期',
    },
  ],
  rows: [
    {
      id: 'P-001',
      name: '管理后台 2.0',
      owner: '林晓',
      members: '8',
      progress: '72%',
      status: '进行中',
      deadline: '2026-12-20',
    },
    {
      id: 'P-002',
      name: '数据平台重构',
      owner: '周珂',
      members: '6',
      progress: '45%',
      status: '进行中',
      deadline: '2027-01-15',
    },
    {
      id: 'P-003',
      name: '组件库 1.5',
      owner: '苏叶',
      members: '4',
      progress: '100%',
      status: '已完成',
      deadline: '2026-10-30',
    },
    {
      id: 'P-004',
      name: '审批中心',
      owner: '陈默',
      members: '5',
      progress: '30%',
      status: '进行中',
      deadline: '2027-02-01',
    },
    {
      id: 'P-005',
      name: '移动端 H5',
      owner: '林晓',
      members: '3',
      progress: '0%',
      status: '待开始',
      deadline: '2027-03-01',
    },
    {
      id: 'P-006',
      name: '监控告警治理',
      owner: '周珂',
      members: '4',
      progress: '15%',
      status: '已逾期',
      deadline: '2026-11-01',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '项目状态',
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
          label: '已逾期',
          value: '已逾期',
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
  createLabel: '新增项目',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
