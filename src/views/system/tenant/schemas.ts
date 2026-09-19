import { h } from "vue";

import { TENANT_STATUS_OPTIONS } from "./constants";

import type { DescriptionItem } from "~/components/business/Description";
import type { FormSchema } from "~/components/business/Form";

import { DictType } from "~/enums/dict";

/** 搜索表单 schema */
export const tenantSearchSchemas: FormSchema[] = [
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
      options: TENANT_STATUS_OPTIONS,
    },
  },
];

/** 弹窗表单 schema */
export const tenantFormSchemas: FormSchema[] = [
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
      options: TENANT_STATUS_OPTIONS,
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

/** 新增租户时的空表单值 */
export const TENANT_EMPTY_VALUES = {
  tenantCode: "",
  tenantName: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  status: "1",
  expireTime: null,
};

/**
 * 详情描述 schema
 * 原 JSX `<a-tag color="blue">{v}</a-tag>` 用 `h()` 表达
 */
export const tenantDetailSchemas: DescriptionItem[] = [
  {
    field: "tenantCode",
    label: "租户编码",
    render: (v) => h("a-tag", { color: "blue" }, v),
  },
  { field: "tenantName", label: "租户名称" },
  { field: "contactName", label: "联系人" },
  { field: "contactPhone", label: "联系电话" },
  { field: "contactEmail", label: "联系邮箱", span: 2 },
  {
    field: "status",
    label: "状态",
    type: "dict",
    dictType: DictType.NORMAL_DISABLE,
  } as DescriptionItem,
  {
    field: "expireTime",
    label: "过期时间",
    render: (v) => (v ? v : "永久"),
  },
  { field: "createdAt", label: "创建时间" },
];
