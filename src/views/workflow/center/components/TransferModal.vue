<template>
  <a-modal v-model:open="open" title="转办任务" :width="520" :confirm-loading="submitting" @ok="handleOk">
    <a-form layout="vertical" class="pt-2">
      <a-form-item label="转办给" required>
        <Select
          v-model:value="targetUserId"
          placeholder="选择接收人"
          :options="userOptions"
          show-search
          option-filter-prop="label"
        />
      </a-form-item>
      <a-form-item label="转办说明">
        <a-textarea v-model:value="comment" :rows="3" :maxlength="1000" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { message, Select } from 'antdv-next'
import { onMounted, ref, watch } from 'vue'

import { getUserAllOptions, transferTask } from '~/api'

defineOptions({ name: 'TransferModal' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ taskId: string | null }>()
const emit = defineEmits<{ success: [] }>()

const targetUserId = ref<string>()
const comment = ref('')
const submitting = ref(false)
const userOptions = ref<{ label: string; value: string }[]>([])

watch(open, (v) => {
  if (v) {
    targetUserId.value = undefined
    comment.value = ''
  }
})

onMounted(async () => {
  try {
    const res: any = await getUserAllOptions()
    userOptions.value = (res?.data ?? res ?? []).map((u: any) => ({
      label: u.realName || u.username,
      value: u.userId,
    }))
  } catch {
    /* ignore */
  }
})

async function handleOk() {
  if (!props.taskId || !targetUserId.value) {
    message.warning('请选择转办人')
    return
  }
  submitting.value = true
  try {
    await transferTask(props.taskId, {
      targetUserId: targetUserId.value,
      comment: comment.value || undefined,
    })
    message.success('转办成功')
    open.value = false
    emit('success')
  } catch (e: any) {
    message.error(e?.message || '转办失败')
  } finally {
    submitting.value = false
  }
}
</script>
