<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, onMounted, reactive, ref } from 'vue'

import { getUploadConfig, updateUploadConfig, type UploadConfig } from '../api'

defineOptions({ name: 'UploadConfigPanel' })

const loading = ref(false)
const saving = ref(false)

const form = reactive<UploadConfig>({
  storage: 'local',
  maxSize: 10,
  allowedTypes: 'jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,zip',

  // local
  localPath: '/uploads/files',
  localUrl: '/uploads',

  // minio
  minioEndpoint: '',
  minioPort: 9000,
  minioUseSSL: false,
  minioRegion: 'us-east-1',
  minioBucket: '',
  minioPublicUrl: '',
  minioAccessKey: '',
  minioSecretKey: '',

  // oss
  ossRegion: '',
  ossBucket: '',
  ossEndpoint: '',
  ossCustomDomain: '',
  ossAccessKeyId: '',
  ossAccessKeySecret: '',

  // cos
  cosRegion: '',
  cosBucket: '',
  cosCustomDomain: '',
  cosSecretId: '',
  cosSecretKey: '',

  // s3
  s3Region: '',
  s3Bucket: '',
  s3CustomDomain: '',
  s3AccessKeyId: '',
  s3AccessKeySecret: '',
})

/* ============================================================
 * 存储类型选项
 * ============================================================ */
const STORAGE_OPTIONS = [
  { label: '本地存储', value: 'local', icon: 'carbon:driver-analysis' },
  { label: 'MinIO', value: 'minio', icon: 'carbon:server-proxy' },
  { label: '阿里云 OSS', value: 'oss', icon: 'carbon:cloud' },
  { label: '腾讯云 COS', value: 'cos', icon: 'carbon:cloud' },
  { label: 'AWS S3', value: 's3', icon: 'carbon:cloud' },
]

const isLocal = computed(() => form.storage === 'local')
const isMinio = computed(() => form.storage === 'minio')
const isOss = computed(() => form.storage === 'oss')
const isCos = computed(() => form.storage === 'cos')
const isS3 = computed(() => form.storage === 's3')

/* ============================================================
 * 加载 / 保存
 * ============================================================ */
async function load() {
  loading.value = true
  try {
    const res: any = await getUploadConfig()
    Object.assign(form, res?.data ?? res)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await updateUploadConfig({ ...form })
    message.success('上传配置已保存')
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-card :bordered="false" title="上传配置" class="shadow-sm">
    <a-spin :spinning="loading">
      <a-form layout="vertical">
        <!-- 存储类型 -->
        <a-form-item label="存储类型">
          <a-radio-group v-model:value="form.storage" button-style="solid">
            <a-radio-button v-for="opt in STORAGE_OPTIONS" :key="opt.value" :value="opt.value">
              <Icon :icon="opt.icon" class="mr-1" />
              {{ opt.label }}
            </a-radio-button>
          </a-radio-group>
        </a-form-item>

        <!-- ============================================================
             本地存储
             ============================================================ -->
        <template v-if="isLocal">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <a-form-item label="存储路径">
              <a-input v-model:value="form.localPath" placeholder="/uploads/files" />
            </a-form-item>
            <a-form-item label="访问前缀">
              <a-input v-model:value="form.localUrl" placeholder="/uploads" />
            </a-form-item>
          </div>
        </template>

        <!-- ============================================================
             MinIO
             ============================================================ -->
        <template v-if="isMinio">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <a-form-item label="Endpoint" required>
              <a-input v-model:value="form.minioEndpoint" placeholder="minio.example.com" />
            </a-form-item>
            <a-form-item label="端口">
              <a-input-number v-model:value="form.minioPort" :min="1" :max="65535" class="w-full" />
            </a-form-item>
            <a-form-item label="Region">
              <a-input v-model:value="form.minioRegion" placeholder="us-east-1" />
            </a-form-item>
            <a-form-item label="Bucket" required>
              <a-input v-model:value="form.minioBucket" placeholder="antdv" />
            </a-form-item>
            <a-form-item label="使用 HTTPS">
              <a-switch v-model:checked="form.minioUseSSL" />
            </a-form-item>
            <a-form-item label="对外访问前缀">
              <a-input v-model:value="form.minioPublicUrl" placeholder="/minio-api 或 https://cdn.xxx.com" />
            </a-form-item>
            <a-form-item label="AccessKey" required>
              <a-input v-model:value="form.minioAccessKey" placeholder="minioadmin" />
            </a-form-item>
            <a-form-item label="SecretKey" required>
              <a-input-password v-model:value="form.minioSecretKey" placeholder="留空不修改" />
            </a-form-item>
          </div>
        </template>

        <!-- ============================================================
             阿里云 OSS
             ============================================================ -->
        <template v-if="isOss">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <a-form-item label="Region" required>
              <a-input v-model:value="form.ossRegion" placeholder="oss-cn-hangzhou" />
            </a-form-item>
            <a-form-item label="Bucket" required>
              <a-input v-model:value="form.ossBucket" placeholder="my-bucket" />
            </a-form-item>
            <a-form-item label="Endpoint">
              <a-input v-model:value="form.ossEndpoint" placeholder="oss-cn-hangzhou.aliyuncs.com（可选）" />
            </a-form-item>
            <a-form-item label="自定义域名">
              <a-input v-model:value="form.ossCustomDomain" placeholder="https://cdn.example.com（可选）" />
            </a-form-item>
            <a-form-item label="AccessKeyId" required>
              <a-input v-model:value="form.ossAccessKeyId" placeholder="LTAI..." />
            </a-form-item>
            <a-form-item label="AccessKeySecret" required>
              <a-input-password v-model:value="form.ossAccessKeySecret" placeholder="留空不修改" />
            </a-form-item>
          </div>
        </template>

        <!-- ============================================================
             腾讯云 COS
             ============================================================ -->
        <template v-if="isCos">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <a-form-item label="Region" required>
              <a-input v-model:value="form.cosRegion" placeholder="ap-guangzhou" />
            </a-form-item>
            <a-form-item label="Bucket" required>
              <a-input v-model:value="form.cosBucket" placeholder="my-bucket-1250000000" />
            </a-form-item>
            <a-form-item label="自定义域名">
              <a-input v-model:value="form.cosCustomDomain" placeholder="https://cdn.example.com（可选）" />
            </a-form-item>
            <a-form-item label="SecretId" required>
              <a-input v-model:value="form.cosSecretId" placeholder="AKID..." />
            </a-form-item>
            <a-form-item label="SecretKey" required>
              <a-input-password v-model:value="form.cosSecretKey" placeholder="留空不修改" />
            </a-form-item>
          </div>
        </template>

        <!-- ============================================================
             AWS S3
             ============================================================ -->
        <template v-if="isS3">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <a-form-item label="Region" required>
              <a-input v-model:value="form.s3Region" placeholder="us-east-1" />
            </a-form-item>
            <a-form-item label="Bucket" required>
              <a-input v-model:value="form.s3Bucket" placeholder="my-bucket" />
            </a-form-item>
            <a-form-item label="自定义域名">
              <a-input v-model:value="form.s3CustomDomain" placeholder="https://cdn.example.com（可选）" />
            </a-form-item>
            <a-form-item label="AccessKeyId" required>
              <a-input v-model:value="form.s3AccessKeyId" placeholder="AKIA..." />
            </a-form-item>
            <a-form-item label="AccessKeySecret" required>
              <a-input-password v-model:value="form.s3AccessKeySecret" placeholder="留空不修改" />
            </a-form-item>
          </div>
        </template>

        <!-- ============================================================
             通用限制
             ============================================================ -->
        <a-divider direction="left" class="!text-xs">
          <span class="text-slate-500">通用限制</span>
        </a-divider>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <a-form-item label="单文件大小限制">
            <a-input-number v-model:value="form.maxSize" :min="1" :max="1024" class="w-full">
              <template #addonAfter>MB</template>
            </a-input-number>
          </a-form-item>
          <a-form-item label="允许的文件类型">
            <a-input v-model:value="form.allowedTypes" placeholder="jpg,png,pdf,docx" />
          </a-form-item>
        </div>
      </a-form>

      <div class="flex justify-end">
        <a-button type="primary" :loading="saving" @click="save">
          <template #icon><Icon icon="carbon:save" /></template>
          保存
        </a-button>
      </div>
    </a-spin>
  </a-card>
</template>
<style scoped>
:deep(.ant-radio-button-label) {
  width: 100%;
  display: flex;
  align-items: center;
}
</style>
