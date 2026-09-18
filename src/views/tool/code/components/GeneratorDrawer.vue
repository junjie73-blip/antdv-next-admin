<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button, message, Space } from "antdv-next";
import { BasicForm, useForm } from "@/components/business/Form";
import {
  createGenTable,
  getGenCodeDownloadUrl,
  getGenTableDetail,
  updateGenTable,
} from "@/api/generator";
import type { GenTable, GenTableColumn } from "../types";
import { useBaseInfoSchemas } from "../schemas";
import {
  drawerBodyStyle,
  drawerContentClassName,
  drawerFooterClassName,
  sectionTitleClassName,
} from "../constants";
import ColumnTable from "./ColumnTable.vue";
import CodePreview from "./CodePreview.vue";
import { useUserStore } from "@/stores/modules/user";

defineOptions({ name: "GeneratorDrawer" });

const props = defineProps<{
  open: boolean;
  tableId: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  success: [];
}>();

const visible = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

// ============================================================
// 状态
// ============================================================
const activeTab = ref("base");
const loading = ref(false);
const saving = ref(false);
const table = ref<GenTable | null>(null);
const columns = ref<GenTableColumn[]>([]);
const isEdit = computed(() => Boolean(props.tableId));
const userStore = useUserStore();
const userInfo = computed(() => userStore.userInfo);

const drawerTitle = computed(() =>
  isEdit.value ? `编辑：${table.value?.tableName ?? ""}` : "新增代码生成配置",
);

// ============================================================
// 基本信息表单
// ============================================================
const baseInfoSchemas = useBaseInfoSchemas(userInfo.value!);
const [baseInfoRegister, baseInfoMethods] = useForm();

// ============================================================
// 默认字段（新增时预填规范审计字段）
// ============================================================
function getDefaultColumns(): GenTableColumn[] {
  return [
    {
      columnName: "id",
      columnComment: "主键",
      columnType: "uuid",
      tsType: "string",
      fieldName: "id",
      isPk: "1",
      isIncrement: "0",
      isRequired: "1",
      isInsert: "0",
      isEdit: "0",
      isList: "0",
      isQuery: "0",
      isSort: "0",
      queryType: "EQ",
      htmlType: "input",
      defaultValue: "gen_random_uuid()",
    },
    {
      columnName: "tenant_id",
      columnComment: "租户ID",
      columnType: "uuid",
      tsType: "string",
      fieldName: "tenantId",
      isPk: "0",
      isIncrement: "0",
      isRequired: "1",
      isInsert: "0",
      isEdit: "0",
      isList: "0",
      isQuery: "0",
      isSort: "0",
      queryType: "EQ",
      htmlType: "input",
    },
    {
      columnName: "created_at",
      columnComment: "创建时间",
      columnType: "timestamptz",
      tsType: "Date",
      fieldName: "createdAt",
      isPk: "0",
      isIncrement: "0",
      isRequired: "1",
      isInsert: "0",
      isEdit: "0",
      isList: "1",
      isQuery: "0",
      isSort: "0",
      queryType: "EQ",
      htmlType: "datetime",
      defaultValue: "now()",
    },
    {
      columnName: "updated_at",
      columnComment: "更新时间",
      columnType: "timestamptz",
      tsType: "Date",
      fieldName: "updatedAt",
      isPk: "0",
      isIncrement: "0",
      isRequired: "1",
      isInsert: "0",
      isEdit: "0",
      isList: "0",
      isQuery: "0",
      isSort: "0",
      queryType: "EQ",
      htmlType: "datetime",
      defaultValue: "now()",
    },
    {
      columnName: "is_deleted",
      columnComment: "软删标记",
      columnType: "int2",
      tsType: "number",
      fieldName: "isDeleted",
      isPk: "0",
      isIncrement: "0",
      isRequired: "1",
      isInsert: "0",
      isEdit: "0",
      isList: "0",
      isQuery: "0",
      isSort: "0",
      queryType: "EQ",
      htmlType: "inputNumber",
      defaultValue: "0",
    },
  ];
}

// ============================================================
// 加载详情
// ============================================================
async function loadDetail() {
  if (!props.tableId) {
    // 新增：重置表单 + 默认字段
    baseInfoMethods.resetFields();
    await baseInfoMethods.setFieldsValue({
      tplCategory: "crud",
      packageName: "src/modules",
      functionAuthor: "codegen",
    });
    columns.value = getDefaultColumns();
    return;
  }

  loading.value = true;
  try {
    const res = await getGenTableDetail(props.tableId);
    const data = res.data;
    table.value = data;
    columns.value = data.columns ?? [];

    await baseInfoMethods.setFieldsValue({
      tableName: data.tableName,
      tableComment: data.tableComment,
      className: data.className,
      tplCategory: data.tplCategory,
      packageName: data.packageName,
      moduleName: data.moduleName,
      businessName: data.businessName,
      functionName: data.functionName,
      functionAuthor: data.functionAuthor,
    });
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      activeTab.value = "base";
      void loadDetail();
    } else {
      table.value = null;
      columns.value = [];
    }
  },
);

// ============================================================
// 保存（新增 = 建表）
// ============================================================
async function handleSave() {
  const baseInfo = (await baseInfoMethods.validate()) as Record<string, unknown>;

  if (columns.value.length === 0) {
    message.warning("至少添加一个字段");
    return;
  }

  saving.value = true;
  try {
    if (isEdit.value && props.tableId) {
      await updateGenTable(props.tableId, {
        ...baseInfo,
        columns: columns.value,
      });
      message.success("保存成功");
    } else {
      await createGenTable({
        ...baseInfo,
        columns: columns.value,
      } as Parameters<typeof createGenTable>[0]);
      message.success("建表成功");
    }
    emit("success");
    visible.value = false;
  } finally {
    saving.value = false;
  }
}

// ============================================================
// 生成（下载 zip）
// ============================================================
function handleDownload() {
  if (!props.tableId) {
    message.warning("请先保存后再生成");
    return;
  }
  window.open(getGenCodeDownloadUrl(props.tableId), "_blank");
}
</script>

<template>
  <a-drawer
    v-model:open="visible"
    :width="1200"
    :body-style="drawerBodyStyle"
    :destroy-on-close="true"
    placement="right"
  >
    <template #title>{{ drawerTitle }}</template>

    <div :class="drawerContentClassName">
      <PerfectScrollbar class="h-full"
        ><a-tabs v-model:active-key="activeTab" :class="drawerTabsClassName">
          <!-- ========== 基本信息 ========== -->
          <a-tab-pane key="base" tab="基本信息">
            <div class="py-4">
              <BasicForm
                :schemas="baseInfoSchemas"
                :grid="{ cols: 2 }"
                :show-action-button-group="false"
                @register="baseInfoRegister"
              />
            </div>
          </a-tab-pane>

          <!-- ========== 字段配置 ========== -->
          <a-tab-pane key="columns" tab="字段配置">
            <div class="py-4">
              <div :class="sectionTitleClassName" class="mb-2">字段配置</div>
              <ColumnTable v-model:columns="columns" />
            </div>
          </a-tab-pane>

          <!-- ========== 代码预览 ========== -->
          <a-tab-pane key="preview" tab="代码预览">
            <div class="py-4">
              <CodePreview v-if="tableId && activeTab === 'preview'" :table-id="tableId" />
              <div v-else class="py-16 text-center text-gray-400 dark:text-gray-500">
                保存后可预览生成的代码
              </div>
            </div>
          </a-tab-pane>
        </a-tabs></PerfectScrollbar
      >
    </div>
    <template #footer :class="drawerFooterClassName">
      <Space>
        <Button :loading="saving" type="primary" @click="handleSave">
          {{ isEdit ? "保存" : "保存并建表" }}
        </Button>
        <Button v-if="isEdit" @click="handleDownload">生成代码</Button>
      </Space>
    </template>
  </a-drawer>
</template>
