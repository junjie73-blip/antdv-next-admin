<script setup lang="ts">
import type { AppRouteRecordRaw } from '#/app-router'

import { Icon } from '@iconify/vue'
import { Input } from 'antdv-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRouteStore } from '@/stores/modules/route'
import { cn } from '@/utils/cn'

defineOptions({
  name: 'MenuSearch',
})

const visible = defineModel<boolean>('visible', { default: false })

const router = useRouter()
const routeStore = useRouteStore()
const searchValue = ref('')

interface MenuItem {
  title: string
  path: string
  icon?: string
}

function flattenRoutes(routes: AppRouteRecordRaw[], parentPath = ''): MenuItem[] {
  const result: MenuItem[] = []

  routes.forEach((route) => {
    if (route.meta?.hidden)
      return

    const fullPath = route.path.startsWith('/') ? route.path : `${parentPath}/${route.path}`.replace(/\/+/g, '/')

    if (route.meta?.title) {
      result.push({
        title: String(route.meta.title),
        path: fullPath,
        icon: route.meta.icon,
      })
    }

    if (route.children) {
      result.push(...flattenRoutes(route.children, fullPath))
    }
  })

  return result
}

const allMenus = computed(() => flattenRoutes(routeStore.routes))

const filteredMenus = computed(() => {
  if (!searchValue.value)
    return allMenus.value

  const keyword = searchValue.value.toLowerCase()
  return allMenus.value.filter(menu =>
    menu.title.toLowerCase().includes(keyword)
    || menu.path.toLowerCase().includes(keyword),
  )
})

function handleSelect(menu: MenuItem) {
  router.push(menu.path)
  visible.value = false
  searchValue.value = ''
}

function handleClose() {
  visible.value = false
  searchValue.value = ''
}
</script>

<template>
  <a-modal
    v-model:open="visible"
    :footer="null"
    :closable="false"
    :width="500"
    centered
    class="menu-search-modal"
    @cancel="handleClose"
  >
    <div class="p-4">
      <Input
        v-model:value="searchValue"
        placeholder="搜索菜单..."
        size="large"
        allow-clear
        autofocus
      >
        <template #prefix>
          <Icon
            icon="carbon:search"
            class="text-lg text-gray-400"
          />
        </template>
      </Input>

      <div class="mt-4 max-h-[400px] overflow-y-auto">
        <div
          v-for="menu in filteredMenus"
          :key="menu.path"
          :class="cn(
            'flex items-center gap-3 px-3 py-2 rounded cursor-pointer',
            'transition-colors duration-200',
            'hover:bg-gray-100 dark:hover:bg-gray-700',
          )"
          @click="handleSelect(menu)"
        >
          <Icon
            v-if="menu.icon"
            :icon="menu.icon"
            class="text-lg text-gray-500"
          />
          <Icon
            v-else
            icon="carbon:document"
            class="text-lg text-gray-400"
          />
          <div class="flex-1">
            <div class="text-sm font-medium">
              {{ menu.title }}
            </div>
            <div class="text-xs text-gray-400">
              {{ menu.path }}
            </div>
          </div>
          <Icon
            icon="carbon:arrow-right"
            class="text-gray-400"
          />
        </div>

        <div
          v-if="filteredMenus.length === 0 && searchValue"
          class="py-8 text-center text-gray-400"
        >
          <Icon
            icon="carbon:search-locate"
            class="text-4xl mb-2"
          />
          <div>未找到相关菜单</div>
        </div>

        <div
          v-if="!searchValue"
          class="py-4 text-center text-gray-400 text-sm"
        >
          输入关键词搜索菜单
        </div>
      </div>
    </div>
  </a-modal>
</template>
