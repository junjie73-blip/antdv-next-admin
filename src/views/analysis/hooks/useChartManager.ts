import type { Ref } from "vue";
import * as echarts from "echarts";
import { ref } from "vue";
import { isObject } from "es-toolkit/compat";

/**
 * 图表实例管理器
 * - 维护 name → ECharts 实例
 * - 提供 safeInit：等待容器有尺寸后再初始化
 * - 提供 disposeAll：组件卸载时清理
 */
export function useChartManager() {
  const charts = new Map<string, echarts.ECharts>();
  const cleanups = new Map<string, () => void>();

  function register(name: string, instance: echarts.ECharts, cleanup?: () => void) {
    charts.set(name, instance);
    if (cleanup) cleanups.set(name, cleanup);
  }

  function get(name: string) {
    return charts.get(name);
  }

  function remove(name: string) {
    const cleanup = cleanups.get(name);
    if (cleanup) {
      cleanup();
      cleanups.delete(name);
    }
    const instance = charts.get(name);
    if (instance) {
      instance.dispose();
      charts.delete(name);
    }
  }

  function disposeAll() {
    cleanups.forEach((fn) => fn());
    cleanups.clear();
    charts.forEach((c) => c.dispose());
    charts.clear();
  }

  /**
   * 安全初始化图表
   * 若容器无尺寸，等待 ResizeObserver 触发后再初始化
   */
  function safeInit(
    name: string,
    refEl: Ref<HTMLElement | undefined>,
    initFn: (el: HTMLElement) => Promise<echarts.ECharts | void>,
  ) {
    const el = refEl.value;
    if (!el || charts.has(name)) return;

    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      run(name, el, initFn);
      return;
    }

    let cleaned = false;
    const observer = new ResizeObserver((entries) => {
      if (cleaned) return;
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          cleaned = true;
          observer.disconnect();
          const target = refEl.value;
          if (target && !charts.has(name)) {
            run(name, target, initFn);
          }
          break;
        }
      }
    });
    observer.observe(el);

    setTimeout(() => {
      if (!cleaned && !charts.has(name)) {
        cleaned = true;
        observer.disconnect();
        const target = refEl.value;
        if (target) run(name, target, initFn);
      }
    }, 3000);
  }

  async function run(
    name: string,
    el: HTMLElement,
    initFn: (el: HTMLElement) => Promise<echarts.ECharts | void>,
  ) {
    try {
      const result = await initFn(el);
      if (result instanceof Object && "setOption" in result) {
        charts.set(name, result as echarts.ECharts);
      } else if (isObject(result)) {
        // moduleRank 返回 { instance, cleanup }
        const { instance, cleanup } = result as any;
        charts.set(name, instance);
        if (cleanup) cleanups.set(name, cleanup);
      }
    } catch (e) {
      console.warn(`[chart:${name}] init failed`, e);
    }
  }

  /** 响应式容器变化：批量 resize */
  function resizeAll() {
    charts.forEach((c) => c.resize());
  }

  return {
    charts,
    get,
    remove,
    disposeAll,
    safeInit,
    resizeAll,
  };
}
