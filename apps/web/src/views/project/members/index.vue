<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'ProjectMembers' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '项目成员',
  description: '项目成员与角色分派，按项目与角色筛选。',
  icon: 'carbon:group',
  stats: [
    {
      label: '成员总数',
      value: '32',
      icon: 'carbon:group',
      tone: 'blue',
    },
    {
      label: '项目负责',
      value: '6',
      icon: 'carbon:user',
      tone: 'violet',
    },
    {
      label: '开发',
      value: '19',
      icon: 'carbon:terminal',
      tone: 'green',
    },
    {
      label: '测试/设计',
      value: '7',
      icon: 'carbon:screen',
      tone: 'amber',
    },
  ],
  columns: [
    {
      key: 'id',
      title: '工号',
    },
    {
      key: 'name',
      title: '成员',
    },
    {
      key: 'project',
      title: '所属项目',
    },
    {
      key: 'dept',
      title: '部门',
    },
    {
      key: 'role',
      title: '项目角色',
    },
    {
      key: 'email',
      title: '邮箱',
    },
    {
      key: 'status',
      title: '状态',
    },
  ],
  rows: [
    {
      id: 'E-1001',
      name: '林晓',
      project: '管理后台 2.0',
      dept: '前端组',
      role: '项目负责人',
      email: 'linxiao@example.com',
      status: '启用',
    },
    {
      id: 'E-1002',
      name: '周珂',
      project: '数据平台重构',
      dept: '后端组',
      role: '项目负责人',
      email: 'zhouke@example.com',
      status: '启用',
    },
    {
      id: 'E-1003',
      name: '苏叶',
      project: '组件库 1.5',
      dept: '前端组',
      role: '开发',
      email: 'suye@example.com',
      status: '启用',
    },
    {
      id: 'E-1004',
      name: '陈默',
      project: '审批中心',
      dept: '后端组',
      role: '开发',
      email: 'chenmo@example.com',
      status: '启用',
    },
    {
      id: 'E-1005',
      name: '李珊',
      project: '移动端 H5',
      dept: '设计组',
      role: '设计',
      email: 'lishan@example.com',
      status: '停用',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '账号状态',
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
    {
      key: 'role',
      label: '项目角色',
      options: [
        {
          label: '项目负责人',
          value: '项目负责人',
        },
        {
          label: '开发',
          value: '开发',
        },
        {
          label: '设计',
          value: '设计',
        },
        {
          label: '测试',
          value: '测试',
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
  createLabel: '添加成员',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
