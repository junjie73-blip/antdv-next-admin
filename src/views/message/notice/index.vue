<script setup lang="ts">
import { Icon } from "@iconify/vue";
import dayjs from "dayjs";
import { ref } from "vue";
import { message } from "antdv-next";

import {
  deleteNotice,
  getNoticeDetail,
  getNoticeList,
  getUserAllOptions,
  revokeNotice,
  saveNotice,
  sendNotice,
  updateNotice,
} from "@/api";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, useTable } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";
import ChannelConfig from "./components/ChannelConfig.vue";

// 抽离的模块
import { getNoticeActions } from "./actions";
import { noticeActionColumn, noticeColumns, noticePagination, noticeRowKey } from "./columns";
import {
  NOTICE_PRIORITY_MAP,
  NOTICE_STATUS_MAP,
  NOTICE_TYPE_MAP,
  NOTICE_IS_TOP_MAP,
} from "./constants";
import { noticeSearchSchemas, useNoticeFormSchemas } from "./schemas";
import { cardClassName, containerClassName } from "./style";
import type { NoticeRecord, UserOption } from "./types";
defineOptions({ name: "SystemNotice" });

// ========== 用户选项 ==========
const userOptions = ref<UserOption[]>([]);
const channelConfigOpen = ref(false);

async function loadUserOptions() {
  try {
    const res = await getUserAllOptions();
    const data = Array.isArray(res) ? res : (res?.data ?? res ?? []);
    userOptions.value = data;
  } catch (e) {
    console.error(e);
  }
}

// ========== 弹窗表单 schema（依赖 userOptions） ==========
const noticeFormSchemas = useNoticeFormSchemas(ref(userOptions) as any);

// ========== 注册实例 ==========
const [tableRegister, tableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

// ========== useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<NoticeRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "noticeId",
  onFetchDetail: async (id) => await getNoticeDetail(id),
  getEmptyValues: () => ({
    title: "",
    noticeType: 1,
    status: "0",
    publishTime: null,
    targetUserIds: [],
    content: "",
  }),
  getFormValues: (record) => ({
    title: record.title,
    noticeType: record.noticeType,
    status: record.status,
    publishTime: record.publishTime ? dayjs(record.publishTime) : null,
    targetUserIds: record.targetUserIds || [],
    content: record.content,
  }),
  onCreate: async (values: any) => {
    const payload = {
      ...values,
      publishTime: values.publishTime
        ? dayjs(values.publishTime).format("YYYY-MM-DD HH:mm:ss")
        : null,
    };
    await saveNotice(payload);
  },
  onUpdate: async (id, values) => {
    await updateNotice(id, values);
  },
  onDelete: async (record) => {
    await deleteNotice(record.noticeId);
  },
  messages: {
    createSuccess: "通知创建成功",
    updateSuccess: "通知更新成功",
    deleteSuccess: "通知删除成功",
  },
});

// ========== 手动发送 ==========
async function handleSend(record: NoticeRecord) {
  try {
    await sendNotice(record.noticeId);
    message.success(`已发送通知「${record.title}」`);
    tableMethods.value?.reload();
  } catch (e: any) {
    message.error(e?.message || "发送失败");
  }
}
async function handleRevoke(record: NoticeRecord) {
  try {
    await revokeNotice(record.noticeId);
    message.success("已撤回");
    tableMethods.value?.reload();
  } catch (e: any) {
    message.error(e?.message || "撤回失败");
  }
}
// ========== 操作项（每次渲染注入最新 record） ==========
function getActions(record: any) {
  return getNoticeActions(record, {
    onEdit: handleEdit,
    onSend: handleSend,
    onDelete: handleDelete,
    onRevoke: handleRevoke,
  });
}
// ========== 初始化 ==========
loadUserOptions();
</script>

<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <div class="p-4">
        <BasicTable
          :columns="noticeColumns"
          :api="getNoticeList"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: noticeSearchSchemas, labelWidth: 80 }"
          :action-column="noticeActionColumn"
          :pagination="noticePagination"
          :row-key="noticeRowKey"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button type="primary" @click="handleAdd()">
              <template #icon><Icon icon="ant-design:plus-outlined" /></template>
              新增通知
            </a-button>
            <a-button @click="channelConfigOpen = true">
              <template #icon><Icon icon="carbon:notification" /></template>
              渠道设置
            </a-button>
          </template>

          <template #cell-noticeType="{ record }">
            <a-tag :color="NOTICE_TYPE_MAP[record.noticeType]?.color || 'default'">
              {{ NOTICE_TYPE_MAP[record.noticeType]?.label || "未知" }}
            </a-tag>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="NOTICE_STATUS_MAP[record.status]?.color || 'default'">
              {{ NOTICE_STATUS_MAP[record.status]?.label || record.status }}
            </a-tag>
          </template>
          <template #cell-priority="{ record }">
            <a-tag :color="NOTICE_PRIORITY_MAP[record.priority]?.color || 'default'">
              {{ NOTICE_PRIORITY_MAP[record.priority]?.label || record.priority }}
            </a-tag>
          </template>
          <template #cell-isTop="{ record }">
            <a-tag :color="NOTICE_IS_TOP_MAP[record.isTop]?.color || 'default'">
              {{ NOTICE_IS_TOP_MAP[record.isTop]?.label || record.isTop }}
            </a-tag>
          </template>
          <template #action="{ record }">
            <table-action :actions="getActions(record)" />
          </template>
        </BasicTable>
      </div>
    </a-card>

    <BasicModal
      :title="isEditing ? '编辑通知' : '新增通知'"
      :width="640"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="noticeFormSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>
    <ChannelConfig v-model:open="channelConfigOpen" />
  </div>
</template>
