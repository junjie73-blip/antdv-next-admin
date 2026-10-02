<template>
  <div class="code-editor">
    <Codemirror
      v-model="model"
      :style="{ height: height, fontSize: '13px' }"
      :autofocus="false"
      :indent-with-tab="true"
      :tab-size="2"
      :extensions="extensions"
      @change="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import { javascript } from '@codemirror/lang-javascript'
import { sql } from '@codemirror/lang-sql'
import { vue } from '@codemirror/lang-vue'
import { oneDark } from '@codemirror/theme-one-dark'
import { computed } from 'vue'
import { Codemirror } from 'vue-codemirror'

defineOptions({ name: 'CodeEditor' })

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    language?: 'typescript' | 'vue' | 'sql' | 'javascript'
    height?: string
    readonly?: boolean
    dark?: boolean
  }>(),
  {
    language: 'typescript',
    height: '420px',
    readonly: false,
    dark: false,
  },
)

const extensions = computed(() => {
  const base: any[] = []
  switch (props.language) {
    case 'vue':
      base.push(vue())
      break
    case 'sql':
      base.push(sql())
      break
    case 'javascript':
      base.push(javascript())
      break
    default:
      base.push(javascript({ typescript: true }))
  }
  if (props.dark) base.push(oneDark)
  return base
})

function onChange(_v: string) {
  /* 由 v-model 处理 */
}
</script>

<style scoped>
.code-editor :deep(.cm-editor) {
  border-radius: 8px;
  border: 1px solid rgb(229 231 235);
}
.code-editor :deep(.cm-editor.cm-focused) {
  outline: 2px solid rgb(59 130 246);
  outline-offset: -1px;
}
</style>
