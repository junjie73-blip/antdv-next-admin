<template>
  <div class="h-full">
    <a-tabs v-model:active-key="activeKey" :items="tabs" @change="handleChange" class="flex h-full flex-col">
      <template #labelRender="{ item }">
        {{ item.label }}
        <a-badge v-if="item.badge && item.badge > 0" :count="item.badge" :overflow-count="99" class="ml-0.5" />
      </template>
      <template #contentRender>
        <PerfectScrollbar class="h-full">
          <Suspense>
            <component :is="currentComponent" v-if="currentComponent" :key="activeKey" />
            <template #fallback>
              <div class="flex h-full items-center justify-center">
                <a-spin />
              </div>
            </template>
          </Suspense>
        </PerfectScrollbar>
      </template>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import type { TabPaneProps } from 'antdv-next'

import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

defineOptions({ name: 'MonitorTabView' })

export interface MonitorTabItem {
  key: string
  label: string
  icon?: TabPaneProps['icon']
  badge?: number
  component: () => Promise<any>
}

const props = defineProps<{
  tabs: MonitorTabItem[]
  defaultKey?: string
}>()

const route = useRoute()
// const router = useRouter();

const queryKey = 'tab'

const activeKey = ref<string>((route.query[queryKey] as string) || props.defaultKey || props.tabs[0]?.key || '')

// 已挂载过的 Tab 集合
const mountedKeys = ref<Set<string>>(new Set([activeKey.value]))

const currentComponent = computed(() => {
  const tab = props.tabs.find((t) => t.key === activeKey.value)
  if (!tab || !mountedKeys.value.has(tab.key)) return null
  return defineAsyncComponent(tab.component)
})

function handleChange(key: string) {
  activeKey.value = key
  mountedKeys.value.add(key)
  mountedKeys.value = new Set(mountedKeys.value)

  // router.replace({
  //   query: { ...route.query, [queryKey]: key },
  // });
}

// 响应浏览器前进/后退
watch(
  () => route.query[queryKey],
  (v) => {
    if (v && typeof v === 'string' && v !== activeKey.value) {
      activeKey.value = v
      mountedKeys.value.add(v)
    }
  },
)
</script>
<style scoped>
@reference '~/assets/styles/global.css';
:deep(.ant-tabs-body-holder) {
  flex: 1;
}
:deep(.ant-tabs-body),
:deep(.ant-tabs-content) {
  height: 100%;
}
:deep(.ant-tabs-tab-btn) {
  @apply inline-flex items-center gap-1.5;
}
</style>
