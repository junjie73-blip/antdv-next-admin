import { computed } from "vue";

import type { ComputedRef } from "vue";

import type { FormSchema } from "@/components/business/Form";




/** 状态选项类型 */
export interface StatusOption {
  label: string;
  value: string | number;
}

/**
 * 字典类型弹窗表单 schema
 */
export function useDictTypeFormSchemas(
  statusOptions: ComputedRef<StatusOption[]>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: "dictName",
      label: "字典名称",
      component: "Input",
      required: true,
      componentProps: { placeholder: "例如：用户性别" },
    },
    {
      field: "dictCode",
      label: "字典编码",
      component: "Input",
      required: true,
      componentProps: { placeholder: "例如：sys_user_sex" },
    },
    {
      field: "status",
      label: "状态",
      component: "RadioGroup",
      defaultValue: "1",
      colProps: { span: 12 },
      componentProps: () => ({
        optionType: "button",
        buttonStyle: "solid",
        options: statusOptions.value,
      }),
    },
    {
      field: "description",
      label: "备注",
      component: "InputTextArea",
      colProps: { span: 24 },
      componentProps: { placeholder: "请输入备注信息...", rows: 3 },
    },
  ]);
}

/**
 * 字典项弹窗表单 schema
 */
export function useDictItemFormSchemas(
  statusOptions: ComputedRef<StatusOption[]>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: "dictLabel",
      label: "字典标签",
      component: "Input",
      required: true,
      componentProps: { placeholder: "例如：男" },
    },
    {
      field: "dictValue",
      label: "字典编码",
      component: "Input",
      required: true,
      componentProps: { placeholder: "例如：0" },
    },
    {
      field: "sortOrder",
      label: "排序",
      component: "InputNumber",
      colProps: { span: 12 },
      componentProps: { min: 0, placeholder: "请输入排序号", style: { width: "100%" } },
    },
    {
      field: "status",
      label: "状态",
      component: "RadioGroup",
      defaultValue: "1",
      colProps: { span: 12 },
      componentProps: () => ({
        optionType: "button",
        buttonStyle: "solid",
        options: statusOptions.value,
      }),
    },
    {
      field: "remark",
      label: "备注",
      component: "InputTextArea",
      colProps: { span: 24 },
      componentProps: { placeholder: "请输入备注...", rows: 3 },
    },
  ]);
}
