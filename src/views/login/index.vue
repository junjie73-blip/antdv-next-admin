<script setup lang="ts">
import type { FormInstance } from 'antdv-next'
import type { Rule } from 'antdv-next/dist/form/types'

import { LockOutlined, ReloadOutlined, SafetyOutlined, UserOutlined } from '@antdv-next/icons'
import { message } from 'antdv-next'
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getAuthTenantList, getCaptcha } from '~/api/auth'
import logoIconUrl from '~/assets/images/logo.png'
import { useAuthStyles } from '~/components/common/Auth/composables/useAuthStyles.js'
import { useAppStore } from '~/stores'
import { useUserStore } from '~/stores/modules/user'
import { cache } from '~/utils'

import ForgotPasswordModal from './ForgotPasswordModal.vue'

defineOptions({ name: 'Login' })

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'
const appStore = useAppStore()

const { containerClassName, cardClassName, inputClassName, submitButtonClassName } = useAuthStyles()

const formRef = ref<FormInstance>()
const loading = ref(false)
const DEVICE_ID_KEY = 'device_id'

const formState = reactive<{
  tenantCode: string | undefined
  username: string
  password: string
  remember: boolean
  captchaCode: string | undefined
}>({
  tenantCode: undefined,
  username: 'super',
  password: '123456',
  remember: true,
  captchaCode: '',
})

/* ============================================================
 * 品牌面板配置
 * ============================================================ */
const brandFeatures = [
  { icon: 'carbon:flash', text: '极速开发体验' },
  { icon: 'carbon:color-palette', text: '现代化 UI 设计' },
  { icon: 'carbon:security', text: '企业级安全' },
]

const brandStats = [
  { icon: 'carbon:user-multiple', value: '10K+', label: 'Active Users' },
  { icon: 'carbon:application', value: '500+', label: 'Deployments' },
  { icon: 'carbon:star', value: '4.9', label: 'Rating' },
]

/* ============================================================
 * 租户下拉
 * ============================================================ */
interface TenantOption {
  tenantId: string
  tenantCode: string
  tenantName: string
}

const tenantOptions = ref<TenantOption[]>([])
const tenantLoading = ref(false)

async function loadTenants() {
  tenantLoading.value = true
  try {
    tenantOptions.value = await getAuthTenantList()
  } catch (err) {
    message.error('加载租户列表失败，请刷新重试')
    console.error('[login] loadTenants failed', err)
  } finally {
    tenantLoading.value = false
  }
}

/* ============================================================
 * 验证码
 * ============================================================ */
const captchaId = ref('')
const captchaSvg = ref('')
const captchaLoading = ref(false)

async function refreshCaptcha() {
  captchaLoading.value = true
  try {
    const data = await getCaptcha()
    captchaId.value = data.captchaId
    captchaSvg.value = data.svg
    formState.captchaCode = undefined
  } catch (e) {
    console.error(e)
    message.error('验证码加载失败')
  } finally {
    captchaLoading.value = false
  }
}

/* ============================================================
 * 校验
 * ============================================================ */
const rules: Record<string, Rule[]> = {
  tenantCode: [{ required: true, message: '请选择租户', trigger: 'change' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
  captchaCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 4, message: '验证码为 4 位', trigger: 'blur' },
  ],
}

/* ============================================================
 * 登录
 * ============================================================ */
async function handleLogin() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const result = await userStore.login(formState.username, formState.password, formState.tenantCode!, {
      captchaId: captchaId.value,
      captchaCode: formState.captchaCode,
      deviceId: await getDeviceId(),
    })

    if (result.success) {
      cache.setItem('last_tenant_code', formState.tenantCode)
      message.success('登录成功')
      const redirect = (route.query.redirect as string) || '/dashboard'
      router.push(redirect)
    } else {
      message.error(result.message || '登录失败')
      await refreshCaptcha()
    }
  } finally {
    loading.value = false
  }
}

/* ============================================================
 * 忘记密码
 * ============================================================ */
const forgotModalOpen = ref(false)
const loginTenantCode = ref('')

function handleRegister() {
  router.push('/register')
}

function handleForgotPassword() {
  forgotModalOpen.value = true
}

function handleResetSuccess(payload: { tenantCode: string; username: string }) {
  loginTenantCode.value = payload.tenantCode
  formState.username = payload.username
  formState.password = ''
  formState.tenantCode = payload.tenantCode
}

/* ============================================================
 * 第三方登录
 * ============================================================ */
const socialLogins = [
  {
    key: 'wechat',
    label: '微信',
    icon: 'ri:wechat-fill',
    iconClassName: 'text-[#07C160]',
  },
  {
    key: 'github',
    label: 'GitHub',
    icon: 'mdi:github',
    iconClassName: 'text-slate-800 dark:text-slate-200',
  },
  {
    key: 'google',
    label: 'Google',
    icon: 'flat-color-icons:google',
    iconClassName: '',
  },
  {
    key: 'gitee',
    label: 'Gitee',
    icon: 'simple-icons:gitee',
    iconClassName: 'text-[#C71D23]',
  },
]

function handleSocialLogin(key: string) {
  const item = socialLogins.find((x) => x.key === key)
  message.info(`${item?.label ?? key} 登录即将上线`)
}

/* ============================================================
 * 设备ID
 * ============================================================ */
async function getDeviceId(): Promise<string | undefined> {
  let id = (await cache.getItem(DEVICE_ID_KEY)) as string
  if (!id) {
    id = `${import.meta.env.MODE}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    cache.setItem(DEVICE_ID_KEY, id)
  }
  return id as string
}

/* ============================================================
 * 初始化
 * ============================================================ */
onMounted(async () => {
  const lastTenant = cache.getItem('last_tenant_code')
  if (lastTenant) {
    formState.tenantCode = lastTenant as string
  }
  await Promise.all([loadTenants(), refreshCaptcha()])
})
</script>

<template>
  <div :class="containerClassName">
    <AuthBackground />

    <a-border-beam :count="4" :color="appStore.appSetting.primaryColor">
      <div class="relative rounded-2xl">
        <div :class="cardClassName">
          <!-- 左侧品牌 -->
          <AuthBrandPanel
            :app-title="appTitle"
            :logo="logoIconUrl"
            headline="欢迎登录&#10;管理平台"
            subhead="或许我们只是差点运气"
            :features="brandFeatures"
            :stats="brandStats"
          />

          <!-- 右侧表单 -->
          <AuthFormPanel :app-title="appTitle" :logo="logoIconUrl">
            <AuthHeader badge-text="账号密码登录" title="登录" subtitle="请输入用户名 · 请输入密码" />

            <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical" @finish="handleLogin">
              <a-form-item name="tenantCode" class="!mb-4">
                <a-select
                  v-model:value="formState.tenantCode"
                  :options="tenantOptions"
                  placeholder="请选择租户"
                  :loading="tenantLoading"
                  :class="inputClassName"
                  show-search
                  allow-clear
                  :field-names="{ label: 'tenantName', value: 'tenantCode' }"
                />
              </a-form-item>

              <a-form-item name="username" class="!mb-4">
                <a-input
                  v-model:value="formState.username"
                  size="large"
                  placeholder="用户名"
                  :class="inputClassName"
                  allow-clear
                >
                  <template #prefix>
                    <UserOutlined class="text-slate-400" />
                  </template>
                </a-input>
              </a-form-item>

              <a-form-item name="password" class="!mb-4">
                <a-input-password
                  v-model:value="formState.password"
                  size="large"
                  placeholder="密码"
                  :class="inputClassName"
                  allow-clear
                >
                  <template #prefix>
                    <LockOutlined class="text-slate-400" />
                  </template>
                </a-input-password>
              </a-form-item>

              <a-form-item name="captchaCode" class="!mb-4">
                <div class="flex items-center gap-3">
                  <a-input
                    v-model:value="formState.captchaCode"
                    size="large"
                    placeholder="图形验证码"
                    :class="[inputClassName, 'flex-1']"
                    :maxlength="4"
                    allow-clear
                  >
                    <template #prefix>
                      <SafetyOutlined class="text-slate-400" />
                    </template>
                  </a-input>

                  <div
                    class="flex h-11 w-[110px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/60 bg-white/50 backdrop-blur-sm transition-colors hover:border-white/90 dark:border-white/[0.08] dark:bg-slate-800/40 dark:hover:border-white/[0.15]"
                    title="点击刷新验证码"
                    @click="refreshCaptcha"
                  >
                    <a-spin :spinning="captchaLoading" size="small">
                      <div
                        v-if="captchaSvg"
                        class="flex h-full w-full items-center justify-center [&>svg]:h-full [&>svg]:w-full"
                        v-html="captchaSvg"
                      />
                      <ReloadOutlined v-else class="text-slate-400" />
                    </a-spin>
                  </div>
                </div>
              </a-form-item>

              <div class="mb-6 flex items-center justify-between">
                <a-checkbox
                  v-model:checked="formState.remember"
                  class="!text-[13px] !text-slate-600 dark:!text-slate-400"
                >
                  记住我
                </a-checkbox>
                <a-button
                  type="link"
                  size="small"
                  class="!h-auto !p-0 !text-[13px] !text-slate-500 hover:!text-[var(--ant-color-primary)] dark:!text-slate-400"
                  @click="handleForgotPassword"
                >
                  忘记密码？
                </a-button>
              </div>

              <a-button
                type="primary"
                html-type="submit"
                size="large"
                block
                :loading="loading"
                :class="submitButtonClassName"
              >
                登 录
              </a-button>
            </a-form>

            <AuthFooterLink text="还没有账号？" action-text="立即注册" @action="handleRegister" />

            <AuthDivider>或使用以下方式登录</AuthDivider>

            <AuthSocialLogin :items="socialLogins" @click="handleSocialLogin" />

            <!-- 信任标识 -->
            <AuthTrustBadges />
          </AuthFormPanel>
        </div>
      </div>
    </a-border-beam>

    <ForgotPasswordModal
      v-model:open="forgotModalOpen"
      :default-tenant-code="loginTenantCode"
      :default-username="formState.username"
      @success="handleResetSuccess"
    />
  </div>
</template>
