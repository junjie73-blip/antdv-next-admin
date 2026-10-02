<template>
  <a-drawer
    v-model:open="open"
    :title="isEdit ? '编辑模板' : '新增模板'"
    :width="880"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <template #extra>
      <a-space>
        <a-button @click="open = false">取消</a-button>
        <a-button type="primary" :loading="saving" @click="handleSave"> 保存 </a-button>
      </a-space>
    </template>

    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="模板标识" name="templateKey">
            <a-input
              v-model:value="form.templateKey"
              :disabled="isEdit"
              placeholder="如：controller.hbs"
              :maxlength="128"
            />
            <div class="mt-1 text-xs text-gray-400">字母开头，含字母数字下划线点号中划线</div>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="模板名称" name="templateName">
            <a-input v-model:value="form.templateName" :maxlength="128" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="分类" name="category">
        <a-radio-group v-model:value="form.category" button-style="solid" :disabled="isEdit">
          <a-radio-button value="backend">后端</a-radio-button>
          <a-radio-button value="frontend">前端</a-radio-button>
          <a-radio-button value="sql">SQL</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="变更说明" name="changelog">
        <a-input v-model:value="form.changelog" placeholder="本次修改的内容（可选）" :maxlength="512" />
      </a-form-item>

      <a-form-item label="模板内容" name="content">
        <CodeEditor v-model="form.content" :language="editorLanguage" height="500px" />
        <div class="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span
            >使用 Handlebars 语法，如 <code v-pre>{{ className }}</code></span
          >
          <span>{{ form.content.length }} 字符</span>
        </div>
      </a-form-item>
    </a-form>
  </a-drawer>
</template>

<script setup lang="ts">
import { message, type FormInstance, type FormProps } from 'antdv-next'
import { computed, reactive, ref } from 'vue'

import {
  createGenTemplate,
  getGenTemplateDetail,
  updateGenTemplate,
  type GenTemplateRecord,
  type TemplateCategory,
} from '../api'
import { CATEGORY_LANGUAGE } from '../constants'
import CodeEditor from './CodeEditor.vue'

defineOptions({ name: 'TemplateEditorDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ record: GenTemplateRecord | null }>()
const emit = defineEmits<{ success: [] }>()

const formRef = ref<FormInstance>()
const saving = ref(false)

const isEdit = computed(() => !!props.record)

const form = reactive<{
  templateKey: string
  templateName: string
  category: TemplateCategory
  changelog: string
  content: string
}>({
  templateKey: '',
  templateName: '',
  category: 'backend',
  changelog: '',
  content: '',
})

const editorLanguage = computed(() => (CATEGORY_LANGUAGE[form.category] ?? 'typescript') as any)

const rules: FormProps['rules'] = {
  templateKey: [
    { required: true, message: '请输入模板标识', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_.-]{0,127}$/,
      message: '字母开头，含字母数字下划线点号中划线',
      trigger: 'blur',
    },
  ],
  templateName: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  content: [{ required: true, message: '请输入模板内容', trigger: 'blur' }],
}

async function onOpenChange(v: boolean) {
  if (!v) return
  formRef.value?.clearValidate()

  if (props.record) {
    const res: any = await getGenTemplateDetail(props.record.templateId).catch(() => null)
    const d = res?.data ?? res ?? props.record
    form.templateKey = d.templateKey
    form.templateName = d.templateName
    form.category = d.category
    form.changelog = ''
    form.content = d.currentContent ?? ''
  } else {
    form.templateKey = ''
    form.templateName = ''
    form.category = 'backend'
    form.changelog = ''
    form.content = ''
  }
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    if (isEdit.value && props.record) {
      await updateGenTemplate(props.record.templateId, {
        templateName: form.templateName,
        content: form.content,
        changelog: form.changelog || undefined,
      })
      message.success('保存成功，内容变更将自动创建新版本')
    } else {
      await createGenTemplate({
        templateKey: form.templateKey,
        templateName: form.templateName,
        category: form.category,
        content: form.content,
        changelog: form.changelog || '初始版本',
      })
      message.success('创建成功')
    }
    open.value = false
    emit('success')
  } finally {
    saving.value = false
  }
}
</script>
