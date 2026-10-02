<template>
  <a-modal v-model:open="open" title="加签" :width="520" :confirm-loading="submitting" @ok="handleOk">
    <a-form layout="vertical" class="pt-2">
      <a-form-item label="加签人" required>
        <Select
          v-model:value="userIds"
          mode="multiple"
          placeholder="选择加签人（最多 20 人）"
          :options="userOptions"
          :max-tag-count="5"
          show-search
          option-filter-prop="label"
        />
      </a-form-item>

      <a-form-item label="加签方式">
        <a-radio-group v-model:value="signType">
          <a-radio value="before">前加签（先于我审批）</a-radio>
          <a-radio value="after">后加签（我审批后）</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="备注">
        <a-textarea v-model:value="comment" :rows="3" :maxlength="1000" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { message, Select } from 'antdv-next'
import { onMounted, ref, watch } from 'vue'

import { addSign, getUserAllOptions } from '~/api'

defineOptions({ name: 'AddSignModal' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  taskId: string | null
}>()

const emit = defineEmits<{ success: [] }>()

const userIds = ref<string[]>([])
const signType = ref<'before' | 'after'>('after')
const comment = ref('')
const submitting = ref(false)
const userOptions = ref<{ label: string; value: string }[]>([])

watch(open, (v) => {
  if (v) {
    userIds.value = []
    signType.value = 'after'
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
  if (!props.taskId || userIds.value.length === 0) {
    message.warning('请选择加签人')
    return
  }
  submitting.value = true
  try {
    await addSign(props.taskId, {
      userIds: userIds.value,
      signType: signType.value,
      comment: comment.value || undefined,
    })
    message.success('加签成功')
    open.value = false
    emit('success')
  } catch (e: any) {
    message.error(e?.message || '加签失败')
  } finally {
    submitting.value = false
  }
}
</script>
