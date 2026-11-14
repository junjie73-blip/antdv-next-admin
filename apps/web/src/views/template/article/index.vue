<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';

import { DataPage } from '@antdv/common-ui';

defineOptions({ name: 'TemplateArticle' });

/** 数据按参考 admin 的字段组织；这里用静态种子数据演示完整查询/选择/分页/新建闭环。 */
const config: DataPageProps = {
  title: '文章列表',
  description: '文章与内容列表，支持按发布状态筛选与关键字检索。',
  icon: 'carbon:blog',
  stats: [
    {
      label: '文章总数',
      value: '86',
      icon: 'carbon:blog',
      tone: 'blue',
    },
    {
      label: '已发布',
      value: '61',
      icon: 'carbon:checkmark',
      tone: 'green',
    },
    {
      label: '审核中',
      value: '9',
      icon: 'carbon:time',
      tone: 'amber',
    },
    {
      label: '草稿',
      value: '16',
      icon: 'carbon:document',
      tone: 'violet',
    },
  ],
  columns: [
    {
      key: 'id',
      title: '编号',
    },
    {
      key: 'title',
      title: '标题',
    },
    {
      key: 'category',
      title: '分类',
    },
    {
      key: 'author',
      title: '作者',
    },
    {
      key: 'views',
      title: '阅读量',
    },
    {
      key: 'status',
      title: '状态',
    },
    {
      key: 'date',
      title: '发布日期',
    },
  ],
  rows: [
    {
      id: 'A-201',
      title: '后台权限模型设计实践',
      category: '技术',
      author: '林晓',
      views: '2,481',
      status: '已发布',
      date: '2026-11-02',
    },
    {
      id: 'A-202',
      title: '从零搭建组件库规范',
      category: '技术',
      author: '苏叶',
      views: '1,936',
      status: '已发布',
      date: '2026-10-28',
    },
    {
      id: 'A-203',
      title: '2026 年度产品路线图',
      category: '产品',
      author: '周珂',
      views: '3,120',
      status: '审核中',
      date: '2026-11-10',
    },
    {
      id: 'A-204',
      title: '设计系统色彩变量说明',
      category: '设计',
      author: '李珊',
      views: '874',
      status: '草稿箱',
      date: '—',
    },
    {
      id: 'A-205',
      title: '工作流引擎接入指南',
      category: '技术',
      author: '陈默',
      views: '1,502',
      status: '已发布',
      date: '2026-10-15',
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
  createLabel: '写文章',
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
