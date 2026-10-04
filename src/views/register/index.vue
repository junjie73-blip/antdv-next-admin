<script setup lang="ts">
import type { FormInstance } from 'antdv-next'
import type { Rule } from 'antdv-next/dist/form/types'

import { LockOutlined, MailOutlined, ShopOutlined, UserOutlined } from '@antdv-next/icons'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import logoIconUrl from '~/assets/images/logo.png'
import { useAuthStyles } from '~/components/common/Auth/composables/useAuthStyles'
import { useAppStore } from '~/stores'
import { request } from '~/composables'

defineOptions({ name: 'Register' })

const router = useRouter()
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'
const appStore = useAppStore()

const { containerClassName, cardClassName, inputClassName, submitButtonClassName } = useAuthStyles()

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

/* ============================================================
 * 品牌面板配置
 * ============================================================ */
const brandFeatures = [
  { icon: 'carbon:checkmark', text: '免费创建' },
  { icon: 'carbon:user-multiple', text: '多租户架构' },
  { icon: 'carbon:data-base', text: '数据隔离' },
]

const brandStats = [
  { icon: 'carbon:user-multiple', value: '10K+', label: 'Active Users' },
  { icon: 'carbon:application', value: '500+', label: 'Deployments' },
  { icon: 'carbon:star', value: '4.9', label: 'Rating' },
]

/* ============================================================
 * 校验
 * ============================================================ */
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

/* ============================================================
 * 注册
 * ============================================================ */
async function handleRegister() {
  try {
    await formRef.value?.validate()
    loading.value = true

    await request.post('/auth/register', {
      tenantName: formState.tenantName,
      tenantCode: formState.tenantCode,
      username: formState.username,
      password: formState.password,
      email: formState.email,
    })

    message.success('注册成功，请登录')
    router.push('/login')
  } catch (e: unknown) {
    if ((e as { errorFields?: unknown })?.errorFields) return
    message.error((e as Error)?.message || '注册失败，请稍后再试')
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
    <AuthBackground />

    <a-border-beam :count="4" :color="appStore.appSetting.primaryColor">
      <div class="relative rounded-2xl">
        <div :class="cardClassName">
          <AuthBrandPanel
            :app-title="appTitle"
            :logo="logoIconUrl"
            headline="开启您的&#10;企业空间"
            subhead="注册即可创建专属空间"
            :features="brandFeatures"
            :stats="brandStats"
          />

          <AuthFormPanel :app-title="appTitle" :logo="logoIconUrl">
            <AuthHeader badge-text="免费注册" title="创建账号" subtitle="填写以下信息，即刻开启您的企业空间" />

            <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical" @finish="handleRegister">
              <a-form-item name="tenantName" class="!mb-3">
                <a-input
                  v-model:value="formState.tenantName"
                  size="large"
                  placeholder="企业名称"
                  :class="inputClassName"
                >
                  <template #prefix>
                    <ShopOutlined class="text-slate-400" />
                  </template>
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
                  <template #prefix>
                    <UserOutlined class="text-slate-400" />
                  </template>
                </a-input>
              </a-form-item>

              <a-form-item name="email" class="!mb-3">
                <a-input v-model:value="formState.email" size="large" placeholder="邮箱" :class="inputClassName">
                  <template #prefix>
                    <MailOutlined class="text-slate-400" />
                  </template>
                </a-input>
              </a-form-item>

              <a-form-item name="password" class="!mb-3">
                <a-input-password
                  v-model:value="formState.password"
                  size="large"
                  placeholder="密码（至少6位）"
                  :class="inputClassName"
                >
                  <template #prefix>
                    <LockOutlined class="text-slate-400" />
                  </template>
                </a-input-password>
              </a-form-item>

              <a-form-item name="confirmPassword" class="!mb-4">
                <a-input-password
                  v-model:value="formState.confirmPassword"
                  size="large"
                  placeholder="确认密码"
                  :class="inputClassName"
                >
                  <template #prefix>
                    <LockOutlined class="text-slate-400" />
                  </template>
                </a-input-password>
              </a-form-item>

              <a-form-item name="agree" class="!mb-5">
                <a-checkbox v-model:checked="formState.agree" class="!text-[12px] !text-slate-600 dark:!text-slate-400">
                  我已阅读并同意
                  <a href="#" class="text-[var(--ant-color-primary)]"> 《用户协议》 </a>
                  和
                  <a href="#" class="text-[var(--ant-color-primary)]"> 《隐私政策》 </a>
                </a-checkbox>
              </a-form-item>

              <a-button
                type="primary"
                html-type="submit"
                size="large"
                block
                :loading="loading"
                :class="submitButtonClassName"
              >
                创建账号
              </a-button>
            </a-form>

            <AuthFooterLink text="已有账号？" action-text="立即登录" @action="handleGoLogin" />

            <!-- 信任标识 -->
            <AuthTrustBadges />
          </AuthFormPanel>
        </div>
      </div>
    </a-border-beam>
  </div>
</template>
