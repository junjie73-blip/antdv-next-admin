<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import { ref, watch } from "vue";

import { getJobActions } from "./actions";

import {
  jobActionColumn,
  jobColumns,
  jobRowKey,
  jobScroll,
  logColumns,
  logRowKey,
} from "./columns";

import { LOG_STATUS_MAP } from "./constants";
import { JOB_EMPTY_VALUES, jobFormSchemas } from "./schemas";

import type { JobRecord, JobTabKey } from "./types";

import {
  clearJobLog,
  createJob,
  deleteJob,
  getJobList,
  getJobLogList,
  pauseJob,
  resumeJob,
  runJobOnce,
  toggleJobStatus,
  updateJob,
} from "~/api";

import { BasicForm, useForm } from "~/components/business/Form";
import { BasicModal, useModal } from "~/components/business/Modal";
import { type ActionItem, BasicTable, TableAction, useTable } from "~/components/business/Table";
import CronEditor from "~/components/common/CronEditor/index.vue";
import { useCRUD } from "~/composables/useCRUD";

// 抽离的模块

defineOptions({ name: "MonitorJob" });

// ============ 状态 ============
const activeTab = ref<JobTabKey>("job");

const [jobTableRegister, jobTableMethods] = useTable();
const [logTableRegister, logTableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

// ============ useCRUD ============
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<JobRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods: jobTableMethods,
  idKey: "jobId",
  getEmptyValues: () => ({ ...JOB_EMPTY_VALUES }),
  getFormValues: (r) => ({ ...r }),
  onCreate: async (v) => {
    await createJob(v);
  },
  onUpdate: async (id, v) => {
    await updateJob(id, v);
  },
  onDelete: async (r) => {
    await deleteJob(r.jobId);
  },
  messages: {
    createSuccess: "创建成功",
    updateSuccess: "更新成功",
    deleteSuccess: "删除成功",
  },
});

// ============ 状态切换 / 执行 / 日志清空 ============
async function handleToggle(record: JobRecord) {
  const newStatus = record.status === "1" ? "0" : "1";
  await toggleJobStatus(record.jobId, newStatus);
  message.success(newStatus === "1" ? "已启动" : "已停止");
  jobTableMethods.value?.reload();
}

async function handleRun(record: JobRecord) {
  await runJobOnce(record.jobId);
  message.success("已执行");
}

async function handleClearLog() {
  await clearJobLog();
  message.success("已清空");
  logTableMethods.value?.reload();
}
async function handlePause(record: JobRecord) {
  await pauseJob(record.jobId);
  message.success("已暂停");
  jobTableMethods.value?.reload();
}

async function handleResume(record: JobRecord) {
  await resumeJob(record.jobId);
  message.success("已恢复");
  jobTableMethods.value?.reload();
}
// ============ 操作项 ============
function getActions(record: JobRecord): ActionItem[] {
  return getJobActions(record, {
    onRun: handleRun,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onPause: handlePause,
    onResume: handleResume,
  });
}

// ============ Tab 切换时刷新对应表格 ============
watch(activeTab, (newVal) => {
  if (newVal === "job") {
    jobTableMethods.value?.reload();
  } else if (newVal === "log") {
    logTableMethods.value?.reload();
  }
});
</script>

<template>
  <a-card :bordered="false" class="shadow-sm">
    <a-tabs v-model:active-key="activeTab">
      <a-tab-pane key="job" tab="任务列表">
        <BasicTable
          :columns="jobColumns"
          :api="getJobList"
          :immediate="true"
          :use-search-form="false"
          :scroll="jobScroll"
          :row-key="jobRowKey"
          :action-column="jobActionColumn"
          @register="jobTableRegister"
        >
          <template #toolbar>
            <a-button type="primary" @click="handleAdd()">
              <template #icon><Icon icon="ant-design:plus-outlined" /></template>
              新增任务
            </a-button>
          </template>

          <template #cell-status="{ record }">
            <a-switch
              :checked="record.status === '1'"
              size="small"
              @change="() => handleToggle(record as JobRecord)"
            />
          </template>

          <template #action="{ record }">
            <TableAction :actions="getActions(record as JobRecord)" />
          </template>
        </BasicTable>
      </a-tab-pane>

      <a-tab-pane key="log" tab="执行日志">
        <BasicTable
          :columns="logColumns"
          :api="getJobLogList"
          :immediate="true"
          :use-search-form="false"
          :scroll="jobScroll"
          :row-key="logRowKey"
          @register="logTableRegister"
        >
          <template #toolbar>
            <a-button danger @click="handleClearLog">清空日志</a-button>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="LOG_STATUS_MAP[record.status]?.color || 'default'">
              {{ LOG_STATUS_MAP[record.status]?.label || record.status }}
            </a-tag>
          </template>
        </BasicTable>
      </a-tab-pane>
    </a-tabs>

    <BasicModal
      :title="isEditing ? '编辑任务' : '新增任务'"
      :width="620"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="jobFormSchemas"
        :label-width="100"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      >
        <template #cronEditor="{ model, field }">
          <CronEditor
            :model-value="model[field]"
            @update:model-value="(val) => formMethods.setFieldsValue({ [field]: val })"
          />
        </template>
      </BasicForm>
    </BasicModal>
  </a-card>
</template>
