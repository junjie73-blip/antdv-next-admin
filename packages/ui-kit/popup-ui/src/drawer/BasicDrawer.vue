<script setup lang="ts">
import type {
  DrawerInnerMethods,
  DrawerMethods,
  DrawerProps,
} from './types';

import {
  computed,
  onMounted,
  ref,
  useId,
  useSlots,
  watch,
} from 'vue';

import {
  Button,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Spinner,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';
import { Check, X } from '@lucide/vue';
import { useTimeoutFn } from '@vueuse/core';

import { resolvePopupButton } from '../shared/button';
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
  zIndex: 1000,
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
    const size = merged.value.size || merged.value.width;
    if (typeof size === 'string') {
      return Number.parseInt(size, 10) || 520;
    }
    return size || 520;
  }
  if (placement === 'top' || placement === 'bottom') {
    const size = merged.value.size || merged.value.height;
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

const contentStyle = computed(() => ({
  ...(isHorizontal.value
    ? { width: `${getSize.value}px` }
    : { height: `${getSize.value}px` }),
  zIndex: merged.value.zIndex,
  ...merged.value.drawerStyle,
}));

const contentClass = computed(() =>
  cn(
    'basic-drawer flex flex-col gap-0 [&>button]:hidden!',
    // 尺寸靠 contentStyle 的内联 width/height，这里只解开 SheetContent 的 max-w 上限；
    // 别再叠 `w-auto!`，important 会反过来把内联宽度顶掉
    isHorizontal.value && 'max-w-none!',
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

watch(
  () => [merged.value.open, merged.value.visible] as const,
  ([open, visible]) => {
    visibleRef.value = open || visible || false;
  },
  { immediate: true },
);

async function handleOk(e: MouseEvent) {
  okLoadingRef.value = true;
  emit('ok', e);
}

async function handleCancel(e?: MouseEvent) {
  emit('cancel', e as MouseEvent);
  await drawerMethods.closeDrawer();
}

function onRootUpdate(val: boolean) {
  if (val) visibleRef.value = true;
  else void handleCancel();
}

function onInteractOutside(event: Event) {
  event.preventDefault();
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
  <Sheet :open="visibleRef" :modal="merged.mask" @update:open="onRootUpdate">
    <SheetContent
      :side="merged.placement"
      :class="contentClass"
      :style="contentStyle"
      :force-mount="!merged.destroyOnHidden"
      aria-modal="true"
      role="dialog"
      @pointer-down-outside="onInteractOutside"
      @interact-outside="onInteractOutside"
      @escape-key-down="onEscapeKeyDown"
    >
      <!-- 自定义头部 -->
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
          <SheetTitle as-child>
            <span :class="cn('text-foreground text-lg font-medium')">
              {{ merged.title }}
            </span>
          </SheetTitle>
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
      <slot v-else name="header"></slot>

      <!-- 内容区域 -->
      <SheetDescription :class="cn('sr-only')">
        {{ merged.title ? `${merged.title} 抽屉` : '抽屉内容' }}
      </SheetDescription>
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
                cn('primary animate-spin border-2 border-t-transparent h-8 w-8 rounded-full border-current/20')
              "
            ></div>
            <span v-if="merged.loadingTip" :class="cn('text-muted-foreground text-sm')">{{
              merged.loadingTip
            }}</span>
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
        v-if="merged.showFooter && !slots.footer && (merged.showCancelBtn || merged.showOkBtn)"
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
    </SheetContent>
  </Sheet>
</template>
