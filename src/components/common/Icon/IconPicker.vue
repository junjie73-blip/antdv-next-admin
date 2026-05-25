<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { cn } from '@/utils/cn'

interface CollectionInfo {
  prefix: string
  name: string
  total: number
}

interface Props {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  size?: 'small' | 'middle' | 'large'
  allowClear?: boolean
  limit?: number
  defaultPrefix?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Select an icon',
  disabled: false,
  size: 'middle',
  allowClear: true,
  limit: 200,
  defaultPrefix: 'carbon',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
}>()

const ICON_COLLECTIONS: CollectionInfo[] = [
  { prefix: 'carbon', name: 'Carbon', total: 0 },
  { prefix: 'mdi', name: 'Material Design Icons', total: 0 },
  { prefix: 'ph', name: 'Phosphor', total: 0 },
  { prefix: 'tabler', name: 'Tabler Icons', total: 0 },
  { prefix: 'ri', name: 'Remix Icon', total: 0 },
  { prefix: 'ic', name: 'Google Material Icons', total: 0 },
]

const CARBON_ICONS = [
  'home', 'user', 'settings', 'search', 'add', 'close', 'checkmark', 'edit', 'delete', 'download',
  'upload', 'folder', 'file', 'document', 'image', 'video', 'audio', 'calendar', 'clock', 'star',
  'star-filled', 'heart', 'thumbs-up', 'share', 'bookmark', 'link', 'unlink', 'copy', 'paste', 'cut',
  'undo', 'redo', 'save', 'print', 'refresh', 'zoom-in', 'zoom-out', 'fit-to-screen', 'full-screen',
  'minimize', 'maximize', 'collapse-all', 'expand-all', 'menu', 'list', 'grid', 'table', 'chart',
  'bar', 'line', 'pie-chart', 'area', 'scatter-plot', 'radar', 'dashboard', 'filter', 'sort-ascending',
  'sort-descending', 'overflow-menu-horizontal', 'overflow-menu-vertical', 'drag-horizontal',
  'drag-vertical', 'move', 'pin', 'unpin', 'flag', 'tag', 'label', 'text-link', 'attachment',
  'microphone', 'headset', 'phone', 'email', 'chat', 'notification', 'notification-off', 'warning',
  'warning-alt', 'error', 'error-outline', 'help', 'help-filled', 'info', 'information', 'checkmark-outline',
  'close-outline', 'add-outline', 'subtract', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
  'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right', 'caret-up', 'caret-down', 'caret-left',
  'caret-right', 'up-to-top', 'launch', 'new-tab', 'rotate', 'shuffle', 'play', 'pause', 'stop',
  'play-outline', 'pause-outline', 'stop-outline', 'volume-up', 'volume-down', 'volume-mute', 'microphone',
  'microphone-off', 'video-off', 'camera', 'send', 'send-alt', 'reply', 'forward',
  'user-avatar', 'user-avatar-filled', 'user-identification', 'group', 'events', 'collaborate',
  'locked', 'unlocked', 'view', 'view-off', 'visibility', 'visibility-off', 'light', 'light-filled',
  'moon', 'sun', 'rain', 'cloud', 'umbrella', 'snow', 'weather-station', 'temperature',
  'code', 'terminal', 'application', 'apps', 'development', 'debug', 'wifi', 'bluetooth', 'data',
  'database', 'data-table', 'cloud-upload', 'cloud-download', 'server', 'router', 'connect',
  'shopping-cart', 'shopping-bag', 'store', 'money', 'wallet', 'purchase', 'gift', 'receipt',
  'location', 'location-filled', 'map', 'globe', 'compass', 'navigation', 'car', 'bus', 'airplane',
  'train', 'bicycle', 'walk', 'person', 'people',
  'education', 'book', 'clipboard', 'task', 'tasks', 'checklist', 'list-checked', 'list-boxes',
  'checkbox-checked', 'checkbox-indeterminate', 'radio-button-checked',
  'time', 'timer', 'alarm', 'hourglass', 'event-schedule',
  'color-palette', 'brush', 'paint-brush', 'pencil',
  'settings-adjust', 'settings-check', 'tool-box',
  'trash-can', 'restart', 'reset', 'reset-alt', 'power',
  'rocket', 'sparkles', 'badge', 'certificate', 'aperture',
]

const OTHER_ICONS: Record<string, string[]> = {
  mdi: ['home', 'account', 'cog', 'magnify', 'plus', 'close', 'check', 'pencil', 'delete', 'download',
    'upload', 'folder', 'file', 'calendar', 'clock', 'star', 'heart', 'thumb-up', 'share', 'bookmark',
    'link', 'content-copy', 'content-paste', 'content-cut', 'undo', 'redo', 'content-save', 'printer',
    'refresh', 'fullscreen', 'menu', 'view-list', 'view-grid', 'chart-bar', 'chart-line', 'filter',
    'sort', 'pin', 'flag', 'tag', 'email', 'chat', 'bell', 'alert', 'help-circle', 'information',
    'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'chevron-up', 'chevron-down', 'chevron-left',
    'chevron-right', 'open-in-new', 'play', 'pause', 'stop', 'volume-high', 'volume-off', 'camera',
    'send', 'reply', 'account-group', 'lock', 'eye', 'eye-off', 'weather-sunny', 'weather-night',
    'code-tags', 'wifi', 'bluetooth', 'database', 'cloud-upload', 'cloud-download', 'server', 'cart',
    'currency-usd', 'wallet', 'gift', 'map-marker', 'map', 'earth', 'compass', 'car', 'airplane',
    'school', 'book', 'clipboard-text', 'check-circle', 'palette', 'brush', 'wrench', 'delete-forever',
    'restart', 'power', 'rocket-launch'],
  ph: ['house', 'user', 'gear', 'magnifying-glass', 'plus', 'x', 'check', 'pencil-simple', 'trash',
    'download-simple', 'upload-simple', 'folder', 'file', 'calendar', 'clock', 'star', 'heart',
    'thumbs-up', 'share', 'bookmark-simple', 'link', 'copy', 'floppy-disk', 'arrow-counter-clockwise',
    'arrow-clockwise', 'arrows-out', 'list', 'squares-four', 'chart-bar', 'chart-line', 'funnel',
    'sort-ascending', 'push-pin', 'flag', 'tag', 'envelope', 'chat', 'bell', 'warning', 'question',
    'info', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'caret-up', 'caret-down',
    'caret-left', 'caret-right', 'arrow-square-out', 'play', 'pause', 'stop', 'speaker-high',
    'microphone', 'video-camera', 'camera', 'paper-plane-tilt', 'users', 'lock', 'eye', 'eye-slash',
    'sun', 'moon', 'code', 'wifi-high', 'bluetooth', 'database', 'cloud-arrow-up', 'cloud-arrow-down',
    'shopping-cart', 'currency-dollar', 'map-pin', 'globe', 'compass', 'car', 'airplane', 'book',
    'clipboard', 'circle', 'palette', 'wrench', 'rocket'],
  tabler: ['home', 'user', 'settings', 'search', 'plus', 'x', 'check', 'edit', 'trash', 'download',
    'upload', 'folder', 'file', 'calendar', 'clock', 'star', 'star-filled', 'heart', 'thumb-up',
    'share', 'bookmark', 'link', 'copy', 'clipboard', 'arrow-back-up', 'arrow-forward-up', 'device-floppy',
    'refresh', 'arrows-maximize', 'menu-2', 'list', 'layout-grid', 'chart-bar', 'chart-line', 'filter',
    'sort-ascending', 'pinned', 'flag', 'tag', 'mail', 'message', 'bell', 'alert-triangle', 'help',
    'info-circle', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'chevron-up', 'chevron-down',
    'chevron-left', 'chevron-right', 'external-link', 'player-play', 'player-pause', 'player-stop',
    'volume', 'volume-3', 'camera', 'send', 'arrow-back', 'users', 'lock', 'eye', 'eye-off',
    'sun', 'moon', 'code', 'wifi', 'bluetooth', 'database', 'cloud-upload', 'cloud-download',
    'shopping-cart', 'currency-dollar', 'map-pin', 'world', 'compass', 'car', 'plane', 'book',
    'clipboard-check', 'palette', 'tools', 'rocket'],
  ri: ['home', 'user', 'settings', 'search', 'add', 'close', 'check', 'edit', 'delete', 'download',
    'upload', 'folder', 'file', 'calendar', 'time', 'star', 'star-fill', 'heart', 'thumb-up',
    'share', 'bookmark', 'link', 'file-copy', 'clipboard', 'arrow-go-back', 'arrow-go-forward',
    'save', 'refresh', 'fullscreen', 'menu', 'list-check', 'layout-grid', 'bar-chart', 'line-chart',
    'filter', 'sort-asc', 'pushpin', 'flag', 'price-tag', 'mail', 'chat-3', 'notification', 'alarm',
    'question', 'information', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up-s',
    'arrow-down-s', 'arrow-left-s', 'arrow-right-s', 'external-link', 'play', 'pause', 'stop',
    'volume-up', 'camera', 'send-plane', 'team', 'lock', 'eye', 'eye-off', 'sun', 'moon',
    'code', 'wifi', 'bluetooth', 'database', 'cloud-upload', 'cloud-download', 'shopping-cart-2',
    'money-dollar', 'map-pin', 'earth', 'compass', 'car', 'flight', 'book', 'task', 'palette',
    'brush', 'tools', 'delete-back-2', 'restart', 'shut-down', 'rocket'],
  ic: ['home', 'person', 'settings', 'search', 'add', 'close', 'check', 'edit', 'delete', 'file-download',
    'file-upload', 'folder', 'description', 'calendar-today', 'access-time', 'star', 'star-border',
    'favorite', 'thumb-up', 'share', 'bookmark', 'link', 'content-copy', 'content-paste', 'undo',
    'redo', 'save', 'print', 'refresh', 'fullscreen', 'menu', 'view-list', 'grid-on', 'bar-chart',
    'show-chart', 'filter-list', 'sort', 'push-pin', 'flag', 'label', 'email', 'chat', 'notifications',
    'warning', 'help', 'info', 'arrow-upward', 'arrow-downward', 'arrow-back', 'arrow-forward',
    'expand-more', 'expand-less', 'chevron-left', 'chevron-right', 'open-in-new', 'play-arrow',
    'pause', 'stop', 'volume-up', 'mic', 'camera', 'send', 'group', 'lock', 'visibility', 'visibility-off',
    'wb-sunny', 'nights-stay', 'code', 'wifi', 'bluetooth', 'storage', 'cloud-upload', 'cloud-download',
    'dns', 'shopping-cart', 'attach-money', 'location-on', 'language', 'explore', 'directions-car',
    'flight', 'school', 'menu-book', 'assignment', 'palette', 'brush', 'build', 'delete-forever',
    'restart-alt', 'power-settings-new', 'rocket-launch'],
}

const ICON_DATA: Record<string, string[]> = {
  carbon: CARBON_ICONS,
  mdi: OTHER_ICONS.mdi,
  ph: OTHER_ICONS.ph,
  tabler: OTHER_ICONS.tabler,
  ri: OTHER_ICONS.ri,
  ic: OTHER_ICONS.ic,
}

const collections = ref<CollectionInfo[]>(
  ICON_COLLECTIONS.map(c => ({
    ...c,
    total: ICON_DATA[c.prefix]?.length || 0,
  })),
)

const visible = ref(false)
const searchValue = ref('')
const loading = ref(false)
const icons = ref<string[]>([])
const selectedPrefix = ref(props.defaultPrefix)

const selectedIcon = computed(() => props.modelValue)

const inputClassName = cn(
  'icon-picker-input',
  'cursor-pointer',
)

const iconGridClassName = cn(
  'icon-picker-grid',
  'grid grid-cols-6 gap-2',
  'max-h-[300px] overflow-y-auto',
  'p-2',
)

function iconItemClassName(icon: string) {
  return cn(
    'icon-picker-item',
    'flex items-center justify-center',
    'w-10 h-10 rounded-lg',
    'border border-gray-200 dark:border-gray-700',
    'hover:bg-gray-100 dark:hover:bg-gray-800',
    'cursor-pointer transition-all duration-200',
    {
      'bg-blue-50 border-blue-500 dark:bg-blue-900/30 dark:border-blue-500':
        selectedIcon.value === icon,
    },
  )
}

function loadIcons(prefix: string) {
  loading.value = true
  const data = ICON_DATA[prefix] || []
  icons.value = data.slice(0, props.limit).map(name => `${prefix}:${name}`)
  loading.value = false
}

function searchIconsLocal(query: string) {
  const data = ICON_DATA[selectedPrefix.value] || []
  const lowerQuery = query.toLowerCase()
  const filtered = data
    .filter(name => name.toLowerCase().includes(lowerQuery))
    .slice(0, props.limit)
    .map(name => `${selectedPrefix.value}:${name}`)

  icons.value = filtered
}

function handleSelectIcon(icon: string) {
  emit('update:modelValue', icon)
  emit('change', icon)
  visible.value = false
}

function handleClear() {
  emit('update:modelValue', '')
  emit('change', '')
}

function handlePrefixChange(prefix: string) {
  selectedPrefix.value = prefix
  searchValue.value = ''
  if (prefix) {
    loadIcons(prefix)
  }
  else {
    icons.value = []
  }
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchValue, (val) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(() => {
    if (val) {
      searchIconsLocal(val)
    }
    else if (selectedPrefix.value) {
      loadIcons(selectedPrefix.value)
    }
  }, 200)
})

watch(visible, (val) => {
  if (val && selectedPrefix.value && !searchValue.value) {
    loadIcons(selectedPrefix.value)
  }
})
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
      <div class="icon-picker-content w-[450px]">
        <div class="flex gap-2 mb-3">
          <a-input
            v-model:value="searchValue"
            placeholder="Search icons..."
            allow-clear
            size="small"
            class="flex-1"
          >
            <template #prefix>
              <Icon icon="carbon:search" :width="14" />
            </template>
          </a-input>

          <a-select
            v-model:value="selectedPrefix"
            placeholder="Select icon set"
            size="small"
            style="width: 150px"
            allow-clear
            @change="handlePrefixChange"
          >
            <a-select-option
              v-for="col in collections"
              :key="col.prefix"
              :value="col.prefix"
            >
              <div class="flex items-center justify-between">
                <span>{{ col.name }}</span>
                <span class="text-xs text-gray-400">{{ col.total }}</span>
              </div>
            </a-select-option>
          </a-select>
        </div>

        <div v-if="icons.length === 0" class="py-8">
          <a-empty description="Select an icon set" />
        </div>

        <div v-else :class="iconGridClassName">
          <div
            v-for="icon in icons"
            :key="icon"
            :class="iconItemClassName(icon)"
            :title="icon"
            @click="handleSelectIcon(icon)"
          >
            <Icon :icon="icon" :width="20" />
          </div>
        </div>

        <div v-if="icons.length > 0" class="text-xs text-gray-400 text-center mt-2">
          {{ icons.length }} icons
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
        <template v-if="selectedIcon" #prefix>
          <Icon :icon="selectedIcon" :width="16" />
        </template>
        <template #suffix>
          <Icon icon="carbon:chevron-down" :width="14" class="text-gray-400" />
        </template>
      </a-input>
    </div>
  </a-popover>
</template>

<style scoped>
.icon-picker-content {
  max-height: 450px;
}

.icon-picker-item:hover {
  transform: scale(1.1);
}

.icon-picker-item:active {
  transform: scale(0.95);
}
</style>