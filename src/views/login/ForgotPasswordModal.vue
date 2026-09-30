<script setup lang="ts">
import type { FormInstance } from 'antdv-next'
import type { Rule } from 'antdv-next/dist/form/types'

import { LockOutlined, ShopOutlined, UserOutlined } from '@antdv-next/icons'
import { message } from 'antdv-next'
import { reactive, ref, watch } from 'vue'

import { forgotPassword } from '~/api/auth'
import { usePasswordPolicy } from '~/composables/usePasswordPolicy'

interface Props {
  defaultTenantCode?: string
  defaultUsername?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultTenantCode: '',
  defaultUsername: '',
})
const open = defineModel('open', { default: false, type: Boolean })
const emit = defineEmits<{
  success: [payload: { tenantCode: string; username: string }]
}>()

const formRef = ref<FormInstance>()
const loading = ref(false)
const formState = reactive({
  tenantCode: '',
  username: '',
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const { policyText, validate: validatePassword } = usePasswordPolicy()

watch(
  () => open.value,
  (v) => {
    if (v) {
      formState.tenantCode = props.defaultTenantCode || ''
      formState.username = props.defaultUsername || ''
      formState.oldPassword = ''
      formState.newPassword = ''
      formState.confirmPassword = ''
      formRef.value?.clearValidate?.()
    }
  },
  { immediate: true },
)

const rules: Record<string, Rule[]> = {
  tenantCode: [
    { required: true, message: '请输入租户编码', trigger: 'blur' },
    { min: 2, max: 64, message: '长度 2-64 位', trigger: 'blur' },
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { max: 64, message: '最长 64 位', trigger: 'blur' },
  ],
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' },
    { max: 64, message: '最长 64 位', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 64, message: '长度 6-64 位', trigger: 'blur' },
    {
      validator: (_, v, cb) => (v && v === formState.oldPassword ? cb('新密码不能与原密码相同') : cb()),
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_, v, cb) => (v && v !== formState.newPassword ? cb('两次输入不一致') : cb()),
      trigger: 'blur',
    },
  ],
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const check = validatePassword(formState.newPassword)
  if (!check.ok) {
    message.error(check.message)
    return
  }
  loading.value = true
  try {
    await forgotPassword({
      tenantCode: formState.tenantCode,
      username: formState.username,
      oldPassword: formState.oldPassword,
      newPassword: formState.newPassword,
    })
    message.success('密码重置成功，请使用新密码登录')
    emit('success', {
      tenantCode: formState.tenantCode,
      username: formState.username,
    })
    open.value = false
  } catch (e: any) {
    message.error(e?.message || '重置失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:open="open"
    :width="440"
    :mask-closable="false"
    :keyboard="!loading"
    title="重置密码"
    ok-text="确认重置"
    cancel-text="取消"
    :confirm-loading="loading"
    centered
    @ok="handleSubmit"
  >
    <div class="py-2">
      <p class="mb-5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        请验证您的原密码并设置新的登录密码。<span class="text-red-500">此操作不需要邮箱验证</span>。
      </p>

      <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical" @keyup.enter="handleSubmit">
        <a-form-item name="tenantCode">
          <a-input v-model:value="formState.tenantCode" size="large" placeholder="租户编码" allow-clear :maxlength="64">
            <template #prefix><ShopOutlined class="text-slate-400" /></template>
          </a-input>
        </a-form-item>

        <a-form-item name="username">
          <a-input
            v-model:value="formState.username"
            size="large"
            placeholder="用户名"
            allow-clear
            :maxlength="64"
            autocomplete="username"
          >
            <template #prefix><UserOutlined class="text-slate-400" /></template>
          </a-input>
        </a-form-item>

        <a-form-item name="oldPassword">
          <a-input-password
            v-model:value="formState.oldPassword"
            size="large"
            placeholder="原密码"
            allow-clear
            :maxlength="64"
            autocomplete="current-password"
          >
            <template #prefix><LockOutlined class="text-slate-400" /></template>
          </a-input-password>
        </a-form-item>

        <a-form-item name="newPassword">
          <a-input-password
            v-model:value="formState.newPassword"
            size="large"
            :placeholder="`新密码（${policyText}）`"
            allow-clear
            :maxlength="64"
            autocomplete="new-password"
          >
            <template #prefix><LockOutlined class="text-slate-400" /></template>
          </a-input-password>
        </a-form-item>

        <a-form-item name="confirmPassword" class="!mb-0">
          <a-input-password
            v-model:value="formState.confirmPassword"
            size="large"
            placeholder="确认新密码"
            allow-clear
            :maxlength="64"
            autocomplete="new-password"
          >
            <template #prefix><LockOutlined class="text-slate-400" /></template>
          </a-input-password>
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped>
:deep(.ant-form-item-explain-error) {
  font-size: 12px;
}
</style>
