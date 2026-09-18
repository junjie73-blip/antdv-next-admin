<script setup lang="ts">
import { ref } from "vue";
import { message } from "antdv-next";
import { BasicTable, useTable } from "@/components/business/Table";
import { deleteGenTable, getGenCodeDownloadUrl, getGenTableList } from "@/api/generator";
import type { GenTable, GenTableListParams } from "./types";
import { getTableColumns } from "./columns";
import { useSearchSchemas } from "./schemas";
import { getGenTableActions, type GenTableActionContext } from "./actions";
import { containerClassName } from "./constants";
import GeneratorDrawer from "./components/GeneratorDrawer.vue";
import { Icon } from "@iconify/vue";
import { downloadBlob } from "@/utils/download";

defineOptions({ name: "ToolGenerator" });

// ============================================================
// 状态
// ============================================================
const drawerVisible = ref(false);
const currentTableId = ref<string | null>(null);

// ============================================================
// 表格
// ============================================================
const searchSchemas = useSearchSchemas();
const tableColumns = getTableColumns();
const [tableRegister, tableMethods] = useTable();

// ============================================================
// 行操作
// ============================================================
const actionCtx: GenTableActionContext = {
  onEdit(record: GenTable) {
    currentTableId.value = record.tableId;
    drawerVisible.value = true;
  },
  async onGenerate(record: GenTable) {
    downloadBlob(async () => {
      return await getGenCodeDownloadUrl(record.tableId);
    }, `${record.tableName}.zip`);
    // window.open(url, "_blank");
  },
  async onDelete(record: GenTable) {
    await deleteGenTable(record.tableId);
    message.success("删除成功");
    tableMethods.value?.reload();
  },
};

const actionColumn = {
  width: 250,
};

// ============================================================
// 事件
// ============================================================
function handleAdd() {
  currentTableId.value = null;
  drawerVisible.value = true;
}

function handleDrawerSuccess() {
  tableMethods.value?.reload();
}
</script>

<template>
  <a-card :class="containerClassName">
    <BasicTable
      :columns="tableColumns"
      :api="getGenTableList"
      :immediate="true"
      :use-search-form="true"
      :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
      show-index-column
      :action-column="actionColumn"
      row-key="tableId"
      :pagination="{ pageSize: 10, showSizeChanger: true }"
      :scroll="{ x: 1200 }"
      @register="tableRegister"
    >
      <template #toolbar>
        <a-button type="primary" @click="handleAdd">
          <template #icon>
            <Icon icon="ant-design:plus-outlined"></Icon>
          </template>
          新增</a-button
        >
      </template>
      <template #action="{ record }">
        <TableAction
          :record="record"
          :actions="getGenTableActions(record as GenTable, actionCtx)"
        />
      </template>
    </BasicTable>

    <GeneratorDrawer
      v-model:open="drawerVisible"
      :table-id="currentTableId"
      @success="handleDrawerSuccess"
    />
  </a-card>
</template>
