<template>
  <MonitorTabView :tabs="tabs" default-key="audit" />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

import MonitorTabView from '../components/MonitorTabView.vue'

defineOptions({ name: 'MonitorLogs' })

const tabs = [
  {
    key: 'audit',
    label: '系统日志',
    icon: () => h(Icon, { icon: 'carbon:document' }),
    component: () => import('./log/index.vue'),
  },
  {
    key: 'login',
    label: '登录日志',
    icon: () => h(Icon, { icon: 'carbon:login' }),
    component: () => import('./login-log/index.vue'),
  },
  {
    key: 'logs',
    label: '日志检索',
    icon: () => h(Icon, { icon: 'carbon:search' }),
    component: () => import('./logs/index.vue'),
  },
]
</script>
