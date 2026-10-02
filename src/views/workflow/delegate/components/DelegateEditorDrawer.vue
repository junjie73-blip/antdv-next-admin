<template>
  <a-drawer
    v-model:open="open"
    :title="isEdit ? '编辑委托' : '新建委托'"
    :width="520"
    :footer-style="{ textAlign: 'right' }"
    @after-open-change="onOpenChange"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="被委托人" name="delegateeId">
        <Select
          v-model:value="form.delegateeId"
          :options="userOptions"
          :disabled="isEdit"
          placeholder="选择被委托人"
          show-search
          option-filter-prop="label"
        />
      </a-form-item>

      <a-form-item label="生效时间" name="range">
        <a-range-picker v-model:value="form.range" show-time format="YYYY-MM-DD HH:mm" class="w-full" />
      </a-form-item>

      <a-form-item label="限定流程" name="defKeys">
        <Select
          v-model:value="form.defKeys"
          mode="multiple"
          :options="defOptions"
          placeholder="留空表示全部流程"
          allow-clear
          show-search
        />
      </a-form-item>

      <a-form-item label="备注" name="reason">
        <a-textarea v-model:value="form.reason" :rows="3" :maxlength="512" show-count />
      </a-form-item>
    </a-form>
  </a-drawer>
</template>

<script setup lang="ts">
import { message, Select, type FormInstance, type FormProps } from 'antdv-next'
import dayjs, { type Dayjs } from 'dayjs'
import { computed, onMounted, reactive, ref } from 'vue'

import type { WfDelegateItem } from '~/api/workflow'

import { createDelegate, getDefinitionList, getUserAllOptions, updateDelegate } from '~/api'

defineOptions({ name: 'DelegateEditorDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ record: WfDelegateItem | null }>()
const emit = defineEmits<{ success: [] }>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const userOptions = ref<{ label: string; value: string }[]>([])
const defOptions = ref<{ label: string; value: string }[]>([])

const isEdit = computed(() => !!props.record)

const form = reactive<{
  delegateeId?: string
  range: [Dayjs, Dayjs] | null
  defKeys: string[]
  reason: string
}>({
  delegateeId: undefined,
  range: null,
  defKeys: [],
  reason: '',
})

const rules: FormProps['rules'] = {
  delegateeId: [{ required: true, message: '请选择被委托人', trigger: 'change' }],
  range: [{ required: true, message: '请选择生效时间', trigger: 'change' }],
}

onMounted(async () => {
  try {
    const [users, defs]: any[] = await Promise.all([getUserAllOptions(), getDefinitionList({ pageSize: 100 })])
    userOptions.value = (users?.data ?? users ?? []).map((u: any) => ({
      label: u.realName || u.username,
      value: u.userId,
    }))
    defOptions.value = (defs?.data?.list ?? []).map((d: any) => ({
      label: d.def_name,
      value: d.def_key,
    }))
  } catch {
    /* ignore */
  }
})

function onOpenChange(v: boolean) {
  if (!v) return
  if (props.record) {
    form.delegateeId = props.record.delegateeId
    form.range = [dayjs(props.record.startAt), dayjs(props.record.endAt)]
    form.defKeys = props.record.defKeys ?? []
    form.reason = props.record.reason ?? ''
  } else {
    form.delegateeId = undefined
    form.range = null
    form.defKeys = []
    form.reason = ''
  }
}

async function handleOk() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (!form.range) return

  const payload = {
    delegateeId: form.delegateeId!,
    startAt: form.range[0].toISOString(),
    endAt: form.range[1].toISOString(),
    defKeys: form.defKeys.length > 0 ? form.defKeys : undefined,
    reason: form.reason || undefined,
  }

  submitting.value = true
  try {
    if (isEdit.value && props.record) {
      await updateDelegate(props.record.delegateId, payload)
      message.success('更新成功')
    } else {
      await createDelegate(payload)
      message.success('创建成功')
    }
    open.value = false
    emit('success')
  } finally {
    submitting.value = false
  }
}

defineExpose({ handleOk })
</script>
