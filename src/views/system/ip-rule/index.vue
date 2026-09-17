<script setup lang="ts">

import { Icon } from "@iconify/vue";
import { ref, watch } from "vue";

import { getIpRuleActions } from "./actions";
import { ipRuleActionColumn, ipRuleColumns, ipRuleRowKey, ipRuleScroll } from "./columns";
import { IP_RULE_STATUS_COLOR_MAP, IP_RULE_STATUS_LABEL_MAP, TAB_TO_RULE_TYPE } from "./constants";
import { ipRuleFormSchemas } from "./schemas";

import type { IpRuleRecord, IpRuleType } from "./types";

import { createIpRule, deleteIpRule, getIpRuleList, updateIpRule } from "@/api";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { type ActionItem, BasicTable, TableAction, useTable } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";

// 抽离的模块


defineOptions({ name: "SystemIpRule" });

// ========== 状态 ==========
const activeTab = ref<IpRuleType>("white");

const [tableRegister, tableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

// ========== useCRUD ==========
// 说明：删除确认由操作项 popConfirm 负责，关闭 useCRUD 内置 Modal.confirm，
// 避免"气泡确认 + 弹窗确认"双重确认。
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<IpRuleRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "ruleId",
  getEmptyValues: () => ({
    ruleType: activeTab.value,
    ipPattern: "",
    status: "1",
    remark: "",
  }),
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
  },
});

// ========== Tab 切换时重新拉取 ==========
watch(
  activeTab,
  (newVal) => {
    tableMethods.value?.reload({
      searchInfo: {
        ruleType: TAB_TO_RULE_TYPE[newVal],
      },
    });
  },
  { immediate: true },
);

// ========== 操作项 ==========
function getActions(record: IpRuleRecord): ActionItem[] {
  return getIpRuleActions(record, {
    onEdit: handleEdit,
    onDelete: handleDelete,
  });
}
</script>

<template>
  <a-card :bordered="false"
class="shadow-sm">
    <a-tabs v-model:active-key="activeTab">
      <a-tab-pane key="white"
tab="IP 白名单" />
      <a-tab-pane key="black"
tab="IP 黑名单" />
    </a-tabs>

    <BasicTable
      :columns="ipRuleColumns"
      :api="getIpRuleList"
      :immediate="true"
      :use-search-form="false"
      :scroll="ipRuleScroll"
      :row-key="ipRuleRowKey"
      :action-column="ipRuleActionColumn"
      @register="tableRegister"
    >
      <template #toolbar>
        <a-button type="primary"
@click="handleAdd()">
          <template #icon><Icon icon="ant-design:plus-outlined" /></template>
          新增规则
        </a-button>
      </template>

      <template #cell-status="{ record }">
        <a-tag :color="IP_RULE_STATUS_COLOR_MAP[record.status] || 'default'">
          {{ IP_RULE_STATUS_LABEL_MAP[record.status] || "未知" }}
        </a-tag>
      </template>

      <template #action="{ record }">
        <TableAction :actions="getActions(record as IpRuleRecord)" />
      </template>
    </BasicTable>

    <BasicModal
      :title="isEditing ? '编辑规则' : '新增规则'"
      :width="520"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="ipRuleFormSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>
  </a-card>
</template>
