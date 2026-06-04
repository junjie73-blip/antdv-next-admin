<script setup lang="ts">
import type { FormProps } from 'antdv-next'
import { message } from 'antdv-next'
import { computed, reactive, ref } from 'vue'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')
const codeBlockClassName = cn('bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-mono overflow-auto h-full')

const formState = reactive({ username: '', password: '', confirmPassword: '', email: '', age: null as number | null })
const result = computed(() => JSON.stringify(formState, null, 2))

const rules: Record<string, FormProps['rules']> = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 16, message: '用户名长度必须在3-16个字符之间', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少为6个字符', trigger: 'blur' },
    {
      validator: (_rule, value: string) => {
        if (value && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return Promise.reject(new Error('密码必须包含大写字母、小写字母和数字'))
        }
        return Promise.resolve()
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule, value: string) => {
        if (value && value !== formState.password) {
          return Promise.reject(new Error('两次输入的密码不一致'))
        }
        return Promise.resolve()
      },
      trigger: 'blur',
    },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  age: [
    { type: 'number', message: '年龄必须为数字', trigger: 'blur' },
    {
      validator: (_rule, value: number | null) => {
        if (value !== null && (value < 1 || value > 120)) {
          return Promise.reject(new Error('年龄必须在1-120之间'))
        }
        return Promise.resolve()
      },
      trigger: 'blur',
    },
  ],
}

const formRef = ref()

async function handleValidate() {
  try {
    await formRef.value?.validate()
    message.success('验证通过')
  }
  catch {
    message.error('验证失败，请检查表单')
  }
}

async function handleReset() {
  formRef.value?.resetFields()
  message.info('表单已重置')
}

const progressiveFormState = reactive({
  name: '',
  email: '',
  address: '',
  phone: '',
  company: '',
  website: '',
})
const showAdvanced = ref(false)
const collapseActiveKey = computed(() => showAdvanced.value ? ['advanced'] : [])
const progressiveResult = computed(() => JSON.stringify(progressiveFormState, null, 2))

const linkedFormState = reactive({
  province: '',
  city: '',
  district: '',
})

const provinces = [
  { value: 'beijing', label: '北京' },
  { value: 'shanghai', label: '上海' },
  { value: 'guangdong', label: '广东' },
  { value: 'zhejiang', label: '浙江' },
]
const cities: Record<string, { value: string, label: string }[]> = {
  beijing: [{ value: 'beijing', label: '北京市' }],
  shanghai: [{ value: 'shanghai', label: '上海市' }],
  guangdong: [
    { value: 'guangzhou', label: '广州' },
    { value: 'shenzhen', label: '深圳' },
  ],
  zhejiang: [
    { value: 'hangzhou', label: '杭州' },
    { value: 'ningbo', label: '宁波' },
  ],
}
const districts: Record<string, { value: string, label: string }[]> = {
  beijing: [{ value: 'chaoyang', label: '朝阳' }, { value: 'haidian', label: '海淀' }],
  shanghai: [{ value: 'pudong', label: '浦东' }, { value: 'jingan', label: '静安' }],
  guangzhou: [{ value: 'tianhe', label: '天河' }, { value: 'yuexiu', label: '越秀' }],
  shenzhen: [{ value: 'nanshan', label: '南山' }, { value: 'futian', label: '福田' }],
  hangzhou: [{ value: 'xihu', label: '西湖' }, { value: 'binjiang', label: '滨江' }],
  ningbo: [{ value: 'haishu', label: '海曙' }, { value: 'yinzhou', label: '鄞州' }],
}

const availableCities = computed(() => cities[linkedFormState.province] || [])
const availableDistricts = computed(() => districts[linkedFormState.city] || [])

function onProvinceChange() {
  linkedFormState.city = ''
  linkedFormState.district = ''
}
function onCityChange() {
  linkedFormState.district = ''
}

async function handleLinkedValidate() {
  if (!linkedFormState.province) {
    message.warning('请选择省份')
    return
  }
  if (!linkedFormState.city) {
    message.warning('请选择城市')
    return
  }
  if (!linkedFormState.district) {
    message.warning('请选择区县')
    return
  }
  message.success(`联动验证通过：${linkedFormState.province} / ${linkedFormState.city} / ${linkedFormState.district}`)
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="基础验证"
      variant="borderless"
    >
      <a-descriptions
        :column="1"
        size="small"
        class="mb-4"
      >
        <a-descriptions-item label="用户名">
          必填，3-16个字符
        </a-descriptions-item>
        <a-descriptions-item label="密码">
          必填，至少6个字符，需包含大小写字母和数字
        </a-descriptions-item>
        <a-descriptions-item label="确认密码">
          必须与密码一致
        </a-descriptions-item>
        <a-descriptions-item label="邮箱">
          有效的邮箱格式
        </a-descriptions-item>
        <a-descriptions-item label="年龄">
          数字，范围1-120
        </a-descriptions-item>
      </a-descriptions>

      <a-row :gutter="24">
        <a-col :span="12">
          <a-form
            ref="formRef"
            :model="formState"
            :rules="rules"
            layout="vertical"
          >
            <a-form-item
              label="用户名"
              name="username"
            >
              <a-input
                v-model:value="formState.username"
                placeholder="请输入用户名"
              />
            </a-form-item>
            <a-form-item
              label="密码"
              name="password"
            >
              <a-input-password
                v-model:value="formState.password"
                placeholder="请输入密码"
              />
            </a-form-item>
            <a-form-item
              label="确认密码"
              name="confirmPassword"
            >
              <a-input-password
                v-model:value="formState.confirmPassword"
                placeholder="请再次输入密码"
              />
            </a-form-item>
            <a-form-item
              label="邮箱"
              name="email"
            >
              <a-input
                v-model:value="formState.email"
                placeholder="请输入邮箱"
              />
            </a-form-item>
            <a-form-item
              label="年龄"
              name="age"
            >
              <a-input-number
                v-model:value="formState.age"
                :min="1"
                :max="120"
                placeholder="请输入年龄"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button
                  type="primary"
                  @click="handleValidate"
                >
                  验证
                </a-button>
                <a-button @click="handleReset">
                  重置
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-col>
        <a-col
          :span="12"
          class="flex flex-col"
        >
          <div :class="codeBlockClassName">
            <pre>{{ result }}</pre>
          </div>
        </a-col>
      </a-row>
    </a-card>

    <a-card
      title="渐进式验证"
      variant="borderless"
    >
      <a-form
        :model="progressiveFormState"
        layout="vertical"
      >
        <a-form-item
          label="姓名"
          name="name"
          :rules="[{ required: true }]"
        >
          <a-input
            v-model:value="progressiveFormState.name"
            placeholder="请输入姓名"
          />
        </a-form-item>
        <a-form-item
          label="邮箱"
          name="email"
          :rules="[{ required: true, type: 'email' }]"
        >
          <a-input
            v-model:value="progressiveFormState.email"
            placeholder="请输入邮箱"
          />
        </a-form-item>
        <a-collapse :active-key="collapseActiveKey">
          <template #expandIcon>
            <a-button
              type="link"
              size="small"
              @click="showAdvanced = !showAdvanced"
            >
              {{ showAdvanced ? '隐藏' : '显示' }}高级字段
            </a-button>
          </template>
          <a-collapse-panel
            key="advanced"
            header="高级字段"
          >
            <a-form-item
              label="地址"
              name="address"
            >
              <a-input
                v-model:value="progressiveFormState.address"
                placeholder="请输入地址"
              />
            </a-form-item>
            <a-form-item
              label="电话"
              name="phone"
            >
              <a-input
                v-model:value="progressiveFormState.phone"
                placeholder="请输入电话"
              />
            </a-form-item>
            <a-form-item
              label="公司"
              name="company"
            >
              <a-input
                v-model:value="progressiveFormState.company"
                placeholder="请输入公司名称"
              />
            </a-form-item>
            <a-form-item
              label="网站"
              name="website"
            >
              <a-input
                v-model:value="progressiveFormState.website"
                placeholder="请输入网站地址"
              />
            </a-form-item>
          </a-collapse-panel>
        </a-collapse>
      </a-form>
      <div
        :class="codeBlockClassName"
        class="mt-4"
      >
        <pre>{{ progressiveResult }}</pre>
      </div>
    </a-card>

    <a-card
      title="联动验证（省/市/区）"
      variant="borderless"
    >
      <a-form
        :model="linkedFormState"
        layout="horizontal"
        :label-col="{ span: 4 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item
          label="省份"
          required
        >
          <a-select
            v-model:value="linkedFormState.province"
            placeholder="请选择省份"
            :options="provinces"
            @change="onProvinceChange"
          />
        </a-form-item>
        <a-form-item
          label="城市"
          required
        >
          <a-select
            v-model:value="linkedFormState.city"
            placeholder="请选择城市"
            :options="availableCities"
            :disabled="!linkedFormState.province"
            @change="onCityChange"
          />
        </a-form-item>
        <a-form-item
          label="区县"
          required
        >
          <a-select
            v-model:value="linkedFormState.district"
            placeholder="请选择区县"
            :options="availableDistricts"
            :disabled="!linkedFormState.city"
          />
        </a-form-item>
        <a-form-item :wrapper-col="{ offset: 4 }">
          <a-button
            type="primary"
            @click="handleLinkedValidate"
          >
            验证联动选择
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>
