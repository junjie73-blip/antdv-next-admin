import dayjs from "dayjs";
import { h } from "vue";

import type { DescriptionItem } from "~/components/business/Description";
import type { FormSchema } from "~/components/business/Form";

/** 搜索表单 schema */
export const configSearchSchemas: FormSchema[] = [
  {
    field: "keyword",
    label: "关键词",
    component: "Input",
    colProps: { span: 8 },
    componentProps: {
      placeholder: "搜索配置键或描述...",
      allowClear: true,
    },
  },
];

/** 弹窗表单 schema（只保留后端支持的字段） */
export const configFormSchemas: FormSchema[] = [
  {
    field: "configKey",
    label: "配置键",
    component: "Input",
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: "例如：site.name" },
  },
  {
    field: "configValue",
    label: "配置值",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入配置值", rows: 3 },
  },
  {
    field: "description",
    label: "描述",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入描述信息...", rows: 2 },
  },
];

/** 新增配置时的空表单值 */
export const CONFIG_EMPTY_VALUES = {
  configKey: "",
  configValue: "",
  description: "",
};

/**
 * 详情描述 schema
 * 用 `h()` 表达 JSX 中的 `<a-tag>` / `<pre>` 渲染
 */
export const configDetailSchemas: DescriptionItem[] = [
  {
    field: "configKey",
    label: "配置键",
    render: (value: string) => h("a-tag", { color: "blue" }, value),
  },
  {
    field: "configValue",
    label: "配置值",
    span: 2,
    render: (value: string) =>
      h(
        "pre",
        {
          class: "whitespace-pre-wrap text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded",
        },
        value || "-",
      ),
  },
  { field: "description", label: "描述", span: 2 },
  {
    field: "createdAt",
    label: "创建时间",
    render: (value: string) => dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
  },
  {
    field: "updatedAt",
    label: "更新时间",
    render: (value: string) => dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
  },
];
