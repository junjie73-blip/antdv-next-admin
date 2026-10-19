<script setup lang="ts">
import { Card } from '@antdv/common-ui';
import { message, notification, toast } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * 轻提示与通知的示例页。
 *
 * 两只 toaster 的分工（见 `apps/web/src/App.vue` 与 `@antdv/popup-ui`）：
 * `message.*` 不带 `toasterId` → 进「顶部居中」那只；`notification.*` 带
 * `NOTIFICATION_TOASTER_ID` → 进位置由偏好 `notificationPosition` 决定的那只。
 * 所以这一页同时点两边，能直接看出两条通道各堆各的、不会互相顶位。
 *
 * 配色规范：卡片一律弹层底色，状态只由左侧那枚实色圆徽表达（成功绿 / 信息主色 /
 * 警告琥珀 / 错误红），通知比轻提示多一行灰色描述与右上角关闭按钮。
 */

const containerClassName = cn('space-y-6');
const pageHeaderClassName = cn('mb-2');
const pageTitleClassName = cn(
  'text-2xl font-bold text-gray-800 dark:text-gray-100',
);
const pageDescClassName = cn('mt-1 text-gray-500 dark:text-gray-400');
const cardExtraClassName = cn('text-sm text-gray-400');
const buttonGroupClassName = cn('flex flex-wrap gap-3');
const tipClassName = cn('mt-3 text-sm text-gray-400');

/** 四种状态在两条通道上各演示一次，文案对齐色彩规范图 */
const STATUS = [
  { key: 'success', label: '成功', title: '操作成功', desc: '已完成 12 条记录的数据同步' },
  { key: 'info', label: '信息', title: '新版本可用', desc: 'v2.4.0 已发布，建议刷新页面' },
  { key: 'warning', label: '警告', title: '磁盘空间不足', desc: '剩余 8%，请及时清理日志' },
  { key: 'error', label: '错误', title: '请求失败', desc: '网关 502，请稍后重试' },
] as const;

type Status = (typeof STATUS)[number]['key'];

function showMessage(status: Status) {
  const item = STATUS.find((s) => s.key === status)!;
  message[status](item.title);
}

function showNotification(status: Status) {
  const item = STATUS.find((s) => s.key === status)!;
  notification[status](item.title, item.desc);
}

/**
 * 默认与 Promise 两个入口直接落在 vue-sonner 的 `toast` 上（`message` / `notification`
 * 只包了带类型的那几个）。样式层按 `data-type` 挂徽标，`default` 没有徽标色、
 * `promise` 在 pending 阶段走 loading 转圈，所以这两个入口也要能在页面上点出来。
 */
function showDefault() {
  toast('这是一条默认提示');
}

function showPromise() {
  toast.promise(
    new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 1500)),
    {
      error: '同步失败',
      loading: '正在同步…',
      success: '同步完成',
    },
  );
}
</script>

<template>
  <div :class="containerClassName">
    <div :class="pageHeaderClassName">
      <h2 :class="pageTitleClassName">轻提示与通知</h2>
      <p :class="pageDescClassName">
        两条独立的提示通道：位置、停留时长与堆叠互不干扰
      </p>
    </div>

    <Card title="轻提示 message" variant="borderless">
      <template #extra>
        <span :class="cardExtraClassName">顶部居中，3 秒自动消失</span>
      </template>
      <div :class="buttonGroupClassName">
        <Button
          v-for="item in STATUS"
          :key="item.key"
          @click="showMessage(item.key)"
        >
          {{ item.label }}提示
        </Button>
      </div>
      <p :class="tipClassName">
        卡片底色始终是弹层底色，四种状态靠左侧的实色圆徽区分；轻提示不带关闭按钮。
      </p>
    </Card>

    <Card title="通知 notification" variant="borderless">
      <template #extra>
        <span :class="cardExtraClassName">
          位置跟随偏好「通知位置」，带描述与关闭按钮
        </span>
      </template>
      <div :class="buttonGroupClassName">
        <Button
          v-for="item in STATUS"
          :key="item.key"
          variant="outline"
          @click="showNotification(item.key)"
        >
          {{ item.label }}通知
        </Button>
      </div>
      <p :class="tipClassName">
        通知比轻提示多一行灰色描述；点右上角 ✕ 或等 8 秒都会收起，不会挡住正文操作区。
      </p>
    </Card>

    <Card title="加载提示" variant="borderless">
      <template #extra>
        <span :class="cardExtraClassName">toast.loading 常驻，直到手动关闭</span>
      </template>
      <div :class="buttonGroupClassName">
        <Button @click="message.loading('正在同步数据…')">
          发起加载提示
        </Button>
        <Button variant="outline" @click="message.success('同步完成')">
          以成功提示收尾
        </Button>
      </div>
    </Card>

    <Card title="默认与 Promise" variant="borderless">
      <template #extra>
        <span :class="cardExtraClassName">
          直接调用 vue-sonner 的 toast，样式层同样接管
        </span>
      </template>
      <div :class="buttonGroupClassName">
        <Button @click="showDefault">默认提示</Button>
        <Button variant="outline" @click="showPromise">
          Promise（转圈 → 成功）
        </Button>
      </div>
      <p :class="tipClassName">
        默认类型没有状态徽标，只有正文；Promise 在 pending 阶段是转圈，落地后换成对应类型的圆徽。
      </p>
    </Card>
  </div>
</template>
