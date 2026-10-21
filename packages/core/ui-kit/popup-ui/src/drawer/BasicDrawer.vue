<script setup lang="ts">
import type { DrawerInnerMethods, DrawerMethods, DrawerProps } from './types';

import { computed, onMounted, ref, useId, useSlots, watch } from 'vue';

import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  ScrollArea,
  Spinner,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Check, X } from '@lucide/vue';
import { useTimeoutFn } from '@vueuse/core';

import { resolvePopupButton } from '../shared/button';
import { isFocusOutsideEvent } from '../shared/dismiss';
import { CLOSED_PANEL_INERT } from '../shared/presence';

const props = withDefaults(defineProps<DrawerProps>(), {
  placement: 'right',
  useWrapper: true,
  showFooter: true,
  showCancelBtn: true,
  showOkBtn: true,
  cancelText: '关闭',
  okText: '保存',
  maskClosable: true,
  keyboard: true,
  closable: true,
  mask: true,
  destroyOnHidden: true,
  bodyScroll: true,
});

const emit = defineEmits<{
  register: [instance: DrawerMethods];
  ok: [e: MouseEvent];
  cancel: [e: MouseEvent];
  visibleChange: [visible: boolean];
  'update:visible': [visible: boolean];
  'update:open': [visible: boolean];
}>();

const slots = useSlots();

const drawerId = useId();
const drawerTitleId = `${drawerId}-title`;

const visibleRef = ref(props.open || props.visible || false);
const okLoadingRef = ref(false);
const loadingRef = ref(props.loading || false);

const propOverrides = ref<Partial<DrawerProps>>({});
const merged = computed(() => ({ ...props, ...propOverrides.value }));

// 计算尺寸：左右取宽、上下取高（与旧 antdv 版一致，默认 520/400）
const getSize = computed(() => {
  const { placement } = merged.value;
  if (placement === 'left' || placement === 'right') {
    const configured = merged.value.size;
    const size = configured || merged.value.width;
    if (typeof size === 'string') {
      return Number.parseInt(size, 10) || 520;
    }
    return size || 520;
  }
  if (placement === 'top' || placement === 'bottom') {
    const configured = merged.value.size;
    const size = configured || merged.value.height;
    if (typeof size === 'string') {
      return Number.parseInt(size, 10) || 400;
    }
    return size || 400;
  }
  return undefined;
});

const isHorizontal = computed(
  () => merged.value.placement === 'left' || merged.value.placement === 'right',
);

// 抽屉原语只说上下（up/down），placement 沿用旧词汇（top/bottom），只有这两档要换词
const SWIPE_DIRECTIONS = {
  bottom: 'down',
  left: 'left',
  right: 'right',
  top: 'up',
} as const;

const swipeDirection = computed(
  () => SWIPE_DIRECTIONS[merged.value.placement ?? 'right'],
);

/**
 * 用 `'trap-focus'` 而不是 `true`：reka 的 DrawerContent 在 modal 为严格 `true` 时会跑
 * `useHideOthers`，且少了 Dialog 那层的 `present` 闸门 —— force-mount 的关闭态面板会把
 * 整个应用置成 `aria-hidden="true"`。代价是面板要自己认领 pointer-events（见 contentClass）。
 * 也不能开合时切成 `true`：full-modal 与非 modal 是两棵 keyed 子树，翻 modal 会重挂载，
 * 调用方插槽里的状态全丢。
 */
const rootModal = computed(() =>
  merged.value.mask === false ? false : 'trap-focus',
);

const contentStyle = computed(() => ({
  ...(isHorizontal.value
    ? { width: `${getSize.value}px` }
    : { height: `${getSize.value}px` }),
  zIndex: merged.value.zIndex,
  ...merged.value.drawerStyle,
}));

const contentClass = computed(() =>
  cn(
    'basic-drawer flex flex-col gap-0',
    // 尺寸靠 contentStyle 的内联 width/height，这里只解开 DrawerContent 的 `sm:max-w-sm` 上限；
    // 别再叠 `w-auto!`，important 会反过来把内联宽度顶掉
    isHorizontal.value && 'max-w-none!',
    // 蒙层用 `body{pointer-events:none}` 锁页面，而 reka 只在 full-modal 分支把面板的
    // pointer-events 认领回来；我们走 'trap-focus'，这一条得自己补，否则整块面板点不动。
    // 只给 open 态，关闭态继续由 CLOSED_PANEL_INERT 置为不可交互。
    'data-[state=open]:pointer-events-auto',
    CLOSED_PANEL_INERT,
    merged.value.wrapClassName,
  ),
);

function setVisible(val: boolean) {
  visibleRef.value = val;
  emit('visibleChange', val);
  emit('update:visible', val);
  emit('update:open', val);
}

const drawerMethods: DrawerMethods = {
  openDrawer: (visible = true) => {
    if (visible) setVisible(true);
  },
  closeDrawer: async () => {
    if (merged.value.closeFunc) {
      const canClose = await merged.value.closeFunc();
      if (!canClose) return;
    }
    visibleRef.value = false;
    okLoadingRef.value = false;
    loadingRef.value = false;
    emit('visibleChange', false);
    emit('update:visible', false);
    emit('update:open', false);
    merged.value.afterClose?.();
  },
  setDrawerProps: (newProps) => {
    propOverrides.value = { ...propOverrides.value, ...newProps };
    if (newProps.open !== undefined) visibleRef.value = newProps.open;
    if (newProps.visible !== undefined) visibleRef.value = newProps.visible;
    if (newProps.loading !== undefined) loadingRef.value = newProps.loading;
  },
  getVisible: () => visibleRef.value,
};

const innerMethods: DrawerInnerMethods & DrawerMethods = {
  ...drawerMethods,
  changeOkLoading: (loading) => {
    okLoadingRef.value = loading;
  },
  changeLoading: (loading) => {
    loadingRef.value = loading;
  },
};

defineExpose({
  ...drawerMethods,
  _innerMethods: innerMethods,
});

const { start: scheduleRegister } = useTimeoutFn(
  () => emit('register', innerMethods),
  0,
  {
    immediate: false,
  },
);
onMounted(() => {
  scheduleRegister();
});

// `open` / `visible` 没绑就等于「不归 props 管」，不能拿默认值 false 去顶掉 visibleRef：
// 源写成 `[open, visible]` 数组的话，父组件每次重渲染（比如换了个 okButtonProps 对象）都会
// 触发回调，抽屉会在用户点到底部按钮之前自己关掉。
watch(
  () => props.open ?? props.visible,
  (val) => {
    if (val === undefined) return;
    visibleRef.value = val;
  },
);

async function handleOk(e: MouseEvent) {
  okLoadingRef.value = true;
  emit('ok', e);
}

async function handleCancel(e?: MouseEvent) {
  emit('cancel', e as MouseEvent);
  await drawerMethods.closeDrawer();
}

/**
 * reka `DrawerRoot` 的 `update:open` 第二参（`DrawerOpenChangeDetails`）。
 * 按结构写而不引 `reka-ui`：本包只用 `@antdv/shadcn-ui` 的原语壳，
 * 把 reka 提进 dependencies 会让版本口径绕过那一层封装。
 */
interface OpenChangeDetails {
  cancel: () => void;
  reason?: string;
}

/**
 * 只剩「滑动关闭」会走到这里：Esc 与点蒙层在 `onEscapeKeyDown` / `onInteractOutside`
 * 就被 preventDefault 拦下了。先 `cancel()` 把已经拖出屏外的面板弹回原位，
 * 关不关交给 `closeDrawer` 里的 `closeFunc` 这道异步闸门决定 ——
 * `cancel()` 只能在 emit 的同步过程里生效，等 await 完再调已经来不及。
 */
function onRootUpdate(val: boolean, details?: OpenChangeDetails) {
  if (val) {
    visibleRef.value = true;
    return;
  }
  details?.cancel();
  if (details?.reason === 'swipe' && !merged.value.maskClosable) return;
  void handleCancel();
}

/**
 * 只绑 `interact-outside`：reka 在一次外部按下时会连发 `pointerDownOutside` 和
 * `interactOutside`，两个都接等于点一次蒙层关两次（`closeFunc` 会被跑两遍）。
 * 焦点移出同样进这里，但那只是重新渲染把焦点甩回 body 的副作用，不算关闭请求。
 */
function onInteractOutside(event: Event) {
  event.preventDefault();
  if (isFocusOutsideEvent(event)) return;
  if (!merged.value.maskClosable) return;
  void handleCancel();
}

function onEscapeKeyDown(event: Event) {
  event.preventDefault();
  if (!merged.value.keyboard) return;
  void handleCancel();
}

const okBtn = computed(() =>
  resolvePopupButton(
    merged.value.okButtonProps,
    merged.value.okType ?? 'primary',
    okLoadingRef.value,
  ),
);
const cancelBtn = computed(() =>
  resolvePopupButton(merged.value.cancelButtonProps, 'default'),
);
</script>

<template>
  <Drawer
    :open="visibleRef"
    :modal="rootModal"
    :swipe-direction="swipeDirection"
    @update:open="onRootUpdate"
  >
    <DrawerContent
      :class="contentClass"
      :style="contentStyle"
      :force-mount="!merged.destroyOnHidden"
      @interact-outside="onInteractOutside"
      @escape-key-down="onEscapeKeyDown"
    >
      <!-- 头部：内置与自定义插槽共用同一圈内边距，插槽内容不再贴着抽屉边缘 -->
      <div
        v-if="!slots.header"
        :id="drawerTitleId"
        :class="
          cn(
            'drawer-header border-border flex items-center justify-between border-b px-6 py-4',
          )
        "
        :style="merged.headerStyle"
      >
        <div :class="cn('flex items-center gap-2')">
          <DrawerTitle as-child>
            <span :class="cn('text-foreground text-lg font-medium')">
              {{ merged.title }}
            </span>
          </DrawerTitle>
          <slot name="titleTip"></slot>
        </div>
        <div :class="cn('flex items-center gap-2')">
          <button
            v-if="merged.closable"
            :class="
              cn(
                'text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-sm p-1 transition-colors',
              )
            "
            type="button"
            :aria-label="`关闭${merged.title ? ` ${merged.title}` : ''}`"
            @click="handleCancel"
          >
            <X :size="16" />
          </button>
        </div>
      </div>
      <div
        v-else
        :class="
          cn('drawer-header border-border flex items-center border-b px-6 py-4')
        "
        :style="merged.headerStyle"
      >
        <!-- 面板自己带 aria-labelledby，插槽标题不可见时补一个供读屏器定位 -->
        <DrawerTitle v-if="merged.title" :class="cn('sr-only')">
          {{ merged.title }}
        </DrawerTitle>
        <slot name="header"></slot>
      </div>

      <!-- 内容区域 -->
      <DrawerDescription :class="cn('sr-only')">
        {{ merged.title ? `${merged.title} 抽屉` : '抽屉内容' }}
      </DrawerDescription>
      <div
        :class="
          cn('drawer-body relative min-h-0 flex-1 overflow-hidden!', {
            'p-4': merged.useWrapper,
          })
        "
        role="region"
        :aria-label="merged.title || '抽屉内容'"
        :aria-labelledby="drawerTitleId"
        :style="merged.bodyStyle"
      >
        <!-- Loading 遮罩 -->
        <div
          v-if="loadingRef"
          :class="
            cn(
              'absolute inset-0 z-10 flex items-center justify-center',
              'bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-sm',
            )
          "
        >
          <div :class="cn('flex flex-col items-center gap-2')">
            <div
              :class="
                cn(
                  'text-primary animate-spin border-2 border-t-transparent h-8 w-8 rounded-full border-current/20',
                )
              "
            ></div>
            <span
              v-if="merged.loadingTip"
              :class="cn('text-muted-foreground text-sm')"
              >{{ merged.loadingTip }}</span>
          </div>
        </div>

        <!-- 内容滚动区（shadcn ScrollArea 自绘滚动条）；调用方自带滚动时这层要让位 -->
        <ScrollArea v-if="merged.bodyScroll" class="h-full">
          <slot></slot>
        </ScrollArea>
        <slot v-else></slot>
      </div>

      <!-- 底部按钮 -->
      <div
        v-if="
          merged.showFooter &&
          !slots.footer &&
          (merged.showCancelBtn || merged.showOkBtn)
        "
        :class="
          cn(
            'drawer-footer border-border flex items-center justify-center gap-3 border-t px-4 py-3',
          )
        "
        :style="merged.footerStyle"
      >
        <slot name="insertFooter"></slot>
        <Button
          v-if="merged.showCancelBtn"
          :variant="cancelBtn.variant"
          :disabled="cancelBtn.disabled"
          :class="cancelBtn.class"
          @click="handleCancel"
        >
          <X :size="14" />
          {{ merged.cancelText }}
        </Button>
        <slot name="centerFooter"></slot>
        <Button
          v-if="merged.showOkBtn"
          :variant="okBtn.variant"
          :disabled="okBtn.disabled || okBtn.loading"
          :class="okBtn.class"
          @click="handleOk"
        >
          <Spinner v-if="okBtn.loading" :size="14" />
          <Check v-else :size="14" />
          {{ merged.okText }}
        </Button>
        <slot name="appendFooter"></slot>
      </div>
      <div v-else-if="slots.footer" :style="merged.footerStyle">
        <slot name="footer"></slot>
      </div>
    </DrawerContent>
  </Drawer>
</template>
