我来查看 Vben Admin Loading 组件的官方文档，然后为你设计完整的提示词。
基于 Vben Admin Loading 官方文档 ，以下是完整的 Loading 加载组件生成提示词：

---

```markdown
请使用 Vue 3.3+ + TypeScript 5.0 实现一个完整的企业级 Loading 加载组件，完全对标 Vben Admin 的 Loading 组件，支持组件调用和指令调用两种方式。

## 一、组件架构要求

### 1. 文件结构
```
src/components/Loading/
├── index.ts                    # 入口导出
├── Loading.vue                # 组件主体
├── useLoading.ts              # 组合式函数
├── createLoading.ts           # 函数式创建 loading
├── directive.ts               # v-loading 指令
├── types.ts                   # 类型定义
└── css/
    └── index.less             # 样式文件
```

### 2. 使用方式支持
- **组件方式**：`<Loading :loading="true" tip="加载中..." />`
- **指令方式**：`v-loading="loadingRef" loading-tip="加载中..."`
- **函数方式**：`useLoading(options)` / `createLoading(options)`

## 二、完整类型定义（TypeScript）

```typescript
// LoadingProps - 加载组件配置（文档中所有 Props）
export interface LoadingProps {
  tip?: string;                         // 加载提示文本
  size?: 'default' | 'small' | 'large';   // 尺寸大小（默认 default）
  absolute?: boolean;                   // 绝对定位（默认 false，false 时全屏）
  loading?: boolean;                    // 加载状态（默认 false）
  background?: string;                  // 自定义背景色
  theme?: 'dark' | 'light';             // 主题色（默认 light，background 存在时优先）
}

// LoadingInstance - 组件实例方法
export interface LoadingInstance {
  close: () => void;                    // 关闭 loading
  open: () => void;                     // 打开 loading
  setTip: (tip: string) => void;       // 动态修改提示文本
  setLoading: (loading: boolean) => void; // 动态修改加载状态
}

// UseLoadingOptions - useLoading 配置选项
export interface UseLoadingOptions extends LoadingProps {
  target?: HTMLElement | string;          // 目标容器（CSS 选择器或元素）
  body?: boolean;                       // 是否挂载到 body（默认 true，全屏时）
  wrapClass?: string;                   // 包装器类名
}

// CreateLoadingOptions - createLoading 配置选项
export interface CreateLoadingOptions extends UseLoadingOptions {
  onClose?: () => void;                 // 关闭回调
}

// LoadingDirectiveBinding - 指令绑定值
export interface LoadingDirectiveBinding {
  value: boolean;                       // 是否显示
  modifiers?: {
    body?: boolean;                   // 修饰符：挂载到 body
    fullscreen?: boolean;             // 修饰符：全屏
  };
  arg?: string;                       // 参数：提示文本
}

// 辅助类型
export type LoadingSize = 'default' | 'small' | 'large';
export type LoadingTheme = 'dark' | 'light';
```

## 三、核心功能实现要求

### 1. Loading.vue 组件实现

**模板结构**：
```vue
<template>
  <Transition name="loading-fade" mode="out-in">
    <div
      v-show="loading"
      :class="[
        'loading-wrapper',
        {
          'loading-fullscreen': !absolute,
          'loading-absolute': absolute,
          [`loading-${size}`]: size !== 'default',
          [`loading-${theme}`]: !background,
        },
      ]"
      :style="getStyle"
    >
      <div class="loading-spin">
        <Spin :size="size" v-bind="$attrs" />
      </div>
      <div v-if="tip" class="loading-tip">
        {{ tip }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Spin } from 'ant-design-vue';
import type { LoadingProps } from './types';

const props = withDefaults(defineProps<LoadingProps>(), {
  size: 'default',
  absolute: false,
  loading: false,
  theme: 'light',
});

const getStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.background) {
    style.backgroundColor = props.background;
  }
  return style;
});
</script>
```

**样式要求**：
```less
.loading-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  transition: all 0.3s;
  
  // 全屏模式
  &.loading-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(255, 255, 255, 0.8);
    
    &.loading-dark {
      background-color: rgba(0, 0, 0, 0.7);
      color: #fff;
    }
  }
  
  // 绝对定位模式（容器内）
  &.loading-absolute {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.6);
    
    &.loading-dark {
      background-color: rgba(0, 0, 0, 0.5);
      color: #fff;
    }
  }
  
  // 尺寸
  &.loading-small {
    .loading-spin {
      transform: scale(0.8);
    }
  }
  &.loading-large {
    .loading-spin {
      transform: scale(1.2);
    }
  }
}

// 过渡动画
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.3s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}
```

### 2. useLoading.ts 实现

```typescript
// 用于在 setup 中控制 loading
export function useLoading(options: UseLoadingOptions = {}): LoadingInstance {
  const { target = document.body, body = true, ...props } = options;
  
  const loadingRef = ref(props.loading ?? false);
  const tipRef = ref(props.tip ?? '');
  
  // 创建 loading 元素
  let loadingEl: HTMLDivElement | null = null;
  let vm: ComponentPublicInstance | null = null;
  
  const createLoadingEl = () => {
    if (loadingEl) return;
    
    loadingEl = document.createElement('div');
    const targetEl = typeof target === 'string' 
      ? document.querySelector(target) 
      : target;
    
    if (!targetEl) {
      console.warn('useLoading: target element not found');
      return;
    }
    
    // 确保目标容器有定位
    const targetPosition = getComputedStyle(targetEl).position;
    if (targetPosition === 'static' && !body) {
      (targetEl as HTMLElement).style.position = 'relative';
    }
    
    // 挂载 loading 组件
    vm = createApp(Loading, {
      ...props,
      loading: loadingRef.value,
      tip: tipRef.value,
      absolute: !body,
    }).mount(loadingEl);
    
    if (body) {
      document.body.appendChild(loadingEl);
    } else {
      targetEl.appendChild(loadingEl);
    }
  };
  
  const removeLoadingEl = () => {
    if (loadingEl && vm) {
      vm.$unmount?.();
      loadingEl.remove();
      loadingEl = null;
      vm = null;
    }
  };
  
  const instance: LoadingInstance = {
    open: () => {
      if (!loadingEl) createLoadingEl();
      loadingRef.value = true;
      if (vm) {
        vm.$props.loading = true;
      }
    },
    close: () => {
      loadingRef.value = false;
      if (vm) {
        vm.$props.loading = false;
      }
      // 延迟移除 DOM，等待动画结束
      setTimeout(() => {
        if (!loadingRef.value) removeLoadingEl();
      }, 300);
    },
    setTip: (tip: string) => {
      tipRef.value = tip;
      if (vm) {
        vm.$props.tip = tip;
      }
    },
    setLoading: (loading: boolean) => {
      loadingRef.value = loading;
      if (vm) {
        vm.$props.loading = loading;
      }
      if (!loading) {
        setTimeout(() => {
          if (!loadingRef.value) removeLoadingEl();
        }, 300);
      }
    },
  };
  
  // 自动打开（如果初始 loading 为 true）
  if (props.loading) {
    instance.open();
  }
  
  // 组件卸载时清理
  tryOnUnmounted(() => {
    removeLoadingEl();
  });
  
  return instance;
}
```

### 3. createLoading.ts 实现（函数式调用）

```typescript
// 用于在任意位置（包括组件外）创建 loading
export function createLoading(options: CreateLoadingOptions = {}): LoadingInstance {
  const { onClose, ...rest } = options;
  
  const instance = useLoading({
    ...rest,
    body: true,  // 函数式调用默认全屏
  });
  
  // 包装 close 方法，触发回调
  const originalClose = instance.close;
  instance.close = () => {
    originalClose();
    onClose?.();
  };
  
  return instance;
}
```

### 4. directive.ts 实现（v-loading 指令）

```typescript
// v-loading 指令实现
const loadingDirective: Directive<HTMLElement, boolean> = {
  mounted(el, binding) {
    const tip = el.getAttribute('loading-tip') || '';
    const background = el.getAttribute('loading-background') || '';
    const theme = (el.getAttribute('loading-theme') as LoadingTheme) || 'light';
    
    // 确保容器有定位
    const position = getComputedStyle(el).position;
    if (position === 'static') {
      el.style.position = 'relative';
    }
    
    // 创建 loading 容器
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading-directive-wrapper';
    
    // 根据修饰符判断模式
    const isFullscreen = binding.modifiers?.fullscreen || false;
    const isBody = binding.modifiers?.body || isFullscreen;
    
    const vm = createApp(Loading, {
      loading: binding.value,
      tip,
      background,
      theme,
      absolute: !isBody,
      size: (el.getAttribute('loading-size') as LoadingSize) || 'default',
    }).mount(loadingEl);
    
    // 存储引用
    el._loadingInstance = vm;
    el._loadingEl = loadingEl;
    
    if (isBody) {
      document.body.appendChild(loadingEl);
    } else {
      el.appendChild(loadingEl);
    }
    
    // 初始状态
    updateLoading(el, binding);
  },
  
  updated(el, binding) {
    updateLoading(el, binding);
  },
  
  unmounted(el) {
    removeLoading(el);
  },
};

function updateLoading(el: HTMLElement, binding: DirectiveBinding<boolean>) {
  const instance = el._loadingInstance;
  if (instance) {
    instance.$props.loading = binding.value;
  }
}

function removeLoading(el: HTMLElement) {
  const loadingEl = el._loadingEl;
  if (loadingEl) {
    loadingEl.remove();
    el._loadingInstance?.$unmount?.();
    el._loadingInstance = null;
    el._loadingEl = null;
  }
}

// 扩展 HTMLElement 类型
declare global {
  interface HTMLElement {
    _loadingInstance?: ComponentPublicInstance;
    _loadingEl?: HTMLDivElement;
  }
}

export default loadingDirective;
```

## 四、代码示例要求

### 示例 1：组件方式使用
```vue
<template>
  <div class="content-box">
    <Loading :loading="loading" tip="数据加载中..." size="large" />
    <div v-show="!loading">内容区域</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Loading } from '@/components/Loading';

const loading = ref(true);
setTimeout(() => {
  loading.value = false;
}, 2000);
</script>
```

### 示例 2：指令方式使用（推荐）
```vue
<template>
  <div class="p-5" ref="wrapEl" v-loading="loadingRef" loading-tip="加载中...">
    <a-button @click="openLoading">打开 Loading</a-button>
    <div>大量内容...</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { vLoading } from '@/components/Loading';

const loadingRef = ref(false);

const openLoading = () => {
  loadingRef.value = true;
  setTimeout(() => {
    loadingRef.value = false;
  }, 2000);
};
</script>
```

### 示例 3：useLoading 方式（容器内）
```vue
<template>
  <div>
    <div ref="containerRef" class="container">
      <p>容器内容</p>
    </div>
    <a-button @click="openContainerLoading">容器内 Loading</a-button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useLoading } from '@/components/Loading';

const containerRef = ref(null);
let loadingInstance = null;

const openContainerLoading = () => {
  loadingInstance = useLoading({
    target: containerRef.value,
    tip: '容器加载中...',
    body: false,  // 非全屏，容器内
    background: 'rgba(0,0,0,0.3)',
  });
  
  loadingInstance.open();
  
  setTimeout(() => {
    loadingInstance.close();
  }, 2000);
};
</script>
```

### 示例 4：useLoading 方式（全屏）
```vue
<template>
  <div>
    <a-button @click="openFullLoading">全屏 Loading</a-button>
  </div>
</template>

<script setup>
import { useLoading } from '@/components/Loading';

const openFullLoading = () => {
  const loading = useLoading({
    tip: '全屏加载中...',
    body: true,  // 全屏
    theme: 'dark',
    size: 'large',
  });
  
  loading.open();
  
  setTimeout(() => {
    loading.close();
  }, 3000);
};
</script>
```

### 示例 5：createLoading 函数式调用（组件外）
```typescript
import { createLoading } from '@/components/Loading';

// 在任意位置调用，如路由守卫、请求拦截器等
const showPageLoading = () => {
  const loading = createLoading({
    tip: '页面初始化...',
    theme: 'dark',
    background: 'rgba(0,0,0,0.8)',
    onClose: () => {
      console.log('loading 已关闭');
    },
  });
  
  loading.open();
  
  // 异步操作完成后关闭
  return loading;
};

// 使用示例
const loading = showPageLoading();
await initApp();
loading.close();
```

### 示例 6：动态修改提示文本
```vue
<template>
  <div>
    <a-button @click="startUpload">开始上传</a-button>
  </div>
</template>

<script setup>
import { useLoading } from '@/components/Loading';

const startUpload = () => {
  const loading = useLoading({
    tip: '准备上传...',
  });
  
  loading.open();
  
  // 模拟上传进度
  let progress = 0;
  const timer = setInterval(() => {
    progress += 10;
    loading.setTip(`上传中 ${progress}%...`);
    
    if (progress >= 100) {
      clearInterval(timer);
      loading.setTip('处理中...');
      setTimeout(() => {
        loading.close();
      }, 500);
    }
  }, 200);
};
</script>
```

## 五、性能与边界要求

1. **DOM 清理**：组件卸载或关闭时自动清理 DOM 节点，防止内存泄漏
2. **动画优化**：使用 CSS transition 实现淡入淡出，避免重排
3. **层级管理**：全屏 loading z-index 设置为 9999，确保在最上层
4. **防抖处理**：频繁切换 loading 状态时防抖处理
5. **定位检测**：自动为 static 定位的容器添加 relative 定位
6. **类型安全**：所有 Props、Emits、指令绑定值必须完整类型定义

## 六、输出要求

1. 提供完整的可运行代码（TypeScript 无类型错误）
2. 包含所有类型的详细 JSDoc 注释
3. 提供 `Loading.md` 文档说明（包含所有 Props、Methods、指令用法）
4. 代码风格使用 Vue 3 `<script setup lang="ts">` 语法
5. 使用 `ant-design-vue` 的 Spin 组件作为加载动画基础

请按以上要求生成完整的加载组件代码库。
```