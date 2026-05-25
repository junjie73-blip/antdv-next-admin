<script setup lang="ts">
import type { FormInstance } from 'antdv-next'
import type { Rule } from 'antdv-next/dist/form/types'

import { LockOutlined, MailOutlined, MobileOutlined, UserOutlined } from '@antdv-next/icons'
import { Icon } from '@iconify/vue'
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

const decorBlob1ClassName = computed(() =>
  cn(
    'absolute top-1/4 left-1/4 w-[500px] h-[500px]',
    'rounded-full blur-[100px]',
  ),
)

const decorBlob1Style = computed(() => ({
  background: 'color-mix(in srgb, var(--ant-color-primary) 15%, transparent)',
}))

const decorBlob2ClassName = computed(() =>
  cn(
    'absolute bottom-1/4 right-1/4 w-[400px] h-[400px]',
    'rounded-full blur-[80px]',
  ),
)

const decorBlob2Style = computed(() => ({
  background: 'color-mix(in srgb, var(--ant-color-primary) 10%, transparent)',
}))

const decorBlob3ClassName = computed(() =>
  cn(
    'absolute top-1/2 left-1/2 w-[300px] h-[300px]',
    'rounded-full blur-[60px]',
  ),
)

const decorBlob3Style = computed(() => ({
  background: 'color-mix(in srgb, var(--ant-color-primary) 8%, transparent)',
}))

const gridBgClassName = computed(() =>
  cn(
    'absolute inset-0',
    'bg-[linear-gradient(rgba(100,100,100,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(100,100,100,0.03)_1px,transparent_1px)]',
    'bg-[size:48px_48px]',
  ),
)

const logoContainerClassName = computed(() =>
  cn(
    'inline-flex items-center gap-3 px-5 py-2.5',
    'bg-white/60 backdrop-blur-md rounded-xl',
    'border border-white/80 shadow-lg shadow-slate-900/5',
  ),
)

const logoIconClassName = computed(() =>
  cn(
    'w-9 h-9 rounded-lg flex items-center justify-center shadow-md',
  ),
)

const logoIconStyle = computed(() => ({
  background: 'var(--ant-color-primary)',
  boxShadow: '0 4px 12px color-mix(in srgb, var(--ant-color-primary) 30%, transparent)',
}))

const titleHighlightStyle = computed(() => ({
  color: 'var(--ant-color-primary)',
}))

const featureIconClassName = computed(() =>
  cn(
    'w-11 h-11 bg-white/60 backdrop-blur-md rounded-lg flex items-center justify-center',
    'border border-white/80 shadow-md shadow-slate-900/5 transition-all duration-300',
  ),
)

const featureIconStyle = computed(() => ({
  color: 'var(--ant-color-primary)',
}))

const loginTypeContainerClassName = computed(() =>
  cn('flex bg-stone-100/80 rounded-lg p-1'),
)

const loginTypeBtnBaseClassName = computed(() =>
  cn(
    'flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200',
  ),
)

const loginTypeActiveBtnStyle = computed(() => ({ color: 'var(--ant-color-primary)' }))

const sendCodeBtnStyle = computed(() => ({
  color: 'var(--ant-color-primary)',
}))

const registerLinkStyle = computed(() => ({
  color: 'var(--ant-color-primary)',
}))

const thirdPartyBtnClassName = computed(() =>
  cn(
    'w-11 h-11 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center',
    'border border-stone-200 hover:border-stone-300 transition-all duration-200 shadow-sm',
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
          :class="decorBlob1ClassName"
          :style="decorBlob1Style"
        />
        <div
          :class="decorBlob2ClassName"
          :style="decorBlob2Style"
        />
        <div
          :class="decorBlob3ClassName"
          :style="decorBlob3Style"
        />
      </div>

      <!-- 网格背景 -->
      <div :class="gridBgClassName" />

      <!-- 内容 -->
      <div class="relative z-10 flex flex-col justify-center px-12 xl:px-20">
        <!-- Logo -->
        <div class="mb-12">
          <div :class="logoContainerClassName">
            <div
              :class="logoIconClassName"
              :style="logoIconStyle"
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
          <span :style="titleHighlightStyle">管理系统</span>
        </h1>

        <p class="text-lg text-stone-600 mb-12 max-w-lg leading-relaxed">
          基于 Vue 3 + TypeScript + Ant Design Vue 构建的企业级后台管理解决方案，助您快速开发高质量管理系统。
        </p>

        <!-- 特性列表 -->
        <div class="space-y-5">
          <div class="flex items-center gap-4 group">
            <div :class="featureIconClassName">
              <Icon icon="carbon:flash" class="w-5 h-5" :style="featureIconStyle" />
            </div>
            <div>
              <h3 class="text-stone-800 font-medium">极速开发</h3>
              <p class="text-stone-500 text-sm">开箱即用的组件与模板</p>
            </div>
          </div>

          <div class="flex items-center gap-4 group">
            <div :class="featureIconClassName">
              <Icon icon="carbon:shield-checkmark" class="w-5 h-5" :style="featureIconStyle" />
            </div>
            <div>
              <h3 class="text-stone-800 font-medium">安全可靠</h3>
              <p class="text-stone-500 text-sm">完善的权限管理体系</p>
            </div>
          </div>

          <div class="flex items-center gap-4 group">
            <div :class="featureIconClassName">
              <Icon icon="carbon:settings-adjust" class="w-5 h-5" :style="featureIconStyle" />
            </div>
            <div>
              <h3 class="text-stone-800 font-medium">灵活配置</h3>
              <p class="text-stone-500 text-sm">高度可定制的主题系统</p>
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
          <div :class="loginTypeContainerClassName">
            <button
              :class="cn(loginTypeBtnBaseClassName,
                loginType === 'account'
                  ? 'bg-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-700',
              )"
              :style="loginType === 'account' ? loginTypeActiveBtnStyle : {}"
              @click="loginType = 'account'"
            >
              账号登录
            </button>
            <button
              :class="cn(loginTypeBtnBaseClassName,
                loginType === 'mobile'
                  ? 'bg-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-700',
              )"
              :style="loginType === 'mobile' ? loginTypeActiveBtnStyle : {}"
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
                    :style="sendCodeBtnStyle"
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
            :style="registerLinkStyle"
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
          <button :class="thirdPartyBtnClassName">
            <Icon icon="mdi:web" width="18" height="18" class="text-stone-500" />
          </button>
          <button :class="thirdPartyBtnClassName">
            <Icon icon="ic:baseline-telegram" width="18" height="18" class="text-stone-500" />
          </button>
          <button :class="thirdPartyBtnClassName">
            <Icon icon="mdi:github" width="18" height="18" class="text-stone-500" />
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
