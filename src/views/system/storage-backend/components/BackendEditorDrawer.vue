<template>
  <a-drawer
    v-model:open="open"
    :title="isEdit ? '编辑存储后端' : '新增存储后端'"
    :width="640"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <template #footer>
      <a-space class="flex w-full justify-center">
        <a-button @click="handleClose">
          <template #icon>
            <Icon icon="lucide:minus"></Icon>
          </template>
          取消</a-button
        >
        <a-button type="primary" :loading="saving" @click="handleSave">
          <template #icon>
            <Icon icon="lucide:plus"></Icon>
          </template>
          保存
        </a-button>
      </a-space>
    </template>

    <perfect-scrollbar class="h-full">
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="后端类型" name="backendType">
          <Select
            v-model:value="form.backendType"
            :options="BACKEND_TYPE_OPTIONS"
            :disabled="isEdit"
            placeholder="选择类型"
          />
        </a-form-item>

        <a-form-item label="后端名称" name="backendName">
          <a-input v-model:value="form.backendName" placeholder="自定义名称，如：主存储" :maxlength="128" />
        </a-form-item>

        <a-form-item label="优先级" name="priority">
          <a-input-number v-model:value="form.priority" :min="0" :max="100" class="w-full" />
          <div class="mt-1 text-xs text-gray-400">数值越大越优先（用于故障切换）</div>
        </a-form-item>

        <!-- ==================== 动态配置 ==================== -->
        <a-divider orientation="horizontal">存储配置</a-divider>

        <!-- 本地存储 -->
        <template v-if="form.backendType === 'local'">
          <a-form-item label="存储路径">
            <a-input v-model:value="config.path" placeholder="/uploads/files" />
          </a-form-item>
          <a-form-item label="访问 URL">
            <a-input v-model:value="config.url" placeholder="/uploads" />
          </a-form-item>
        </template>

        <!-- MinIO -->
        <template v-else-if="form.backendType === 'minio'">
          <a-row :gutter="12">
            <a-col :span="16">
              <a-form-item label="Endpoint">
                <a-input v-model:value="config.endpoint" placeholder="minio.example.com" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="端口">
                <a-input-number v-model:value="config.port" :min="1" :max="65535" class="w-full" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="使用 SSL">
            <a-switch v-model:checked="config.useSSL" />
          </a-form-item>
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item label="Region">
                <a-input v-model:value="config.region" placeholder="us-east-1" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="Bucket">
                <a-input v-model:value="config.bucket" placeholder="my-bucket" />
              </a-form-item>
            </a-col>
          </a-row>
          <SensitiveInput label="AccessKey" v-model="config.accessKey" />
          <SensitiveInput label="SecretKey" v-model="config.secretKey" />
        </template>

        <!-- 阿里云 OSS -->
        <template v-else-if="form.backendType === 'oss'">
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item label="Region">
                <a-input v-model:value="config.region" placeholder="oss-cn-hangzhou" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="Bucket">
                <a-input v-model:value="config.bucket" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="Endpoint">
            <a-input v-model:value="config.endpoint" placeholder="https://oss-cn-hangzhou.aliyuncs.com" />
          </a-form-item>
          <a-form-item label="自定义域名">
            <a-input v-model:value="config.customDomain" placeholder="https://cdn.example.com" />
          </a-form-item>
          <SensitiveInput label="AccessKeyId" v-model="config.accessKeyId" />
          <SensitiveInput label="AccessKeySecret" v-model="config.accessKeySecret" />
        </template>

        <!-- 腾讯云 COS -->
        <template v-else-if="form.backendType === 'cos'">
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item label="Region">
                <a-input v-model:value="config.region" placeholder="ap-guangzhou" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="Bucket">
                <a-input v-model:value="config.bucket" placeholder="mybucket-1250000000" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="自定义域名">
            <a-input v-model:value="config.customDomain" />
          </a-form-item>
          <SensitiveInput label="SecretId" v-model="config.secretId" />
          <SensitiveInput label="SecretKey" v-model="config.secretKey" />
        </template>

        <!-- AWS S3 -->
        <template v-else-if="form.backendType === 's3'">
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item label="Region">
                <a-input v-model:value="config.region" placeholder="us-east-1" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="Bucket">
                <a-input v-model:value="config.bucket" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="自定义域名">
            <a-input v-model:value="config.customDomain" />
          </a-form-item>
          <SensitiveInput label="AccessKeyId" v-model="config.accessKeyId" />
          <SensitiveInput label="AccessKeySecret" v-model="config.accessKeySecret" />
        </template>

        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" :maxlength="512" show-count />
        </a-form-item>
      </a-form>
    </perfect-scrollbar>
  </a-drawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Select, type FormInstance, type FormProps } from 'antdv-next'
import { computed, reactive, ref } from 'vue'
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'

import {
  createStorageBackend,
  getStorageBackendDetail,
  updateStorageBackend,
  type BackendType,
  type StorageBackendRecord,
} from '../api'
import { BACKEND_TYPE_OPTIONS, MASK } from '../constants'
import SensitiveInput from './SensitiveInput.vue'

defineOptions({ name: 'StorageBackendEditorDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ record: StorageBackendRecord | null }>()
const emit = defineEmits<{ success: [] }>()

const formRef = ref<FormInstance>()
const saving = ref(false)

const isEdit = computed(() => !!props.record)

const form = reactive<{
  backendType: BackendType
  backendName: string
  priority: number
  remark: string
}>({
  backendType: 'local',
  backendName: '',
  priority: 0,
  remark: '',
})

const config = reactive<Record<string, any>>({})

const rules: FormProps['rules'] = {
  backendType: [{ required: true, message: '请选择类型', trigger: 'change' }],
  backendName: [{ required: true, message: '请输入名称', trigger: 'blur' }],
}

async function onOpenChange(v: boolean) {
  if (!v) return
  formRef.value?.clearValidate()

  if (props.record) {
    const detailRes: any = await getStorageBackendDetail(props.record.backendId).catch(() => null)
    const d = detailRes?.data ?? detailRes ?? props.record
    form.backendType = d.backendType
    form.backendName = d.backendName
    form.priority = d.priority ?? 0
    form.remark = d.remark ?? ''

    // 清空 config
    Object.keys(config).forEach((k) => delete config[k])
    Object.assign(config, d.config ?? {})
  } else {
    form.backendType = 'local'
    form.backendName = ''
    form.priority = 0
    form.remark = ''
    Object.keys(config).forEach((k) => delete config[k])
    Object.assign(config, {
      path: '/uploads/files',
      url: '/uploads',
    })
  }
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  // ⚠️ 过滤掉值为 MASK 的敏感字段（表示"不修改"）
  const cleanedConfig = { ...config }
  for (const k of Object.keys(cleanedConfig)) {
    if (cleanedConfig[k] === MASK) delete cleanedConfig[k]
  }

  const payload: any = {
    backendName: form.backendName,
    priority: form.priority,
    remark: form.remark || undefined,
    config: cleanedConfig,
  }
  if (!isEdit.value) payload.backendType = form.backendType

  saving.value = true
  try {
    if (isEdit.value && props.record) {
      await updateStorageBackend(props.record.backendId, payload)
      message.success('更新成功')
    } else {
      await createStorageBackend(payload)
      message.success('创建成功')
    }
    open.value = false
    emit('success')
  } finally {
    saving.value = false
  }
}

function handleClose() {
  open.value = false
}
</script>
