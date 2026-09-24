import type { ComputedRef } from 'vue'

import { computed } from 'vue'

import type { FormSchema } from '~/components/business/Form'

import type { DeptTreeNode } from './types'

/** 搜索表单 schema（静态） */
export const deptSearchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '部门名称',
    component: 'Input',
    componentProps: { placeholder: '搜索部门名称...', allowClear: true },
    colProps: { span: 8 },
  },
]

/**
 * 生成部门弹窗表单 schema
 * 依赖：
 * - deptTreeData：上级部门 TreeSelect 的数据源
 * - statusOptions：状态选项（来自字典）
 */
export function useDeptFormSchemas(
  deptTreeData: ComputedRef<DeptTreeNode[]>,
  statusOptions: ComputedRef<{ label: string; value: string | number }[]>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'parentId',
      label: '上级部门',
      component: 'TreeSelect',
      componentProps: {
        treeData: deptTreeData.value,
        fieldNames: { children: 'children', label: 'deptName', value: 'deptId' },
      },
    },
    {
      field: 'deptName',
      label: '部门名称',
      component: 'Input',
      required: true,
      componentProps: { placeholder: '请输入部门名称' },
    },
    {
      field: 'deptCode',
      label: '部门编码',
      component: 'Input',
      required: true,
      componentProps: { placeholder: '请输入部门编码（唯一）' },
    },
    {
      field: 'leader',
      label: '负责人',
      component: 'Input',
      componentProps: { placeholder: '请输入负责人姓名' },
    },
    {
      field: 'phone',
      label: '联系电话',
      component: 'Input',
      componentProps: { placeholder: '请输入联系电话' },
    },
    {
      field: 'email',
      label: '邮箱',
      component: 'Input',
      componentProps: { placeholder: '请输入邮箱' },
    },
    {
      field: 'sortOrder',
      label: '排序号',
      component: 'InputNumber',
      defaultValue: 0,
      colProps: { span: 12 },
      componentProps: { min: 0, placeholder: '数字越小越靠前', style: { width: '100%' } },
    },
    {
      field: 'status',
      label: '状态',
      component: 'RadioGroup',
      defaultValue: '1',
      colProps: { span: 12 },
      componentProps: () => ({
        optionType: 'button',
        buttonStyle: 'solid',
        options: statusOptions.value,
      }),
    },
  ])
}
