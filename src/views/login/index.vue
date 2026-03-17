<script setup lang="ts">
import type { FormInstance } from 'antdv-next'
import type { Rule } from 'antdv-next/dist/form/types'

import { LockOutlined, MailOutlined, MobileOutlined, UserOutlined } from '@antdv-next/icons'
import { message } from 'antdv-next'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/modules/user'
import { cn } from '@/utils/cn'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const loginType = ref<'account' | 'mobile'>('account')

const formState = reactive({
  username: '',
  password: '',
  mobile: '',
  code: '',
  remember: true,
})

const containerClassName = computed(() =>
  cn(
    'min-h-screen flex',
    'bg-gradient-to-br from-stone-100 via-slate-50 to-gray-50',
  ),
)

const leftPanelClassName = computed(() =>
  cn(
    'hidden lg:flex lg:w-1/2 xl:w-3/5',
    'relative overflow-hidden',
  ),
)

const leftGlassClassName = computed(() =>
  cn(
    'absolute inset-0',
    'bg-gradient-to-br from-white/60 via-slate-100/40 to-gray-100/50',
    'backdrop-blur-xl',
  ),
)

const rightPanelClassName = computed(() =>
  cn(
    'w-full lg:w-1/2 xl:w-2/5',
    'flex items-center justify-center',
    'p-8 lg:p-12',
    'bg-gradient-to-br from-white/80 to-slate-50/60',
  ),
)

const glassCardClassName = computed(() =>
  cn(
    'w-full max-w-md',
    'bg-white/70 backdrop-blur-2xl',
    'border border-white/80',
    'rounded-2xl shadow-xl shadow-slate-900/5',
    'p-8 lg:p-10',
  ),
)

const inputClassName = computed(() =>
  cn(
    '[&_.ant-input]:!bg-white/80',
    '[&_.ant-input]:!border-slate-200',
    '[&_.ant-input]:!text-stone-700',
    '[&_.ant-input]:placeholder:text-stone-400',
    '[&_.ant-input]:hover:!border-slate-400',
    '[&_.ant-input]:focus:!border-[var(--ant-color-primary)]',
    '[&_.ant-input]:focus:!shadow-[0_0_0_2px_color-mix(in_srgb,var(--ant-color-primary)_20%,transparent)]',
    '[&_.ant-input-affix-wrapper]:!bg-white/80',
    '[&_.ant-input-affix-wrapper]:!border-slate-200',
    '[&_.ant-input-affix-wrapper]:hover:!border-slate-400',
    '[&_.ant-input-affix-wrapper-focused]:!border-[var(--ant-color-primary)]',
    '[&_.ant-input-affix-wrapper-focused]:!shadow-[0_0_0_2px_color-mix(in_srgb,var(--ant-color-primary)_20%,transparent)]',
    '[&_.ant-input-affix-wrapper_input]:!bg-transparent',
    '[&_.ant-input-affix-wrapper_input]:!text-stone-700',
  ),
)

const accountRules: Record<string, Rule[]> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
}

const mobileRules: Record<string, Rule[]> = {
  mobile: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位', trigger: 'blur' },
  ],
}

const currentRules = computed(() => (loginType.value === 'account' ? accountRules : mobileRules))

async function handleLogin() {
  try {
    await formRef.value?.validate()
    loading.value = true

    const result = await userStore.login(formState.username, formState.password)

    if (result.success) {
      message.success('登录成功')
      router.push('/dashboard')
    }
    else {
      message.error(result.message || '登录失败')
    }
  }
  catch {
    message.error('请检查输入')
  }
  finally {
    loading.value = false
  }
}

function handleRegister() {
  router.push('/register')
}

function handleForgotPassword() {
  message.info('请联系管理员重置密码')
}

function handleSendCode() {
  if (!formState.mobile || !/^1[3-9]\d{9}$/.test(formState.mobile)) {
    message.error('请输入正确的手机号')
    return
  }
  message.success('验证码已发送')
}
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧面板 -->
    <div :class="leftPanelClassName">
      <!-- 玻璃背景 -->
      <div :class="leftGlassClassName" />

      <!-- 装饰性背景 -->
      <div class="absolute inset-0">
        <div
          class="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[100px]"
          style="background: color-mix(in srgb, var(--ant-color-primary) 15%, transparent)"
        />
        <div
          class="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[80px]"
          style="background: color-mix(in srgb, var(--ant-color-primary) 10%, transparent)"
        />
        <div
          class="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full blur-[60px]"
          style="background: color-mix(in srgb, var(--ant-color-primary) 8%, transparent)"
        />
      </div>

      <!-- 网格背景 -->
      <div class="absolute inset-0 bg-[linear-gradient(rgba(100,100,100,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(100,100,100,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <!-- 内容 -->
      <div class="relative z-10 flex flex-col justify-center px-12 xl:px-20">
        <!-- Logo -->
        <div class="mb-12">
          <div class="inline-flex items-center gap-3 px-5 py-2.5 bg-white/60 backdrop-blur-md rounded-xl border border-white/80 shadow-lg shadow-slate-900/5">
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center shadow-md"
              style="background: var(--ant-color-primary); box-shadow: 0 4px 12px color-mix(in srgb, var(--ant-color-primary) 30%, transparent)"
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
            <span class="text-xl font-semibold text-stone-800">Antdv Next</span>
          </div>
        </div>

        <!-- 标题 -->
        <h1 class="text-4xl xl:text-5xl font-bold text-stone-800 mb-6 leading-tight">
          构建现代化<br>
          <span style="color: var(--ant-color-primary)">
            管理系统
          </span>
        </h1>

        <p class="text-lg text-stone-600 mb-12 max-w-lg leading-relaxed">
          基于 Vue 3 + TypeScript + Ant Design Vue 构建的企业级后台管理解决方案，助您快速开发高质量管理系统。
        </p>

        <!-- 特性列表 -->
        <div class="space-y-5">
          <div class="flex items-center gap-4 group">
            <div
              class="w-11 h-11 bg-white/60 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/80 shadow-md shadow-slate-900/5 transition-all duration-300"
              style="--hover-bg: color-mix(in srgb, var(--ant-color-primary) 5%, white)"
            >
              <svg
                class="w-5 h-5"
                style="color: var(--ant-color-primary)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 class="text-stone-800 font-medium">
                极速开发
              </h3>
              <p class="text-stone-500 text-sm">
                开箱即用的组件与模板
              </p>
            </div>
          </div>

          <div class="flex items-center gap-4 group">
            <div class="w-11 h-11 bg-white/60 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/80 shadow-md shadow-slate-900/5 transition-all duration-300">
              <svg
                class="w-5 h-5"
                style="color: var(--ant-color-primary)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h3 class="text-stone-800 font-medium">
                安全可靠
              </h3>
              <p class="text-stone-500 text-sm">
                完善的权限管理体系
              </p>
            </div>
          </div>

          <div class="flex items-center gap-4 group">
            <div class="w-11 h-11 bg-white/60 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/80 shadow-md shadow-slate-900/5 transition-all duration-300">
              <svg
                class="w-5 h-5"
                style="color: var(--ant-color-primary)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h3 class="text-stone-800 font-medium">
                灵活配置
              </h3>
              <p class="text-stone-500 text-sm">
                高度可定制的主题系统
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧登录面板 -->
    <div :class="rightPanelClassName">
      <div :class="glassCardClassName">
        <!-- 标题 -->
        <div class="text-center mb-8">
          <h2 class="text-2xl font-semibold text-stone-800 mb-2">
            欢迎回来
          </h2>
          <p class="text-stone-500">
            请登录您的账户继续操作
          </p>
        </div>

        <!-- 登录类型切换 -->
        <div class="mb-6">
          <div class="flex bg-stone-100/80 rounded-lg p-1">
            <button
              :class="cn(
                'flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200',
                loginType === 'account'
                  ? 'bg-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-700',
              )"
              :style="loginType === 'account' ? { color: 'var(--ant-color-primary)' } : {}"
              @click="loginType = 'account'"
            >
              账号登录
            </button>
            <button
              :class="cn(
                'flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200',
                loginType === 'mobile'
                  ? 'bg-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-700',
              )"
              :style="loginType === 'mobile' ? { color: 'var(--ant-color-primary)' } : {}"
              @click="loginType = 'mobile'"
            >
              手机登录
            </button>
          </div>
        </div>

        <!-- 表单 -->
        <a-form
          ref="formRef"
          :model="formState"
          :rules="currentRules"
          layout="vertical"
          @finish="handleLogin"
        >
          <template v-if="loginType === 'account'">
            <a-form-item name="username">
              <a-input
                v-model:value="formState.username"
                size="large"
                placeholder="请输入用户名"
                :class="inputClassName"
                allow-clear
              >
                <template #prefix>
                  <UserOutlined class="text-stone-400" />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item name="password">
              <a-input-password
                v-model:value="formState.password"
                size="large"
                placeholder="请输入密码"
                :class="inputClassName"
                allow-clear
              >
                <template #prefix>
                  <LockOutlined class="text-stone-400" />
                </template>
              </a-input-password>
            </a-form-item>

            <a-form-item>
              <div class="flex justify-between items-center">
                <a-checkbox
                  v-model:checked="formState.remember"
                  class="[&_.ant-checkbox-inner]:!bg-white [&_.ant-checkbox-inner]:!border-slate-300 [&_.ant-checkbox-wrapper]:!text-stone-500"
                >
                  记住我
                </a-checkbox>
                <a-button
                  type="link"
                  size="small"
                  class="!text-stone-500 hover:!text-stone-700 !p-0"
                  @click="handleForgotPassword"
                >
                  忘记密码？
                </a-button>
              </div>
            </a-form-item>
          </template>

          <template v-else>
            <a-form-item name="mobile">
              <a-input
                v-model:value="formState.mobile"
                size="large"
                placeholder="请输入手机号"
                :class="inputClassName"
                allow-clear
              >
                <template #prefix>
                  <MobileOutlined class="text-stone-400" />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item name="code">
              <a-input
                v-model:value="formState.code"
                size="large"
                placeholder="请输入验证码"
                :class="inputClassName"
                allow-clear
              >
                <template #prefix>
                  <MailOutlined class="text-stone-400" />
                </template>
                <template #suffix>
                  <a-button
                    type="link"
                    size="small"
                    class="!p-0"
                    style="color: var(--ant-color-primary)"
                    @click="handleSendCode"
                  >
                    发送验证码
                  </a-button>
                </template>
              </a-input>
            </a-form-item>
          </template>

          <a-form-item class="mt-8">
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              block
              :loading="loading"
              class="!h-11 !border-0 !shadow-lg"
            >
              登录
            </a-button>
          </a-form-item>
        </a-form>

        <!-- 注册链接 -->
        <div class="text-center mb-6">
          <span class="text-stone-500">还没有账户？</span>
          <a-button
            type="link"
            class="!p-0 !ml-1"
            style="color: var(--ant-color-primary)"
            @click="handleRegister"
          >
            立即注册
          </a-button>
        </div>

        <!-- 分割线 -->
        <div class="relative mb-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-stone-200" />
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-4 bg-transparent text-stone-400">其他登录方式</span>
          </div>
        </div>

        <!-- 第三方登录 -->
        <div class="flex justify-center gap-3">
          <button class="w-11 h-11 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center border border-stone-200 hover:border-stone-300 transition-all duration-200 shadow-sm">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              class="text-stone-500"
            >
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
              />
            </svg>
          </button>
          <button class="w-11 h-11 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center border border-stone-200 hover:border-stone-300 transition-all duration-200 shadow-sm">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              class="text-stone-500"
            >
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
              />
            </svg>
          </button>
          <button class="w-11 h-11 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center border border-stone-200 hover:border-stone-300 transition-all duration-200 shadow-sm">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              class="text-stone-500"
            >
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
[class*="group"]:hover .w-11 {
  background-color: color-mix(in srgb, var(--ant-color-primary) 5%, white);
  border-color: color-mix(in srgb, var(--ant-color-primary) 20%, rgb(203 213 225));
}
</style>
