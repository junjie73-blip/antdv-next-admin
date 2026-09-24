<script setup lang="ts">
import { Icon } from '@iconify/vue'

import { groupBoxClassName, groupIconClassName, groupTitleClassName } from '../constants'

defineOptions({ name: 'SettingGroup' })

defineProps<{
  title: string
  icon: string
}>()
</script>

<template>
  <section>
    <div :class="groupTitleClassName">
      <div :class="groupIconClassName">
        <Icon :icon="icon" />
      </div>
      <span>{{ title }}</span>
    </div>
    <div :class="groupBoxClassName">
      <slot />
    </div>
  </section>
</template>
