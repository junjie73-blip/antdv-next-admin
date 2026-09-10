<script setup lang="tsx">
import type { DescriptionItem } from "@/components/business/Description";
import type { FormSchema } from "@/components/business/Form";
import type { BasicColumn } from "@/components/business/Table";
import { Icon } from "@iconify/vue";
import { computed, ref } from "vue";
import {
  createPermission,
  updatePermission,
  deletePermission,
  getPermissionList,
} from "@/api/system";
import { Description } from "@/components/business/Description";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, useTable } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";
import { cn } from "@/utils/cn";
import { message } from "antdv-next";
import dayjs from "dayjs";
import { DictType } from "@/enums/dict";
import { useUserStore } from "@/stores/modules/user";

defineOptions({ name: "SystemPermission" });

// ========== 类型定义 ==========
interface PermissionRecord {
  permId: string;
  permCode: string;
  permName: string;
  /** 权限级别：platform 平台级，business 业务级（从 permCode 前缀推断） */
  scope: "platform" | "business";
  resourceType: string; // 'menu' | 'button' | 'api' | 'data' | 'other'
  action?: string | null;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ========== 工具函数 ==========
/** 从权限编码推断级别 */
function getScopeByCode(code: string): "platform" | "business" {
  return code.startsWith("platform:") ? "platform" : "business";
}

/** 判断该资源类型是否需要"动作"字段 */
function needAction(resourceType: string): boolean {
  // 菜单类型不需要动作（有/无权访问菜单即可）
  // 数据权限类型也不依赖动作
  return resourceType !== "menu" && resourceType !== "data";
}

// ========== 样式 ==========
const containerClassName = cn("space-y-4");
const cardClassName = cn(
  "shadow-sm rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900",
);
const actionClassName = cn("flex", "items-center", "justify-center");
const btnClassName = cn("!px-0.5");
const dividerClassName = cn("mx-0");

// ========== 状态映射 ==========
const statusColorMap: Record<string, string> = { "1": "green", "0": "red" };
const statusLabelMap: Record<string, string> = { "1": "启用", "0": "禁用" };

// ========== 级别映射 ==========
const scopeOptions = [
  { label: "全部", value: "" },
  { label: "平台级", value: "platform" },
  { label: "业务级", value: "business" },
];

const scopeColorMap: Record<string, string> = {
  platform: "purple",
  business: "blue",
};

const scopeLabelMap: Record<string, string> = {
  platform: "平台级",
  business: "业务级",
};

// ========== 资源类型映射 ==========
const resourceTypeOptions = [
  { label: "菜单", value: "menu" },
  { label: "按钮", value: "button" },
  { label: "接口", value: "api" },
  { label: "数据", value: "data" },
  { label: "其他", value: "other" },
];

const resourceTypeColorMap: Record<string, string> = {
  menu: "purple",
  button: "green",
  api: "blue",
  data: "orange",
  other: "default",
};

const resourceTypeLabelMap: Record<string, string> = {
  menu: "菜单",
  button: "按钮",
  api: "接口",
  data: "数据",
  other: "其他",
};

// ========== 动作映射 ==========
const actionColorMap: Record<string, string> = {
  create: "green",
  read: "blue",
  update: "orange",
  delete: "red",
  export: "cyan",
  import: "purple",
  list: "geekblue",
  detail: "blue",
};

// ========== 用户 store（判断是否平台超管） ==========
const userStore = useUserStore();
const isPlatformAdmin = computed(() => {
  // 简单方式：检查用户是否拥有 platform:* 权限
  return userStore.permissions?.some((p: string) => p.startsWith("platform:")) ?? false;
});

// ========== 详情 ==========
const viewingRecord = ref<PermissionRecord | null>(null);
const [drawerRegister, drawerMethods] = useDrawer();

const detailSchemas: DescriptionItem[] = [
  { field: "permCode", label: "权限编码", span: 2 },
  { field: "permName", label: "权限名称" },
  {
    field: "scope",
    label: "权限级别",
    render: (v) => <a-tag color={scopeColorMap[v] || "default"}>{scopeLabelMap[v] || v}</a-tag>,
  },
  {
    field: "resourceType",
    label: "资源类型",
    render: (v) => (
      <a-tag color={resourceTypeColorMap[v] || "default"}>{resourceTypeLabelMap[v] || v}</a-tag>
    ),
  },
  {
    field: "action",
    label: "动作",
    render: (v) => (v ? <a-tag color={actionColorMap[v] || "default"}>{v}</a-tag> : "-"),
  },
  {
    field: "status",
    label: "状态",
    type: "dict",
    dictType: DictType.NORMAL_DISABLE,
  },
  { field: "description", label: "描述", span: 2 },
  { field: "createdAt", label: "创建时间" },
  { field: "updatedAt", label: "更新时间" },
];

function handleView(record: PermissionRecord) {
  viewingRecord.value = null;
  setTimeout(() => {
    viewingRecord.value = record;
    drawerMethods.openDrawer();
  });
}

// ========== 表格 & 表单 ==========
const [tableRegister, tableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

// ========== 搜索表单 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: "permCode",
    label: "权限编码",
    component: "Input",
    colProps: { span: 6 },
    componentProps: { placeholder: "搜索权限编码", allowClear: true },
  },
  {
    field: "permName",
    label: "权限名称",
    component: "Input",
    colProps: { span: 6 },
    componentProps: { placeholder: "搜索权限名称", allowClear: true },
  },
  {
    field: "scope",
    label: "权限级别",
    component: "Select",
    colProps: { span: 4 },
    componentProps: {
      placeholder: "全部级别",
      allowClear: true,
      options: scopeOptions.slice(1), // 去掉"全部"选项，用 allowClear 代替
    },
  },
  {
    field: "resourceType",
    label: "资源类型",
    component: "Select",
    colProps: { span: 4 },
    componentProps: {
      placeholder: "全部类型",
      allowClear: true,
      options: resourceTypeOptions,
    },
  },
  {
    field: "status",
    label: "状态",
    component: "Select",
    colProps: { span: 4 },
    componentProps: {
      placeholder: "全部状态",
      allowClear: true,
      options: [
        { label: "启用", value: "1" },
        { label: "禁用", value: "0" },
      ],
    },
  },
];

// ========== 编辑表单（核心改造） ==========
const modalFormSchemas = computed<FormSchema[]>(() => [
  {
    field: "permCode",
    label: "权限编码",
    component: "Input",
    required: true,
    colProps: { span: 24 },
    componentProps: {
      placeholder: "平台级：platform:xxx:yyy；业务级：system:xxx:yyy",
    },
    // 编码前缀提示
    helpMessage: "以 platform: 开头为平台级，其他为业务级",
  },
  {
    field: "permName",
    label: "权限名称",
    component: "Input",
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: "例如：创建用户" },
  },
  {
    field: "resourceType",
    label: "资源类型",
    component: "Select",
    required: true,
    colProps: { span: 12 },
    defaultValue: "button",
    componentProps: {
      options: resourceTypeOptions,
      placeholder: "选择资源类型",
    },
  },
  // ⚠️ 关键：仅当资源类型需要动作时才展示"动作"字段
  {
    field: "action",
    label: "动作",
    component: "Select",
    required: true,
    colProps: { span: 12 },
    defaultValue: "create",
    // 使用 ifShow 动态显示
    ifShow: ({ values }: any) => needAction(values.resourceType),
    componentProps: {
      placeholder: "选择动作",
      options: [
        { label: "创建 (create)", value: "create" },
        { label: "读取 (read)", value: "read" },
        { label: "更新 (update)", value: "update" },
        { label: "删除 (delete)", value: "delete" },
        { label: "列表 (list)", value: "list" },
        { label: "详情 (detail)", value: "detail" },
        { label: "导出 (export)", value: "export" },
        { label: "导入 (import)", value: "import" },
      ],
    },
  },
  {
    field: "status",
    label: "状态",
    component: "RadioGroup",
    defaultValue: "1",
    colProps: { span: 12 },
    componentProps: {
      optionType: "button",
      buttonStyle: "solid",
      options: [
        { label: "启用", value: "1" },
        { label: "禁用", value: "0" },
      ],
    },
  },
  {
    field: "description",
    label: "描述",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入权限描述...", rows: 3 },
  },
]);

// ========== useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<PermissionRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "permId",
  confirmDelete: true,
  getEmptyValues: () => ({
    permCode: "",
    permName: "",
    resourceType: "button",
    action: "create",
    status: "1",
    description: "",
  }),
  getFormValues: (record) => ({
    permCode: record.permCode,
    permName: record.permName,
    resourceType: record.resourceType,
    action: record.action || "",
    status: record.status,
    description: record.description || "",
  }),
  onCreate: async (values) => {
    // ⚠️ 菜单类型/数据权限类型不提交 action
    const payload: any = {
      permCode: values.permCode,
      permName: values.permName,
      resourceType: values.resourceType,
      status: values.status === "1" ? 1 : 0,
      description: values.description,
    };
    if (needAction(values.resourceType)) {
      payload.action = values.action;
    }
    await createPermission(payload);
  },
  onUpdate: async (id, values) => {
    const payload: any = {
      permCode: values.permCode,
      permName: values.permName,
      resourceType: values.resourceType,
      status: values.status === "1" ? 1 : 0,
      description: values.description,
    };
    if (needAction(values.resourceType)) {
      payload.action = values.action;
    } else {
      // 清空 action（如果后端支持 null）
      payload.action = null;
    }
    await updatePermission(id, payload);
  },
  onDelete: async (record) => {
    await deletePermission(record.permId);
  },
  messages: {
    createSuccess: "权限创建成功",
    updateSuccess: "权限更新成功",
    deleteSuccess: "权限删除成功",
    deleteConfirm: "确定要删除该权限吗？删除后关联的角色将失去此权限",
  },
});

// ========== 数据加载 ==========
async function mockApi(params: Record<string, any>) {
  const res = await getPermissionList(params);
  const data = res?.data ?? res;
  const list = (data?.list || [])
    .map((item: any) => ({
      permId: item.permId,
      permCode: item.permCode,
      permName: item.permName,
      scope: getScopeByCode(item.permCode),
      resourceType: item.resourceType,
      action: item.action,
      description: item.description,
      status: String(item.status),
      createdAt: item.createdAt ? dayjs(item.createdAt).format("YYYY-MM-DD HH:mm:ss") : "",
      updatedAt: item.updatedAt ? dayjs(item.updatedAt).format("YYYY-MM-DD HH:mm:ss") : "",
    }))
    // 前端兜底：非平台超管过滤掉平台级权限（后端最好也做）
    .filter((item: PermissionRecord) => (isPlatformAdmin.value ? true : item.scope === "business"));
  return { items: list, total: list.length };
}

// ========== 列定义 ==========
const columns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  {
    title: "权限级别",
    dataIndex: "scope",
    key: "scope",
    width: 100,
    align: "center",
  },
  {
    title: "资源类型",
    dataIndex: "resourceType",
    key: "resourceType",
    width: 100,
    align: "center",
  },
  { title: "权限编码", dataIndex: "permCode", key: "permCode", width: 240, ellipsis: true },
  { title: "权限名称", dataIndex: "permName", key: "permName", width: 160 },
  {
    title: "动作",
    dataIndex: "action",
    key: "action",
    width: 100,
    align: "center",
    customRender: ({ record }: any) => record.action || "-",
  },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "描述", dataIndex: "description", key: "description", ellipsis: true },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170, align: "center" },
];
</script>

<template>
  <div :class="containerClassName">
    <a-card title="权限管理" :class="cardClassName">
      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :scroll="{ x: 1400 }"
        :action-column="{ width: 220, title: '操作', fixed: 'right' }"
        :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
        :row-key="(record) => record.permId"
        table-layout="fixed"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="() => handleAdd()">
            <template #icon><Icon icon="ant-design:plus-outlined" /></template>
            新增权限
          </a-button>
        </template>

        <template #cell-scope="{ record }">
          <a-tag :color="scopeColorMap[record.scope] || 'default'">
            {{ scopeLabelMap[record.scope] || record.scope }}
          </a-tag>
        </template>

        <template #cell-resourceType="{ record }">
          <a-tag :color="resourceTypeColorMap[record.resourceType] || 'default'">
            {{ resourceTypeLabelMap[record.resourceType] || record.resourceType }}
          </a-tag>
        </template>

        <template #cell-action="{ record }">
          <a-tag v-if="record.action" :color="actionColorMap[record.action] || 'default'">
            {{ record.action }}
          </a-tag>
          <span v-else class="text-gray-400">-</span>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="statusColorMap[record.status] || 'default'">
            {{ statusLabelMap[record.status] || "未知" }}
          </a-tag>
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <a-button type="link" :class="btnClassName" @click="() => handleView(record)">
              <template #icon><Icon icon="ant-design:eye-outlined" /></template>
              查看
            </a-button>
            <a-divider type="vertical" :class="dividerClassName" />
            <a-button type="link" :class="btnClassName" @click="() => handleEdit(record)">
              <template #icon><Icon icon="ant-design:edit-outlined" /></template>
              编辑
            </a-button>
            <a-divider type="vertical" :class="dividerClassName" />
            <a-popconfirm
              :title="`确定要删除权限「${record.permName}」吗？`"
              @confirm="() => handleDelete(record)"
            >
              <a-button type="link" danger :class="btnClassName">
                <template #icon><Icon icon="ant-design:delete-outlined" /></template>
                删除
              </a-button>
            </a-popconfirm>
          </div>
        </template>
      </BasicTable>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <BasicModal
      :title="isEditing ? '编辑权限' : '新增权限'"
      :width="620"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="modalFormSchemas"
        :label-width="100"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>

    <!-- 详情抽屉 -->
    <BasicDrawer
      :title="`权限详情 - ${viewingRecord?.permName || ''}`"
      :width="620"
      :show-footer="false"
      @register="drawerRegister"
      @close="viewingRecord = null"
    >
      <Description
        v-if="viewingRecord"
        :key="viewingRecord.permId"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="2"
        bordered
        size="middle"
      />
    </BasicDrawer>
  </div>
</template>
