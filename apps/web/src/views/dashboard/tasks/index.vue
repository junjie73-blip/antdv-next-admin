<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'DashboardTasks' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '任务中心',
  description: '个人维度下的任务看板，按状态筛选、批量处理并跟踪进度。',
  icon: 'carbon:task',
  stats: [
    {
      label: '全部任务',
      value: '24',
      icon: 'carbon:task',
      tone: 'blue',
    },
    {
      label: '进行中',
      value: '8',
      icon: 'carbon:in-progress',
      tone: 'violet',
    },
    {
      label: '本周完成',
      value: '11',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '已逾期',
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
    {
      key: 'due',
      title: '截止日期',
    },
  ],
  rows: [
    {
      id: 'T-1024',
      title: '登录页国际化文案核对',
      project: '管理后台 2.0',
      owner: '林晓',
      priority: '高',
      progress: '80%',
      status: '进行中',
      due: '2026-11-18',
    },
    {
      id: 'T-1023',
      title: '菜单权限回归测试',
      project: '管理后台 2.0',
      owner: '周珂',
      priority: '中',
      progress: '60%',
      status: '进行中',
      due: '2026-11-20',
    },
    {
      id: 'T-1022',
      title: '报表导出性能优化',
      project: '数据平台',
      owner: '陈默',
      priority: '高',
      progress: '100%',
      status: '已完成',
      due: '2026-11-12',
    },
    {
      id: 'T-1021',
      title: '移动端导航适配',
      project: '管理后台 2.0',
      owner: '林晓',
      priority: '中',
      progress: '35%',
      status: '进行中',
      due: '2026-11-25',
    },
    {
      id: 'T-1020',
      title: '上传组件错误态文案',
      project: '组件库',
      owner: '苏叶',
      priority: '低',
      progress: '0%',
      status: '待开始',
      due: '2026-11-28',
    },
    {
      id: 'T-1019',
      title: '旧版工单数据迁移',
      project: '数据平台',
      owner: '周珂',
      priority: '中',
      progress: '100%',
      status: '已完成',
      due: '2026-11-08',
    },
    {
      id: 'T-1018',
      title: '审批流节点配置说明',
      project: '审批中心',
      owner: '陈默',
      priority: '高',
      progress: '20%',
      status: '已逾期',
      due: '2026-11-05',
    },
    {
      id: 'T-1017',
      title: '图表主题变量整理',
      project: '组件库',
      owner: '苏叶',
      priority: '低',
      progress: '0%',
      status: '待开始',
      due: '2026-12-02',
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
  createLabel: '新建任务',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
