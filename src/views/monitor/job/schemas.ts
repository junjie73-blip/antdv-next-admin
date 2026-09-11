import type { FormSchema } from "@/components/business/Form";
import {
  DEFAULT_INVOKE_TARGET,
  DEFAULT_JOB_GROUP,
  INVOKE_TARGET_OPTIONS,
  JOB_STATUS_OPTIONS,
} from "./constants";

/** 任务弹窗表单 schema */
export const jobFormSchemas: FormSchema[] = [
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
    defaultValue: DEFAULT_JOB_GROUP,
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
      options: JOB_STATUS_OPTIONS,
    },
  },
  {
    field: "invokeTarget",
    label: "执行目标",
    component: "Select",
    required: true,
    colProps: { span: 24 },
    componentProps: { options: INVOKE_TARGET_OPTIONS },
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

/** 新增任务时的空表单值 */
export const JOB_EMPTY_VALUES = {
  jobName: "",
  jobGroup: DEFAULT_JOB_GROUP,
  invokeTarget: DEFAULT_INVOKE_TARGET,
  cronExpression: "",
  status: "1",
  remark: "",
};
