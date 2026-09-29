<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { onMounted, reactive, ref } from 'vue'

import { getCancelStatus, submitCancelAccount, type CancelStatus } from '~/api/auth'

defineOptions({ name: 'CancelAccountPanel' })

const loading = ref(false)
const submitting = ref(false)
const status = ref<CancelStatus>({ pending: false })
const confirmOpen = ref(false)

const form = reactive({
  password: '',
  reason: '',
})

async function loadStatus() {
  loading.value = true
  try {
    const res: any = await getCancelStatus()
    status.value = res?.data ?? res ?? { pending: false }
  } finally {
    loading.value = false
  }
}

function openConfirm() {
  form.password = ''
  form.reason = ''
  confirmOpen.value = true
}

async function handleConfirm() {
  if (!form.password.trim()) {
    message.warning('请输入登录密码')
    return
  }

  submitting.value = true
  try {
    const res: any = await submitCancelAccount({
      password: form.password,
      reason: form.reason.trim() || undefined,
    })
    const data = res?.data ?? res
    message.success(`注销申请已提交，将于 ${data.bufferDays} 天后生效`)
    confirmOpen.value = false
    await loadStatus()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(loadStatus)
</script>

<template>
  <div class="space-y-4">
    <!-- 未申请：显示危险操作入口 -->
    <div
      v-if="!status.pending"
      class="rounded-xl border border-rose-200/60 bg-rose-50/40 p-5 dark:border-rose-900/40 dark:bg-rose-950/20"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400"
        >
          <Icon icon="carbon:warning-alt" class="text-lg" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-semibold text-rose-700 dark:text-rose-300">注销账号</h3>
          <p class="mt-1 text-xs leading-relaxed text-rose-600/80 dark:text-rose-400/80">
            注销后账号将于 7 天后被删除，此操作不可恢复。
            <span class="font-medium">注销申请期间再次登录将自动撤销申请。</span>
          </p>
          <a-button danger class="mt-3 !h-8 !rounded-lg !text-xs" @click="openConfirm"> 申请注销 </a-button>
        </div>
      </div>
    </div>

    <!-- 已申请：显示倒计时 + 撤销提示 -->
    <div
      v-else
      class="rounded-xl border border-amber-200/60 bg-amber-50/40 p-5 dark:border-amber-900/40 dark:bg-amber-950/20"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400"
        >
          <Icon icon="carbon:hourglass" class="text-lg" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-semibold text-amber-700 dark:text-amber-300">已提交注销申请</h3>
          <div class="mt-2 space-y-1.5 text-xs text-amber-700/80 dark:text-amber-400/80">
            <div class="flex items-center gap-2">
              <Icon icon="carbon:time" />
              <span>申请时间：{{ status.cancelledAt }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Icon icon="carbon:warning" />
              <span>生效时间：{{ status.effectiveAt }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Icon icon="carbon:calendar" />
              <span>
                剩余
                <span class="font-semibold text-amber-600 tabular-nums dark:text-amber-400">
                  {{ status.remainingDays }}
                </span>
                天
              </span>
            </div>
            <div v-if="status.reason" class="flex items-start gap-2">
              <Icon icon="carbon:document" class="mt-0.5" />
              <span>原因：{{ status.reason }}</span>
            </div>
          </div>

          <!-- 撤销提示 -->
          <div
            class="mt-3 rounded-lg border border-amber-200/60 bg-white/60 p-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-slate-900/40 dark:text-amber-300"
          >
            <div class="flex items-start gap-2">
              <Icon icon="carbon:information" class="mt-0.5 shrink-0" />
              <span>
                <span class="font-medium">撤销方式：</span>
                重新登录即可自动撤销注销申请，无需其他操作。
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 二次确认弹窗 -->
    <a-modal
      v-model:open="confirmOpen"
      title="确认注销账号"
      :width="480"
      :confirm-loading="submitting"
      ok-text="确认申请"
      ok-type="danger"
      @ok="handleConfirm"
    >
      <div class="space-y-4 py-2">
        <div
          class="rounded-lg border border-rose-200/60 bg-rose-50/50 p-3 text-xs leading-relaxed text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
        >
          <Icon icon="carbon:warning-alt" class="mr-1 inline-block" />
          注销申请提交后您将被立即下线，7 天后账号自动删除。
          <br />
          期间重新登录可自动撤销申请。
        </div>

        <div>
          <div class="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            登录密码 <span class="text-rose-500">*</span>
          </div>
          <a-input-password
            v-model:value="form.password"
            placeholder="请输入当前账号的登录密码"
            :maxlength="64"
            autocomplete="current-password"
          />
        </div>

        <div>
          <div class="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            注销原因
            <span class="ml-1 text-xs text-slate-400">（可选）</span>
          </div>
          <a-textarea
            v-model:value="form.reason"
            placeholder="请告诉我们您注销的原因，帮助我们改进"
            :rows="3"
            :maxlength="512"
            show-count
          />
        </div>
      </div>
    </a-modal>
  </div>
</template>
