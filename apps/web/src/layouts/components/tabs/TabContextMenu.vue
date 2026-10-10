<script setup lang="ts">
import type { TabContextMenuPayload } from '@antdv/types';

import type { TabActionContext, TabActionItem } from './constants';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';

import { buildTabActions } from './constants';

defineOptions({ name: 'TabContextMenu' });

const props = defineProps<{
  /** 右键命中的标签；为空表示菜单关闭 */
  payload: null | TabContextMenuPayload;
  context: TabActionContext;
}>();

const emit = defineEmits<{
  action: [key: string, tabKey: string];
  close: [];
}>();

const MENU_WIDTH = 176;
// 菜单项补齐到 10 行（含分隔线）后原来写死的高度会低估，贴底时菜单仍会被裁掉
const MENU_HEIGHT = 330;
const menuRef = ref<HTMLDivElement | null>(null);

const items = computed<TabActionItem[]>(() => buildTabActions(props.context));

/**
 * 菜单位置：贴近视口边缘时自动收起，避免菜单被裁掉（右键菜单最常见的可用性坑）。
 */
const style = computed(() => {
  const payload = props.payload;
  if (!payload) return {};
  const left = Math.max(8, Math.min(payload.x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(8, Math.min(payload.y, window.innerHeight - MENU_HEIGHT - 8));
  return { left: `${left}px`, top: `${top}px` };
});

function onDocClick(event: Event) {
  if (!props.payload) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (menuRef.value?.contains(target)) return;
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (!props.payload) return;
  if (event.key === 'Escape') emit('close');
}

function onBlur() {
  if (!props.payload) return;
  emit('close');
}

/**
 * 监听在 mount 时一次性挂好，靠 `props.payload` 判空决定要不要关菜单。
 *
 * 旧写法是"打开菜单后下一帧再挂监听"（为了躲开触发右键的那次 mousedown），
 * 但它把整条关闭链路挂在 `requestAnimationFrame` 上：WebKit 里那一帧没跑到
 * （后台标签页 / 无合成器时 rAF 会被推迟），监听压根没挂上，点哪儿都关不掉菜单。
 * 现在改用 `pointerdown`（右键那一次在 payload 还是 null 时就已发生，不会误关），
 * 捕获阶段保证外层组件 `stopPropagation` 也拦不住。
 */
onMounted(() => {
  document.addEventListener('pointerdown', onDocClick, true);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('blur', onBlur);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocClick, true);
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('blur', onBlur);
});

function handleAction(key: string) {
  if (!props.payload) return;
  emit('action', key, props.payload.key);
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="payload"
      ref="menuRef"
      :style="style"
      class="fixed z-50 min-w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      role="menu"
      aria-label="标签页操作"
    >
      <template v-for="item in items" :key="`${item.key}-${item.label}`">
        <div v-if="item.divider" class="my-1 h-px bg-gray-200 dark:bg-gray-700"></div>
        <button
          v-else
          type="button"
          role="menuitem"
          :disabled="item.disabled"
          :class="
            cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
              'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
              item.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
            )
          "
          @click="handleAction(item.key)"
        >
          <Icon v-if="item.icon" :icon="item.icon" class="text-sm" />
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>
