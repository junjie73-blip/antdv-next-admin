<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import { ref } from 'vue'
import { BasicForm, useForm } from '@/components/business/Form'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')

const schemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户',
    component: 'Input',
    required: true,
    defaultValue: '',
    colProps: { span: 12 },
    componentProps: {
      placeholder: '请输入用户名',
      allowClear: true,
    },
  },
  {
    field: 'password',
    label: '密码',
    component: 'InputPassword',
    required: true,
    colProps: { span: 12 },
    componentProps: {
      placeholder: '请输入密码',
    },
  },
  {
    field: 'email',
    label: '邮箱地址',
    component: 'Input',
    colProps: { span: 12 },
    rules: [
      { required: true, message: '请输入邮箱' },
      { type: 'email' as any, message: '邮箱格式不正确' },
    ],
    componentProps: {
      placeholder: '请输入邮箱',
    },
  },
  {
    field: 'age',
    label: '年龄',
    component: 'InputNumber',
    colProps: { span: 12 },
    componentProps: {
      placeholder: '请输入年龄',
      min: 0,
      max: 150,
      style: { width: '100%' },
    },
  },
  {
    field: 'gender',
    label: '性别',
    component: 'RadioGroup',
    defaultValue: 'male',
    colProps: { span: 12 },
    componentProps: {
      options: [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
      ],
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    defaultValue: 'active',
    colProps: { span: 12 },
    componentProps: {
      placeholder: '请选择状态',
      options: [
        { label: '启用', value: 'active' },
        { label: '禁用', value: 'inactive' },
        { label: '待审核', value: 'pending' },
      ],
    },
  },
  {
    component: 'RadioButtonGroup',
    field: 'theme',
    label: '主题',
    colProps: { span: 12 },
    componentProps: {
      options: [
        { label: '默认', value: 'default' },
        { label: '暗黑', value: 'dark' },
      ],
      optionType: 'button',
      buttonStyle: 'solid',
    },
  },
  {
    field: 'birthday',
    label: '出生日期',
    component: 'DatePicker',
    colProps: { span: 12 },
    componentProps: {
      placeholder: '请选择日期',
      format: 'YYYY-MM-DD',
      valueFormat: 'YYYY-MM-DD',
      style: { width: '100%' },
    },
  },
  {
    field: 'switch',
    label: '开关',
    component: 'Switch',
    defaultValue: false,
    colProps: { span: 12 },
  },
  {
    field: 'hobbies',
    label: '爱好',
    component: 'CheckboxGroup',
    colProps: { span: 24 },
    componentProps: {
      options: [
        { label: '阅读', value: 'reading' },
        { label: '运动', value: 'sports' },
        { label: '音乐', value: 'music' },
        { label: '旅行', value: 'travel' },
      ],
    },
  },
  {
    field: 'rate',
    label: '评分',
    component: 'Rate',
    defaultValue: 3,
    colProps: { span: 12 },
  },
  {
    field: 'slider',
    label: '滑块',
    component: 'Slider',
    defaultValue: 30,
    colProps: { span: 12 },
  },
  {
    field: 'description',
    label: '简介',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: {
      placeholder: '请输入简介',
      rows: 4,
    },
  },
  {
    field: 'timeRange',
    label: '时间范围',
    component: 'RangePicker',
    colProps: { span: 12 },
    componentProps: {
      placeholder: ['开始时间', '结束时间'],
      showTime: true,
      format: 'YYYY-MM-DD HH:mm:ss',
      style: { width: '100%' },
    },
  },
]

const [register, { validate, resetFields, setFieldsValue, getFieldsValue }] = useForm({
  schemas,
  labelWidth: 100,
  showActionButtonGroup: true,
  showResetButton: true,
  showSubmitButton: true,
  showAdvancedButton: true,
  alwaysShowLines: 2,
  fieldMapToTime: [
    ['timeRange', ['startTime', 'endTime'], 'YYYY-MM-DD HH:mm:ss'],
  ],
  submitButtonOptions: {
    text: '查询',
    preIcon: 'carbon:search',
  },
  resetButtonOptions: {
    text: '重置',
    preIcon: 'carbon:restart',
  },
})

const formResult = ref<Record<string, any>>({})

async function handleSubmit(values: Record<string, any>) {
  console.log('查询数据:', values)
  formResult.value = values
}

async function handleValidate() {
  try {
    const values = await validate()
    console.log('验证通过:', values)
    formResult.value = values
  }
  catch (error) {
    console.error('验证失败:', error)
  }
}

function handleReset() {
  resetFields()
  formResult.value = {}
}

function handleSetValues() {
  setFieldsValue({
    username: 'test_user',
    email: 'test@example.com',
    age: 25,
    gender: 'female',
    status: 'pending',
  })
}

function handleGetValues() {
  const values = getFieldsValue()
  console.log('当前表单', values)
  formResult.value = values
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="基础表单">
      <div class="space-y-4">
        <div class="flex gap-2 flex-wrap">
          <a-button
            type="primary"
            @click="handleValidate"
          >
            验证表单
          </a-button>
          <a-button @click="handleReset">
            重置表单
          </a-button>
          <a-button @click="handleSetValues">
            设置
          </a-button>
          <a-button @click="handleGetValues">
            获取
          </a-button>
        </div>

        <BasicForm
          @register="register"
          @submit="handleSubmit"
        />
      </div>
    </a-card>

    <a-card title="表单数据">
      <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">{{ JSON.stringify(formResult, null, 2) }}</pre>
    </a-card>
  </div>
</template>
