import type { Ref } from 'vue';

import { ref } from 'vue';

import { LAYOUT_SIDEBAR_MAX_WIDTH, LAYOUT_SIDEBAR_MIN_WIDTH } from '../layout';

/**
 * 侧栏宽度拖拽。
 *
 * 只处理"一根竖条改一列宽度"这件事：指针按下取起点，移动算预览值并按
 * `LAYOUT_SIDEBAR_MIN_WIDTH ~ MAX_WIDTH` 夹住，抬起才交回使用方落盘。
 * 中途不写偏好 —— 偏好会进 localStorage，一次拖拽上百个 move 就是上百次写入。
 *
 * 监听挂在 window 上而不是拖拽条上：指针滑出那一两像素时拖动不该断。
 */

export interface SidebarDragOptions {
  /** 拖动结束时把宽度交给使用方（写偏好、写 store 都由使用方决定） */
  commit: (width: number) => void;
  /** 当前宽度（折叠态与浮层态由使用方自己判断，这里只读展开宽度） */
  width: () => number;
}

export interface SidebarDragApi {
  /** 拖拽进行中的预览宽度，未拖拽时为 null —— 渲染侧优先取它 */
  draggingWidth: Ref<null | number>;
  /** 是否正在拖：用来关掉宽度过渡动画，否则跟手感会变成"弹一下" */
  isDragging: Ref<boolean>;
  /** 禁用拖拽（折叠态、浮层态）时直接忽略这次按下 */
  start: (event: PointerEvent) => void;
}

function clampWidth(value: number): number {
  return Math.min(
    LAYOUT_SIDEBAR_MAX_WIDTH,
    Math.max(LAYOUT_SIDEBAR_MIN_WIDTH, Math.round(value)),
  );
}

export function useSidebarDrag(options: SidebarDragOptions): SidebarDragApi {
  const draggingWidth = ref<null | number>(null);
  const isDragging = ref(false);

  function start(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();

    const originX = event.clientX;
    const originWidth = options.width();
    isDragging.value = true;
    draggingWidth.value = originWidth;
    // 拖过菜单文字时不该顺手选出一片蓝
    const body = document.body;
    const previousUserSelect = body.style.userSelect;
    body.style.userSelect = 'none';

    const onMove = (moveEvent: PointerEvent) => {
      draggingWidth.value = clampWidth(
        originWidth + moveEvent.clientX - originX,
      );
    };
    const stop = (commit: boolean) => {
      const next = draggingWidth.value;
      isDragging.value = false;
      draggingWidth.value = null;
      body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (commit && next !== null && next !== originWidth) {
        options.commit(next);
      }
    };
    const onUp = () => stop(true);
    /** 手势被系统接管（滚动、快捷键）时这一列宽度回到原样，不写偏好 */
    const onCancel = () => stop(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  return { draggingWidth, isDragging, start };
}
