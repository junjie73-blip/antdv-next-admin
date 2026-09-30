<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Modal } from 'antdv-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { disableMFA, enableMFA, getMFAStatus, regenerateBackupCodes, setupMFA, type MFAStatus } from '~/api/mfa'

defineOptions({ name: 'MFAPanel' })

/* ============================================================
 * 状态
 * ============================================================ */
const mfaStatus = ref<MFAStatus>({ enabled: false, hasBackupCodes: false })
const statusLoading = ref(false)

// 启用流程
const setupVisible = ref(false)
const setupLoading = ref(false)
const setupData = ref<{ qrCode: string; manualEntryKey: string } | null>(null)
const setupToken = ref('')
const setupSubmitting = ref(false)

// 备份码展示
const backupCodes = ref<string[]>([])

// 通用 TOTP 输入弹窗（禁用、重新生成备份码）
interface TokenModalState {
  visible: boolean
  title: string
  hint: string
  value: string
  loading: boolean
  action: ((token: string) => Promise<void>) | null
}

const tokenModal = ref<TokenModalState>({
  visible: false,
  title: '',
  hint: '',
  value: '',
  loading: false,
  action: null,
})

/* ============================================================
 * 加载 MFA 状态
 * ============================================================ */
async function loadStatus() {
  statusLoading.value = true
  try {
    const res: any = await getMFAStatus()
    const data = res?.data ?? res ?? {}
    mfaStatus.value = {
      enabled: Boolean(data.enabled),
      hasBackupCodes: Boolean(data.hasBackupCodes),
    }
  } catch (e: any) {
    // 不阻塞 UI，展示为未启用
    mfaStatus.value = { enabled: false, hasBackupCodes: false }
    message.warning(e?.message || 'MFA 状态加载失败，请稍后重试')
  } finally {
    statusLoading.value = false
  }
}

/* ============================================================
 * 启用 MFA
 * ============================================================ */
async function handleSetup() {
  setupLoading.value = true
  try {
    const res: any = await setupMFA()
    const data = res?.data ?? res
    if (!data?.qrCodeUrl || !data?.secret) {
      throw new Error('二维码数据不完整')
    }
    setupData.value = {
      qrCode: String(data.qrCodeUrl),
      manualEntryKey: String(data.secret),
    }
    setupToken.value = ''
    setupVisible.value = true
  } catch (e: any) {
    message.error(e?.message || 'MFA 初始化失败')
    setupData.value = null
  } finally {
    setupLoading.value = false
  }
}

async function handleSetupConfirm() {
  const token = setupToken.value.trim()
  if (!/^\d{6}$/.test(token)) {
    message.warning('请输入 6 位数字验证码')
    return
  }
  setupSubmitting.value = true
  try {
    const res: any = await enableMFA(token)
    const codes = res?.data?.backupCodes ?? res?.backupCodes ?? []
    if (Array.isArray(codes) && codes.length > 0) {
      backupCodes.value = codes
    }
    message.success('MFA 已启用，请妥善保存备份码')
    setupVisible.value = false
    await loadStatus()
  } catch (e: any) {
    message.error(e?.message || '启用失败，请检查验证码')
  } finally {
    setupSubmitting.value = false
  }
}

/* ============================================================
 * 禁用 MFA
 * ============================================================ */
function handleDisable() {
  Modal.confirm({
    title: '禁用两步验证',
    content: '禁用后账号安全性将降低，确定继续吗？',
    okType: 'danger',
    async onOk() {
      openTokenModal('禁用 MFA', '禁用后账号安全性将降低，请输入当前 6 位验证码确认', async (token) => {
        await disableMFA(token)
        message.success('MFA 已禁用')
        await loadStatus()
      })
    },
  })
}

/* ============================================================
 * 重新生成备份码
 * ============================================================ */
function handleRegenerate() {
  openTokenModal('重新生成备份码', '生成后旧的备份码将全部失效，请输入当前 6 位验证码', async (token) => {
    const res: any = await regenerateBackupCodes(token)
    const codes = res?.data?.backupCodes ?? res?.backupCodes ?? []
    if (!Array.isArray(codes) || codes.length === 0) {
      throw new Error('未返回备份码')
    }
    backupCodes.value = codes
    message.success('备份码已重新生成')
    await loadStatus()
  })
}

/* ============================================================
 * 通用 TOTP 弹窗
 * ============================================================ */
function openTokenModal(title: string, hint: string, action: (token: string) => Promise<void>) {
  tokenModal.value = {
    visible: true,
    title,
    hint,
    value: '',
    loading: false,
    action,
  }
}

async function handleTokenConfirm() {
  const { value, action } = tokenModal.value
  const token = value.trim()
  if (!/^\d{6}$/.test(token)) {
    message.warning('请输入 6 位数字验证码')
    return
  }
  if (!action) return

  tokenModal.value.loading = true
  try {
    await action(token)
    tokenModal.value.visible = false
  } catch (e: any) {
    message.error(e?.message || '操作失败，请检查验证码')
  } finally {
    tokenModal.value.loading = false
  }
}

function closeTokenModal() {
  tokenModal.value.visible = false
  tokenModal.value.value = ''
  tokenModal.value.action = null
}

/* ============================================================
 * 备份码
 * ============================================================ */
async function copyBackupCodes() {
  if (backupCodes.value.length === 0) return
  try {
    await navigator.clipboard.writeText(backupCodes.value.join('\n'))
    message.success('备份码已复制到剪贴板')
  } catch {
    message.warning('复制失败，请手动选择复制')
  }
}

function closeBackupCodes() {
  backupCodes.value = []
}

/* ============================================================
 * 生命周期
 * ============================================================ */
onMounted(loadStatus)

onBeforeUnmount(() => {
  setupData.value = null
  setupToken.value = ''
  backupCodes.value = []
  tokenModal.value = {
    visible: false,
    title: '',
    hint: '',
    value: '',
    loading: false,
    action: null,
  }
})

defineExpose({ refresh: loadStatus })
</script>

<template>
  <div>
    <!-- 标题 -->
    <div class="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
      <Icon icon="carbon:security" class="text-gray-500" />
      <span>两步验证（MFA）</span>
    </div>

    <!-- 状态卡片 -->
    <div class="flex items-center justify-between rounded-lg border border-gray-100 p-4 dark:border-gray-800">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <span>状态：</span>
          <a-tag :color="mfaStatus.enabled ? 'green' : 'default'" class="!m-0">
            <a-spin v-if="statusLoading" :size="'small'" class="mr-1" />
            {{ statusLoading ? '加载中' : mfaStatus.enabled ? '已启用' : '未启用' }}
          </a-tag>
        </div>
        <div class="mt-1 text-xs text-gray-400">
          {{
            mfaStatus.enabled
              ? mfaStatus.hasBackupCodes
                ? '已生成备份码，请妥善保管'
                : '尚未生成备份码，建议立即生成'
              : '启用后可通过验证器 App 提升账号安全性'
          }}
        </div>
      </div>

      <div class="flex gap-2">
        <a-button
          v-if="!mfaStatus.enabled"
          type="primary"
          :loading="setupLoading"
          :disabled="statusLoading"
          @click="handleSetup"
        >
          启用 MFA
        </a-button>
        <template v-else>
          <a-button @click="handleRegenerate">重新生成备份码</a-button>
          <a-button danger @click="handleDisable">禁用 MFA</a-button>
        </template>
      </div>
    </div>

    <!-- ==================== 启用 MFA 弹窗 ==================== -->
    <a-modal
      v-model:open="setupVisible"
      title="启用两步验证"
      :width="460"
      :mask-closable="false"
      :confirm-loading="setupSubmitting"
      ok-text="确认启用"
      cancel-text="取消"
      @ok="handleSetupConfirm"
      @cancel="setupData = null"
    >
      <div v-if="setupData" class="space-y-3">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          使用验证器 App（如 Google Authenticator / Microsoft Authenticator）扫描下方二维码：
        </p>

        <div class="flex justify-center">
          <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <img :src="setupData.qrCode" alt="MFA QR Code" class="h-40 w-40" />
          </div>
        </div>

        <div class="rounded-md bg-gray-50 p-3 text-center text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <div class="mb-1 text-gray-400">无法扫描？手动输入密钥：</div>
          <code class="font-mono text-xs break-all select-all">{{ setupData.manualEntryKey }}</code>
        </div>

        <a-input
          v-model:value="setupToken"
          placeholder="请输入 App 上的 6 位验证码"
          :maxlength="6"
          size="large"
          autocomplete="one-time-code"
          inputmode="numeric"
          @press-enter="handleSetupConfirm"
        />
      </div>

      <a-empty v-else description="二维码加载中..." />
    </a-modal>

    <!-- ==================== 通用 TOTP 弹窗 ==================== -->
    <a-modal
      v-model:open="tokenModal.visible"
      :title="tokenModal.title"
      :width="420"
      :mask-closable="false"
      :confirm-loading="tokenModal.loading"
      ok-text="确认"
      cancel-text="取消"
      @ok="handleTokenConfirm"
      @cancel="closeTokenModal"
    >
      <div class="space-y-3 py-2">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ tokenModal.hint }}</p>
        <a-input
          v-model:value="tokenModal.value"
          placeholder="请输入 6 位 TOTP 验证码"
          :maxlength="6"
          size="large"
          autocomplete="one-time-code"
          inputmode="numeric"
          @press-enter="handleTokenConfirm"
        />
      </div>
    </a-modal>

    <!-- ==================== 备份码弹窗 ==================== -->
    <a-modal
      :open="backupCodes.length > 0"
      title="备份码（请妥善保存）"
      :width="520"
      :mask-closable="false"
      :closable="true"
      :footer="null"
      @cancel="closeBackupCodes"
    >
      <div class="space-y-3">
        <a-alert
          type="warning"
          show-icon
          message="每个备份码只能使用一次"
          description="当无法接收验证码时，可使用备份码登录。请立即保存到安全位置。"
        />

        <div class="grid grid-cols-2 gap-2">
          <code
            v-for="c in backupCodes"
            :key="c"
            class="rounded bg-gray-50 px-2 py-1.5 text-center font-mono text-xs select-all dark:bg-gray-800"
          >
            {{ c }}
          </code>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <a-button @click="copyBackupCodes">
            <template #icon><Icon icon="carbon:copy" /></template>
            复制全部
          </a-button>
          <a-button type="primary" @click="closeBackupCodes">我已保存</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>
