import type { WatermarkOptions } from 'watermark-plus'

import { onMounted, onUnmounted, ref, unref, watch } from 'vue'
import Watermark from 'watermark-plus'

export interface UseWatermarkOptions {
  content?: unknown
  enabled?: unknown
}

export function useWatermark(options: UseWatermarkOptions = {}) {
  const watermarkInstance = ref<Watermark | null>(null)

  const defaultOptions: Partial<WatermarkOptions> = {
    width: 200,
    height: 150,
    rotate: 330,
    alpha: 0.15,
    fontSize: 14,
    fontWeight: 'normal',
    fontFamily: 'sans-serif',
    color: '#666666',
  }

  function createWatermark(customContent?: string) {
    if (watermarkInstance.value) {
      watermarkInstance.value.destroy()
    }

    const content = customContent || unref(options.content as any)

    if (!content) {
      return
    }

    const mergedOptions: Partial<WatermarkOptions> = {
      ...defaultOptions,
      content,
    }

    watermarkInstance.value = new Watermark(mergedOptions)
    watermarkInstance.value.create()
  }

  function destroyWatermark() {
    if (watermarkInstance.value) {
      watermarkInstance.value.destroy()
      watermarkInstance.value = null
    }
  }

  function updateWatermark(content: string) {
    destroyWatermark()
    if (content) {
      createWatermark(content)
    }
  }

  function checkAndCreate() {
    const enabled = unref(options.enabled as any)
    const content = unref(options.content as any)

    if (enabled && content) {
      createWatermark(content)
    }
    else {
      destroyWatermark()
    }
  }

  onMounted(() => {
    checkAndCreate()
  })

  onUnmounted(() => {
    destroyWatermark()
  })

  watch(
    () => unref(options.content as any),
    (newContent) => {
      const enabled = unref(options.enabled as any)
      if (enabled && newContent) {
        updateWatermark(newContent)
      }
      else {
        destroyWatermark()
      }
    },
  )

  watch(
    () => unref(options.enabled as any),
    (newEnabled) => {
      const content = unref(options.content as any)
      if (newEnabled && content) {
        createWatermark(content)
      }
      else {
        destroyWatermark()
      }
    },
  )

  return {
    watermarkInstance,
    createWatermark,
    destroyWatermark,
    updateWatermark,
  }
}
