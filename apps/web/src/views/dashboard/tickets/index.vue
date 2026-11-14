<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'DashboardTickets' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '工单',
  description: '工单提交、流转与处理记录，支持按状态与优先级筛选。',
  icon: 'carbon:ticket',
  stats: [
    {
      label: '全部工单',
      value: '36',
      icon: 'carbon:ticket',
      tone: 'blue',
    },
    {
      label: '待处理',
      value: '6',
      icon: 'carbon:time',
      tone: 'amber',
    },
    {
      label: '处理中',
      value: '9',
      icon: 'carbon:in-progress',
      tone: 'violet',
    },
    {
      label: '本月已解决',
      value: '18',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
  ],
  columns: [
    {
      key: 'id',
      title: '工单号',
    },
    {
      key: 'title',
      title: '标题',
    },
    {
      key: 'type',
      title: '类型',
    },
    {
      key: 'submitter',
      title: '提交人',
    },
    {
      key: 'handler',
      title: '处理人',
    },
    {
      key: 'priority',
      title: '优先级',
    },
    {
      key: 'status',
      title: '状态',
    },
  ],
  rows: [
    {
      id: 'GD-2091',
      title: '导出 Excel 中文乱码',
      type: '缺陷',
      submitter: '王一',
      handler: '陈默',
      priority: '高',
      status: '处理中',
    },
    {
      id: 'GD-2090',
      title: '申请开通报表权限',
      type: '权限',
      submitter: '李珊',
      handler: '周珂',
      priority: '中',
      status: '待处理',
    },
    {
      id: 'GD-2089',
      title: '登录验证码不显示',
      type: '缺陷',
      submitter: '赵磊',
      handler: '林晓',
      priority: '紧急',
      status: '已解决',
    },
    {
      id: 'GD-2088',
      title: '新增部门数据字典',
      type: '需求',
      submitter: '孙悦',
      handler: '苏叶',
      priority: '低',
      status: '已关闭',
    },
    {
      id: 'GD-2087',
      title: '大屏刷新频率咨询',
      type: '咨询',
      submitter: '钱进',
      handler: '陈默',
      priority: '低',
      status: '已解决',
    },
    {
      id: 'GD-2086',
      title: '文件上传偶发超时',
      type: '缺陷',
      submitter: '王一',
      handler: '周珂',
      priority: '高',
      status: '处理中',
    },
  ],
  filters: [
    {
      key: 'status',
      label: '工单状态',
      options: [
        {
          label: '待处理',
          value: '待处理',
        },
        {
          label: '处理中',
          value: '处理中',
        },
        {
          label: '已解决',
          value: '已解决',
        },
        {
          label: '已关闭',
          value: '已关闭',
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
  createLabel: '提交工单',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
