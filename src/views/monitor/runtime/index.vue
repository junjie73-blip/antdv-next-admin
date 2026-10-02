<template>
  <MonitorTabView :tabs="tabs" default-key="service" />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

import MonitorTabView from '../components/MonitorTabView.vue'

defineOptions({ name: 'MonitorRuntime' })

const tabs = [
  {
    key: 'service',
    label: '服务监控',
    icon: () => h(Icon, { icon: 'carbon:server-dns' }),
    component: () => import('./server/index.vue'),
  },
  {
    key: 'database',
    label: '数据库监控',
    icon: () => h(Icon, { icon: 'carbon:data-base' }),
    component: () => import('./database/index.vue'),
  },
  {
    key: 'cache',
    label: '缓存监控',
    icon: () => h(Icon, { icon: 'carbon:data-vis-1' }),
    component: () => import('./cache/index.vue'),
  },
  {
    key: 'qps',
    label: 'QPS 监控',
    icon: () => h(Icon, { icon: 'carbon:chart-line' }),
    component: () => import('./qps/index.vue'),
  },
  {
    key: 'queue',
    label: '队列监控',
    icon: () => h(Icon, { icon: 'carbon:data-vis-2' }),
    component: () => import('./queue/index.vue'),
  },
]
</script>
