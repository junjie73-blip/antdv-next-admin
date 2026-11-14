<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'ApprovalGroup' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '流程分组',
  description: '审批流程的分组与分类维护，控制可见范围与启用状态。',
  icon: 'carbon:category',
  stats: [
    {
      label: '分组总数',
      value: '8',
      icon: 'carbon:category',
      tone: 'blue',
    },
    {
      label: '启用',
      value: '7',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '流程定义',
      value: '24',
      icon: 'carbon:flow',
      tone: 'violet',
    },
    {
      label: '停用',
      value: '1',
      icon: 'carbon:warning-alt',
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
      title: '分组名称',
    },
    {
      key: 'flows',
      title: '流程数',
    },
    {
      key: 'scope',
      title: '适用范围',
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
      id: 'G-01',
      name: '人事类',
      flows: '6',
      scope: '全员',
      owner: '林晓',
      status: '启用',
    },
    {
      id: 'G-02',
      name: '财务类',
      flows: '8',
      scope: '财务/管理',
      owner: '周珂',
      status: '启用',
    },
    {
      id: 'G-03',
      name: '采购类',
      flows: '4',
      scope: '采购/管理',
      owner: '陈默',
      status: '启用',
    },
    {
      id: 'G-04',
      name: '权限类',
      flows: '3',
      scope: '研发',
      owner: '苏叶',
      status: '启用',
    },
    {
      id: 'G-05',
      name: '历史归档',
      flows: '3',
      scope: '管理员',
      owner: '林晓',
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
  createLabel: '新增分组',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
