
import { h } from "vue";

import {
  AUDIT_STATUS_COLOR_MAP,
  AUDIT_STATUS_LABEL_MAP,
  AUDIT_STATUS_OPTIONS,
  HTTP_METHOD_OPTIONS,
} from "./constants";

import type { DescriptionItem } from "@/components/business/Description";
import type { FormSchema } from "@/components/business/Form";


/** 搜索表单 schema */
export const auditLogSearchSchemas: FormSchema[] = [
  {
    field: "username",
    label: "操作人",
    component: "Input",
    componentProps: { placeholder: "请输入操作人用户名", allowClear: true },
    colProps: { span: 4 },
  },
  {
    field: "operation",
    label: "操作描述",
    component: "Input",
    componentProps: { placeholder: "输入操作描述关键字", allowClear: true },
    colProps: { span: 4 },
  },
  {
    field: "method",
    label: "HTTP方法",
    component: "Select",
    componentProps: {
      placeholder: "选择方法",
      allowClear: true,
      options: HTTP_METHOD_OPTIONS,
    },
    colProps: { span: 4 },
  },
  {
    field: "status",
    label: "状态",
    component: "Select",
    componentProps: {
      placeholder: "选择状态",
      allowClear: true,
      options: AUDIT_STATUS_OPTIONS,
    },
    colProps: { span: 3 },
  },
  {
    field: "dateRange",
    label: "操作时间",
    component: "RangePicker",
    componentProps: {
      placeholder: ["开始时间", "结束时间"],
      format: "YYYY-MM-DD HH:mm:ss",
      showTime: true,
      allowClear: true,
    },
    colProps: { span: 6 },
  },
];

/**
 * 详情描述 schema
 * 用函数返回值而非 static，是因为 h() 渲染的 VNode 每次调用都要新建
 */
export function createDetailSchemas(): DescriptionItem[] {
  return [
    { field: "logId", label: "日志编号" },
    { field: "tenantId", label: "租户ID" },
    { field: "userId", label: "用户ID" },
    { field: "username", label: "操作用户" },
    { field: "operation", label: "操作描述" },
    {
      field: "method",
      label: "HTTP方法",
      render: (value) => h("a-tag", { color: "blue" }, value),
    },
    {
      field: "requestUrl",
      label: "请求URL",
      render: (value) => h("code", { class: "break-all text-xs" }, value),
    },
    { field: "ipAddress", label: "客户端IP" },
    {
      field: "executeTime",
      label: "执行时间(ms)",
      render: (value) => h("span", `${value} ms`),
    },
    {
      field: "status",
      label: "状态",
      render: (value) =>
        h(
          "a-tag",
          { color: AUDIT_STATUS_COLOR_MAP[value as string] || "default" },
          AUDIT_STATUS_LABEL_MAP[value as string] || "未知",
        ),
    },
    { field: "createdAt", label: "创建时间" },
    { field: "errorMsg", label: "错误信息" },
    { field: "requestParams", label: "请求参数" },
    { field: "responseData", label: "响应数据" },
    { field: "userAgent", label: "用户代理" },
  ];
}
