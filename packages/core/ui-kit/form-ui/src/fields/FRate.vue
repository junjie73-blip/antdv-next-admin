<script setup lang="ts">
import { cn } from '@antdv/shared/utils/cn';

interface Props {
  allowHalf?: boolean;
  count?: number;
  disabled?: boolean;
  id?: string;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  allowHalf: false,
  count: 5,
  disabled: false,
  value: 0,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

function starFilled(index: number): 'full' | 'half' | 'none' {
  const v = Number(props.value) || 0;
  if (v >= index) return 'full';
  if (props.allowHalf && v >= index - 0.5) return 'half';
  return 'none';
}

function pick(index: number, event: MouseEvent) {
  if (props.disabled) return;
  if (props.allowHalf) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    emit('update:value', isLeftHalf ? index - 0.5 : index);
  } else {
    emit('update:value', props.value === index ? 0 : index);
  }
}
</script>

<template>
  <div class="flex items-center gap-0.5" :id="id" data-field-control>
    <button
      v-for="i in count"
      :key="i"
      type="button"
      :disabled="disabled"
      class="cursor-pointer text-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      :aria-label="`评分 ${i}`"
      @click="pick(i, $event)"
    >
      <span :class="cn('relative inline-block')">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          :fill="starFilled(i) === 'full' ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="starFilled(i) === 'none' && 'text-muted-foreground'"
        >
          <polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          />
        </svg>
        <svg
          v-if="starFilled(i) === 'half'"
          xmlns="http://www.w3.org/2000/svg"
          class="absolute inset-0"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="clip-path: inset(0 50% 0 0)"
        >
          <polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          />
        </svg>
      </span>
    </button>
  </div>
</template>
