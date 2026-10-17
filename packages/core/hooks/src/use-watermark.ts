import type { WatermarkStyleOptions as WatermarkLibraryOptions } from 'watermark-plus';

import type { MaybeRefOrGetter } from 'vue';

import { onMounted, onUnmounted, ref, toValue, watch } from 'vue';

import Watermark from 'watermark-plus';

/**
 * 水印实例的最小契约。
 *
 * 只声明用到的两个方法，而不是 `InstanceType<typeof Watermark>`：
 * 后者会把 `watermark-plus` 这个无类型库写进产物 d.ts，调用方会被迫处理 TS7016。
 */
export interface WatermarkInstance {
  create: () => void;
  destroy: () => void;
}

/** 对外暴露的样式选项（等价于库的入参，但类型由本包负责） */
export interface WatermarkStyleOptions {
  alpha?: number;
  color?: string;
  content?: string;
  fontFamily?: string;
  fontSize?: number | string;
  fontWeight?: number | string;
  height?: number;
  rotate?: number;
  width?: number;
}

export interface UseWatermarkOptions {
  /** 水印文案：支持 ref / getter，便于跟着用户信息变 */
  content?: MaybeRefOrGetter<string>;
  /** 开关：关掉即销毁 */
  enabled?: MaybeRefOrGetter<boolean>;
  /** 追加样式覆盖 */
  style?: MaybeRefOrGetter<WatermarkStyleOptions>;
}

/**
 * 页面水印：挂载时按 enabled + content 创建，任一变化都重建，卸载自动销毁。
 *
 * ⚠️ 依赖组件生命周期（onMounted / onUnmounted），必须在组件 setup 里调用；
 * 在组件外只是不创建，不会报错——真要在别处用，请改调 createWatermark。
 */
export function useWatermark(options: UseWatermarkOptions = {}) {
  const watermarkInstance = ref<null | WatermarkInstance>(null);

  const defaultOptions: WatermarkStyleOptions = {
    width: 200,
    height: 150,
    rotate: 330,
    alpha: 0.15,
    fontSize: 14,
    fontWeight: 'normal',
    fontFamily: 'sans-serif',
    color: '#666666',
  };

  function createWatermark(customContent?: string) {
    if (watermarkInstance.value) {
      watermarkInstance.value.destroy();
    }

    const content = customContent || toValue(options.content);

    if (!content) {
      return;
    }

    const mergedOptions: WatermarkStyleOptions = {
      ...defaultOptions,
      ...toValue(options.style),
      content,
    };

    // 库的 option 带 `[key: string]: unknown` 索引签名（它还有 zIndex 之类没列进来的字段），
    // 本包对外只承诺上面这几个，跨界处显式收口一次，调用方不会被无类型库污染。
    const instance: WatermarkInstance = new Watermark(
      mergedOptions as WatermarkLibraryOptions,
    );
    watermarkInstance.value = instance;
    instance.create();
  }

  function destroyWatermark() {
    if (watermarkInstance.value) {
      watermarkInstance.value.destroy();
      watermarkInstance.value = null;
    }
  }

  function updateWatermark(content: string) {
    destroyWatermark();
    if (content) {
      createWatermark(content);
    }
  }

  onMounted(() => {
    if (toValue(options.enabled) && toValue(options.content)) {
      createWatermark();
    }
  });

  onUnmounted(() => {
    destroyWatermark();
  });

  watch(
    () => toValue(options.content),
    (newContent) => {
      if (toValue(options.enabled) && newContent) {
        updateWatermark(newContent);
      } else {
        destroyWatermark();
      }
    },
  );

  watch(
    () => toValue(options.enabled),
    (newEnabled) => {
      const content = toValue(options.content);
      if (newEnabled && content) {
        createWatermark();
      } else {
        destroyWatermark();
      }
    },
  );

  return {
    watermarkInstance,
    createWatermark,
    destroyWatermark,
    updateWatermark,
  };
}
