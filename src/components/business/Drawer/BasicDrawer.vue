<script setup lang="ts">
import type { DrawerProps as AntDrawerProps } from 'antdv-next'
import type { DrawerInnerMethods, DrawerMethods, DrawerProps } from './types'
import { Button, Drawer } from 'antdv-next'
import { computed, onMounted, ref, useSlots, watch } from 'vue'
import { IconifyIcon as Icon } from '@/components/common/Icon'
import { cn } from '@/utils/cn'

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
  destroyOnHidden: false,
  zIndex: 1000,
})

const emit = defineEmits<{
  'register': [instance: DrawerMethods]
  'ok': [e: MouseEvent]
  'cancel': [e: MouseEvent]
  'visibleChange': [visible: boolean]
  'update:visible': [visible: boolean]
}>()

const slots = useSlots()

// ARIA 无障碍 ID（用于关联标题和内容）
const drawerId = `drawer-${Math.random().toString(36).slice(2, 9)}`
const drawerTitleId = `${drawerId}-title`

// 状态
const visibleRef = ref(props.open || false)
const okLoadingRef = ref(false)
const loadingRef = ref(props.loading || false)

// 计算尺寸
const getSize = computed(() => {
  if (props.placement === 'left' || props.placement === 'right') {
    const size = props.size || props.width
    if (typeof size === 'string') {
      return Number.parseInt(size, 10) || 520
    }
    return size || 520
  }
  if (props.placement === 'top' || props.placement === 'bottom') {
    const size = props.size || props.height
    if (typeof size === 'string') {
      return Number.parseInt(size, 10) || 400
    }
    return size || 400
  }
  return undefined
})

// 计算包裹层类名
const wrapClassName = computed(() => {
  return [
    'basic-drawer',
    props.wrapClassName,
  ].filter(Boolean).join(' ')
})

const drawerBodyClassName = cn('drawer-body relative h-full min-h-0', { 'p-4': props.useWrapper })

const drawerStyles = computed<AntDrawerProps['styles']>(() => ({
  header: {
    padding: '0',
    borderBottom: 'none',
  },
  body: {
    padding: '0',
    ...(props.bodyStyle || {}),
  },
  footer: {
    padding: '0',
    borderTop: 'none',
  },
}))

// Drawer 方法
const drawerMethods: DrawerMethods = {
  openDrawer: (visible = true, data?: any) => {
    if (visible) {
      visibleRef.value = true
      emit('visibleChange', true)
      emit('update:visible', true)
    }
  },
  closeDrawer: async () => {
    if (props.closeFunc) {
      const canClose = await props.closeFunc()
      if (!canClose)
        return
    }
    visibleRef.value = false
    okLoadingRef.value = false
    loadingRef.value = false
    emit('visibleChange', false)
    emit('update:visible', false)
  },
  setDrawerProps: (newProps) => {
    Object.assign(props, newProps)
  },
  getVisible: () => visibleRef.value,
}

// 内部方法（供 useDrawer composable 使用）
const _innerMethods: DrawerInnerMethods = {
  ...drawerMethods,
  changeOkLoading: (loading) => {
    okLoadingRef.value = loading
  },
  changeLoading: (loading) => {
    loadingRef.value = loading
  },
}

// 暴露内部方法供 composable 访问
defineExpose({
  ...drawerMethods,
  _innerMethods,
})
onMounted(() => {
  // 延迟注册，确保父组件已准备好接收
  setTimeout(() => {
    emit('register', drawerMethods)
  }, 0)
})

// 监听 open 变化
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
  drawerMethods.closeDrawer()
}
</script>

<script lang="ts">
// 在 script 中定义类名变量，遵循项目规范
const headerClassName = cn(
  'drawer-header flex items-center justify-between px-6 py-4 border-b border-gray-200',
)

const closeBtnClassName = cn(
  'p-1 text-gray-400 hover:text-gray-600 transition-colors',
  'cursor-pointer hover:bg-gray-100 rounded',
)

const footerClassName = cn(
  'flex items-center justify-center gap-3 px-4 py-3',
  'border-t border-gray-200 dark:border-gray-700',
)
</script>

<template>
  <Drawer
    :open="visibleRef"
    :title="null"
    :placement="placement"
    :size="getSize"
    :closable="false"
    :mask-closable="maskClosable"
    :keyboard="keyboard"
    :z-index="zIndex"
    :mask="mask"
    :footer="null"
    :mask-style="maskStyle"
    :drawer-style="drawerStyle"
    :header-style="headerStyle"
    :footer-style="footerStyle"
    :wrap-class-name="wrapClassName"
    :destroy-on-hidden="destroyOnHidden"
    :styles="drawerStyles"
    aria-modal="true"
    role="dialog"
    @close="handleCancel"
  >
    <!-- 自定义头部 -->
    <template #title>
      <div
        :id="drawerTitleId"
        :class="headerClassName"
      >
        <div :class="cn('flex items-center gap-2')">
          <span :class="cn('text-lg font-medium text-gray-900')">{{ title }}</span>
          <slot name="titleTip" />
        </div>
        <div :class="cn('flex items-center gap-2')">
          <!-- 关闭按钮 -->
          <button
            v-if="closable"
            :class="closeBtnClassName"
            type="button"
            :aria-label="`关闭${title ? ` ${title}` : ''}`"
            @click="handleCancel"
          >
            <Icon icon="ant-design:close-outlined" />
          </button>
        </div>
      </div>
    </template>

    <!-- 内容区域 -->
    <div
      :class="drawerBodyClassName"
      role="region"
      :aria-label="title || '抽屉内容'"
      :aria-labelledby="drawerTitleId"
    >
      <!-- Loading 遮罩 -->
      <div
        v-if="loadingRef"
        :class="cn(
          'absolute inset-0 z-10 flex items-center justify-center',
          'bg-white/80 backdrop-blur-sm',
        )"
      >
        <div :class="cn('flex flex-col items-center gap-2')">
          <div :class="cn('w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin')" />
          <span
            v-if="loadingTip"
            :class="cn('text-gray-600 text-sm')"
          >{{ loadingTip }}</span>
        </div>
      </div>

      <!-- 内容：使用 PerfectScrollbar 替代系统滚动条 -->
      <PerfectScrollbar class="h-full">
        <slot />
      </PerfectScrollbar>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div
        v-if="showFooter && !slots.footer && (showCancelBtn || showOkBtn)"
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
      >
        <slot name="footer" />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
:deep(.ant-drawer-content) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

:deep(.ant-drawer-body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
