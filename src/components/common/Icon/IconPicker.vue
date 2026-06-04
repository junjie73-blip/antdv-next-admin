<script setup lang="ts">
import carbonIcons from '@iconify/json/json/carbon.json'
import phIcons from '@iconify/json/json/ph.json'
import tablerIcons from '@iconify/json/json/tabler.json'
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import { cn } from '@/utils/cn'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

interface CollectionInfo {
  prefix: string
  name: string
  total: number
}

interface IconRow {
  id: number
  icons: string[]
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

const GRID_COLS = 10
const ROW_HEIGHT = 48
const CONTAINER_HEIGHT = 400

const visible = ref(false)
const searchValue = ref('')
const allIcons = ref<string[]>([])
const filteredIcons = ref<string[]>([])
const selectedPrefix = ref('all')

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

const iconRows = computed<IconRow[]>(() => {
  const rows: IconRow[] = []
  for (let i = 0; i < filteredIcons.value.length; i += GRID_COLS) {
    rows.push({
      id: i,
      icons: filteredIcons.value.slice(i, i + GRID_COLS),
    })
  }
  return rows
})

const segmentOptions = computed(() => {
  const options: { label: string, value: string }[] = [
    { label: '全部', value: 'all' },
  ]
  for (const col of COLLECTIONS) {
    options.push({ label: `${col.name} (${col.total})`, value: col.prefix })
  }
  return options
})

function applyFilter() {
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
    'w-8 h-8 rounded',
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
const popoverContentClassName = cn('w-[520px]')
const gridRowClassName = cn('grid grid-cols-10 gap-1.5')
const scrollerContainerClassName = cn('flex-1 mt-3')
const totalInfoClassName = cn(
  'flex items-center justify-between',
  'pt-3 mt-3',
  'border-t border-gray-200 dark:border-gray-700',
)
const countClassName = cn('text-xs text-gray-500 dark:text-gray-400')
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

        <div class="my-2">
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
          <RecycleScroller
            :items="iconRows"
            :item-size="ROW_HEIGHT"
            key-field="id"
            :style="{ height: `${CONTAINER_HEIGHT}px` }"
            class="scroller"
          >
            <template #default="{ item }">
              <div :class="gridRowClassName">
                <a-tooltip
                  v-for="icon in item.icons"
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
                      :width="18"
                    />
                  </div>
                </a-tooltip>
              </div>
            </template>
          </RecycleScroller>
        </div>

        <div
          v-if="filteredIcons.length > 0"
          :class="totalInfoClassName"
        >
          <span :class="countClassName">
            共 {{ filteredIcons.length }} 个图标
          </span>
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

.scroller {
  padding: 0;
}
</style>
