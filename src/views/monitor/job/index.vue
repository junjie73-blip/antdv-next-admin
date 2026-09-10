<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { ref, watch } from "vue";
import {
  getJobList,
  createJob,
  updateJob,
  deleteJob,
  toggleJobStatus,
  runJobOnce,
  getJobLogList,
  clearJobLog,
} from "@/api/system";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, useTable } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";
import { message } from "antdv-next";
import dayjs from "dayjs";
import CronEditor from "@/components/common/CronEditor/index.vue";
defineOptions({ name: "MonitorJob" });

const activeTab = ref("job");
const [jobTableRegister, jobTableMethods] = useTable();
const [logTableRegister, logTableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

const formSchemas = [
  {
    field: "jobName",
    label: "任务名称",
    component: "Input",
    required: true,
    colProps: { span: 24 },
  },
  {
    field: "jobGroup",
    label: "任务分组",
    component: "Input",
    defaultValue: "DEFAULT",
    colProps: { span: 12 },
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
        { label: "停用", value: "0" },
      ],
    },
  },
  {
    field: "invokeTarget",
    label: "执行目标",
    component: "Select",
    required: true,
    colProps: { span: 24 },
    componentProps: {
      options: [
        { label: "发布到期通知 (notice:publish)", value: "notice:publish" },
        { label: "清理过期日志 (log:clean)", value: "log:clean" },
        { label: "待办逾期提醒 (todo:overdue-notify)", value: "todo:overdue-notify" },
      ],
    },
  },
  {
    field: "cronExpression",
    label: "Cron 表达式",
    component: "Input",
    required: true,
    colProps: { span: 24 },
    slot: "cronEditor",
    componentProps: { placeholder: "请选择或自定义 cron 表达式" },
  },
  {
    field: "remark",
    label: "备注",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { rows: 3 },
  },
];

const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<any>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods: jobTableMethods,
  idKey: "jobId",
  confirmDelete: true,
  getEmptyValues: () => ({
    jobName: "",
    jobGroup: "DEFAULT",
    invokeTarget: "notice:publish",
    cronExpression: "",
    status: "1",
    remark: "",
  }),
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
    deleteConfirm: "确定删除该任务吗？",
  },
});

async function handleToggle(record: any) {
  const newStatus = record.status === "1" ? "0" : "1";
  await toggleJobStatus(record.jobId, newStatus);
  message.success(newStatus === "1" ? "已启动" : "已停止");
  jobTableMethods.value?.reload();
}

async function handleRun(record: any) {
  await runJobOnce(record.jobId);
  message.success("已执行");
}

async function handleClearLog() {
  await clearJobLog();
  message.success("已清空");
  logTableMethods.value?.reload();
}

const jobColumns = [
  {
    title: "序号",
    key: "index",
    width: 60,
    dataIndex: "jobId",
    align: "center",
    customRender: ({ index }: any) => index + 1,
  },
  { title: "任务名称", dataIndex: "jobName", key: "jobName", width: 160 },
  { title: "分组", dataIndex: "jobGroup", key: "jobGroup", width: 100, align: "center" },
  { title: "执行目标", dataIndex: "invokeTarget", key: "invokeTarget", width: 200 },
  {
    title: "Cron 表达式",
    dataIndex: "cronExpression",
    key: "cronExpression",
    width: 200,
  },
  { title: "状态", key: "status", dataIndex: "status", width: 90, align: "center" },
];

const logColumns = [
  {
    title: "序号",
    key: "index",
    dataIndex: "logId",
    width: 60,
    align: "center",
    customRender: ({ index }: any) => index + 1,
  },
  { title: "任务名称", dataIndex: "jobName", key: "jobName", width: 160 },
  { title: "执行目标", dataIndex: "invokeTarget", key: "invokeTarget", width: 200 },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "消息", dataIndex: "jobMessage", key: "jobMessage", ellipsis: true },
  {
    title: "执行时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 170,
    customRender: ({ record }: any) => dayjs(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
  },
];
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
          :scroll="{ x: 900 }"
          :row-key="(r: any) => r.jobId"
          :action-column="{ width: 260, title: '操作', fixed: 'right' }"
          @register="jobTableRegister"
        >
          <template #toolbar>
            <a-button type="primary" @click="() => handleAdd()">
              <template #icon><Icon icon="ant-design:plus-outlined" /></template>
              新增任务
            </a-button>
          </template>
          <template #cell-status="{ record }">
            <a-switch
              :checked="record.status === '1'"
              size="small"
              @change="() => handleToggle(record)"
            />
          </template>
          <template #action="{ record }">
            <a-button type="link" size="small" @click="() => handleRun(record)">立即执行</a-button>
            <a-divider vertical />
            <a-button type="link" size="small" @click="() => handleEdit(record)">编辑</a-button>
            <a-divider vertical />
            <a-popconfirm title="确定删除？" @confirm="() => handleDelete(record)">
              <a-button type="link" danger size="small">删除</a-button>
            </a-popconfirm>
          </template>
        </BasicTable>
      </a-tab-pane>

      <a-tab-pane key="log" tab="执行日志">
        <BasicTable
          :columns="logColumns"
          :api="getJobLogList"
          :immediate="true"
          :use-search-form="false"
          :scroll="{ x: 900 }"
          :row-key="(r: any) => r.logId"
          @register="logTableRegister"
        >
          <template #toolbar>
            <a-button danger @click="handleClearLog">清空日志</a-button>
          </template>
          <template #cell-status="{ record }">
            <a-tag :color="record.status === '1' ? 'green' : 'red'">
              {{ record.status === "1" ? "成功" : "失败" }}
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
        :schemas="formSchemas"
        :label-width="100"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      >
        <template #cronEditor="{ model, field }">
          <CronEditor
            :model-value="model[field]"
            @update:model-value="(val) => formMethods.setFieldsValue({ [field]: val })"
          /> </template
      ></BasicForm>
    </BasicModal>
  </a-card>
</template>
