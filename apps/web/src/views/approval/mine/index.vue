<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'ApprovalMine' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '我的审批',
  description: '我发起与待我审批的单据，按审批状态跟踪。',
  icon: 'carbon:checkmark',
  stats: [
    {
      label: '待我审批',
      value: '7',
      icon: 'carbon:time',
      tone: 'amber',
    },
    {
      label: '我发起的',
      value: '15',
      icon: 'carbon:document',
      tone: 'blue',
    },
    {
      label: '本月通过',
      value: '23',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '已驳回',
      value: '2',
      icon: 'carbon:warning-alt',
      tone: 'red',
    },
  ],
  columns: [
    {
      key: 'id',
      title: '单号',
    },
    {
      key: 'title',
      title: '标题',
    },
    {
      key: 'type',
      title: '流程类型',
    },
    {
      key: 'applicant',
      title: '申请人',
    },
    {
      key: 'amount',
      title: '金额/天数',
    },
    {
      key: 'status',
      title: '状态',
    },
    {
      key: 'date',
      title: '提交时间',
    },
  ],
  rows: [
    {
      id: 'AP-8801',
      title: '差旅报销申请',
      type: '费用报销',
      applicant: '王一',
      amount: '¥ 2,480',
      status: '待审批',
      date: '2026-11-13 09:20',
    },
    {
      id: 'AP-8802',
      title: '年假申请（3 天）',
      type: '请假',
      applicant: '李珊',
      amount: '3 天',
      status: '待审批',
      date: '2026-11-12 16:05',
    },
    {
      id: 'AP-8803',
      title: '服务器扩容采购',
      type: '采购',
      applicant: '周珂',
      amount: '¥ 18,600',
      status: '已通过',
      date: '2026-11-10 11:32',
    },
    {
      id: 'AP-8804',
      title: '外部接口开通',
      type: '权限申请',
      applicant: '陈默',
      amount: '—',
      status: '已通过',
      date: '2026-11-08 14:18',
    },
    {
      id: 'AP-8805',
      title: '加班调休申请',
      type: '请假',
      applicant: '苏叶',
      amount: '1 天',
      status: '已驳回',
      date: '2026-11-06 10:02',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '审批状态',
      options: [
        {
          label: '待审批',
          value: '待审批',
        },
        {
          label: '已通过',
          value: '已通过',
        },
        {
          label: '已驳回',
          value: '已驳回',
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
  createLabel: '发起审批',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
