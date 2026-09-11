<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { ref, watch } from "vue";
import { getIpRuleList, createIpRule, updateIpRule, deleteIpRule } from "@/api/system";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, useTable, type ActionItem } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";
import { message } from "antdv-next";
import dayjs from "dayjs";

defineOptions({ name: "SystemIpRule" });

const activeTab = ref("white");
const [tableRegister, tableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

const formSchemas = [
  {
    field: "ruleType",
    label: "规则类型",
    component: "RadioGroup",
    required: true,
    defaultValue: "white",
    componentProps: {
      optionType: "button",
      buttonStyle: "solid",
      options: [
        { label: "白名单", value: "white" },
        { label: "黑名单", value: "black" },
      ],
    },
  },
  {
    field: "ipPattern",
    label: "IP / CIDR",
    component: "Input",
    required: true,
    componentProps: { placeholder: "例如：192.168.1.1 或 192.168.1.0/24" },
  },
  {
    field: "status",
    label: "状态",
    component: "RadioGroup",
    defaultValue: "1",
    componentProps: {
      optionType: "button",
      buttonStyle: "solid",
      options: [
        { label: "启用", value: "1" },
        { label: "停用", value: "0" },
      ],
    },
  },
  { field: "remark", label: "备注", component: "InputTextArea", componentProps: { rows: 3 } },
];

const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<any>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "ruleId",
  confirmDelete: true,
  getEmptyValues: () => ({ ruleType: activeTab.value, ipPattern: "", status: "1", remark: "" }),
  getFormValues: (r) => ({
    ruleType: r.ruleType,
    ipPattern: r.ipPattern,
    status: r.status,
    remark: r.remark,
  }),
  onCreate: async (v) => {
    await createIpRule(v);
  },
  onUpdate: async (id, v) => {
    await updateIpRule(id, v);
  },
  onDelete: async (r) => {
    await deleteIpRule(r.ruleId);
  },
  messages: {
    createSuccess: "创建成功",
    updateSuccess: "更新成功",
    deleteSuccess: "删除成功",
    deleteConfirm: "确定删除该规则吗？",
  },
});

const columns = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }: any) => index + 1,
  },
  { title: "IP / CIDR", dataIndex: "ipPattern", key: "ipPattern", width: 200 },
  { title: "状态", key: "status", width: 80, align: "center" },
  { title: "备注", dataIndex: "remark", key: "remark", ellipsis: true },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 170,
    customRender: ({ record }: any) => dayjs(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
  },
];
watch(
  activeTab,
  (newVal) => {
    tableMethods.value?.reload({
      searchInfo: {
        ruleType: newVal,
      },
    });
  },
  {
    immediate: true,
  },
);
const getActions = (record: any): ActionItem[] => {
  return [
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => handleEdit(record),
    },
    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除IP规则",
        confirm: () => handleDelete(record),
      },
    },
  ];
};
</script>

<template>
  <a-card :bordered="false" class="shadow-sm">
    <a-tabs v-model:active-key="activeTab">
      <a-tab-pane key="white" tab="IP 白名单" />
      <a-tab-pane key="black" tab="IP 黑名单" />
    </a-tabs>

    <BasicTable
      :columns="columns"
      :api="getIpRuleList"
      :immediate="true"
      :use-search-form="false"
      :scroll="{ x: 800 }"
      :row-key="(r: any) => r.ruleId"
      :action-column="{ width: 160, title: '操作', fixed: 'right' }"
      @register="tableRegister"
    >
      <template #toolbar>
        <a-button type="primary" @click="() => handleAdd()">
          <template #icon><Icon icon="ant-design:plus-outlined" /></template>
          新增规则
        </a-button>
      </template>
      <template #cell-status="{ record }">
        <a-tag :color="record.status === '1' ? 'green' : 'red'">
          {{ record.status === "1" ? "启用" : "停用" }}
        </a-tag>
      </template>
      <template #action="{ record }">
        <table-action :actions="getActions(record)" />
      </template>
    </BasicTable>

    <BasicModal
      :title="isEditing ? '编辑规则' : '新增规则'"
      :width="520"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="formSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>
  </a-card>
</template>
