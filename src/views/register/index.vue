<script setup lang="ts">
import type { FormInstance } from 'antdv-next'
import type { Rule } from 'antdv-next/dist/form/types'

import { LockOutlined, MailOutlined, ShopOutlined, UserOutlined } from '@antdv-next/icons'
import { Icon } from '@iconify/vue'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import { http } from '@/utils'
import { cn } from '@/utils/cn'

defineOptions({ name: 'Register' })

const router = useRouter()
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

const formRef = ref<FormInstance>()
const loading = ref(false)

const formState = reactive({
  tenantName: '',
  tenantCode: '',
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
  agree: false,
})

const validateConfirm = async (_rule: Rule, value: string) => {
  if (value !== formState.password) {
    return Promise.reject('两次输入的密码不一致')
  }
  return Promise.resolve()
}

const rules: Record<string, Rule[]> = {
  tenantName: [{ required: true, message: '请输入企业名称', trigger: 'blur' }],
  tenantCode: [
    { required: true, message: '请输入企业编码', trigger: 'blur' },
    {
      pattern: /^[A-Za-z0-9_-]{2,64}$/,
      message: '仅支持字母、数字、下划线、中划线',
      trigger: 'blur',
    },
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 64, message: '用户名长度 3-64 位', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  agree: [
    {
      validator: (_rule: Rule, value: boolean) =>
        value ? Promise.resolve() : Promise.reject('请阅读并同意用户协议'),
      trigger: 'change',
    },
  ],
}

const inputClassName = cn(
  '[&_.ant-input-affix-wrapper]:!bg-gray-50',
  '[&_.ant-input-affix-wrapper]:!border-gray-200',
  '[&_.ant-input-affix-wrapper]:!rounded-lg',
  '[&_.ant-input-affix-wrapper]:!h-11',
  '[&_.ant-input-affix-wrapper-focused]:!border-[var(--ant-color-primary)]',
  '[&_.ant-input-affix-wrapper-focused]:!shadow-[0_0_0_3px_color-mix(in_srgb,var(--ant-color-primary)_12%,transparent)]',
)

async function handleRegister() {
  try {
    await formRef.value?.validate()
    loading.value = true

    await http.Post('/auth/register', {
      tenantName: formState.tenantName,
      tenantCode: formState.tenantCode,
      username: formState.username,
      password: formState.password,
      email: formState.email,
    })

    message.success('注册成功，请登录')
    router.push('/login')
  } catch (e: any) {
    if (e?.errorFields) return
    message.error(e?.message || '注册失败，请稍后再试')
  } finally {
    loading.value = false
  }
}

function handleGoLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex bg-gradient-to-br from-slate-50 via-stone-50 to-gray-100">
    <!-- 左侧装饰区 -->
    <div class="hidden lg:flex lg:w-[45%] relative overflow-hidden">
      <div
        class="absolute inset-0 bg-gradient-to-br from-white/70 via-slate-50/60 to-gray-100/60 backdrop-blur-xl"
      />
      <div
        class="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[100px]"
        style="background: color-mix(in srgb, var(--ant-color-primary) 12%, transparent)"
      />
      <div
        class="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[80px]"
        style="background: color-mix(in srgb, var(--ant-color-primary) 8%, transparent)"
      />

      <div class="relative z-10 flex flex-col justify-center px-12 xl:px-20 w-full">
        <div
          class="inline-flex items-center gap-3 px-4 py-2 bg-white/70 backdrop-blur-md rounded-xl border border-white/80 shadow-sm mb-10 w-fit"
        >
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center shadow-md"
            style="background: var(--ant-color-primary)"
          >
            <svg
              class="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span class="text-base font-semibold text-stone-800">{{ appTitle }}</span>
        </div>

        <h1
          class="text-4xl xl:text-[42px] font-bold text-stone-800 mb-5 leading-tight tracking-tight"
        >
          加入我们<br />
          <span style="color: var(--ant-color-primary)">开启高效之旅</span>
        </h1>

        <p class="text-base text-stone-500 mb-10 max-w-md leading-relaxed">
          注册即可创建专属企业空间，享受多租户、权限管理、数据隔离等企业级能力。
        </p>

        <div class="space-y-5 max-w-md">
          <div class="flex items-start gap-3">
            <div
              class="w-6 h-6 rounded-full bg-white/70 border border-white/80 flex items-center justify-center flex-shrink-0 mt-0.5"
            >
              <Icon
                icon="carbon:checkmark"
                class="w-4 h-4"
                style="color: var(--ant-color-primary)"
              />
            </div>
            <div>
              <div class="text-sm font-medium text-stone-700">免费创建企业空间</div>
              <div class="text-xs text-stone-400 mt-0.5">无需信用卡，即刻开始</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div
              class="w-6 h-6 rounded-full bg-white/70 border border-white/80 flex items-center justify-center flex-shrink-0 mt-0.5"
            >
              <Icon
                icon="carbon:checkmark"
                class="w-4 h-4"
                style="color: var(--ant-color-primary)"
              />
            </div>
            <div>
              <div class="text-sm font-medium text-stone-700">完整的 RBAC 权限体系</div>
              <div class="text-xs text-stone-400 mt-0.5">角色、菜单、数据权限开箱即用</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div
              class="w-6 h-6 rounded-full bg-white/70 border border-white/80 flex items-center justify-center flex-shrink-0 mt-0.5"
            >
              <Icon
                icon="carbon:checkmark"
                class="w-4 h-4"
                style="color: var(--ant-color-primary)"
              />
            </div>
            <div>
              <div class="text-sm font-medium text-stone-700">数据安全隔离</div>
              <div class="text-xs text-stone-400 mt-0.5">多租户架构，数据独立存储</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧注册表单 -->
    <div class="w-full lg:w-[55%] flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white">
      <div class="w-full max-w-[440px]">
        <div class="mb-8">
          <h2 class="text-2xl font-bold text-stone-800 tracking-tight">创建账号 🚀</h2>
          <p class="text-sm text-stone-500 mt-2">填写以下信息，即刻开启您的企业空间</p>
        </div>

        <a-form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
          @finish="handleRegister"
        >
          <a-form-item name="tenantName" class="!mb-4">
            <a-input
              v-model:value="formState.tenantName"
              size="large"
              placeholder="企业名称"
              :class="inputClassName"
            >
              <template #prefix><ShopOutlined class="text-stone-400" /></template>
            </a-input>
          </a-form-item>

          <a-form-item name="tenantCode" class="!mb-4">
            <a-input
              v-model:value="formState.tenantCode"
              size="large"
              placeholder="企业编码（唯一标识）"
              :class="inputClassName"
            >
              <template #prefix><Icon icon="carbon:code" class="text-stone-400" /></template>
            </a-input>
          </a-form-item>

          <a-form-item name="username" class="!mb-4">
            <a-input
              v-model:value="formState.username"
              size="large"
              placeholder="管理员用户名"
              :class="inputClassName"
            >
              <template #prefix><UserOutlined class="text-stone-400" /></template>
            </a-input>
          </a-form-item>

          <a-form-item name="email" class="!mb-4">
            <a-input
              v-model:value="formState.email"
              size="large"
              placeholder="邮箱"
              :class="inputClassName"
            >
              <template #prefix><MailOutlined class="text-stone-400" /></template>
            </a-input>
          </a-form-item>

          <a-form-item name="password" class="!mb-4">
            <a-input-password
              v-model:value="formState.password"
              size="large"
              placeholder="密码（至少6位）"
              :class="inputClassName"
            >
              <template #prefix><LockOutlined class="text-stone-400" /></template>
            </a-input-password>
          </a-form-item>

          <a-form-item name="confirmPassword" class="!mb-4">
            <a-input-password
              v-model:value="formState.confirmPassword"
              size="large"
              placeholder="确认密码"
              :class="inputClassName"
            >
              <template #prefix><LockOutlined class="text-stone-400" /></template>
            </a-input-password>
          </a-form-item>

          <a-form-item name="agree" class="!mb-6">
            <a-checkbox v-model:checked="formState.agree" class="!text-stone-500 !text-[13px]">
              我已阅读并同意
              <a href="#" class="text-[var(--ant-color-primary)]">《用户协议》</a>
              和
              <a href="#" class="text-[var(--ant-color-primary)]">《隐私政策》</a>
            </a-checkbox>
          </a-form-item>

          <a-button
            type="primary"
            html-type="submit"
            size="large"
            block
            :loading="loading"
            class="!h-11 !text-sm !font-medium"
          >
            创建账号
          </a-button>
        </a-form>

        <div class="text-center text-sm text-stone-500 mt-5">
          已有账号？
          <a-button
            type="link"
            class="!px-1 !h-auto !text-[var(--ant-color-primary)] !font-medium"
            @click="handleGoLogin"
          >
            立即登录
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>
