<script setup lang="ts">
import carbonIcons from '@iconify/json/json/carbon.json'
import phIcons from '@iconify/json/json/ph.json'
import tablerIcons from '@iconify/json/json/tabler.json'
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { cn } from '@/utils/cn'

interface CollectionInfo {
  prefix: string
  name: string
  total: number
}

interface CollectionInfo {
  prefix: string
  name: string
  total: number
}

interface Props {
  modelValue?: string
  currentIcon?: string
  placeholder?: string
  disabled?: boolean
  size?: 'small' | 'middle' | 'large'
  allowClear?: boolean
  defaultPrefix?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  currentIcon: '',
  placeholder: '选择一个图标',
  disabled: false,
  size: 'middle',
  allowClear: true,
  defaultPrefix: 'carbon',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
  'select': [value: string]
}>()

type IconData = typeof carbonIcons

const COLLECTION_MAP: Record<string, IconData> = {
  carbon: carbonIcons,
  ph: phIcons,
  tabler: tablerIcons,
}

const COLLECTIONS: CollectionInfo[] = [
  { prefix: 'carbon', name: 'Carbon', total: Object.keys(carbonIcons.icons).length },
  { prefix: 'ph', name: 'Phosphor', total: Object.keys(phIcons.icons).length },
  { prefix: 'tabler', name: 'Tabler', total: Object.keys(tablerIcons.icons).length },
]

/** 每行显示的图标数 */
const GRID_COLS = 8
/** 图标容器高度 */
const CONTAINER_HEIGHT = 440
/** 默认每页数量 */
const DEFAULT_PAGE_SIZE = 80

const visible = ref(false)
const searchValue = ref('')
const allIcons = ref<string[]>([])
const filteredIcons = ref<string[]>([])
const selectedPrefix = ref('all')
/** 当前页码 */
const currentPage = ref(1)
/** 每页条数 */
const pageSize = ref(DEFAULT_PAGE_SIZE)

const selectedIcon = computed(() => props.modelValue || props.currentIcon)

function loadAllFromLocal() {
  const icons: string[] = []
  for (const col of COLLECTIONS) {
    const data = COLLECTION_MAP[col.prefix]
    if (data) {
      const names = Object.keys(data.icons)
      col.total = names.length
      icons.push(...names.map(name => `${col.prefix}:${name}`))
    }
  }
  allIcons.value = icons
}

/** 当前页的图标数据（扁平数组，由整体 grid 布局自动换行） */
const pagedIcons = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredIcons.value.slice(start, end)
})

/** 总条数 */
const totalCount = computed(() => filteredIcons.value.length)

const segmentOptions = computed(() => {
  const options: { label: string, value: string }[] = [
    { label: '全部', value: 'all' },
  ]
  for (const col of COLLECTIONS) {
    options.push({ label: `${col.name} `, value: col.prefix })
  }
  return options
})

function applyFilter() {
  // 切换分类或搜索时重置到第一页
  currentPage.value = 1
  let source = allIcons.value

  if (selectedPrefix.value !== 'all') {
    source = source.filter(icon => icon.startsWith(`${selectedPrefix.value}:`))
  }

  const query = searchValue.value.trim().toLowerCase()
  if (query) {
    source = source.filter((icon) => {
      const [, name] = icon.split(':')
      return name.toLowerCase().includes(query)
    })
  }

  filteredIcons.value = source
}

function handleSelectIcon(icon: string) {
  emit('update:modelValue', icon)
  emit('change', icon)
  emit('select', icon)
  visible.value = false
}

function handleClear() {
  emit('update:modelValue', '')
  emit('change', '')
}

function handleSegmentChange(value: string) {
  selectedPrefix.value = value
  searchValue.value = ''
  applyFilter()
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchValue, () => {
  if (searchTimeout)
    clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    applyFilter()
  }, 200)
})

watch(visible, (val) => {
  if (val && allIcons.value.length === 0) {
    loadAllFromLocal()
    applyFilter()
  }
})

if (allIcons.value.length === 0) {
  loadAllFromLocal()
  applyFilter()
}

onBeforeUnmount(() => {
  if (searchTimeout)
    clearTimeout(searchTimeout)
})

function iconItemClassName(icon: string) {
  return cn(
    'flex items-center justify-center',
    'w-14 h-14 rounded-lg',
    'border border-gray-200 dark:border-gray-700',
    'hover:bg-blue-50 hover:border-blue-400 dark:hover:bg-blue-900/30 dark:hover:border-blue-500',
    'cursor-pointer transition-all duration-150',
    'hover:scale-110 active:scale-95',
    {
      'bg-blue-50 border-blue-500 dark:bg-blue-900/30 dark:border-blue-500':
        selectedIcon.value === icon,
    },
  )
}

const inputClassName = cn('cursor-pointer')
const popoverContentClassName = cn('w-[580px]')
const gridRowClassName = cn('grid grid-cols-8 gap-2 p-1')
const scrollerContainerClassName = cn('mt-3 ')
const countClassName = cn('text-xs text-gray-500 dark:text-gray-400')
const paginationWrapperClassName = cn(
  'flex items-center justify-between pt-3 mt-3',
  'border-t border-gray-200 dark:border-gray-700',
)
</script>

<template>
  <a-popover
    v-model:open="visible"
    trigger="click"
    placement="bottomLeft"
    :disabled="props.disabled"
    overlay-class-name="icon-picker-popover"
  >
    <template #content>
      <div :class="popoverContentClassName">
        <a-segmented
          v-model:value="selectedPrefix"
          :options="segmentOptions"
          block
          class="mb-6"
          @change="(val: any) => handleSegmentChange(val)"
        />

        <div class="my-4">
          <a-input
            v-model:value="searchValue"
            placeholder="搜索图标..."
            allow-clear
          >
            <template #prefix>
              <Icon
                icon="carbon:search"
                :width="14"
              />
            </template>
          </a-input>
        </div>

        <div
          v-if="filteredIcons.length === 0"
          class="py-10"
        >
          <a-empty description="暂无图标" />
        </div>

        <div
          v-else
          :class="scrollerContainerClassName"
        >
          <PerfectScrollbar :options="{ wheelPropagation: true, suppressScrollX: true }" :style="{ height: `${CONTAINER_HEIGHT}px` }">
            <!-- 整体 grid 容器，CSS Grid 自动换行 -->
            <div :class="gridRowClassName">
              <a-tooltip
                v-for="icon in pagedIcons"
                :key="icon"
                :title="icon"
                placement="top"
                :auto-adjust="false"
              >
                <div
                  :class="iconItemClassName(icon)"
                  @click="handleSelectIcon(icon)"
                >
                  <Icon
                    :icon="icon"
                    :width="20"
                  />
                </div>
              </a-tooltip>
            </div>
          </PerfectScrollbar>
        </div>

        <!-- 使用 Antdv Next 分页组件 -->
        <div
          v-if="totalCount > 0"
          :class="paginationWrapperClassName"
        >
          <span :class="countClassName">共 {{ totalCount }} 个图标</span>
          <a-pagination
            v-model:current="currentPage"
            v-model:page-size="pageSize"
            :total="totalCount"
            size="small"
            :show-total="(total: number) => ''"
            :show-size-changer="true"
            :page-size-options="[50, 80, 100, 200]"
            :show-quick-jumper="true"
            simple
          />
        </div>
      </div>
    </template>

    <div :class="inputClassName">
      <a-input
        :value="selectedIcon"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        :size="props.size"
        readonly
        :allow-clear="props.allowClear && !!selectedIcon"
        @clear="handleClear"
      >
        <template
          v-if="selectedIcon"
          #prefix
        >
          <Icon
            :icon="selectedIcon"
            :width="16"
          />
        </template>
        <template #suffix>
          <Icon
            icon="carbon:chevron-down"
            :width="14"
            class="text-gray-400"
          />
        </template>
      </a-input>
    </div>
  </a-popover>
</template>

<style scoped>
.icon-picker-popover :deep(.ant-popover-inner) {
  padding: 12px;
}
</style>
