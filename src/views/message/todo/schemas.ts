import type { FormSchema } from "@/components/business/Form";

/** 待办弹窗表单 schema */
export const todoFormSchemas: FormSchema[] = [
  {
    field: "title",
    label: "标题",
    component: "Input",
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入待办标题" },
  },
  {
    field: "content",
    label: "描述",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { rows: 3, placeholder: "请输入详情..." },
  },
  {
    field: "priority",
    label: "优先级",
    component: "RadioGroup",
    defaultValue: 0,
    colProps: { span: 24 },
    componentProps: {
      optionType: "button",
      buttonStyle: "solid",
      options: [
        { label: "普通", value: 0 },
        { label: "重要", value: 1 },
        { label: "紧急", value: 2 },
      ],
    },
  },
  {
    field: "dueTime",
    label: "截止时间",
    component: "DatePicker",
    colProps: { span: 24 },
    componentProps: {
      showTime: true,
      style: { width: "100%" },
      placeholder: "不填则表示无截止时间",
    },
  },
];

/** 新建待办时的空表单值 */
export const TODO_EMPTY_VALUES = {
  title: "",
  content: "",
  priority: 0,
  dueTime: null,
};
