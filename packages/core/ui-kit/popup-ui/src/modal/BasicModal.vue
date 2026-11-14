<script setup lang="ts">
import type { ModalInnerMethods, ModalMethods, ModalProps } from '../types';

import {
  computed,
  getCurrentInstance,
  onDeactivated,
  onMounted,
  ref,
  useId,
  useSlots,
  watch,
} from 'vue';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Spinner,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Check, X } from '@lucide/vue';
import { useTimeoutFn } from '@vueuse/core';

import { resolvePopupButton } from '../shared/button';
import { resolveConfirmHandler } from '../shared/confirm';
import { isFocusOutsideEvent } from '../shared/dismiss';
import { CLOSED_PANEL_INERT } from '../shared/presence';
import ModalWrapper from './ModalWrapper.vue';

const props = withDefaults(defineProps<ModalProps>(), {
  useWrapper: true,
  showFooter: true,
  showCancelBtn: true,
  showOkBtn: true,
  cancelText: '关闭',
  okText: '保存',
  maskClosable: true,
  keyboard: true,
  closable: true,
  centered: true,
  wrapperFooterOffset: 0,
  mask: true,
  destroyOnHidden: true,
});

const emit = defineEmits<{
  register: [instance: ModalInnerMethods & ModalMethods];
  ok: [e: MouseEvent];
  cancel: [e: MouseEvent];
  'update:open': [visible: boolean];
  visibleChange: [visible: boolean];
}>();

const slots = useSlots();
/** setup 同期抓取：事件回调里 getCurrentInstance() 已为 null */
const vm = getCurrentInstance();

const modalId = useId();
const modalTitleId = `${modalId}-title`;
const modalContentId = `${modalId}-content`;

defineExpose({
  modalTitleId,
  modalContentId,
});

const visibleRef = ref(props.open || false);
const okLoadingRef = ref(false);
const loadingRef = ref(props.loading || false);

/** setModalProps 的动态覆盖层：不改 props 引用本身，避免 Vue 只读告警 */
const propOverrides = ref<Partial<ModalProps>>({});
const merged = computed(() => ({ ...props, ...propOverrides.value }));

const getWidth = computed(() => {
  const w = merged.value.width;
  if (w === undefined) return '520px';
  return typeof w === 'number' ? `${w}px` : w;
});

const contentStyle = computed(() => ({
  width: getWidth.value,
  zIndex: merged.value.zIndex,
  ...merged.value.dialogStyle,
}));

const contentClass = computed(() =>
  cn(
    // 与 BasicDrawer 同构：整体作为 flex 纵向列、并给一个视口上限，由 ModalWrapper
    // 的 `flex-1 min-h-0` 精确填满头/脚之间的剩余空间并内部滚动 —— 旧实现靠
    // `maxHeight: windowHeight - 200` 拍脑袋估值，长表单会被视口或底部按钮裁掉。
    'basic-modal flex max-h-[90vh] max-w-none! flex-col gap-0 overflow-hidden p-0',
    CLOSED_PANEL_INERT,
    merged.value.centered
      ? ''
      : 'top-20! translate-y-0 data-[state=open]:animate-none',
    merged.value.wrapClassName,
  ),
);

function setVisible(val: boolean) {
  visibleRef.value = val;
  emit('visibleChange', val);
  emit('update:open', val);
}

const modalMethods: ModalMethods = {
  openModal: (visible = true) => {
    if (visible) setVisible(true);
  },
  closeModal: async () => {
    if (merged.value.closeFunc) {
      const canClose = await merged.value.closeFunc();
      if (!canClose) return;
    }
    visibleRef.value = false;
    okLoadingRef.value = false;
    loadingRef.value = false;
    emit('visibleChange', false);
    emit('update:open', false);
    merged.value.afterClose?.();
  },
  setModalProps: (newProps) => {
    propOverrides.value = { ...propOverrides.value, ...newProps };
    if (newProps.open !== undefined) visibleRef.value = newProps.open;
    if (newProps.loading !== undefined) loadingRef.value = newProps.loading;
  },
  getVisible: () => visibleRef.value,
};

const innerMethods: ModalInnerMethods & ModalMethods = {
  ...modalMethods,
  changeOkLoading: (loading) => {
    okLoadingRef.value = loading;
  },
  changeLoading: (loading) => {
    loadingRef.value = loading;
  },
};

const { start: scheduleRegister } = useTimeoutFn(
  () => emit('register', innerMethods),
  0,
  { immediate: false },
);

onMounted(() => {
  scheduleRegister();
});

/**
 * 页面被 `<KeepAlive>` 缓存时，组件的根 DOM 会被搬进缓存容器，
 * 但 Teleport 到 body 的 DialogContent 不会被一起搬走 —— 表现是「在用户管理
 * 打开新增弹窗 → 切到字典管理，弹窗和蒙层仍盖在新页面上」。
 * 这里在缓存失活时强制收起，且不经过 closeFunc（切页不是取消操作，不该被
 * 「有未保存内容」的守卫拦下来）。
 */
onDeactivated(() => {
  if (!visibleRef.value) return;
  visibleRef.value = false;
  okLoadingRef.value = false;
  loadingRef.value = false;
  emit('visibleChange', false);
  emit('update:open', false);
});

watch(
  () => props.open,
  (val) => {
    visibleRef.value = val || false;
  },
  { immediate: true },
);

/**
 * 确认按钮：loading 的生命周期跟「提交函数」严格对齐。
 *
 * 旧实现是 `okLoading=true; emit('ok')`，emit 不返回 listener 的 Promise，
 * 于是校验不通过（BasicForm.validate 会抛 FormValidateError）或接口报错时，
 * 没有任何人把 loading 关掉 —— 按钮永久转圈、禁用，用户只能关掉重开。
 * 现在自己 await 业务回调，`finally` 无条件复位。
 *
 * 提交回调 reject 属于**正常业务分支**而不是组件异常：表单校验失败、接口 4xx/5xx
 * 都由调用方用 `message.error` / 字段红字提示了。这里把弹层留在原地等重试即可，
 * 不能再把错误抛回事件循环（Vue 会打「Unhandled error during execution of
 * native event handler」，普通校验失败也满屏红字）。
 */
async function handleOk(e: MouseEvent) {
  if (okLoadingRef.value) return;
  okLoadingRef.value = true;
  try {
    const handler = resolveConfirmHandler(merged.value.onOk, vm);
    if (handler) {
      await handler(e);
    } else {
      // 没有业务回调时保留纯事件语义（父组件只监听 @ok / 单测 emitted('ok')）
      emit('ok', e);
    }
  } catch {
    // 提交未成功：保持弹层打开，用户可修正后重试（无操作，仅吞掉业务失败）
  } finally {
    // closeModal 里也会复位；这里再置一次是幂等的，专门兜住失败路径
    okLoadingRef.value = false;
  }
}

async function handleCancel(e?: MouseEvent) {
  emit('cancel', e as MouseEvent);
  await modalMethods.closeModal();
}

/**
 * 蒙层点击 / ESC 走 reka 的拦截事件，补上 closeFunc 守卫与 cancel 语义。
 *
 * 只绑 `interact-outside` 一个：reka 的 DismissableLayer 在一次外部按下时会连发
 * `pointerDownOutside` 和 `interactOutside`，两个都接就等于点一次蒙层关两次
 * （`closeFunc` 这类有副作用的钩子会被跑两遍）。焦点移出同样会进 `interactOutside`，
 * 但那是重新渲染把焦点甩回 body 的副作用，一律拦下。
 */
async function onInteractOutside(event: Event) {
  event.preventDefault();
  if (isFocusOutsideEvent(event)) return;
  if (!merged.value.maskClosable || !merged.value.closable) return;
  await handleCancel();
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
  <Dialog
    :open="visibleRef"
    :modal="merged.mask"
    @update:open="(v: boolean) => v || handleCancel()"
  >
    <DialogContent
      :class="contentClass"
      :style="contentStyle"
      :force-mount="!merged.destroyOnHidden"
      :show-close-button="false"
      aria-modal="true"
      role="dialog"
      @interact-outside="onInteractOutside"
      @escape-key-down="onEscapeKeyDown"
    >
      <!-- 自定义头部 -->
      <div
        :id="modalTitleId"
        :class="
          cn(
            'modal-header border-border flex items-center justify-between border-b px-6 py-4',
          )
        "
      >
        <div :class="cn('flex items-center gap-2')">
          <DialogTitle as-child>
            <span :class="cn('text-foreground text-lg font-medium')">
              {{ merged.title }}
            </span>
          </DialogTitle>
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

      <!-- 内容区域 -->
      <DialogDescription :class="cn('sr-only')">
        {{ merged.title ? `${merged.title} 对话框` : '对话框内容' }}
      </DialogDescription>
      <ModalWrapper
        :loading="loadingRef"
        :loading-tip="merged.loadingTip"
        :height="merged.height"
        :min-height="merged.minHeight"
        :footer-offset="merged.wrapperFooterOffset"
        :visible="visibleRef"
        :use-wrapper="merged.useWrapper"
        :body-style="merged.bodyStyle"
      >
        <slot></slot>
      </ModalWrapper>

      <!-- 底部按钮 -->
      <div
        v-if="
          merged.showFooter &&
          !slots.footer &&
          (merged.showCancelBtn || merged.showOkBtn)
        "
        :class="
          cn(
            'modal-footer border-border flex items-center justify-center gap-3 border-t px-6 py-4',
          )
        "
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
      <div
        v-else-if="slots.footer"
        :class="cn('modal-footer border-border border-t px-6 py-4')"
      >
        <slot name="footer"></slot>
      </div>
    </DialogContent>
  </Dialog>
</template>
