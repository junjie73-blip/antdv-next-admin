<script setup lang="ts">
import type { AuthColorPreset, AuthColorPresetsProps } from './types';

import { computed } from 'vue';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'AuthColorPresets' });

const props = withDefaults(defineProps<AuthColorPresetsProps>(), {
  current: '',
  label: '',
  presets: () => [],
});

const emit = defineEmits<{
  select: [preset: AuthColorPreset];
}>();

/**
 * 比对只看色值本身：偏好里的 `primaryColor` 可能是取色器写的 `rgb()` 串，
 * 与预设的十六进制对不上时**一颗都不高亮**，而不是硬凑成最接近的那颗 ——
 * 高亮错了等于告诉用户"你选的就是这个"，比不高亮更容易误导。
 */
function isActive(preset: AuthColorPreset): boolean {
  const current = props.current.trim().toLowerCase();
  if (!current) return false;
  const target = preset.color.trim().toLowerCase();
  if (current === target) return true;
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/u.exec(current);
  if (!rgb) return false;
  const hex = `#${[rgb[1], rgb[2], rgb[3]]
    .map((part) => Number(part).toString(16).padStart(2, '0'))
    .join('')}`;
  return hex === target;
}

const dotStyle = computed(() =>
  props.current ? { background: props.current } : undefined,
);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        :aria-label="props.label"
        :title="props.label"
        class="hover:bg-background/70 flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors"
        data-auth="color-presets-trigger"
        type="button"
      >
        <span
          class="ring-input size-4 rounded-full ring-1 ring-inset"
          :style="dotStyle"
        ></span>
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="w-auto min-w-0 p-2" side="bottom">
      <!-- 色块本身就是文案：写上档位名只会把面板撑宽，无障碍名交给 aria-label -->
      <div class="grid grid-cols-7 gap-1.5">
        <DropdownMenuItem
          v-for="preset in props.presets"
          :key="preset.key"
          :aria-label="preset.key"
          :class="
            cn(
              'hover:bg-transparent flex size-6 items-center justify-center rounded-full p-0',
              isActive(preset) && 'ring-primary ring-2',
            )
          "
          :data-auth="`color-preset-${preset.key}`"
          @click="emit('select', preset)"
        >
          <span
            class="ring-black/10 size-4 rounded-full ring-1 ring-inset"
            :style="{ background: preset.color }"
          ></span>
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
