<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Scrollbar } from '@antdv/ui/scrollbar';
import { Icon } from '@iconify/vue';
import { Modal } from 'antdv-next';
import { useRouteStore } from '~/stores/modules/route';

import { flattenMenus, matchEntries } from '../composables/useMenuSearch';

defineOptions({ name: 'MenuSearchModal' });

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const router = useRouter();
const routeStore = useRouteStore();

// 直接读 store 里的菜单树，而不是再发一次 `/api/menus`：
// store 的 `menus` 已经过了权限裁剪和 `hidden` 覆盖，搜到的永远是"现在真能去的页面"。
const entries = computed(() => flattenMenus(routeStore.menus ?? []));

const keyword = ref('');
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const results = computed(() => matchEntries(entries.value, keyword.value, 50));

watch(results, () => {
  activeIndex.value = 0;
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    keyword.value = '';
    activeIndex.value = 0;
  },
);

/**
 * 呼出即可打字是命令面板的底线：不聚焦的话 Ctrl+K 只是"弹个窗"，
 * 用户还得再点一下输入框，快捷键就白做了。
 * 放在 `afterOpenChange` 而不是 watch 里，是因为 rc-dialog 在动画结束后
 * 会把焦点收进弹窗容器 —— 更早的 focus 会被它抢走。
 */
function onAfterOpenChange(open: boolean) {
  if (open) inputRef.value?.focus();
}

function close() {
  emit('update:open', false);
}

function move(step: number) {
  const total = results.value.length;
  if (total === 0) return;
  activeIndex.value = (activeIndex.value + step + total) % total;
}

function go(index: number) {
  const target = results.value[index];
  if (!target) return;
  // 外链交给新标签打开，站内路径走 router（守卫继续做权限判定）
  if (target.external) window.open(target.path, '_blank', 'noopener');
  else void router.push(target.path);
  close();
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault();
      move(1);
      break;
    }
    case 'ArrowUp': {
      event.preventDefault();
      move(-1);
      break;
    }
    case 'Enter': {
      event.preventDefault();
      go(activeIndex.value);
      break;
    }
    case 'Escape': {
      event.preventDefault();
      close();
      break;
    }
    default:
      break;
  }
}

const itemClassName =
  'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors';
</script>

<template>
  <Modal
    :closable="false"
    :footer="null"
    :open="props.open"
    class="menu-search-modal"
    width="560px"
    @after-open-change="onAfterOpenChange"
    @update:open="(value: boolean) => (value ? null : close())"
  >
    <div>
      <div class="flex items-center gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
        <Icon class="shrink-0 text-base text-gray-400" icon="carbon:search" />
        <input
          ref="inputRef"
          v-model="keyword"
          aria-label="搜索菜单"
          class="w-full bg-transparent text-base outline-none placeholder:text-gray-400"
          data-testid="menu-search-input"
          placeholder="搜索页面，↑ ↓ 选择，Enter 打开"
          type="text"
          @keydown="onKeydown"
        />
      </div>

      <Scrollbar class="pt-2" max-height="320px">
        <p
          v-if="results.length === 0"
          class="py-10 text-center text-sm text-gray-400"
          data-testid="menu-search-empty"
        >
          没有匹配的页面
        </p>
        <template v-else>
          <!--
            `data-active` 把"键盘当前停在哪一项"暴露成可断言的状态：
            高亮过去只体现在 class 组合里，用例只能猜类名，很脆。
          -->
          <button
            v-for="(item, index) in results"
            :key="item.path"
            :class="[
              itemClassName,
              index === activeIndex
                ? 'bg-gray-100 text-ant-primary dark:bg-gray-800'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60',
            ]"
            :data-active="index === activeIndex"
            :data-search-path="item.path"
            data-testid="menu-search-item"
            type="button"
            @click="go(index)"
            @mouseenter="activeIndex = index"
          >
            <Icon class="shrink-0 text-base" :icon="item.icon || 'carbon:document'" />
            <span class="truncate">{{ item.title }}</span>
            <span v-if="item.hidden" class="shrink-0 text-xs text-gray-400">
              不在导航
            </span>
            <span class="ml-auto max-w-[45%] shrink-0 truncate text-xs text-gray-400">
              {{ item.breadcrumb || item.path }}
            </span>
          </button>
        </template>
      </Scrollbar>
    </div>
  </Modal>
</template>
