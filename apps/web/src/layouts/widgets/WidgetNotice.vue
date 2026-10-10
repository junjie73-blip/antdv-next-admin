<script setup lang="ts">
import type { BellNotice } from './notice';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Icon } from '@iconify/vue';
import { Badge, message, Popover, Spin } from 'antdv-next';
import {
  getNoticeList,
  markAllNoticeRead,
  markNoticeRead,
} from '~/api/system';
import { useWebSocket } from '~/utils/ws';

import NoticeItem from './components/NoticeItem.vue';
import WidgetButton from './components/WidgetButton.vue';
import { countUnread, mapNoticeList } from './notice';

defineOptions({ name: 'WidgetNotice' });

/**
 * 顶栏铃铛。
 *
 * 这个组件以前是**关着的**：`WIDGET_MAP` 里整项注释掉，而偏好设置抽屉的
 * 「通知」开关（默认 true）还在，于是用户能拨动一个永远不出结果的开关。
 * 现在把它接回真实数据源，顺带修掉三处一旦启用就立刻炸的问题：
 * - `import '~/api/notice.js'`：这个文件不存在，异步块直接解析失败；
 * - 读 `noticeId / isRead / createdAt`：mock 契约是 `id / status / sendTime`，
 *   字段对不上导致未读角标恒为 0、列表恒为空（映射统一收在 ./notice.ts）；
 * - `<Badge mode="dot">`：antdv-next 1.6 的 Badge 没有 `mode`，属性被忽略。
 */

/** 顶栏只给最近几条，全量在「通知管理」页看 */
const PREVIEW_LIMIT = 8;

const router = useRouter();
const { onNotice } = useWebSocket();

const loading = ref(false);
const list = ref<BellNotice[]>([]);
const open = ref(false);
const markingAll = ref(false);
/** 展开的那条：点条目就地看正文，不需要为详情再起一个路由（弹层里塞弹窗体验很差） */
const expandedId = ref<null | number>(null);

const unreadCount = computed(() => countUnread(list.value));
const hasUnread = computed(() => unreadCount.value > 0);

async function loadList() {
  loading.value = true;
  try {
    const res = await getNoticeList({ pageSize: PREVIEW_LIMIT });
    list.value = mapNoticeList(res).slice(0, PREVIEW_LIMIT);
  } catch {
    // 顶栏常驻控件：接口挂了安静降级成"暂无通知"，不要糊一个错误弹窗在布局上
    list.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(loadList);

/** 每次打开都刷新，保证角标与列表跟服务端一致（而不是等用户手动重进） */
watch(open, (value) => {
  if (value) void loadList();
});

/* ============================================================
 * 实时推送
 * ============================================================
 * mock（Nitro）没有 /ws 端点，`useWebSocket` 在未配置 `VITE_WS_URL` 时不会连接，
 * 所以这条订阅在本地开发下是"挂着但不会响"；接上真实后端即自动生效。
 * ⚠️ 必须显式 off：`eventBus` 的监听不随组件卸载清理，
 * 而顶栏小部件会随布局切换重挂，以前这样会越积越多条重复监听。
 */
const unsubscribeNotice = onNotice((item) => {
  const mapped = mapNoticeList([item])[0];
  if (!mapped) return;
  list.value = [mapped, ...list.value].slice(0, PREVIEW_LIMIT);
});
onUnmounted(unsubscribeNotice);

/** 乐观更新：先改本地，失败回滚并提示 */
async function markRead(item: BellNotice) {
  if (item.read) return;
  item.read = true;
  try {
    await markNoticeRead(item.id);
  } catch {
    item.read = false;
    message.error('标记已读失败');
  }
}

function handleClick(item: BellNotice) {
  expandedId.value = expandedId.value === item.id ? null : item.id;
  void markRead(item);
}

async function handleMarkAllRead() {
  if (!hasUnread.value || markingAll.value) return;

  markingAll.value = true;
  const unreadIds = new Set(
    list.value.filter((item) => !item.read).map((item) => item.id),
  );
  list.value.forEach((item) => {
    if (unreadIds.has(item.id)) item.read = true;
  });

  try {
    await markAllNoticeRead();
    message.success('已全部标记为已读');
  } catch {
    list.value.forEach((item) => {
      if (unreadIds.has(item.id)) item.read = false;
    });
    message.error('操作失败，请重试');
  } finally {
    markingAll.value = false;
  }
}

/** 通知管理页是隐藏页（不在导航上），但从铃铛跳过去是常规入口 */
function handleViewAll() {
  open.value = false;
  void router.push('/system/notice');
}
</script>

<template>
  <Popover v-model:open="open" placement="bottomRight" trigger="click" :arrow="false">
    <!-- 触发按钮 -->
    <WidgetButton :active="open" label="通知">
      <Badge :count="unreadCount" size="small" :offset="[0, 4]">
        <Icon icon="carbon:notification" class="text-base" />
      </Badge>
    </WidgetButton>

    <!-- 内容 -->
    <template #content>
      <div class="flex w-[380px] flex-col" data-testid="notice-panel">
        <!-- 头部 -->
        <div
          class="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800"
        >
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              通知
            </span>
            <span
              v-if="unreadCount > 0"
              class="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white"
            >
              {{ unreadCount }}
            </span>
          </div>

          <button
            v-if="hasUnread"
            type="button"
            data-testid="notice-mark-all"
            :disabled="markingAll"
            class="rounded px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            @click="handleMarkAllRead"
          >
            {{ markingAll ? '处理中...' : '全部已读' }}
          </button>
        </div>

        <!-- 列表：滚动走封装组件，弹窗里不露系统滚动条 -->
        <Scrollbar root-class="max-h-[420px] min-h-[140px]" view-class="p-2">
          <Spin :spinning="loading">
            <div
              v-if="!loading && list.length === 0"
              data-testid="notice-empty"
              class="flex flex-col items-center justify-center gap-2 py-12"
            >
              <div
                class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
              >
                <Icon
                  icon="carbon:notification-off"
                  class="text-xl text-slate-400 dark:text-slate-500"
                />
              </div>
              <span class="text-xs text-slate-400 dark:text-slate-500">暂无通知</span>
            </div>

            <div v-else class="space-y-1">
              <NoticeItem
                v-for="item in list"
                :key="item.id"
                :expanded="expandedId === item.id"
                :item="item"
                @click="handleClick"
                @view-all="handleViewAll"
              />
            </div>
          </Spin>
        </Scrollbar>

        <!-- 底部 -->
        <div
          class="flex shrink-0 items-center justify-center border-t border-slate-100 py-2.5 dark:border-slate-800"
        >
          <button
            type="button"
            class="text-ant-primary text-xs transition-colors hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            @click="handleViewAll"
          >
            查看全部通知 →
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>
