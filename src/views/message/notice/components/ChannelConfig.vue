<script setup lang="ts">
import { message } from "antdv-next";
import { computed, ref, watch } from "vue";

import {
  CHANNEL_LABEL,
  type ChannelType,
  getNoticeChannels,
  type NoticeChannel,
  upsertNoticeChannel,
} from "~/api/notice-channel";

defineOptions({ name: "NoticeChannelConfig" });

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [v: boolean];
}>();

// ============ 渠道类型 ============
const CHANNEL_TYPES: ChannelType[] = ["in_app", "email", "sms", "webhook"];

// ============ 表单 ============
interface ChannelForm {
  enabled: 0 | 1;
  config: Record<string, any>;
  remark: string;
}

/** 各渠道的默认 config（后端返回字段会覆盖） */
const DEFAULT_FORMS: Record<ChannelType, ChannelForm> = {
  in_app: { enabled: 1, config: {}, remark: "" },
  email: {
    enabled: 0,
    config: {
      host: "",
      port: 465,
      secure: true,
      user: "",
      password: "",
      from: "",
    },
    remark: "",
  },
  sms: {
    enabled: 0,
    config: {
      provider: "aliyun",
      accessKey: "",
      accessSecret: "",
      signName: "",
      templateCode: "",
    },
    remark: "",
  },
  webhook: {
    enabled: 0,
    config: { url: "", method: "POST", secret: "", headers: "" },
    remark: "",
  },
};

const forms = ref<Record<ChannelType, ChannelForm>>(JSON.parse(JSON.stringify(DEFAULT_FORMS)));
const activeType = ref<ChannelType>("in_app");
const loading = ref(false);
const saving = ref(false);

const activeForm = computed(() => forms.value[activeType.value]);

// ============ 加载 ============
async function load() {
  loading.value = true;
  try {
    // 重置为默认，避免上次打开的残留
    forms.value = JSON.parse(JSON.stringify(DEFAULT_FORMS));

    const list = await getNoticeChannels();
    for (const item of list) {
      const base = forms.value[item.channelType];
      if (!base) continue;
      forms.value[item.channelType] = {
        enabled: item.enabled ?? 0,
        config: { ...base.config, ...(item.config || {}) },
        remark: item.remark || "",
      };
    }
  } catch (e) {
    console.error("[ChannelConfig] 加载失败", e);
    message.error("加载渠道配置失败");
  } finally {
    loading.value = false;
  }
}

// ============ 保存 ============
async function save() {
  saving.value = true;
  try {
    // webhook 的 headers 允许 JSON 字符串，尝试解析一次
    const cfg = { ...activeForm.value.config };
    if (activeType.value === "webhook" && typeof cfg.headers === "string" && cfg.headers) {
      try {
        cfg.headers = JSON.parse(cfg.headers);
      } catch {
        message.warning("自定义请求头不是合法的 JSON");
        saving.value = false;
        return;
      }
    }

    const payload: NoticeChannel = {
      channelType: activeType.value,
      enabled: activeForm.value.enabled,
      config: cfg,
      remark: activeForm.value.remark,
    };

    await upsertNoticeChannel(payload);
    message.success(`${CHANNEL_LABEL[activeType.value]} 配置已保存`);
  } catch (e: any) {
    message.error(e?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) load();
  },
  { immediate: true },
);

function close() {
  emit("update:open", false);
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
            <div
              class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div class="text-sm text-gray-600 dark:text-gray-300">启用该渠道</div>
              <a-switch
                :checked="activeForm.enabled === 1"
                @change="(v: boolean) => (activeForm.enabled = v ? 1 : 0)"
              />
            </div>

            <!-- 站内信：无配置 -->
            <div v-if="t === 'in_app'" class="text-xs text-gray-400 py-6 text-center">
              站内信无需额外配置
            </div>

            <!-- 邮件 -->
            <a-form v-else-if="t === 'email'" layout="vertical">
              <a-row :gutter="12">
                <a-col :span="16">
                  <a-form-item label="SMTP 服务器">
                    <a-input
                      v-model:value="activeForm.config.host"
                      placeholder="smtp.example.com"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="端口">
                    <a-input-number
                      v-model:value="activeForm.config.port"
                      :min="1"
                      :max="65535"
                      class="w-full"
                    />
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
                <a-input
                  v-model:value="activeForm.config.from"
                  placeholder="Admin <no-reply@example.com>"
                />
              </a-form-item>
            </a-form>

            <!-- 短信 -->
            <a-form v-else-if="t === 'sms'" layout="vertical">
              <a-form-item label="服务商">
                <a-select
                  v-model:value="activeForm.config.provider"
                  :options="[
                    { label: '阿里云', value: 'aliyun' },
                    { label: '腾讯云', value: 'tencent' },
                    { label: '华为云', value: 'huawei' },
                  ]"
                  placeholder="选择服务商"
                />
              </a-form-item>
              <a-form-item label="AccessKey">
                <a-input v-model:value="activeForm.config.accessKey" />
              </a-form-item>
              <a-form-item label="AccessSecret">
                <a-input-password v-model:value="activeForm.config.accessSecret" />
              </a-form-item>
              <a-form-item label="短信签名">
                <a-input v-model:value="activeForm.config.signName" placeholder="例如：XXX 科技" />
              </a-form-item>
              <a-form-item label="模板编码">
                <a-input
                  v-model:value="activeForm.config.templateCode"
                  placeholder="SMS_12345678"
                />
              </a-form-item>
            </a-form>

            <!-- Webhook -->
            <a-form v-else-if="t === 'webhook'" layout="vertical">
              <a-form-item label="回调 URL">
                <a-input
                  v-model:value="activeForm.config.url"
                  placeholder="https://example.com/webhook"
                />
              </a-form-item>
              <a-form-item label="请求方法">
                <a-radio-group v-model:value="activeForm.config.method" button-style="solid">
                  <a-radio-button value="POST">POST</a-radio-button>
                  <a-radio-button value="PUT">PUT</a-radio-button>
                </a-radio-group>
              </a-form-item>
              <a-form-item label="签名密钥">
                <a-input-password v-model:value="activeForm.config.secret" />
              </a-form-item>
              <a-form-item label="自定义请求头 (JSON)">
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
