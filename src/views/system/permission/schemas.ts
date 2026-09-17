import type { DescriptionItem } from "@/components/business/Description";
import type { FormSchema } from "@/components/business/Form";
import { h } from "vue";
import {
  ACTION_COLOR_MAP,
  ACTION_OPTIONS,
  PERM_STATUS_OPTIONS,
  RESOURCE_TYPE_COLOR_MAP,
  RESOURCE_TYPE_LABEL_MAP,
  RESOURCE_TYPE_OPTIONS,
  SCOPE_COLOR_MAP,
  SCOPE_LABEL_MAP,
} from "./constants";
import { needAction } from "./utils";
import { DictType } from "@/enums/dict";

/** 搜索表单 schema */
export const permissionSearchSchemas: FormSchema[] = [
  {
    field: "permCode",
    label: "权限编码",
    component: "Input",
    colProps: { span: 6 },
    componentProps: { placeholder: "搜索权限编码", allowClear: true },
  },
  {
    field: "permName",
    label: "权限名称",
    component: "Input",
    colProps: { span: 6 },
    componentProps: { placeholder: "搜索权限名称", allowClear: true },
  },
  {
    field: "resourceType",
    label: "资源类型",
    component: "Select",
    colProps: { span: 4 },
    componentProps: {
      placeholder: "全部类型",
      allowClear: true,
      options: RESOURCE_TYPE_OPTIONS,
    },
  },
  {
    field: "status",
    label: "状态",
    component: "Select",
    colProps: { span: 4 },
    componentProps: {
      placeholder: "全部状态",
      allowClear: true,
      options: PERM_STATUS_OPTIONS,
    },
  },
];

/**
 * 弹窗表单 schema
 * 说明：`action` 字段通过 ifShow 动态显示，依赖当前表单值中的 resourceType
 */
export const permissionFormSchemas: FormSchema[] = [
  {
    field: "permCode",
    label: "权限编码",
    component: "Input",
    required: true,
    colProps: { span: 24 },
    componentProps: {
      placeholder: "平台级：platform:xxx:yyy；业务级：system:xxx:yyy",
    },
    helpMessage: "以 platform: 开头为平台级，其他为业务级",
  },
  {
    field: "permName",
    label: "权限名称",
    component: "Input",
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: "例如：创建用户" },
  },
  {
    field: "resourceType",
    label: "资源类型",
    component: "Select",
    required: true,
    colProps: { span: 12 },
    defaultValue: "api",
    componentProps: {
      options: RESOURCE_TYPE_OPTIONS,
      placeholder: "选择资源类型",
    },
  },
  {
    field: "permAction",
    label: "动作",
    component: "Select",
    required: true,
    colProps: { span: 12 },
    defaultValue: "create",
    // 仅当资源类型需要动作时展示
    ifShow: ({ values }: any) => needAction(values.resourceType),
    componentProps: {
      placeholder: "选择动作",
      options: ACTION_OPTIONS,
    },
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
      options: PERM_STATUS_OPTIONS,
    },
  },
  {
    field: "description",
    label: "描述",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入权限描述...", rows: 3 },
  },
];

/**
 * 详情 schema
 * 依赖 DictType.NORMAL_DISABLE 的字典渲染，需由调用方保证字典已加载
 */
export const permissionDetailSchemas: DescriptionItem[] = [
  { field: "permCode", label: "权限编码", span: 2 },
  { field: "permName", label: "权限名称" },
  {
    field: "scope",
    label: "权限级别",
    render: (v) =>
      h(
        "a-tag",
        { color: SCOPE_COLOR_MAP[v as keyof typeof SCOPE_COLOR_MAP] || "default" },
        SCOPE_LABEL_MAP[v as keyof typeof SCOPE_LABEL_MAP] || v,
      ),
  },
  {
    field: "resourceType",
    label: "资源类型",
    render: (v) =>
      h(
        "a-tag",
        { color: RESOURCE_TYPE_COLOR_MAP[v as keyof typeof RESOURCE_TYPE_COLOR_MAP] || "default" },
        RESOURCE_TYPE_LABEL_MAP[v as keyof typeof RESOURCE_TYPE_LABEL_MAP] || v,
      ),
  },
  {
    field: "permAction",
    label: "动作",
    render: (v) => (v ? h("a-tag", { color: ACTION_COLOR_MAP[v as string] || "default" }, v) : "-"),
  },
  {
    field: "status",
    label: "状态",
    type: "dict",
    dictType: DictType.NORMAL_DISABLE,
  } as DescriptionItem,
  { field: "description", label: "描述", span: 2 },
  { field: "createdAt", label: "创建时间" },
  { field: "updatedAt", label: "更新时间" },
];
