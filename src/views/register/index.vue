<script setup lang="ts">
import type { FormInstance } from 'antdv-next'
import type { Rule } from 'antdv-next/dist/form/types'

import { LockOutlined, MailOutlined, ShopOutlined, UserOutlined } from '@antdv-next/icons'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import logoIconUrl from '~/assets/images/logo.png'
import { useAppStore } from '~/stores'
import { http } from '~/utils'

import { useLoginStyles } from '../login/composables/useLoginStyles'

defineOptions({ name: 'Register' })

const router = useRouter()
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'
const year = new Date().getFullYear()
const appStore = useAppStore()
const {
  containerClassName,
  bgLayerClassName,
  blob1ClassName,
  blob2ClassName,
  blob3ClassName,
  blob4ClassName,
  gridClassName,
  cardClassName,
  brandPanelClassName,
  brandGlowClassName,
  brandGridClassName,
  brandContentClassName,
  formPanelClassName,
  formWrapClassName,
  inputClassName,
  brandLogoClassName,
  brandLogoIconClassName,
  brandFeatureClassName,
  brandPreviewClassName,
} = useLoginStyles()

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
      validator: (_rule: Rule, value: boolean) => (value ? Promise.resolve() : Promise.reject('请阅读并同意用户协议')),
      trigger: 'change',
    },
  ],
}

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
  <div :class="containerClassName">
    <!-- ==================== 液态玻璃背景层 ==================== -->
    <div :class="bgLayerClassName" aria-hidden="true">
      <div :class="blob1ClassName" />
      <div :class="blob2ClassName" />
      <div :class="blob3ClassName" />
      <div :class="blob4ClassName" />
      <div :class="gridClassName" />
    </div>
    <a-border-beam :count="4" :color="appStore.appSetting.primaryColor">
      <div class="relative rounded-2xl">
        <!-- ==================== 主卡片 ==================== -->
        <div :class="cardClassName">
          <!-- ============ 左侧品牌面板 ============ -->
          <div :class="brandPanelClassName">
            <div :class="brandGlowClassName" />
            <div :class="brandGridClassName" />

            <div :class="brandContentClassName">
              <!-- Logo -->
              <div :class="brandLogoClassName">
                <div :class="brandLogoIconClassName">
                  <img :src="logoIconUrl" :alt="appTitle" class="h-full w-full object-contain" />
                </div>
                <span class="text-sm font-semibold tracking-wide">{{ appTitle }}</span>
              </div>

              <!-- 标题 -->
              <div class="mt-10">
                <h1 class="text-3xl leading-snug font-bold tracking-tight">
                  开启您的<br />
                  企业空间
                </h1>
                <p class="mt-4 text-sm leading-relaxed text-white/80">注册即可创建专属空间</p>
              </div>

              <!-- 特性胶囊 -->
              <div class="mt-8 flex flex-wrap gap-2">
                <span :class="brandFeatureClassName">
                  <Icon icon="carbon:checkmark" class="h-3.5 w-3.5" />
                  免费创建
                </span>
                <span :class="brandFeatureClassName">
                  <Icon icon="carbon:user-multiple" class="h-3.5 w-3.5" />
                  多租户架构
                </span>
                <span :class="brandFeatureClassName">
                  <Icon icon="carbon:data-base" class="h-3.5 w-3.5" />
                  数据隔离
                </span>
              </div>

              <!-- 预览图（装饰） -->
              <div class="mt-12">
                <div :class="brandPreviewClassName">
                  <div class="mb-2.5 flex items-center gap-1.5">
                    <div class="h-2 w-2 rounded-full bg-white/40" />
                    <div class="h-2 w-2 rounded-full bg-white/30" />
                    <div class="h-2 w-2 rounded-full bg-white/20" />
                  </div>
                  <div class="space-y-1.5">
                    <div class="h-1.5 w-3/4 rounded-full bg-white/20" />
                    <div class="h-1.5 w-1/2 rounded-full bg-white/15" />
                    <div class="h-1.5 w-2/3 rounded-full bg-white/10" />
                  </div>
                </div>
                <div class="mt-3 text-[11px] text-white/60">© {{ year }} {{ appTitle }} Team</div>
              </div>
            </div>
          </div>

          <!-- ============ 右侧表单面板 ============ -->
          <div :class="formPanelClassName">
            <div :class="formWrapClassName">
              <!-- 移动端 Logo -->
              <div class="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style="background: var(--ant-color-primary)"
                >
                  <img :src="logoIconUrl" :alt="appTitle" class="h-6 w-6 object-contain" />
                </div>
                <span class="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {{ appTitle }}
                </span>
              </div>

              <!-- 标题 -->
              <div class="mb-8 text-center">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border border-blue-100/60 bg-blue-50/80 px-3 py-1 text-[11px] font-medium text-blue-600 backdrop-blur-sm dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  免费注册
                </span>
                <h2 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">创建账号</h2>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">填写以下信息，即刻开启您的企业空间</p>
              </div>

              <!-- 表单 -->
              <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical" @finish="handleRegister">
                <a-form-item name="tenantName" class="!mb-3">
                  <a-input
                    v-model:value="formState.tenantName"
                    size="large"
                    placeholder="企业名称"
                    :class="inputClassName"
                  >
                    <template #prefix><ShopOutlined class="text-slate-400" /></template>
                  </a-input>
                </a-form-item>

                <a-form-item name="tenantCode" class="!mb-3">
                  <a-input
                    v-model:value="formState.tenantCode"
                    size="large"
                    placeholder="企业编码（唯一标识）"
                    :class="inputClassName"
                  >
                    <template #prefix>
                      <Icon icon="carbon:code" class="text-slate-400" />
                    </template>
                  </a-input>
                </a-form-item>

                <a-form-item name="username" class="!mb-3">
                  <a-input
                    v-model:value="formState.username"
                    size="large"
                    placeholder="管理员用户名"
                    :class="inputClassName"
                  >
                    <template #prefix><UserOutlined class="text-slate-400" /></template>
                  </a-input>
                </a-form-item>

                <a-form-item name="email" class="!mb-3">
                  <a-input v-model:value="formState.email" size="large" placeholder="邮箱" :class="inputClassName">
                    <template #prefix><MailOutlined class="text-slate-400" /></template>
                  </a-input>
                </a-form-item>

                <a-form-item name="password" class="!mb-3">
                  <a-input-password
                    v-model:value="formState.password"
                    size="large"
                    placeholder="密码（至少6位）"
                    :class="inputClassName"
                  >
                    <template #prefix><LockOutlined class="text-slate-400" /></template>
                  </a-input-password>
                </a-form-item>

                <a-form-item name="confirmPassword" class="!mb-4">
                  <a-input-password
                    v-model:value="formState.confirmPassword"
                    size="large"
                    placeholder="确认密码"
                    :class="inputClassName"
                  >
                    <template #prefix><LockOutlined class="text-slate-400" /></template>
                  </a-input-password>
                </a-form-item>

                <a-form-item name="agree" class="!mb-5">
                  <a-checkbox
                    v-model:checked="formState.agree"
                    class="!text-[12px] !text-slate-600 dark:!text-slate-400"
                  >
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
                  class="!h-11 !rounded-lg !text-sm !font-medium"
                >
                  创建账号
                </a-button>
              </a-form>

              <div class="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
                已有账号？
                <a-button
                  type="link"
                  class="!h-auto !px-1 !font-medium !text-[var(--ant-color-primary)]"
                  @click="handleGoLogin"
                >
                  立即登录
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </div></a-border-beam
    >
  </div>
</template>

<style scoped>
:deep(.ant-form-item-explain-error) {
  font-size: 12px;
}
</style>
