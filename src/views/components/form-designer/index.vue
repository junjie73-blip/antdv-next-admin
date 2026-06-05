<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { cn } from '@/utils/cn'

defineOptions({ name: 'FormDesigner' })

const designerRef = useTemplateRef('designerRef')

// 设计器配置
const designerConfig = {
  showSaveBtn: true,
  showPreviewBtn: true,
  showConfig: true,
  showBaseForm: true,
  showPropsForm: true,
  showEventForm: true,
  showValidateForm: true,
  showStyleForm: true,
  showFormConfig: true,
  showComponentName: true,
  showControl: true,
  showJsonPreview: true,
  showAi: false,
  showMenuBar: true,
  autoActive: true,
}

const containerClassName = cn(
  'h-[calc(100vh-88px)]',
  'bg-gray-100 dark:bg-gray-900',
)
</script>

<template>
  <div :class="containerClassName">
    <fc-designer
      ref="designerRef"
      height="100%"
      :config="designerConfig"
    />
  </div>
</template>
