// views/system/notice/schemas.ts
import { computed, unref, type Ref, type ComputedRef } from 'vue'

import type { FormSchema } from '~/components/business/Form'

import type { UserOption } from './types'

import {
  NOTICE_IS_TOP_OPTIONS,
  NOTICE_PRIORITY_OPTIONS,
  NOTICE_PUBLISH_OPTIONS,
  NOTICE_SEND_STATUS_OPTIONS, // ⭐ 新增
  NOTICE_STATUS_OPTIONS,
  NOTICE_TYPE_OPTIONS,
} from './constants'

/** 搜索表单 schema（静态） */
export const noticeSearchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '标题',
    component: 'Input',
    componentProps: { placeholder: '搜索标题关键字', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'noticeType',
    label: '类型',
    component: 'Select',
    componentProps: {
      placeholder: '全部类型',
      allowClear: true,
      options: NOTICE_TYPE_OPTIONS,
    },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '发布状态',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: NOTICE_STATUS_OPTIONS,
    },
    colProps: { span: 6 },
  },
  // ⭐ 新增：发送状态筛选
  {
    field: 'sendStatus',
    label: '发送状态',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: NOTICE_SEND_STATUS_OPTIONS,
    },
    colProps: { span: 6 },
  },
]

/**
 * 生成弹窗表单 schema
 *
 * ⭐ 修复：使用 unref 解包，让 computed 正确追踪依赖
 *   原写法 userOptions.value 在 computed 里是快照，异步加载后不会刷新
 */
export function useNoticeFormSchemas(
  userOptions: Ref<UserOption[]> | ComputedRef<UserOption[]>,
  templateOptions: Ref<{ label: string; value: string }[]> | ComputedRef<{ label: string; value: string }[]>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => {
    const users = unref(userOptions)
    const templates = unref(templateOptions)

    return [
      {
        field: 'title',
        label: '通知标题',
        component: 'Input',
        required: true,
        colProps: { span: 24 },
        componentProps: { placeholder: '请输入标题', maxlength: 256 },
      },
      {
        field: 'noticeType',
        label: '通知类型',
        component: 'Select',
        defaultValue: 1,
        componentProps: { options: NOTICE_TYPE_OPTIONS },
      },
      {
        field: 'priority',
        label: '优先级',
        component: 'RadioGroup',
        defaultValue: 0,
        componentProps: { options: NOTICE_PRIORITY_OPTIONS },
      },
      {
        field: 'isTop',
        label: '是否置顶',
        component: 'RadioGroup',
        defaultValue: 0,
        componentProps: { options: NOTICE_IS_TOP_OPTIONS },
      },
      {
        field: 'status',
        label: '发布状态',
        component: 'RadioGroup',
        defaultValue: '0',
        componentProps: () => ({
          optionType: 'button',
          buttonStyle: 'solid',
          options: NOTICE_PUBLISH_OPTIONS,
        }),
      },
      {
        field: 'publishTime',
        label: '发布时间',
        component: 'DatePicker',
        colProps: { span: 24 },
        componentProps: {
          showTime: true,
          placeholder: '不填则立即发布或保持草稿',
          style: { width: '100%' },
          valueFormat: 'YYYY-MM-DD HH:mm:ss', // ⭐ 统一格式，省去 payload 转换
        },
      },
      {
        field: 'targetUserIds',
        label: '接收人',
        component: 'Select',
        colProps: { span: 24 },
        componentProps: {
          mode: 'multiple',
          placeholder: '选择接收用户（不选则发送给所有人）',
          options: users, // ⭐ 响应式
          showSearch: true,
          optionFilterProp: 'label',
          maxTagCount: 10,
        },
      },
      {
        field: 'templateId',
        label: '消息模板',
        component: 'Select',
        colProps: { span: 24 },
        componentProps: {
          placeholder: '选择消息模板（不选则使用通知内容）',
          allowClear: true,
          showSearch: true,
          options: templates, // ⭐ 响应式
          optionFilterProp: 'label',
        },
        helpMessage: '选择后将使用模板内容作为邮件正文；否则使用通知内容',
      },
      {
        field: 'content',
        label: '内容',
        component: 'MarkdownEditor',
        required: true,
        colProps: { span: 24 },
        componentProps: { placeholder: '请输入通知内容', minHeight: 500 },
      },
    ]
  })
}
