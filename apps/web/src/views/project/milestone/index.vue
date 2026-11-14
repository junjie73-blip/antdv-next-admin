<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'ProjectMilestone' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '里程碑',
  description: '项目里程碑与阶段目标，跟踪每个交付节点的达成情况。',
  icon: 'carbon:milestone',
  stats: [
    {
      label: '里程碑总数',
      value: '18',
      icon: 'carbon:milestone',
      tone: 'blue',
    },
    {
      label: '本月达成',
      value: '5',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '进行中',
      value: '9',
      icon: 'carbon:in-progress',
      tone: 'violet',
    },
    {
      label: '延期',
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
      title: '里程碑名称',
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
      key: 'progress',
      title: '完成度',
    },
    {
      key: 'status',
      title: '状态',
    },
    {
      key: 'date',
      title: '截止日期',
    },
  ],
  rows: [
    {
      id: 'M-01',
      name: '需求冻结',
      project: '管理后台 2.0',
      owner: '林晓',
      progress: '100%',
      status: '已完成',
      date: '2026-10-15',
    },
    {
      id: 'M-02',
      name: 'Alpha 内测',
      project: '管理后台 2.0',
      owner: '林晓',
      progress: '75%',
      status: '进行中',
      date: '2026-11-28',
    },
    {
      id: 'M-03',
      name: '数据迁移完成',
      project: '数据平台重构',
      owner: '周珂',
      progress: '40%',
      status: '进行中',
      date: '2026-12-10',
    },
    {
      id: 'M-04',
      name: '组件库发版',
      project: '组件库 1.5',
      owner: '苏叶',
      progress: '100%',
      status: '已完成',
      date: '2026-10-30',
    },
    {
      id: 'M-05',
      name: '灰度发布',
      project: '审批中心',
      owner: '陈默',
      progress: '0%',
      status: '待开始',
      date: '2027-01-20',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '里程碑状态',
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
  createLabel: '新增里程碑',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
