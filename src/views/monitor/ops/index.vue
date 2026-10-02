<template>
  <MonitorTabView :tabs="tabs" default-key="online" />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

import MonitorTabView from '../components/MonitorTabView.vue'

defineOptions({ name: 'MonitorOps' })

const tabs = [
  {
    key: 'online',
    label: '在线用户',
    icon: () => h(Icon, { icon: 'carbon:user-multiple' }),
    component: () => import('./online/index.vue'),
  },
  {
    key: 'job',
    label: '定时任务',
    icon: () => h(Icon, { icon: 'carbon:time' }),
    component: () => import('./job/index.vue'),
  },
  {
    key: 'slow-query',
    label: '慢查询分析',
    icon: () => h(Icon, { icon: 'carbon:meter' }),
    component: () => import('./slow-query/index.vue'),
  },
  {
    key: 'backup',
    label: '数据库备份',
    icon: () => h(Icon, { icon: 'lucide:database' }),
    component: () => import('./backup/index.vue'),
  },
]
</script>
