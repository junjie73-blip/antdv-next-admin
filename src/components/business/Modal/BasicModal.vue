<script setup lang="ts">
import type { ModalProps as AntModalProps } from 'antdv-next'
import type { ModalInnerMethods, ModalMethods, ModalProps } from './types'
import { Button, Modal } from 'antdv-next'
import { computed, onMounted, ref, useSlots, watch } from 'vue'
import { IconifyIcon as Icon } from '@/components/common/Icon'
import { cn } from '@/utils/cn'
import ModalWrapper from './components/ModalWrapper.vue'

const props = withDefaults(defineProps<ModalProps>(), {
  useWrapper: true,
  showCancelBtn: true,
  showOkBtn: true,
  cancelText: '关闭',
  okText: '保存',
  maskClosable: true,
  keyboard: true,
  closable: true,
  centered: true,
  wrapperFooterOffset: 0,
  zIndex: 1000,
  mask: true,
  destroyOnHidden: false,
})

const emit = defineEmits<{
  'register': [instance: ModalMethods]
  'ok': [e: MouseEvent]
  'cancel': [e: MouseEvent]
  'visible-change': [visible: boolean]
  'update:open': [visible: boolean]
}>()

const slots = useSlots()

// 状态
const visibleRef = ref(props.visible || false)
const okLoadingRef = ref(false)
const loadingRef = ref(props.loading || false)

// 计算宽度
const getWidth = computed(() => {
  return props.width || '520px'
})

// 计算包裹层类名
const wrapClassName = computed(() => {
  return [
    'basic-modal',
    props.wrapClassName,
  ].filter(Boolean).join(' ')
})

const modalStyles = computed<AntModalProps['styles']>(() => ({
  container: {
    padding: '0',
  },
  header: {
    padding: '0',
  },
  body: {
    padding: '0',
    ...(props.bodyStyle || {}),
  },
}))

// Modal 方法
const modalMethods: ModalMethods = {
  openModal: (visible = true, data?: any) => {
    if (visible) {
      visibleRef.value = true
      emit('visible-change', true)
      emit('update:open', true)
    }
  },
  closeModal: async () => {
    if (props.closeFunc) {
      const canClose = await props.closeFunc()
      if (!canClose)
        return
    }
    visibleRef.value = false
    okLoadingRef.value = false
    loadingRef.value = false
    emit('visible-change', false)
    emit('update:open', false)
  },
  setModalProps: (newProps) => {
    Object.assign(props, newProps)
  },
  getVisible: () => visibleRef.value,
}

// 内部方法
const innerMethods: ModalInnerMethods = {
  ...modalMethods,
  changeOkLoading: (loading) => {
    okLoadingRef.value = loading
  },
  changeLoading: (loading) => {
    loadingRef.value = loading
  },
}

// 注册
onMounted(() => {
  // 延迟注册，确保父组件已准备好接收
  setTimeout(() => {
    emit('register', modalMethods)
  }, 0)
})

// 监听 visible 变化
watch(
  () => props.open,
  (val) => {
    visibleRef.value = val || false
  },
  { immediate: true },
)

// 事件处理
async function handleOk(e: MouseEvent) {
  okLoadingRef.value = true
  emit('ok', e)
}

function handleCancel(e?: MouseEvent) {
  emit('cancel', e as MouseEvent)
  modalMethods.closeModal()
}

function handleVisibleChange(visible: boolean) {
  if (!visible) {
    handleCancel()
  }
}
</script>

<script lang="ts">
// 在 script 中定义类名变量，遵循项目规范
const headerClassName = cn(
  'modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200',
)

const closeBtnClassName = cn(
  'p-1 text-gray-400 hover:text-gray-600 transition-colors',
  'cursor-pointer hover:bg-gray-100 rounded',
)

const footerClassName = cn(
  'modal-footer flex items-center justify-center gap-3 px-6 py-4 border-t border-gray-200',
)
</script>

<template>
  <Modal
    :open="visibleRef"
    :title="null"
    :footer="null"
    :width="getWidth"
    :centered="centered"
    :closable="false"
    :mask-closable="maskClosable"
    :keyboard="keyboard"
    :z-index="zIndex"
    :mask="mask"
    :mask-style="maskStyle"
    :dialog-style="dialogStyle"
    :wrap-class-name="wrapClassName"
    :destroy-on-hidden="destroyOnClose"
    :styles="modalStyles"
    @cancel="handleVisibleChange"
  >
    <!-- 自定义头部 -->
    <template #title>
      <div :class="headerClassName">
        <div :class="cn('flex items-center gap-2')">
          <span :class="cn('text-lg font-medium text-gray-900')">{{ title }}</span>
          <slot name="titleTip" />
        </div>
        <div :class="cn('flex items-center gap-2')">
          <!-- 关闭按钮 -->
          <button
            v-if="closable"
            :class="closeBtnClassName"
            @click="handleCancel"
          >
            <Icon icon="ant-design:close-outlined" />
          </button>
        </div>
      </div>
    </template>

    <!-- 内容区域 -->
    <ModalWrapper
      :loading="loadingRef"
      :loading-tip="loadingTip"
      :height="height"
      :min-height="minHeight"
      :footer-offset="wrapperFooterOffset"
      :visible="visibleRef"
      :use-wrapper="useWrapper"
    >
      <slot />
    </ModalWrapper>

    <!-- 底部按钮 -->
    <div
      v-if="!slots.footer && (showCancelBtn || showOkBtn)"
      :class="footerClassName"
    >
      <slot name="insertFooter" />
      <Button
        v-if="showCancelBtn"
        v-bind="cancelButtonProps"
        @click="handleCancel"
      >
        <template #icon>
          <Icon icon="ant-design:close-outlined" />
        </template>
        {{ cancelText }}
      </Button>
      <slot name="centerFooter" />
      <Button
        v-if="showOkBtn"
        :type="okType || 'primary'"
        :loading="okLoadingRef"
        v-bind="okButtonProps"
        @click="handleOk"
      >
        <template #icon>
          <Icon icon="ant-design:check-outlined" />
        </template>
        {{ okText }}
      </Button>
      <slot name="appendFooter" />
    </div>
    <div
      v-else-if="slots.footer"
      :class="cn('modal-footer px-6 py-4 border-t border-gray-200')"
    >
      <slot name="footer" />
    </div>
  </Modal>
</template>
