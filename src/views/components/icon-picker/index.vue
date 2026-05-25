<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'antdv-next'
import { Icon } from '@iconify/vue'
import { IconPicker } from '@/components/common/Icon'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')
const twinContainerClassName = cn('grid grid-cols-2 gap-4')
const infoBoxClassName = cn(
  'flex items-center gap-2 mt-4 p-3 rounded-lg',
  'bg-blue-50 dark:bg-blue-900/20',
  'border border-blue-200 dark:border-blue-800',
)
const infoIconClassName = cn('text-blue-500 text-lg flex-shrink-0')
const infoTextClassName = cn('text-sm text-blue-700 dark:text-blue-300 font-mono')

const selectedIcon = ref('')
const defaultIcon = ref('carbon:star-filled')
const disabledValue = ref('carbon:lock-locked')

const leftIcon = ref('')
const rightIcon = ref('')

function handleBasicChange(value: string) {
  message.success(`Selected icon: ${value || '(cleared)'}`)
}

function handleLeftChange(value: string) {
  message.info(`Left icon changed to: ${value || '(cleared)'}`)
}

function handleRightChange(value: string) {
  message.info(`Right icon changed to: ${value || '(cleared)'}`)
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="Basic Usage" variant="borderless">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Click the input to open the icon picker. Search or browse icon collections and
        click an icon to select it.
      </p>
      <div class="max-w-md">
        <IconPicker v-model="selectedIcon" placeholder="Click to select an icon" @change="handleBasicChange" />
        <div :class="infoBoxClassName">
          <Icon icon="carbon:information" :class="infoIconClassName" />
          <span :class="infoTextClassName">
            Selected: {{ selectedIcon || '(none)' }}
          </span>
        </div>
      </div>
    </a-card>

    <a-card title="Default Value" variant="borderless">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Provide an initial icon value via <code>v-model</code>. In this example,
        <code>carbon:star-filled</code> is pre-selected.
      </p>
      <div class="max-w-md">
        <IconPicker v-model="defaultIcon" placeholder="Has default icon" />
        <div :class="infoBoxClassName">
          <Icon icon="carbon:information" :class="infoIconClassName" />
          <span :class="infoTextClassName">
            Default: {{ defaultIcon }}
          </span>
        </div>
      </div>
    </a-card>

    <a-card title="Disabled (Read-only)" variant="borderless">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Set <code>:disabled=&quot;true&quot;</code> to prevent user interaction.
      </p>
      <div class="max-w-md">
        <IconPicker v-model="disabledValue" disabled placeholder="This picker is disabled" />
      </div>
    </a-card>

    <a-card title="Multiple Instances" variant="borderless">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Two independent icon pickers side by side, each with its own state.
      </p>
      <div :class="twinContainerClassName">
        <div>
          <label class="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
            Left Picker
          </label>
          <IconPicker v-model="leftIcon" placeholder="Pick left icon" @change="handleLeftChange" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
            Right Picker
          </label>
          <IconPicker v-model="rightIcon" placeholder="Pick right icon" @change="handleRightChange" />
        </div>
      </div>
    </a-card>

    <a-card title="Change Event" variant="borderless">
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        The <code>@change</code> event fires every time the icon selection changes,
        including clearing. A <code>message</code> toast is shown with the selected value.
      </p>
      <div class="max-w-md">
        <IconPicker v-model="selectedIcon" placeholder="Select an icon to see the toast" @change="handleBasicChange" />
      </div>
    </a-card>
  </div>
</template>