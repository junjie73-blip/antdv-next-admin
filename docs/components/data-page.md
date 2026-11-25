# 数据工作台 DataPage

`DataPage`（`packages/core/ui-kit/common-ui/src/components/data-page/DataPage.vue`）是列表型页面的标准模板。它把统计卡、查询表单、工具栏、表格、分页、新增/编辑弹窗与详情抽屉收敛成一份配置，避免在业务页里重复拼装 `BasicTable + BasicModal + BasicForm`。

当前使用它的页面包括 AI 配置五页、审批流、仪表盘任务/工单，以及安全中心的审计与策略页。

## 最小示例

```vue
<script setup lang="ts">
import type { DataPageProps } from '@antdv/common-ui';
import { DataPage } from '@antdv/common-ui';
import { getList } from '~/api/demo';

const config: DataPageProps = {
  title: '示例列表',
  columns: [
    { key: 'name', title: '名称' },
    { key: 'status', title: '状态' },
  ],
  api: (params) => getList(params),
  statusKey: 'status',
  statusLabels: { enabled: '启用', disabled: '停用' },
};
</script>

<template>
  <DataPage v-bind="config" />
</template>
```

## 关键约定

- 配了 `api` 后，服务端必须自己按 `pageNum` / `pageSize` 切片并返回 `{ list, total }`；组件不会再在客户端切片。
- `readonly: true` 用于审计/台账类页面：隐藏新建、编辑、删除和行选择，只保留查询与详情。
- `statusKey` + `statusLabels` + `statusColors` 负责状态列渲染；其他列的自定义渲染走 `BasicTable` 的 `cell-<key>` 插槽。
- `toolbar-extra` 插槽用于放页面特有的工具栏按钮，`action-extra` 用于操作列的额外按钮，`detail-extra` 用于详情抽屉补充内容。
- 写接口成功后调用组件实例的 `reload()` 强制刷新服务端数据。

## 表单

新增/编辑统一走 `BasicModal + BasicForm`，用 `createSchemas` 声明 `FormSchema`，不要在页面里写原生 `<form>` / `<input>` / `<select>`。`onSubmit` 返回 `false` 表示业务校验失败，弹层保持打开。

## 插槽

| 插槽 | 作用域 | 用途 |
| --- | --- | --- |
| `toolbar-extra` | 无 | 表格工具栏追加按钮 |
| `action-extra` | `record` | 操作列追加按钮 |
| `detail-extra` | `record` | 详情抽屉追加内容 |
