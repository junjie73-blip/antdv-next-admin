<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { onMounted, reactive, ref } from 'vue'

import { getSiteInfo, updateSiteInfo, type SiteInfo } from '../api'

defineOptions({ name: 'SiteInfoPanel' })

const loading = ref(false)
const saving = ref(false)
const form = reactive<SiteInfo>({
  name: '',
  logo: '',
  favicon: '',
  icp: '',
  copyright: '',
  description: '',
  keywords: '',
})

async function load() {
  loading.value = true
  try {
    const res: any = await getSiteInfo()
    Object.assign(form, res?.data ?? res)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await updateSiteInfo({ ...form })
    message.success('网站信息已保存')
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-card :bordered="false" title="网站信息" class="shadow-sm">
    <a-spin :spinning="loading">
      <a-form layout="vertical">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <a-form-item label="网站名称" required>
            <a-input v-model:value="form.name" placeholder="如 SaaS Admin" :maxlength="128" />
          </a-form-item>

          <a-form-item label="ICP 备案号">
            <a-input v-model:value="form.icp" placeholder="如 京ICP备00000000号" :maxlength="128" />
          </a-form-item>

          <a-form-item label="Logo URL">
            <a-input v-model:value="form.logo" placeholder="https://..." :maxlength="512" />
          </a-form-item>

          <a-form-item label="Favicon URL">
            <a-input v-model:value="form.favicon" placeholder="https://..." :maxlength="512" />
          </a-form-item>

          <a-form-item label="版权信息">
            <a-input v-model:value="form.copyright" placeholder="© 2026 xxx" :maxlength="256" />
          </a-form-item>

          <a-form-item label="SEO 关键词">
            <a-input v-model:value="form.keywords" placeholder="逗号分隔" :maxlength="512" />
          </a-form-item>
        </div>

        <a-form-item label="网站描述">
          <a-textarea
            v-model:value="form.description"
            :rows="3"
            :maxlength="512"
            show-count
            placeholder="用于 SEO 描述"
          />
        </a-form-item>
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
