<script setup lang="ts">
import { useAuthStyles } from '../composables/useAuthStyles'

defineOptions({ name: 'AuthFormPanel' })

defineProps<{
  appTitle: string
  logo: string
}>()

const { formPanelClassName, formWrapClassName } = useAuthStyles()
</script>

<template>
  <div :class="formPanelClassName">
    <div :class="formWrapClassName">
      <!-- 移动端 Logo -->
      <div class="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
        <div
          class="bg-ant-primary flex h-10 w-10 items-center justify-center rounded-xl text-white"
        >
          <img :src="logo" :alt="appTitle" class="h-6 w-6 object-contain" />
        </div>
        <span
          class="text-base font-semibold text-slate-800 dark:text-slate-100"
        >
          {{ appTitle }}
        </span>
      </div>

      <slot />
    </div>
  </div>
</template>
