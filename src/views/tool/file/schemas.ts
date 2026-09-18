import { MIME_TYPE_OPTIONS } from "./constants";

import type { FormSchema } from "@/components/business/Form";

/** 文件搜索表单 schema */
export const fileSearchSchemas: FormSchema[] = [
  {
    field: "keyword",
    label: "文件名",
    component: "Input",
    colProps: { span: 6 },
    componentProps: {
      placeholder: "搜索文件名...",
      allowClear: true,
    },
  },
  {
    field: "mimeType",
    label: "文件类型",
    component: "Select",
    colProps: { span: 6 },
    componentProps: {
      options: MIME_TYPE_OPTIONS,
      placeholder: "选择类型",
      allowClear: true,
    },
  },
];
