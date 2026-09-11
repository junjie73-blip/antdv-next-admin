import type { FormSchema } from "@/components/business/Form";
import type { ComputedRef } from "vue";
import { computed } from "vue";
import type { UserOption } from "./types";
import { NOTICE_PUBLISH_OPTIONS, NOTICE_STATUS_OPTIONS, NOTICE_TYPE_OPTIONS } from "./constants";

/** 搜索表单 schema（静态） */
export const noticeSearchSchemas: FormSchema[] = [
  {
    field: "keyword",
    label: "标题",
    component: "Input",
    componentProps: { placeholder: "搜索标题关键字", allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: "noticeType",
    label: "类型",
    component: "Select",
    componentProps: {
      placeholder: "全部类型",
      allowClear: true,
      options: NOTICE_TYPE_OPTIONS,
    },
    colProps: { span: 6 },
  },
  {
    field: "status",
    label: "状态",
    component: "Select",
    componentProps: {
      placeholder: "全部状态",
      allowClear: true,
      options: NOTICE_STATUS_OPTIONS,
    },
    colProps: { span: 6 },
  },
];

/**
 * 生成弹窗表单 schema
 * 为什么用函数：接收人选项是异步加载的，需要保持响应性
 */
export function useNoticeFormSchemas(
  userOptions: ComputedRef<UserOption[]>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: "title",
      label: "通知标题",
      component: "Input",
      required: true,
      colProps: { span: 24 },
      componentProps: { placeholder: "请输入标题" },
    },
    {
      field: "noticeType",
      label: "通知类型",
      component: "Select",
      defaultValue: 1,
      componentProps: { options: NOTICE_TYPE_OPTIONS },
    },
    {
      field: "status",
      label: "发布状态",
      component: "RadioGroup",
      defaultValue: "0",
      componentProps: () => ({
        optionType: "button",
        buttonStyle: "solid",
        options: NOTICE_PUBLISH_OPTIONS,
      }),
    },
    {
      field: "publishTime",
      label: "发布时间",
      component: "DatePicker",
      colProps: { span: 24 },
      componentProps: {
        showTime: true,
        placeholder: "不填则立即发布或保持草稿",
        style: { width: "100%" },
      },
    },
    {
      field: "targetUserIds",
      label: "接收人",
      component: "Select",
      colProps: { span: 24 },
      componentProps: {
        mode: "multiple",
        placeholder: "选择接收用户（不选则发送给所有人）",
        options: userOptions.value,
      },
    },
    {
      field: "content",
      label: "内容",
      component: "InputTextArea",
      required: true,
      colProps: { span: 24 },
      componentProps: { placeholder: "请输入通知内容", rows: 5 },
    },
  ]);
}
