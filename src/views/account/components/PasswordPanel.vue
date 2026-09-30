<script setup lang="ts">
import { message, type FormProps } from 'antdv-next'
import { computed, reactive, ref } from 'vue'

import { changePassword } from '~/api/auth'
import { usePasswordPolicy } from '~/composables/usePasswordPolicy'

const { policyText, validate: validatePassword } = usePasswordPolicy()

const loading = ref(false)
const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const rules = computed<FormProps['rules']>(() => ({
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6-64 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_: any, v: string, cb: any) => (v && v !== form.newPassword ? cb('两次输入不一致') : cb()),
      trigger: 'blur',
    },
  ],
}))

const formRef = ref()

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const check = validatePassword(form.newPassword)
  if (!check.ok) {
    message.error(check.message)
    return
  }
  loading.value = true
  try {
    await changePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword })
    message.success('密码修改成功')
    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
  } catch (e: any) {
    message.error(e?.message || '修改失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
      <Icon icon="carbon:password" class="text-gray-500" />
      <span>修改密码</span>
    </div>
    <div class="max-w-xl">
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="当前密码" name="oldPassword">
          <a-input-password v-model:value="form.oldPassword" placeholder="请输入当前密码" />
        </a-form-item>
        <a-form-item label="新密码" name="newPassword" :extra="`密码要求：${policyText}`">
          <a-input-password v-model:value="form.newPassword" placeholder="请输入新密码" />
        </a-form-item>
        <a-form-item label="确认新密码" name="confirmPassword">
          <a-input-password v-model:value="form.confirmPassword" placeholder="再次输入新密码" />
        </a-form-item>
        <div class="flex justify-end">
          <a-button type="primary" :loading="loading" @click="handleSubmit">确认修改</a-button>
        </div>
      </a-form>
    </div>
  </div>
</template>

<script lang="ts">
import { Icon } from '@iconify/vue'
export default { components: { Icon } }
</script>
