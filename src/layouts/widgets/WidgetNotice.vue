<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Badge, message, Popover, Spin } from "antdv-next";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import NoticeItem from "./components/NoticeItem.vue";
import WidgetButton from "./components/WidgetButton.vue";

defineOptions({ name: "WidgetNotice" });

const router = useRouter();

const loading = ref(false);
const list = ref([]);
const open = ref(false);

/** 防止重复请求 */
const markingAll = ref(false);

const unreadCount = ref(0);
const hasUnread = computed(() => unreadCount.value > 0);

/* ============================================================
 * 加载列表
 * ============================================================ */
async function loadList() {
  loading.value = true;
  try {
    // const res = await getMyNoticeList({ pageNum: 1, pageSize: 5 })
    list.value = [];
    unreadCount.value = 0;
  } finally {
    loading.value = false;
  }
}
function transformNotice(item: any) {
  return {
    priority: item.priority,
    noticeId: item.noticeId,
    title: item.title,
    content: item.content || "",
    noticeType: item.noticeType,
    status: item.status,
    publishTime: item.publishTime || item.publish_time || null, // 兼容
    createdAt: item.createdAt || item.created_at,
    isRead: item.isRead ?? item.is_read ?? false, // 兼容
  };
}
onMounted(loadList);

/* ============================================================
 * ⭐ 单条已读
 * ============================================================
 * 策略：乐观更新
 *  1. 先本地改 isRead = 1（UI 立刻反馈）
 *  2. 调接口
 *  3. 失败回滚
 */
async function handleRead(item) {
  if (item.isRead === 1) return;

  // 记录旧值，用于回滚
  const oldValue = item.isRead;

  // 乐观更新
  item.isRead = 1;

  try {
    // await markNoticeRead(item.noticeId);
    list.value = list.value.map((n) => (n.noticeId === item.noticeId ? { ...n, isRead: 1 } : n));
    list.value = list.value.map((n) => (n.noticeId === item.noticeId ? { ...n, isRead: 1 } : n));
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  } catch (err) {
    // 回滚
    item.isRead = oldValue;
    message.error("标记已读失败");
    throw err;
  }
}

/* ============================================================
 * ⭐ 点击通知：已读 + 跳详情
 * ============================================================ */
async function handleClick(item) {
  try {
    if (item.isRead === 0) {
      await handleRead(item);
    }
  } catch {
    // 已读失败也允许跳转，不阻塞用户
  }
  open.value = false;
  // router.push(`/message/my/${item.noticeId}`);
}

/* ============================================================
 * ⭐ 全部已读
 * ============================================================
 * 策略：乐观更新所有未读项 → 调接口 → 失败回滚
 */
async function handleMarkAllRead() {
  if (!hasUnread.value || markingAll.value) return;

  markingAll.value = true;

  // 记录旧的未读 id 列表
  const unreadIds = list.value.filter((i) => i.isRead === 0).map((i) => i.noticeId);

  // 乐观更新
  list.value.forEach((item) => {
    if (item.isRead === 0) item.isRead = 1;
  });

  try {
    // await markAllNoticeRead();
    message.success(`已全部标记为已读`);
  } catch (_err) {
    // 回滚
    const unreadSet = new Set(unreadIds);
    list.value.forEach((item) => {
      if (unreadSet.has(item.noticeId)) item.isRead = 0;
    });
    message.error("操作失败，请重试");
  } finally {
    markingAll.value = false;
  }
}

/* ============================================================
 * 查看全部
 * ============================================================ */
function handleViewAll() {
  open.value = false;
  router.push("/message/my");
}

/* ============================================================
 * 打开变化：懒加载 + 可选自动刷新
 * ============================================================ */
function handleOpenChange(v: boolean) {
  open.value = v;
  if (v) {
    // 每次打开都刷新，保证数据最新
    void loadList();
  }
}

const popoverStyles = {
  body: { padding: 0 },
};

defineExpose({ loadList });
</script>

<template>
  <Popover
    v-model:open="open"
    placement="bottomRight"
    trigger="click"
    :arrow="false"
    :styles="popoverStyles"
    @open-change="handleOpenChange"
  >
    <!-- 触发按钮 -->
    <WidgetButton :active="open">
      <Badge :count="unreadCount" size="small" mode="dot">
        <Icon icon="carbon:notification" class="text-base" />
      </Badge>
    </WidgetButton>

    <!-- 内容 -->
    <template #content>
      <div class="flex w-[380px] flex-col">
        <!-- 头部 -->
        <div
          class="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800"
        >
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200"> 通知 </span>
            <span
              v-if="unreadCount > 0"
              class="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white"
            >
              {{ unreadCount }}
            </span>
          </div>

          <!-- ⭐ 全部已读按钮 -->
          <button
            v-if="hasUnread"
            type="button"
            :disabled="markingAll"
            class="rounded px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            @click="handleMarkAllRead"
          >
            {{ markingAll ? "处理中..." : "全部已读" }}
          </button>
        </div>

        <!-- 列表 -->
        <div class="max-h-[420px] min-h-[140px] overflow-y-auto p-2">
          <Spin :spinning="loading">
            <div
              v-if="!loading && list.length === 0"
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
              <span class="text-xs text-slate-400 dark:text-slate-500"> 暂无通知 </span>
            </div>

            <div v-else class="space-y-1">
              <NoticeItem v-for="item in list" :key="item.noticeId" :item="item" />
            </div>
          </Spin>
        </div>

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
