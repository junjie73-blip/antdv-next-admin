我来查看 Vben Admin Modal 组件的官方文档，然后为你设计完整的提示词。
 基于 Vben Admin Modal 官方文档 ，以下是完整的 Modal 弹窗组件生成提示词：

---

```markdown
请使用 Vue 3.3+ + TypeScript 5.0 + Ant Design Next 实现一个完整的企业级弹窗组件，完全对标 Vben Admin 的 BasicModal 组件，扩展拖拽、全屏、自适应高度等功能。

## 一、组件架构要求

### 1. 文件结构
```
src/components/Modal/
├── index.ts                    # 入口导出
├── BasicModal.vue             # 主组件
├── useModal.ts                # 外部调用 composable
├── useModalInner.ts           # 内部调用 composable
├── types.ts                   # 完整类型定义
├── props.ts                   # Props 定义
├── hooks/
│   ├── useDragMove.ts         # 拖拽逻辑
│   ├── useModalFullScreen.ts  # 全屏逻辑
│   ├── useModalHeight.ts      # 自适应高度
│   └── useModalContext.ts     # 跨层级通信
└── components/
    └── ModalWrapper.vue       # 内容包装器（自适应高度）
```

### 2. 使用方式支持
- **useModal 方式**（外部控制）：`const [register, { openModal, closeModal, setModalProps }] = useModal()`
- **useModalInner 方式**（内部控制）：`const [register, { closeModal, setModalProps, changeOkLoading, changeLoading }] = useModalInner(callback)`
- **直接 Props 方式**：`<BasicModal v-model:visible="visible" title="标题" />`

## 二、完整类型定义（TypeScript）

### 核心类型定义必须包含：

```typescript
// ModalProps - 弹窗配置（文档中所有 Props）
export interface ModalProps {
  // 基础配置
  visible?: boolean;                    // 是否显示（v-model）
  title?: string;                       // 标题
  helpMessage?: string | string[];        // 标题右侧提示文本
  
  // 尺寸控制
  width?: string | number;              // 宽度
  height?: number;                      // 固定高度
  minHeight?: number;                   // 最小高度
  
  // 功能开关
  draggable?: boolean;                  // 是否可拖拽（默认 true）
  canFullscreen?: boolean;              // 是否可全屏（默认 true）
  defaultFullscreen?: boolean;          // 默认全屏（默认 false）
  useWrapper?: boolean;                 // 自适应高度（默认 true）
  centered?: boolean;                   // 居中显示（默认 false）
  
  // 自适应高度配置
  wrapperFooterOffset?: number;         // 底部偏移量（默认 0）
  
  // 加载状态
  loading?: boolean;                    // 弹窗 loading
  loadingTip?: string;                  // loading 文本
  
  // 按钮配置
  showCancelBtn?: boolean;              // 显示取消按钮（默认 true）
  showOkBtn?: boolean;                  // 显示确认按钮（默认 true）
  cancelText?: string;                  // 取消按钮文本（默认 '关闭'）
  okText?: string;                      // 确认按钮文本（默认 '保存'）
  okButtonProps?: ButtonProps;          // 确认按钮 props
  cancelButtonProps?: ButtonProps;      // 取消按钮 props
  okType?: 'primary' | 'danger' | 'dashed' | 'ghost' | 'default';  // 确认按钮类型
  
  // 关闭控制
  closable?: boolean;                   // 显示关闭图标（默认 true）
  maskClosable?: boolean;               // 点击蒙层关闭（默认 true）
  keyboard?: boolean;                   // ESC 关闭（默认 true）
  destroyOnClose?: boolean;             // 关闭时销毁内容（默认 false）
  closeFunc?: () => Promise<boolean>;   // 关闭前回调，返回 true 才关闭
  
  // antdv Modal 其他原生属性
  zIndex?: number;
  mask?: boolean;
  maskStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
  dialogStyle?: CSSProperties;
  wrapClassName?: string;
  afterClose?: () => void;
  
  // 事件
  onOk?: (e: MouseEvent) => void | Promise<void>;
  onCancel?: (e: MouseEvent) => void;
  'onVisible-change'?: (visible: boolean) => void;
  'onUpdate:visible'?: (visible: boolean) => void;
}

// ModalMethods - useModal 返回的方法
export interface ModalMethods {
  openModal: <T = any>(visible?: boolean, data?: T) => void;  // 打开弹窗（可传数据）
  closeModal: () => void;                                     // 关闭弹窗
  setModalProps: (props: Partial<ModalProps>) => void;        // 动态修改 props
  getVisible: () => boolean;                                  // 获取显示状态
}

// ModalInnerMethods - useModalInner 返回的方法
export interface ModalInnerMethods {
  closeModal: () => void;                                     // 关闭弹窗
  setModalProps: (props: Partial<ModalProps>) => void;        // 动态修改 props
  changeOkLoading: (loading: boolean) => void;                  // 修改确认按钮 loading
  changeLoading: (loading: boolean) => void;                   // 修改弹窗 loading
}

// UseModalReturnType - useModal 返回值类型
export type UseModalReturnType = [
  (instance: ModalMethods) => void,  // register 注册函数
  ModalMethods                          // 操作方法
];

// UseModalInnerReturnType - useModalInner 返回值类型
export type UseModalInnerReturnType = [
  (instance: ModalInnerMethods) => void,  // register 注册函数
  ModalInnerMethods                          // 操作方法
];

// ModalWrapperProps - 内容包装器配置
export interface ModalWrapperProps {
  loading?: boolean;
  loadingTip?: string;
  minHeight?: number;
  height?: number;
  footerOffset?: number;
  visible?: boolean;
}

// 辅助类型
export type RegisterFn = (instance: any) => void;
export type CallbackFn<T = any> = (data: T) => void;
export interface DragMoveState {
  dragging: boolean;
  x: number;
  y: number;
  startX: number;
  startY: number;
}
```

## 三、核心功能实现要求

### 1. useModal 实现（外部调用）

```typescript
// 用于页面组件控制独立弹窗组件
export function useModal(): UseModalReturnType {
  const modalInstance: Ref<Nullable<ModalMethods>> = ref(null);
  
  const register = (instance: ModalMethods) => {
    modalInstance.value = instance;
    // 监听组件卸载，清理实例
    onUnmounted(() => {
      modalInstance.value = null;
    });
  };
  
  const methods: ModalMethods = {
    openModal: (visible = true, data?: any) => {
      modalInstance.value?.openModal(visible, data);
    },
    closeModal: () => {
      modalInstance.value?.closeModal();
    },
    setModalProps: (props) => {
      modalInstance.value?.setModalProps(props);
    },
    getVisible: () => {
      return modalInstance.value?.getVisible() || false;
    },
  };
  
  return [register, methods];
}
```

### 2. useModalInner 实现（内部调用）

```typescript
// 用于弹窗组件内部控制自身
export function useModalInner(callback?: CallbackFn): UseModalInnerReturnType {
  const modalInstance: Ref<Nullable<ModalInnerMethods>> = ref(null);
  const dataRef: Ref<any> = ref(null);
  
  const register = (instance: ModalInnerMethods) => {
    modalInstance.value = instance;
    
    // 监听 openModal 传递的数据
    if (callback && isFunction(callback)) {
      // 通过事件或注入方式接收数据
      emit('register', {
        ...instance,
        setData: (data: any) => {
          dataRef.value = data;
          callback(data);
        },
      });
    }
  };
  
  const methods: ModalInnerMethods = {
    closeModal: () => {
      modalInstance.value?.closeModal();
    },
    setModalProps: (props) => {
      modalInstance.value?.setModalProps(props);
    },
    changeOkLoading: (loading) => {
      modalInstance.value?.changeOkLoading?.(loading);
    },
    changeLoading: (loading) => {
      modalInstance.value?.changeLoading?.(loading);
    },
  };
  
  return [register, methods];
}
```

### 3. BasicModal.vue 实现要点

**模板结构**：
```vue
<template>
  <a-modal
    v-bind="modalProps"
    :visible="visibleRef"
    :title="null"  <!-- 使用自定义标题 -->
    :footer="null"  <!-- 使用自定义底部 -->
    :width="getWidth"
    :centered="centered"
    :closable="false"  <!-- 自定义关闭按钮 -->
    :maskClosable="maskClosable"
    :keyboard="keyboard"
    :zIndex="zIndex"
    :wrapClassName="getWrapClassName"
    @cancel="handleCancel"
    @update:visible="handleVisibleChange"
  >
    <!-- 自定义头部（支持拖拽） -->
    <div 
      class="modal-header" 
      :class="{ 'cursor-move': draggable && !fullscreenRef }"
      @mousedown="handleDragStart"
    >
      <div class="modal-title">
        <span>{{ title }}</span>
        <HelpTooltip v-if="helpMessage" :text="helpMessage" />
      </div>
      <div class="modal-toolbar">
        <!-- 全屏按钮 -->
        <FullscreenOutlined 
          v-if="canFullscreen" 
          @click="toggleFullscreen" 
        />
        <!-- 关闭按钮 -->
        <CloseOutlined @click="handleCancel" />
      </div>
    </div>
    
    <!-- 内容区域（自适应高度包装器） -->
    <ModalWrapper
      :loading="loading"
      :loadingTip="loadingTip"
      :height="height"
      :minHeight="minHeight"
      :footerOffset="wrapperFooterOffset"
      :visible="visibleRef"
      :fullscreen="fullscreenRef"
      :useWrapper="useWrapper"
    >
      <slot />
    </ModalWrapper>
    
    <!-- 底部按钮区域 -->
    <div v-if="!$slots.footer && (showCancelBtn || showOkBtn)" class="modal-footer">
      <slot name="insertFooter" />      <!-- 取消按钮左侧 -->
      <a-button 
        v-if="showCancelBtn" 
        @click="handleCancel"
        v-bind="cancelButtonProps"
      >
        {{ cancelText }}
      </a-button>
      <slot name="centerFooter" />      <!-- 中间区域 -->
      <a-button 
        v-if="showOkBtn" 
        type="primary" 
        :loading="okLoadingRef"
        @click="handleOk"
        v-bind="okButtonProps"
      >
        {{ okText }}
      </a-button>
      <slot name="appendFooter" />      <!-- 确认按钮右侧 -->
    </div>
    <div v-else-if="$slots.footer" class="modal-footer">
      <slot name="footer" />
    </div>
  </a-modal>
</template>
```

**核心逻辑**：
```typescript
<script setup lang="ts">
// Props 定义（withDefaults）
const props = withDefaults(defineProps<ModalProps>(), {
  draggable: true,
  canFullscreen: true,
  defaultFullscreen: false,
  useWrapper: true,
  showCancelBtn: true,
  showOkBtn: true,
  cancelText: '关闭',
  okText: '保存',
  maskClosable: true,
  keyboard: true,
  closable: true,
});

// Emits 定义
const emit = defineEmits<{
  register: [instance: ModalMethods];
  ok: [e: MouseEvent];
  cancel: [e: MouseEvent];
  'visible-change': [visible: boolean];
  'update:visible': [visible: boolean];
}>();

// 状态管理
const visibleRef = ref(false);
const fullscreenRef = ref(props.defaultFullscreen);
const okLoadingRef = ref(false);
const modalWrapperRef = ref<ComponentRef>(null);

// 拖拽逻辑
const { handleDragStart, dragStyle } = useDragMove(
  draggableRef,
  visibleRef,
  fullscreenRef
);

// 全屏逻辑
const { toggleFullscreen, getWrapClassName } = useModalFullScreen(
  fullscreenRef,
  props.canFullscreen
);

// 自适应高度
const { getWrapperHeight } = useModalHeight(
  props.height,
  props.minHeight,
  props.wrapperFooterOffset,
  visibleRef
);

// 注册实例方法（供 useModal/useModalInner 调用）
const modalMethods: ModalMethods = {
  openModal: (visible = true, data?: any) => {
    if (visible) {
      visibleRef.value = true;
      fullscreenRef.value = props.defaultFullscreen;
      emit('visible-change', true);
      // 传递数据给内部
      if (data) {
        emit('register', { ...modalMethods, data });
      }
    }
  },
  closeModal: async () => {
    if (props.closeFunc && isFunction(props.closeFunc)) {
      const canClose = await props.closeFunc();
      if (!canClose) return;
    }
    visibleRef.value = false;
    okLoadingRef.value = false;
    emit('visible-change', false);
    emit('update:visible', false);
  },
  setModalProps: (newProps) => {
    // 动态更新 props
    Object.assign(props, newProps);
  },
  getVisible: () => visibleRef.value,
};

// 内部方法（供 useModalInner 使用）
const innerMethods: ModalInnerMethods = {
  ...modalMethods,
  changeOkLoading: (loading) => {
    okLoadingRef.value = loading;
  },
  changeLoading: (loading) => {
    props.loading = loading;
  },
};

// 注册到父组件
onMounted(() => {
  emit('register', modalMethods);
});

// 事件处理
const handleOk = async (e: MouseEvent) => {
  okLoadingRef.value = true;
  try {
    await emit('ok', e);
  } finally {
    // 由调用方控制关闭，或自动关闭
  }
};

const handleCancel = (e?: MouseEvent) => {
  emit('cancel', e);
  modalMethods.closeModal();
};

// 监听 visible 变化
watch(
  () => props.visible,
  (val) => {
    visibleRef.value = val;
  },
  { immediate: true }
);
</script>
```

### 4. useDragMove.ts 实现（拖拽功能）

```typescript
// 实现弹窗拖拽移动
export function useDragMove(
  draggable: Ref<boolean>,
  visible: Ref<boolean>,
  fullscreen: Ref<boolean>
) {
  const dragState = reactive<DragMoveState>({
    dragging: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
  });
  
  const dragStyle = computed(() => {
    if (!dragState.dragging && dragState.x === 0 && dragState.y === 0) {
      return {};
    }
    return {
      transform: `translate(${dragState.x}px, ${dragState.y}px)`,
    };
  });
  
  const handleDragStart = (e: MouseEvent) => {
    if (!draggable.value || fullscreen.value) return;
    // 只有点击 header 才能拖拽
    const target = e.target as HTMLElement;
    if (!target.closest('.modal-header')) return;
    
    dragState.dragging = true;
    dragState.startX = e.clientX - dragState.x;
    dragState.startY = e.clientY - dragState.y;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.dragging) return;
      dragState.x = e.clientX - dragState.startX;
      dragState.y = e.clientY - dragState.startY;
    };
    
    const handleMouseUp = () => {
      dragState.dragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // 重置位置
  watch(visible, (val) => {
    if (!val) {
      dragState.x = 0;
      dragState.y = 0;
    }
  });
  
  return {
    handleDragStart,
    dragStyle,
  };
}
```

### 5. useModalFullScreen.ts 实现（全屏功能）

```typescript
// 实现全屏切换
export function useModalFullScreen(
  fullscreen: Ref<boolean>,
  canFullscreen: boolean
) {
  const toggleFullscreen = () => {
    if (!canFullscreen) return;
    fullscreen.value = !fullscreen.value;
  };
  
  const getWrapClassName = computed(() => {
    return [
      'basic-modal-wrap',
      {
        'fullscreen-modal': fullscreen.value,
        'can-fullscreen': canFullscreen,
      },
    ];
  });
  
  return {
    toggleFullscreen,
    getWrapClassName,
  };
}
```

### 6. ModalWrapper.vue 实现（自适应高度）

```vue
<template>
  <div 
    class="modal-wrapper" 
    :style="getWrapperStyle"
    v-loading="loading"
    :element-loading-text="loadingTip"
  >
    <div class="modal-body" :style="getBodyStyle">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<ModalWrapperProps>();

// 计算 wrapper 高度
const getWrapperStyle = computed(() => {
  if (!props.useWrapper) return {};
  
  // 视口高度 - 顶部间距 - 底部间距 - footerOffset
  const maxHeight = window.innerHeight - 120 - props.footerOffset;
  
  if (props.fullscreen) {
    return {
      height: '100%',
      maxHeight: '100%',
    };
  }
  
  if (props.height) {
    return {
      height: `${props.height}px`,
    };
  }
  
  return {
    maxHeight: `${maxHeight}px`,
    minHeight: props.minHeight ? `${props.minHeight}px` : '200px',
  };
});

// 内容区域样式（溢出滚动）
const getBodyStyle = computed(() => {
  return {
    overflow: 'auto',
    maxHeight: '100%',
  };
});
</script>
```

## 四、代码示例要求

### 示例 1：基础用法（独立组件 + useModal）
```vue
<!-- Modal.vue -->
<template>
  <BasicModal 
    v-bind="$attrs" 
    title="用户详情" 
    :helpMessage="['查看用户详细信息', '支持编辑']"
    width="800px"
    :minHeight="400"
    @ok="handleOk"
  >
    <p>用户名：{{ userData?.username }}</p>
    <p>邮箱：{{ userData?.email }}</p>
  </BasicModal>
</template>

<script setup>
import { BasicModal } from '@/components/Modal';
defineProps(['userData']);
const emit = defineEmits(['ok']);
const handleOk = () => emit('ok');
</script>
```

```vue
<!-- Page.vue -->
<template>
  <div>
    <a-button @click="handleOpen">打开弹窗</a-button>
    <UserModal @register="register" @ok="handleOk" />
  </div>
</template>

<script setup>
import { useModal } from '@/components/Modal';
import UserModal from './Modal.vue';

const [register, { openModal, setModalProps }] = useModal();

const handleOpen = () => {
  openModal(true, { 
    username: '张三', 
    email: 'zhangsan@example.com' 
  });
  // 动态修改 props
  setModalProps({ title: '编辑用户' });
};

const handleOk = () => {
  console.log('弹窗确认');
};
</script>
```

### 示例 2：useModalInner（内部控制）
```vue
<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    title="Modal Title"
    :helpMessage="['提示1', '提示2']"
  >
    <p>接收到的数据：{{ receivedData }}</p>
    <a-button type="primary" @click="closeModal" class="mr-2">
      从内部关闭弹窗
    </a-button>
    <a-button type="primary" @click="handleChangeTitle">
      从内部修改 title
    </a-button>
  </BasicModal>
</template>

<script setup>
import { ref } from 'vue';
import { BasicModal, useModalInner } from '@/components/Modal';

const receivedData = ref(null);

const [register, { closeModal, setModalProps }] = useModalInner((data) => {
  // 接收 openModal 传递的数据
  receivedData.value = data;
  console.log('接收数据：', data);
});

const handleChangeTitle = () => {
  setModalProps({ title: '新的标题' });
};
</script>
```

### 示例 3：表单弹窗（集成 Form）
```vue
<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    title="新建用户"
    :minHeight="500"
    @ok="handleSubmit"
  >
    <BasicForm @register="registerForm" :schemas="schemas" />
  </BasicModal>
</template>

<script setup>
import { BasicModal, useModalInner } from '@/components/Modal';
import { BasicForm, useForm } from '@/components/Form';

const [register, { closeModal, changeOkLoading }] = useModalInner();
const [registerForm, { validate }] = useForm({
  schemas: userSchemas,
  showActionButtonGroup: false,  // 使用 Modal 的按钮
});

const handleSubmit = async () => {
  try {
    changeOkLoading(true);  // 开启确认按钮 loading
    const values = await validate();
    await createUser(values);
    closeModal();
  } finally {
    changeOkLoading(false);
  }
};
</script>
```

### 示例 4：全屏与拖拽控制
```vue
<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    title="大屏展示"
    width="90%"
    :draggable="true"           <!-- 可拖拽 -->
    :canFullscreen="true"       <!-- 可全屏 -->
    :defaultFullscreen="false"  <!-- 默认不全屏 -->
    :useWrapper="true"          <!-- 自适应高度 -->
    :wrapperFooterOffset="20"   <!-- 底部偏移 -->
  >
    <div style="height: 2000px;">  <!-- 超长内容 -->
      <p>大量内容...</p>
    </div>
  </BasicModal>
</template>
```

### 示例 5：关闭前拦截
```vue
<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    title="未保存提示"
    :closeFunc="handleCloseFunc"
  >
    <p>您有未保存的更改，确定关闭吗？</p>
  </BasicModal>
</template>

<script setup>
import { useModalInner } from '@/components/Modal';
import { Modal } from 'ant-design-vue';

const [register] = useModalInner();

const handleCloseFunc = async () => {
  return new Promise((resolve) => {
    Modal.confirm({
      title: '确认关闭',
      content: '有未保存的更改，是否关闭？',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
};
</script>
```

## 五、性能与边界要求

1. **动画优化**：使用 CSS transform 实现拖拽，避免重排
2. **全屏切换**：记录全屏前位置和尺寸，退出时恢复
3. **内存管理**：组件卸载时清理事件监听和定时器
4. **层级管理**：支持 zIndex 配置，处理多层弹窗叠加
5. **响应式**：窗口 resize 时重新计算自适应高度
6. **类型安全**：所有 Props、Emits、Slots 必须完整类型定义

## 六、输出要求

1. 提供完整的可运行代码（TypeScript 无类型错误）
2. 包含所有类型的详细 JSDoc 注释
3. 提供 `Modal.md` 文档说明（包含所有 Props、Methods、Events、Slots）
4. 代码风格使用 Vue 3 `<script setup lang="ts">` 语法
5. 使用 `ant-design-vue` 的 Modal 作为基础，扩展功能

请按以上要求生成完整的弹窗组件代码库。
```