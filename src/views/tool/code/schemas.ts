import { computed, type ComputedRef } from "vue";

import { IDENT_RE, TPL_CATEGORY_OPTIONS } from "./constants";

import type { UserInfo } from "#/user";
import type { FormSchema } from "~/components/business/Form/types";

/** 搜索表单 schema */
export function useSearchSchemas(): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: "keyword",
      label: "关键字",
      component: "Input",
      componentProps: {
        placeholder: "表名 / 表描述",
        allowClear: true,
      },
    },
  ]);
}

/** 基本信息表单 schema */
export function useBaseInfoSchemas(userInfo: UserInfo): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: "tableName",
      label: "表名",
      component: "Input",
      required: true,
      rules: [
        { required: true, message: "表名不能为空", trigger: "blur" },
        { pattern: IDENT_RE, message: "小写字母开头，仅含小写字母/数字/下划线", trigger: "blur" },
      ],
      componentProps: {
        placeholder: "sys_demo",
        disabled: false,
      },
      colProps: { span: 12 },
    },
    {
      field: "tableComment",
      label: "表描述",
      component: "Input",
      componentProps: { placeholder: "示例表" },
      colProps: { span: 12 },
    },
    {
      field: "className",
      label: "实体类名",
      component: "Input",
      required: true,
      rules: [{ required: true, message: "实体类名不能为空" }],
      componentProps: { placeholder: "Demo" },
      colProps: { span: 12 },
    },
    {
      field: "tplCategory",
      label: "模板类型",
      component: "Select",
      defaultValue: "crud",
      componentProps: () => ({ options: TPL_CATEGORY_OPTIONS }),
      colProps: { span: 12 },
    },
    {
      field: "packageName",
      label: "包路径",
      component: "Input",
      defaultValue: "src/modules",
      colProps: { span: 12 },
    },
    {
      field: "moduleName",
      label: "模块名",
      component: "Input",
      componentProps: { placeholder: "demo" },
      colProps: { span: 12 },
    },
    {
      field: "businessName",
      label: "业务名",
      component: "Input",
      componentProps: { placeholder: "demo" },
      colProps: { span: 12 },
    },
    {
      field: "functionName",
      label: "功能名",
      component: "Input",
      componentProps: { placeholder: "示例管理" },
      colProps: { span: 12 },
    },
    {
      field: "functionAuthor",
      label: "作者",
      component: "ASelect",
      defaultValue: userInfo?.realname ?? userInfo?.username ?? "codegen",
      dynamicDisabled: () => true,
      componentProps: {
        placeholder: "codegen",
        api: "/user/all/options",
        fieldNames: {
          label: "username",
          value: "userId",
        },
      },
      colProps: { span: 12 },
    },
  ]);
}
