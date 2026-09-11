<script setup lang="tsx">
import type { DescriptionItem } from "@/components/business/Description";
import type { FormSchema } from "@/components/business/Form";
import type { BasicColumn } from "@/components/business/Table";
import { Icon } from "@iconify/vue";
import { nextTick, ref, shallowRef } from "vue";
import {
  createTenant,
  updateTenant,
  deleteTenant,
  batchDeleteTenant,
  getTenantList,
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

defineOptions({ name: "SystemTenant" });

interface TenantRecord {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  status: string; // '0' 禁用，'1' 启用
  expireTime?: string | null;
  createdAt: string;
  updatedAt: string;
}

const containerClassName = cn("space-y-4");
const cardClassName = cn(
  "shadow-sm rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900",
);
const actionClassName = cn("flex", "items-center", "justify-center");
const btnClassName = cn("!px-0.5");
const dividerClassName = cn("mx-0");

const statusColorMap: Record<string, string> = { "1": "green", "0": "red" };
const statusLabelMap: Record<string, string> = { "1": "启用", "0": "禁用" };

// ========== 详情 ==========
const viewingRecord = shallowRef<TenantRecord | null>(null);
const [drawerRegister, drawerMethods] = useDrawer();

const detailSchemas: DescriptionItem[] = [
  { field: "tenantCode", label: "租户编码", render: (v) => <a-tag color="blue">{v}</a-tag> },
  { field: "tenantName", label: "租户名称" },
  { field: "contactName", label: "联系人" },
  { field: "contactPhone", label: "联系电话" },
  { field: "contactEmail", label: "联系邮箱", span: 2 },
  {
    field: "status",
    label: "状态",
    type: "dict",
    dictType: DictType.NORMAL_DISABLE,
  },
  {
    field: "expireTime",
    label: "过期时间",
    render: (v) => (v ? v : "永久"),
  },
  {
    field: "createdAt",
    label: "创建时间",
  },
];

function handleView(record: TenantRecord) {
  viewingRecord.value = null;
  drawerMethods.openDrawer();

  nextTick(() => {
    viewingRecord.value = record;
  });
}

// ========== 表单 & CRUD ==========
const [tableRegister, tableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

const searchFormSchemas: FormSchema[] = [
  {
    field: "keyword",
    label: "关键词",
    component: "Input",
    colProps: { span: 6 },
    componentProps: { placeholder: "租户编码/名称", allowClear: true },
  },
  {
    field: "status",
    label: "状态",
    component: "Select",
    colProps: { span: 6 },
    componentProps: {
      placeholder: "选择状态",
      allowClear: true,
      options: [
        { label: "启用", value: "1" },
        { label: "禁用", value: "0" },
      ],
    },
  },
];

const modalFormSchemas: FormSchema[] = [
  {
    field: "tenantCode",
    label: "租户编码",
    component: "Input",
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: "全局唯一，如 ACME" },
  },
  {
    field: "tenantName",
    label: "租户名称",
    component: "Input",
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: "例如：ACME科技有限公司" },
  },
  { field: "contactName", label: "联系人", component: "Input", colProps: { span: 12 } },
  { field: "contactPhone", label: "联系电话", component: "Input", colProps: { span: 12 } },
  { field: "contactEmail", label: "联系邮箱", component: "Input", colProps: { span: 24 } },
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
    field: "expireTime",
    label: "过期时间",
    component: "DatePicker",
    colProps: { span: 12 },
    componentProps: {
      showTime: true,
      style: { width: "100%" },
      placeholder: "留空表示永久",
    },
  },
];

const { isEditing, handleAdd, handleEdit, handleDelete, handleBatchDelete, handleSave } =
  useCRUD<TenantRecord>({
    containerType: "modal",
    modalMethods,
    formMethods,
    tableMethods,
    idKey: "tenantId",
    confirmDelete: true,
    getEmptyValues: () => ({
      tenantCode: "",
      tenantName: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      status: "1",
      expireTime: null,
    }),
    getFormValues: (record) => ({
      tenantCode: record.tenantCode,
      tenantName: record.tenantName,
      contactName: record.contactName || "",
      contactPhone: record.contactPhone || "",
      contactEmail: record.contactEmail || "",
      status: record.status,
      expireTime: record.expireTime ? dayjs(record.expireTime) : null,
    }),
    onCreate: async (values) => {
      const payload = {
        ...values,
        expireTime: values.expireTime
          ? dayjs(values.expireTime).format("YYYY-MM-DD HH:mm:ss")
          : null,
      };
      await createTenant(payload);
    },
    onUpdate: async (id, values) => {
      const payload = {
        ...values,
        expireTime: values.expireTime
          ? dayjs(values.expireTime).format("YYYY-MM-DD HH:mm:ss")
          : null,
      };
      await updateTenant(id, payload);
    },
    onDelete: async (record) => {
      await deleteTenant(record.tenantId);
    },
    onBatchDelete: async (records) => {
      await batchDeleteTenant(records.map((r) => r.tenantId));
    },
    messages: {
      createSuccess: "租户创建成功",
      updateSuccess: "租户更新成功",
      deleteSuccess: "租户删除成功",
      batchDeleteSuccess: "批量删除成功",
      deleteConfirm: "确定要删除该租户吗？该操作不可恢复",
      batchDeleteConfirm: "确定要删除选中的租户吗？",
    },
  });

// ========== 列定义 ==========
const columns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    dataIndex: "tenantId",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "租户编码", dataIndex: "tenantCode", key: "tenantCode", width: 140 },
  { title: "租户名称", dataIndex: "tenantName", key: "tenantName", width: 200, ellipsis: true },
  { title: "联系人", dataIndex: "contactName", key: "contactName", width: 100, align: "center" },
  {
    title: "联系电话",
    dataIndex: "contactPhone",
    key: "contactPhone",
    width: 140,
    align: "center",
  },
  { title: "联系邮箱", dataIndex: "contactEmail", key: "contactEmail", width: 200, ellipsis: true },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  {
    title: "过期时间",
    dataIndex: "expireTime",
    key: "expireTime",
    width: 170,
    align: "center",
    customRender: ({ record }: any) =>
      record.expireTime ? dayjs(record.expireTime).format("YYYY-MM-DD HH:mm") : "永久",
  },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170, align: "center" },
];
const getActions = (record: any): ActionItem[] => {
  return [
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => handleEdit(record),
    },
    {
      label: "查看",
      icon: "ant-design:eye-outlined",
      onClick: () => handleView(record),
    },
    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除租户",
        confirm: () => handleDelete(record),
      },
    },
  ];
};
</script>

<template>
  <div :class="containerClassName">
    <a-card title="租户管理" :class="cardClassName">
      <BasicTable
        :columns="columns"
        :api="getTenantList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :scroll="{ x: 1400 }"
        :row-selection="{ type: 'checkbox' }"
        :action-column="{ width: 250, title: '操作', fixed: 'right' }"
        :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
        :row-key="(record) => record.tenantId"
        table-layout="fixed"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="() => handleAdd()">
            <template #icon><Icon icon="ant-design:plus-outlined" /></template>
            新增租户
          </a-button>
          <a-button danger @click="() => handleBatchDelete()">
            <template #icon><Icon icon="ant-design:delete-outlined" /></template>
            批量删除
          </a-button>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="statusColorMap[record.status] || 'default'">
            {{ statusLabelMap[record.status] || "未知" }}
          </a-tag>
        </template>

        <template #action="{ record }">
          <table-action :actions="getActions(record)" />
        </template>
      </BasicTable>
    </a-card>

    <BasicModal
      :title="isEditing ? '编辑租户' : '新增租户'"
      :width="640"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="modalFormSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>

    <BasicDrawer
      :title="`租户详情 - ${viewingRecord?.tenantName || ''}`"
      :width="620"
      :show-footer="false"
      @register="drawerRegister"
      @close="viewingRecord = null"
    >
      <Description
        v-if="viewingRecord"
        :key="viewingRecord.tenantId"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="2"
      />
    </BasicDrawer>
  </div>
</template>
