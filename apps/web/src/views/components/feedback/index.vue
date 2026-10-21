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
 * 停留时长与关闭动作两条通道共用一份实现（3 秒自动消失 + `closeButton` 那个开关），
 * 差别只在出场位置，以及通知通常多带一行描述。
 *
 * 关闭按钮**默认不显示**：`message.*` 这一页按默认走（没有 ✕），
 * `notification.*` 显式传 `{ closeButton: true }` 才有 ✕。开关在两条通道上是同一个，
 * 见下面「关闭按钮开关」那张卡把四种组合都点一遍。
 *
 * 配色规范：卡片一律弹层底色，状态只由左侧那枚实色圆徽表达（成功绿 / 信息主色 /
 * 警告琥珀 / 错误红），通知比轻提示多一行灰色描述。
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
  {
    key: 'success',
    label: '成功',
    title: '操作成功',
    desc: '已完成 12 条记录的数据同步',
  },
  {
    key: 'info',
    label: '信息',
    title: '新版本可用',
    desc: 'v2.4.0 已发布，建议刷新页面',
  },
  {
    key: 'warning',
    label: '警告',
    title: '磁盘空间不足',
    desc: '剩余 8%，请及时清理日志',
  },
  {
    key: 'error',
    label: '错误',
    title: '请求失败',
    desc: '网关 502，请稍后重试',
  },
] as const;

type Status = (typeof STATUS)[number]['key'];

function showMessage(status: Status) {
  const item = STATUS.find((s) => s.key === status)!;
  message[status](item.title);
}

function showNotification(status: Status) {
  const item = STATUS.find((s) => s.key === status)!;
  // 通知要留一行描述，也允许用户自己收掉，所以显式开 ✕（不传就没有）
  notification[status](item.title, {
    closeButton: true,
    description: item.desc,
  });
}

/**
 * `closeButton` 是**单条**的开关，两条通道共用：不传就没有 ✕，传了才有。
 * 下面两个入口把"默认"与"开启"各演示一次，另一种组合由上面两张卡提供
 * （轻提示默认无 ✕、通知显式开启有 ✕）。
 */
function showMessageWithClose() {
  message.info('这条轻提示带手动关闭', { closeButton: true });
}

function showNotificationWithoutClose() {
  notification.success('这条通知没有 ✕', {
    description: '不传 closeButton 时不渲染关闭按钮',
  });
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
        卡片底色始终是弹层底色，四种状态靠左侧的实色圆徽区分；这一组按默认写法，
        不挂右上角 ✕，3 秒后自己消失。
      </p>
    </Card>

    <Card title="通知 notification" variant="borderless">
      <template #extra>
        <span :class="cardExtraClassName">
          位置跟随偏好「通知位置」，带描述；传 `closeButton: true` 才有 ✕
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
        通知比轻提示多一行灰色描述，位置跟随偏好；这一组显式开了关闭按钮，
        点右上角 ✕ 或等 3 秒都会收起，不会挡住正文操作区。
      </p>
    </Card>

    <Card title="关闭按钮开关" variant="borderless">
      <template #extra>
        <span :class="cardExtraClassName">
          <code>closeButton</code> 是单条的可选项，两条通道共用，默认不渲染
        </span>
      </template>
      <div :class="buttonGroupClassName">
        <Button @click="showMessageWithClose">轻提示 · 开启 ✕</Button>
        <Button variant="outline" @click="showNotificationWithoutClose">
          通知 · 不传（无 ✕）
        </Button>
      </div>
      <p :class="tipClassName">
        开关只看这一条有没有传，跟走哪条通道无关：轻提示传了照样有 ✕，
        通知不传照样没有。
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
        默认类型没有状态徽标，只有正文；Promise 在 pending
        阶段是转圈，落地后换成对应类型的圆徽。
      </p>
    </Card>
  </div>
</template>
