<script setup lang="ts">
import { message } from 'antdv-next'
import { ref, watch } from 'vue'

import { http } from '~/utils'

const props = defineProps<{ jobId: string }>()
const emit = defineEmits<{ updated: [] }>()

const loading = ref(false)
const jobOptions = ref<Array<{ label: string; value: string }>>([])
const form = ref({
  dependencyJobIds: [] as string[],
  dependencyMode: 'all' as 'all' | 'any',
  onDependencyFail: 'skip' as 'skip' | 'abort',
})

async function loadOptions() {
  const res: any = await http.Get('/job/list', {
    params: { pageSize: 100 },
  })
  const list = res?.data?.list ?? res?.list ?? []
  jobOptions.value = list
    .filter((j: any) => j.jobId !== props.jobId)
    .map((j: any) => ({ label: j.jobName, value: j.jobId }))
}

async function loadCurrent() {
  const res: any = await http.Get(`/job/${props.jobId}`)
  const data = res?.data ?? res
  form.value = {
    dependencyJobIds: data.dependencyJobIds ?? [],
    dependencyMode: data.dependencyMode ?? 'all',
    onDependencyFail: data.onDependencyFail ?? 'skip',
  }
}

async function handleSave() {
  loading.value = true
  try {
    await http.Put(`/job/${props.jobId}/dependencies`, form.value)
    message.success('依赖配置已保存')
    emit('updated')
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.jobId,
  async () => {
    if (props.jobId) {
      await Promise.all([loadOptions(), loadCurrent()])
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-4">
    <a-form layout="vertical">
      <a-form-item label="依赖的任务（上游）">
        <a-select
          v-model:value="form.dependencyJobIds"
          mode="multiple"
          :options="jobOptions"
          placeholder="选择需要先完成的任务"
          :max-tag-count="5"
          allow-clear
        />
      </a-form-item>

      <a-form-item label="依赖满足模式">
        <a-radio-group v-model:value="form.dependencyMode">
          <a-radio value="all">全部成功</a-radio>
          <a-radio value="any">任一成功</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="上游失败时">
        <a-radio-group v-model:value="form.onDependencyFail">
          <a-radio value="skip">跳过本次</a-radio>
          <a-radio value="abort">中止执行</a-radio>
        </a-radio-group>
      </a-form-item>
    </a-form>

    <div class="flex justify-end">
      <a-button type="primary" :loading="loading" @click="handleSave"> 保存依赖配置 </a-button>
    </div>
  </div>
</template>
