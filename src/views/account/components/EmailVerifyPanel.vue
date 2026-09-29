<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { sendEmailCode, verifyEmail } from '~/api/auth'
import { useUserStore } from '~/stores/modules/user'

defineOptions({ name: 'EmailVerifyPanel' })

const userStore = useUserStore()

/* ============================================================
 * 状态
 * ============================================================ */
const loading = ref(false)
const sending = ref(false)
const verifying = ref(false)
const editing = ref(false)

/** 倒计时 */
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

/** 表单 */
const form = reactive({
  email: '',
  code: '',
})

/** 邮箱是否已验证 */
const emailVerified = computed(() => (userStore.userInfo as any)?.emailVerified === 1)
const currentEmail = computed(() => (userStore.userInfo as any)?.email ?? '')
const maskedEmail = computed(() => maskEmail(currentEmail.value))

/** 表单是否可提交 */
const canSendCode = computed(() => {
  return !sending.value && countdown.value === 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
})

const canVerify = computed(() => {
  return !verifying.value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && /^[A-Za-z0-9]{4,8}$/.test(form.code)
})

/* ============================================================
 * 邮箱脱敏
 * ============================================================ */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [name, domain] = email.split('@')
  if (name.length <= 2) return `${name[0]}***@${domain}`
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`
}

/* ============================================================
 * 倒计时
 * ============================================================ */
function startCountdown(seconds = 60) {
  stopCountdown()
  countdown.value = seconds
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) stopCountdown()
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 0
}

/* ============================================================
 * 操作
 * ============================================================ */
async function handleSendCode() {
  if (!canSendCode.value) return

  sending.value = true
  try {
    await sendEmailCode({
      email: form.email.trim(),
      scene: emailVerified.value ? 'email_change' : 'email_bind',
    })
    message.success('验证码已发送，请查收邮箱')
    startCountdown(60)
  } catch (e: any) {
    message.error(e?.message || '发送失败')
  } finally {
    sending.value = false
  }
}

async function handleVerify() {
  if (!canVerify.value) return

  verifying.value = true
  try {
    await verifyEmail({
      email: form.email.trim(),
      code: form.code.trim().toUpperCase(),
    })
    message.success('邮箱验证成功')

    // 刷新用户信息
    await userStore.fetchUserInfo?.()

    // 关闭编辑态
    editing.value = false
    resetForm()
  } catch (e: any) {
    message.error(e?.message || '验证失败')
  } finally {
    verifying.value = false
  }
}

function handleEdit() {
  editing.value = true
  form.email = currentEmail.value
  form.code = ''
}

function handleCancel() {
  editing.value = false
  resetForm()
  stopCountdown()
}

function resetForm() {
  form.email = ''
  form.code = ''
}

onMounted(() => {
  if (emailVerified.value) {
    form.email = currentEmail.value
  }
})

onBeforeUnmount(stopCountdown)
</script>

<template>
  <div class="space-y-4">
    <!-- 已绑定且未编辑 -->
    <div
      v-if="emailVerified && !editing"
      class="rounded-xl border border-slate-100 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-900/40"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400"
        >
          <Icon icon="carbon:email" class="text-lg" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200"> 已绑定邮箱 </span>
            <a-tag color="green" class="!m-0 !text-[11px]">
              <Icon icon="carbon:checkmark-filled" class="mr-0.5" />
              已验证
            </a-tag>
          </div>
          <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ maskedEmail }}
          </div>
          <div class="mt-3 flex items-center gap-2">
            <a-button size="small" class="!h-7 !rounded-lg !text-xs" @click="handleEdit">
              <template #icon>
                <Icon icon="carbon:edit" />
              </template>
              更换邮箱
            </a-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 未绑定 或 编辑中 -->
    <div v-else class="rounded-xl border border-slate-100 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400"
        >
          <Icon icon="carbon:email" class="text-lg" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {{ emailVerified ? '更换绑定邮箱' : '绑定邮箱' }}
            </span>
            <a-tag v-if="!emailVerified" color="warning" class="!m-0 !text-[11px]"> 未验证 </a-tag>
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">绑定邮箱后可用于找回密码、接收系统通知</p>

          <!-- 表单 -->
          <div class="mt-4 space-y-3">
            <!-- 邮箱输入 -->
            <div>
              <div class="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">邮箱地址</div>
              <a-input
                v-model:value="form.email"
                placeholder="请输入邮箱地址"
                :maxlength="128"
                size="middle"
                allow-clear
              >
                <template #prefix>
                  <Icon icon="carbon:email" class="text-slate-400" />
                </template>
              </a-input>
            </div>

            <!-- 验证码输入 -->
            <div>
              <div class="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">验证码</div>
              <div class="flex items-center gap-2">
                <a-input
                  v-model:value="form.code"
                  placeholder="请输入 6 位验证码"
                  :maxlength="8"
                  size="middle"
                  class="flex-1"
                  @press-enter="handleVerify"
                >
                  <template #prefix>
                    <Icon icon="carbon:password" class="text-slate-400" />
                  </template>
                </a-input>

                <a-button
                  :disabled="!canSendCode"
                  :loading="sending"
                  size="middle"
                  class="!h-8 !w-32 !rounded-lg !text-xs"
                  @click="handleSendCode"
                >
                  <template v-if="countdown > 0"> {{ countdown }}s 后重发 </template>
                  <template v-else> 获取验证码 </template>
                </a-button>
              </div>
              <div class="mt-1.5 text-[11px] text-slate-400">
                <Icon icon="carbon:information" class="mr-0.5 inline" />
                验证码 5 分钟内有效，请注意查收（含垃圾箱）
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex items-center gap-2 pt-1">
              <a-button
                type="primary"
                :disabled="!canVerify"
                :loading="verifying"
                class="!h-8 !rounded-lg !text-xs"
                @click="handleVerify"
              >
                <template #icon>
                  <Icon v-if="!verifying" icon="carbon:checkmark" />
                </template>
                确认绑定
              </a-button>

              <a-button v-if="editing" class="!h-8 !rounded-lg !text-xs" @click="handleCancel"> 取消 </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
