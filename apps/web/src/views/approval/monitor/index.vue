<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'ApprovalMonitor' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '流程监控',
  description: '审批流程实例的吞吐、耗时与异常监控。',
  icon: 'carbon:activity',
  stats: [
    {
      label: '运行中实例',
      value: '42',
      icon: 'carbon:activity',
      tone: 'blue',
    },
    {
      label: '今日完结',
      value: '118',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '平均耗时',
      value: '3.2h',
      icon: 'carbon:time',
      tone: 'violet',
    },
    {
      label: '异常',
      value: '3',
      icon: 'carbon:warning-alt',
      tone: 'red',
    },
  ],
  columns: [
    {
      key: 'id',
      title: '实例 ID',
    },
    {
      key: 'flow',
      title: '流程名称',
    },
    {
      key: 'group',
      title: '分组',
    },
    {
      key: 'node',
      title: '当前节点',
    },
    {
      key: 'duration',
      title: '已耗时',
    },
    {
      key: 'status',
      title: '状态',
    },
  ],
  rows: [
    {
      id: 'IN-3101',
      flow: '差旅报销',
      group: '财务类',
      node: '部门经理审批',
      duration: '1.4h',
      status: '处理中',
    },
    {
      id: 'IN-3102',
      flow: '请假申请',
      group: '人事类',
      node: 'HR 备案',
      duration: '0.6h',
      status: '处理中',
    },
    {
      id: 'IN-3103',
      flow: '采购申请',
      group: '采购类',
      node: '财务复核',
      duration: '8.1h',
      status: '已逾期',
    },
    {
      id: 'IN-3104',
      flow: '权限开通',
      group: '权限类',
      node: '完成',
      duration: '2.0h',
      status: '已解决',
    },
    {
      id: 'IN-3105',
      flow: '合同审批',
      group: '财务类',
      node: '法务审核',
      duration: '4.5h',
      status: '处理中',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '实例状态',
      options: [
        {
          label: '处理中',
          value: '处理中',
        },
        {
          label: '已逾期',
          value: '已逾期',
        },
        {
          label: '已解决',
          value: '已解决',
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
  createLabel: '刷新实例',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
