import type { MaybeRefOrGetter } from 'vue';

/**
 * Loading 组件尺寸类型
 */
export type LoadingSize = 'default' | 'large' | 'small';

/**
 * Loading 组件主题类型
 */
export type LoadingTheme = 'dark' | 'light';

/**
 * Loading 组件属性配置
 */
export interface LoadingProps {
  /**
   * 加载提示文本
   */
  tip?: string;

  /**
   * 尺寸大小
   * @default 'default'
   */
  size?: LoadingSize;

  /**
   * 是否使用绝对定位（容器内）
   * @default false - false 时为全屏模式
   */
  absolute?: boolean;

  /**
   * 加载状态
   * @default false
   */
  loading?: boolean;

  /**
   * 自定义背景色
   */
  background?: string;

  /**
   * 主题色
   * @default 'light'
   * @description 当 background 存在时优先使用 background
   */
  theme?: LoadingTheme;
}

/**
 * Loading 实例方法
 *
 * 语义约定：`open/close/setLoading` 控制显隐，`close` 会等淡出动画结束后自动清理 DOM；
 * `destroy` 是强制清理（不等动画），用于路由守卫中断、组件卸载等确定不再显示的场景。
 */
export interface LoadingInstance {
  /**
   * 关闭 loading（等待淡出动画后移除 DOM）
   */
  close: () => void;

  /**
   * 强制移除 loading DOM，不等动画，也不触发 `onClose`
   */
  destroy: () => void;

  /**
   * 打开 loading
   */
  open: () => void;

  /**
   * 动态修改提示文本
   */
  setTip: (tip: string) => void;

  /**
   * 动态修改加载状态
   */
  setLoading: (loading: boolean) => void;
}

/**
 * useLoading 配置选项
 */
export interface UseLoadingOptions extends LoadingProps {
  /**
   * 目标容器（CSS 选择器、元素、ref 或 getter）
   *
   * 容器是延迟解析的：只在第一次真正需要显示时才查找，
   * 因此在 `setup` 里对着还没挂载的 `useTemplateRef()` 写 getter 是安全的。
   */
  target?: MaybeRefOrGetter<HTMLElement | string | undefined>;

  /**
   * 是否挂载到 body
   * @default true - 全屏时默认为 true
   */
  body?: boolean;

  /**
   * 包装器类名
   */
  wrapClass?: string;
}

/**
 * createLoading 配置选项
 */
export interface CreateLoadingOptions extends UseLoadingOptions {
  /**
   * 关闭回调
   */
  onClose?: () => void;
}

/**
 * Loading 指令绑定值
 */
export interface LoadingDirectiveBinding {
  /**
   * 是否显示 loading
   */
  value: boolean;

  /**
   * 修饰符
   */
  modifiers?: {
    /**
     * 挂载到 body
     */
    body?: boolean;

    /**
     * 全屏模式
     */
    fullscreen?: boolean;
  };

  /**
   * 参数：提示文本
   */
  arg?: string;
}
