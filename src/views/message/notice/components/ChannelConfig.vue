<script setup lang="ts">
import { message, Select } from 'antdv-next'
import { computed, ref, watch } from 'vue'

import {
  CHANNEL_LABEL,
  type ChannelType,
  getNoticeChannels,
  type NoticeChannel,
  upsertNoticeChannel,
} from '~/api/notice-channel'

defineOptions({ name: 'NoticeChannelConfig' })

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [v: boolean]
}>()

// ============ 渠道类型 ============
const CHANNEL_TYPES: ChannelType[] = ['in_app', 'email', 'sms', 'webhook']

// ============ 表单 ============
interface ChannelForm {
  enabled: 0 | 1
  config: Record<string, any>
  remark: string
}

/** 各渠道的默认 config（后端返回字段会覆盖） */
const DEFAULT_FORMS: Record<ChannelType, ChannelForm> = {
  in_app: { enabled: 1, config: {}, remark: '' },
  email: {
    enabled: 0,
    config: {
      host: '',
      port: 465,
      secure: true,
      user: '',
      password: '',
      from: '',
    },
    remark: '',
  },
  sms: {
    enabled: 0,
    config: {
      provider: 'aliyun',
      accessKeyId: '',
      accessKeySecret: '',
      secretId: '',
      secretKey: '',
      appKey: '',
      appSecret: '',
      signName: '',
      defaultTemplateId: '',
      region: 'cn-hangzhou',
      endpoint: '',
      sender: '',
    },
    remark: '',
  },
  webhook: {
    enabled: 0,
    config: {
      url: '',
      secret: '',
      enableIdempotency: true,
      headers: '',
    },
    remark: '',
  },
}

const forms = ref<Record<ChannelType, ChannelForm>>(JSON.parse(JSON.stringify(DEFAULT_FORMS)))
const activeType = ref<ChannelType>('in_app')
const loading = ref(false)
const saving = ref(false)

const activeForm = computed(() => forms.value[activeType.value])

// ============ 加载 ============
async function load() {
  loading.value = true
  try {
    // 重置为默认，避免上次打开的残留
    forms.value = JSON.parse(JSON.stringify(DEFAULT_FORMS))

    const list = await getNoticeChannels()
    for (const item of list) {
      const base = forms.value[item.channelType]
      if (!base) continue
      forms.value[item.channelType] = {
        enabled: item.enabled ?? 0,
        config: { ...base.config, ...JSON.parse((item.config as unknown as string) || '{}') },
        remark: item.remark || '',
      }
    }
  } catch (e) {
    console.error('[ChannelConfig] 加载失败', e)
    message.error('加载渠道配置失败')
  } finally {
    loading.value = false
  }
}

// ============ 保存 ============
async function save() {
  saving.value = true
  try {
    // webhook 的 headers 允许 JSON 字符串，尝试解析一次
    const cfg = { ...activeForm.value.config }
    if (activeType.value === 'webhook' && typeof cfg.headers === 'string' && cfg.headers) {
      try {
        cfg.headers = JSON.parse(cfg.headers)
      } catch {
        message.warning('自定义请求头不是合法的 JSON')
        saving.value = false
        return
      }
    }

    const payload: NoticeChannel = {
      channelType: activeType.value,
      enabled: activeForm.value.enabled,
      config: cfg,
      remark: activeForm.value.remark,
    }

    await upsertNoticeChannel(payload)
    message.success(`${CHANNEL_LABEL[activeType.value]} 配置已保存`)
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) load()
  },
  { immediate: true },
)

function close() {
  emit('update:open', false)
}
</script>

<template>
  <a-drawer :open="open" title="通知渠道配置" :width="580" @close="close">
    <template #extra>
      <a-button type="primary" :loading="saving" @click="save">保存</a-button>
    </template>

    <a-spin :spinning="loading">
      <a-tabs v-model:active-key="activeType">
        <a-tab-pane v-for="t in CHANNEL_TYPES" :key="t" :tab="CHANNEL_LABEL[t]">
          <div class="space-y-4 pt-2">
            <!-- 启用开关 -->
            <div class="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <div class="text-sm text-gray-600 dark:text-gray-300">启用该渠道</div>
              <a-switch
                :checked="activeForm.enabled === 1"
                @change="(v: boolean) => (activeForm.enabled = v ? 1 : 0)"
              />
            </div>

            <!-- 站内信：无配置 -->
            <div v-if="t === 'in_app'" class="py-6 text-center text-xs text-gray-400">站内信无需额外配置</div>

            <!-- 邮件 -->
            <a-form v-else-if="t === 'email'" layout="vertical">
              <a-row :gutter="12">
                <a-col :span="16">
                  <a-form-item label="SMTP 服务器">
                    <a-input v-model:value="activeForm.config.host" placeholder="smtp.example.com" />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="端口">
                    <a-input-number v-model:value="activeForm.config.port" :min="1" :max="65535" class="w-full" />
                  </a-form-item>
                </a-col>
              </a-row>
              <a-form-item label="SSL / TLS">
                <a-switch v-model:checked="activeForm.config.secure" />
              </a-form-item>
              <a-form-item label="用户名">
                <a-input v-model:value="activeForm.config.user" placeholder="user@example.com" />
              </a-form-item>
              <a-form-item label="密码">
                <a-input-password v-model:value="activeForm.config.password" />
              </a-form-item>
              <a-form-item label="发件人">
                <a-input v-model:value="activeForm.config.from" placeholder="Admin <no-reply@example.com>" />
              </a-form-item>
            </a-form>

            <!-- 短信 -->
            <a-form v-else-if="t === 'sms'" layout="vertical">
              <a-form-item label="服务商">
                <Select
                  v-model:value="activeForm.config.provider"
                  :options="[
                    { label: '阿里云', value: 'aliyun' },
                    { label: '腾讯云', value: 'tencent' },
                    { label: '华为云', value: 'huawei' },
                  ]"
                  placeholder="选择服务商"
                />
              </a-form-item>

              <!-- 阿里云 -->
              <template v-if="activeForm.config.provider === 'aliyun'">
                <a-form-item label="AccessKeyId">
                  <a-input v-model:value="activeForm.config.accessKeyId" />
                </a-form-item>
                <a-form-item label="AccessKeySecret">
                  <a-input-password v-model:value="activeForm.config.accessKeySecret" />
                </a-form-item>
                <a-form-item label="Region">
                  <a-input v-model:value="activeForm.config.region" placeholder="cn-hangzhou" />
                </a-form-item>
              </template>

              <!-- 腾讯云 -->
              <template v-else-if="activeForm.config.provider === 'tencent'">
                <a-form-item label="SecretId">
                  <a-input v-model:value="activeForm.config.secretId" />
                </a-form-item>
                <a-form-item label="SecretKey">
                  <a-input-password v-model:value="activeForm.config.secretKey" />
                </a-form-item>
                <a-form-item label="Region">
                  <a-input v-model:value="activeForm.config.region" placeholder="ap-guangzhou" />
                </a-form-item>
              </template>

              <!-- 华为云 -->
              <template v-else-if="activeForm.config.provider === 'huawei'">
                <a-form-item label="AppKey">
                  <a-input v-model:value="activeForm.config.appKey" />
                </a-form-item>
                <a-form-item label="AppSecret">
                  <a-input-password v-model:value="activeForm.config.appSecret" />
                </a-form-item>
                <a-form-item label="Endpoint">
                  <a-input
                    v-model:value="activeForm.config.endpoint"
                    placeholder="https://smsapi.cn-north-4.myhuaweicloud.com"
                  />
                </a-form-item>
                <a-form-item label="通道号（Sender）">
                  <a-input v-model:value="activeForm.config.sender" placeholder="10690000..." />
                </a-form-item>
              </template>

              <a-form-item label="短信签名">
                <a-input v-model:value="activeForm.config.signName" placeholder="例如：ACME 科技" />
              </a-form-item>
              <a-form-item label="默认模板 ID">
                <a-input v-model:value="activeForm.config.defaultTemplateId" placeholder="SMS_123456789" />
              </a-form-item>
            </a-form>

            <!-- Webhook -->
            <a-form v-else-if="t === 'webhook'" layout="vertical">
              <a-form-item label="回调 URL">
                <a-input v-model:value="activeForm.config.url" placeholder="https://example.com/webhook" />
              </a-form-item>
              <a-form-item label="签名密钥">
                <a-input-password
                  v-model:value="activeForm.config.secret"
                  placeholder="留空则不签名；设置后请求头带 X-Signature"
                />
              </a-form-item>
              <a-form-item label="启用幂等">
                <a-switch v-model:checked="activeForm.config.enableIdempotency" />
                <div class="ml-2 inline-block text-xs text-gray-400">
                  开启后请求头带 X-Idempotency-Key，接收方可去重
                </div>
              </a-form-item>
              <a-form-item label="自定义请求头（JSON）">
                <a-textarea
                  v-model:value="activeForm.config.headers"
                  :rows="3"
                  placeholder='{"Authorization":"Bearer xxx"}'
                />
              </a-form-item>
            </a-form>

            <!-- 备注（所有渠道共用） -->
            <a-form layout="vertical">
              <a-form-item label="备注">
                <a-textarea v-model:value="activeForm.remark" :rows="2" :maxlength="256" />
              </a-form-item>
            </a-form>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-spin>
  </a-drawer>
</template>
