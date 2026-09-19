import { computed } from "vue";

import type { ComputedRef, Ref } from "vue";

import type { FormSchema } from "~/components/business/Form";

export interface StatusOption {
  label: string;
  value: string | number;
}

/**
 * 搜索表单 schema
 * 依赖 statusOptions（字典异步加载），用工厂函数保证响应性
 */
export function useUserSearchSchemas(
  statusOptions: ComputedRef<StatusOption[]>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: "keyword",
      label: "关键词",
      component: "Input",
      componentProps: {
        placeholder: "搜索用户名/真实姓名/邮箱/手机号...",
        allowClear: true,
      },
      colProps: { span: 6 },
    },
    {
      field: "status",
      label: "状态",
      component: "Select",
      defaultValue: "1",
      componentProps: {
        placeholder: "选择状态",
        allowClear: true,
        options: statusOptions.value,
      },
      colProps: { span: 6 },
    },
  ]);
}

/**
 * 弹窗表单 schema
 * @param statusOptions  状态选项（来自字典）
 * @param isEditing      是否编辑模式（控制密码字段显隐）
 */
export function useUserFormSchemas(
  statusOptions: ComputedRef<StatusOption[]>,
  isEditing: Ref<boolean>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: "username",
      label: "用户名",
      component: "Input",
      required: true,
      componentProps: { placeholder: "请输入用户名" },
    },
    {
      field: "realName",
      label: "真实姓名",
      component: "Input",
      required: true,
      componentProps: { placeholder: "请输入真实姓名" },
    },
    {
      field: "password",
      label: "密码",
      component: "InputPassword",
      ifShow: () => !isEditing.value,
      componentProps: { placeholder: "留空则不修改密码" },
    },
    {
      field: "phone",
      label: "手机号",
      component: "Input",
      componentProps: { placeholder: "请输入手机号" },
    },
    {
      field: "email",
      label: "邮箱",
      component: "Input",
      componentProps: { placeholder: "请输入邮箱地址" },
    },
    {
      field: "gender",
      label: "性别",
      component: "RadioGroup",
      defaultValue: 0,
      colProps: { span: 12 },
      componentProps: {
        optionType: "button",
        buttonStyle: "solid",
        options: [
          { label: "未知", value: 0 },
          { label: "男", value: 1 },
          { label: "女", value: 2 },
        ],
      },
    },
    {
      field: "avatar",
      label: "头像",
      component: "Input",
      colProps: { span: 24 },
      slot: "avatarUpload",
      componentProps: { placeholder: "头像 URL" },
    },
    {
      field: "deptIds",
      label: "部门",
      component: "ATreeSelect",
      componentProps: {
        fieldNames: { children: "children", label: "deptName", value: "deptId" },
        placeholder: "请选择部门",
        treeDefaultExpandAll: true,
        api: "/dept/tree",
      },
    },
    {
      field: "roleIds",
      label: "角色",
      component: "ASelect",
      componentProps: {
        api: "/role/options",
        placeholder: "请选择角色",
        mode: "multiple",
      },
    },
    {
      field: "sortOrder",
      label: "排序号",
      component: "InputNumber",
      colProps: { span: 12 },
      defaultValue: 0,
      componentProps: { min: 0, placeholder: "数字越小越靠前", style: { width: "100%" } },
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
  ]);
}

/** 新增用户时的空表单值 */
export const USER_EMPTY_VALUES = {
  username: "",
  realName: "",
  password: "",
  email: "",
  phone: "",
  deptIds: [],
  roleIds: [],
  sortOrder: 0,
  status: "1",
  gender: 0,
  avatar: "",
};

export const userDetailSchema = [
  {
    field: "username",
    label: "用户名",
  },
  {
    field: "realName",
    label: "真实姓名",
  },
  ,
  {
    field: "email",
    label: "邮箱",
  },
  {
    field: "phone",
    label: "手机号",
  },
  {
    field: "idCard",
    label: "身份证号",
  },
  {
    field: "gender",
    label: "性别",
  },
];
