
import { computed } from "vue";

import { MENU_TYPE_OPTIONS } from "./constants";

import type { ComputedRef } from "vue";

import type { FormSchema } from "@/components/business/Form";


/** 状态选项类型 */
export interface StatusOption {
  label: string;
  value: string | number;
}

/**
 * 菜单抽屉表单 schema
 * @param statusOptions 从字典 store 获取的状态选项（响应式）
 */
export function useMenuFormSchemas(
  statusOptions: ComputedRef<StatusOption[]>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: "menuType",
      label: "菜单类型",
      component: "RadioGroup",
      defaultValue: 1,
      componentProps: {
        optionType: "button",
        buttonStyle: "solid",
        options: MENU_TYPE_OPTIONS,
      },
    },
    {
      field: "parentId",
      label: "上级菜单",
      component: "ATreeSelect",
      componentProps: {
        api: "/menu/tree",
        placeholder: "请选择上级菜单（留空为顶级）",
        allowClear: true,
        treeDefaultExpandAll: true,
        fieldNames: {
          label: "menuName",
          value: "menuId",
          children: "children",
        },
      },
    },
    {
      field: "menuName",
      label: "菜单名称",
      component: "Input",
      required: true,
      componentProps: { placeholder: "请输入菜单名称" },
    },
    {
      field: "icon",
      label: "图标",
      component: "Input",
      slot: "iconPicker",
      componentProps: { placeholder: "点击选择图标", readonly: true },
      dynamicDisabled: ({ model }) => (model as any).menuType === 3,
    },
    {
      field: "path",
      label: "路由地址",
      component: "Input",
      componentProps: { placeholder: "例如：/system/user" },
      dynamicDisabled: ({ model }) => (model as any).menuType !== 2,
    },
    {
      field: "component",
      label: "组件路径",
      component: "Input",
      componentProps: { placeholder: "例如：system/user/index" },
      dynamicDisabled: ({ model }) => (model as any).menuType !== 2,
    },
    {
      field: "permission",
      label: "权限标识",
      component: "Input",
      componentProps: { placeholder: "例如：system:user:list" },
    },
    {
      field: "sortOrder",
      label: "排序",
      component: "InputNumber",
      componentProps: { min: 0, placeholder: "请输入排序号", style: { width: "100%" } },
    },
    {
      field: "status",
      label: "状态",
      component: "RadioGroup",
      defaultValue: "1",
      componentProps: () => ({
        optionType: "button",
        buttonStyle: "solid",
        options: statusOptions.value,
      }),
    },
  ]);
}

/** 新增菜单时的空表单值 */
export const MENU_EMPTY_VALUES = {
  parentId: undefined,
  menuType: 1,
  menuName: "",
  icon: "",
  path: "",
  component: "",
  permission: "",
  sortOrder: 0,
  status: "1",
};
