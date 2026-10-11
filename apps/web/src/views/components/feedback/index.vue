<script setup lang="ts">
import { computed, h, onUnmounted, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { App } from 'antdv-next';
import { useAppStore } from '~/stores/modules/app';

/**
 * 反馈类组件示例。
 *
 * 这一页刻意用 `App.useApp()` 而不是 `import { message } from 'antdv-next'`：
 * 那个具名的 `message` 其实是**静态方法**（导出表里写的是 `staticMethods as message`），
 * 它在组件外面渲染，拿不到 `<a-app>` / `ConfigProvider` 的上下文，
 * 换主题色或切暗黑时会退回默认样式（`App.vue` 已经把整棵应用包在 `a-app` 里，
 * 上下文是现成的）。示例页是别人抄的模板，就得抄对的那一种。
 *
 * `useApp` 不是包的具名导出，组合式入口挂在组件对象上：写成 `import { useApp }`
 * 会抛 "does not provide an export named 'useApp'"，整页导航被守卫 abort，
 * 表现是"点了菜单没反应"，而不是页面报错——很容易误判成路由问题。
 */

const { message, modal, notification } = App.useApp();
const appStore = useAppStore();

const containerClassName = cn('space-y-4');
const rowClassName = cn('flex', 'flex-wrap', 'items-center', 'gap-2');
const hintClassName = cn(
  'mb-3',
  'text-xs',
  'text-gray-500',
  'dark:text-gray-400',
);
const watermarkBoxClassName = cn(
  'rounded-md',
  'border',
  'border-gray-200',
  'p-6',
  'text-center',
  'dark:border-gray-700',
);

const messageKey = ref(0);
const watermarkText = ref('Antdv Admin');

function openMessage(type: 'error' | 'info' | 'loading' | 'success' | 'warning') {
  if (type === 'loading') {
    const hide = message.loading('数据加载中，2 秒后自动关闭', 2);
    setTimeout(() => hide(), 2000);
    return;
  }
  message[type](`${type} 类型的全球提示`);
}

/** 同一 key 的消息会被后一条替换，用来演示"进度提示只占一个位置" */
function replaceMessage() {
  messageKey.value += 1;
  const key = `progress-${messageKey.value}`;
  message.loading({ content: '正在提交…', duration: 1, key });
  setTimeout(() => {
    message.success({ content: '提交完成（同一条消息被替换）', duration: 2, key });
  }, 1000);
}

function dismissAll() {
  message.destroy();
}

function openNotification(type: 'error' | 'info' | 'success' | 'warning') {
  notification[type]({
    description: '通知的落点跟随偏好设置里的「通知位置」，改完再点就能看出区别。',
    // antdv-next 的 Notification 标题字段是 `title`（React antd 那边才叫 `message`），
    // 写成 `message` 不报错，只是标题整块是空的
    placement: appStore.notificationPosition,
    title: `${type} 通知`,
  });
}

function openConfirm() {
  modal.confirm({
    cancelText: '再想想',
    content: '删除后不可恢复，确定要继续吗？',
    okText: '确定删除',
    okType: 'danger',
    onOk: () => {
      message.success('已确认（这里返回 Promise 时会自带 loading）');
    },
    title: '危险操作二次确认',
  });
}

function openAsyncConfirm() {
  modal.confirm({
    content: '点「确定」后按钮进入 loading，1.5 秒后才真正关闭。',
    onOk: () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 1500);
      }),
    title: '异步确认',
  });
}

function openModalWithNode() {
  modal.info({
    content: h('div', { class: 'space-y-2' }, [
      h('p', 'content 直接收 VNode，可以在里面塞任意组件。'),
      h(
        'p',
        { class: 'text-ant-primary' },
        [h(Icon, { icon: 'carbon:idea' }), ' 这段文字用了主题色 token。'],
      ),
    ]),
    title: '自定义内容',
  });
}

const progressTimer = ref<null | ReturnType<typeof setInterval>>(null);
const progressSteps = ref(0);
/** 进度还在跑就把按钮锁住，免得连点叠出多个定时器 */
const progressRunning = computed(() => {
  return progressTimer.value !== null;
});

function runProgress() {
  if (progressTimer.value) clearInterval(progressTimer.value);
  progressSteps.value = 0;
  progressTimer.value = setInterval(() => {
    progressSteps.value += 10;
    if (progressSteps.value >= 100 && progressTimer.value) {
      clearInterval(progressTimer.value);
      progressTimer.value = null;
    }
  }, 200);
}

// 标签页缓存（keep-alive）之下，离开页面不等于没看见 —— 定时器必须跟着卸载清掉
onUnmounted(() => {
  if (progressTimer.value) clearInterval(progressTimer.value);
});
</script>

<template>
  <div :class="containerClassName">
    <a-card title="Message 全局提示" variant="borderless">
      <p :class="hintClassName">
        走 <code>App.useApp()</code> 拿实例，主题色与暗黑模式才会跟着偏好走。
      </p>
      <div :class="rowClassName">
        <a-button @click="openMessage('success')">成功</a-button>
        <a-button @click="openMessage('error')">错误</a-button>
        <a-button @click="openMessage('warning')">警告</a-button>
        <a-button @click="openMessage('info')">信息</a-button>
        <a-button @click="openMessage('loading')">加载中</a-button>
        <a-button @click="replaceMessage">同一条被替换</a-button>
        <a-button danger @click="dismissAll">全部清除</a-button>
      </div>
    </a-card>

    <a-card title="Notification 通知" variant="borderless">
      <p :class="hintClassName">
        当前落点：<code>{{ appStore.notificationPosition }}</code>
        （在右上角落的设置抽屉「通知位置」里改）
      </p>
      <div :class="rowClassName">
        <a-button @click="openNotification('success')">成功通知</a-button>
        <a-button @click="openNotification('info')">信息通知</a-button>
        <a-button @click="openNotification('warning')">警告通知</a-button>
        <a-button @click="openNotification('error')">错误通知</a-button>
      </div>
    </a-card>

    <a-card title="Modal 确认框" variant="borderless">
      <p :class="hintClassName">
        删除这类不可逆操作必须二次确认；<code>onOk</code> 返回 Promise 时按钮自动 loading。
      </p>
      <div :class="rowClassName">
        <a-button danger @click="openConfirm">危险确认</a-button>
        <a-button @click="openAsyncConfirm">异步确认</a-button>
        <a-button @click="openModalWithNode">自定义内容</a-button>
        <a-popconfirm
          ok-text="删除"
          placement="right"
          title="气泡确认框：不需要遮罩层"
          @confirm="message.success('气泡确认通过')"
        >
          <a-button>气泡确认</a-button>
        </a-popconfirm>
      </div>
    </a-card>

    <a-card title="Tooltip 与 Popover" variant="borderless">
      <div :class="rowClassName">
        <a-tooltip placement="top" title="悬浮提示，只放一句话">
          <a-button>悬浮提示</a-button>
        </a-tooltip>
        <a-popover placement="bottom" title="气泡卡片">
          <template #content>
            <p class="m-0">
              可以放一段富文本、一个表单，或者一组操作按钮。
            </p>
          </template>
          <a-button>气泡卡片</a-button>
        </a-popover>
      </div>
    </a-card>

    <a-card title="Alert 警告提示" variant="borderless">
      <div class="space-y-3">
        <a-alert
          description="需要用户知道、但不打断操作的静态提示。"
          message="信息"
          show-icon
          type="info"
        />
        <a-alert
          closable
          description="这条可以被关闭，关闭后从 DOM 移除。"
          message="成功"
          show-icon
          type="success"
        />
        <a-alert
          message="警告：配额即将用尽"
          show-icon
          type="warning"
        >
          <template #action>
            <a-button size="small" type="link">查看用量</a-button>
          </template>
        </a-alert>
        <a-alert
          banner
          message="通栏样式：贴页面顶部，不带圆角。"
          type="error"
        />
      </div>
    </a-card>

    <a-card title="Progress 进度条" variant="borderless">
      <div :class="rowClassName">
        <div class="min-w-60 flex-1">
          <a-progress :percent="progressSteps" />
          <a-progress :percent="60" status="active" />
          <a-progress :percent="30" status="exception" />
          <a-progress :percent="100" status="success" />
        </div>
        <a-progress :percent="progressSteps" type="circle" />
        <a-progress :percent="75" type="dashboard" />
        <a-button :disabled="progressRunning" @click="runProgress">跑一次进度</a-button>
      </div>
    </a-card>

    <a-card title="Result 结果" variant="borderless">
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <a-result
          status="success"
          title="提交成功"
          sub-title="订单已创建，可在列表中查看进度。"
        >
          <template #extra>
            <a-button type="primary">查看订单</a-button>
            <a-button>继续下单</a-button>
          </template>
        </a-result>
        <a-result status="404" title="404" sub-title="这个页面不存在。">
          <template #extra>
            <a-button type="primary">回到首页</a-button>
          </template>
        </a-result>
      </div>
    </a-card>

    <a-card title="Watermark 水印" variant="borderless">
      <p :class="hintClassName">
        组件级水印只盖住这一块；整页水印在设置抽屉里开（走
        <code>useWatermark</code>）。
      </p>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <a-input v-model:value="watermarkText" class="w-60" placeholder="水印文案" />
      </div>
      <a-watermark :content="watermarkText">
        <div :class="watermarkBoxClassName">
          <p class="m-0 text-sm">被水印覆盖的内容区，试着选中这段文字。</p>
        </div>
      </a-watermark>
    </a-card>
  </div>
</template>
