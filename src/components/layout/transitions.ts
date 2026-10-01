import type { TransitionEffect } from '~/settings'

interface MotionVariant {
  initial: Record<string, unknown>
  enter: Record<string, unknown>
}

const COMMON_EASE = 'easeOut'
const COMMON_DURATION = 280

/**
 * 根据 transitionEffect 返回 initial / enter 状态
 *
 * 说明：
 *  - initial：入场前的起始状态
 *  - enter：入场后的目标状态，含 transition 配置
 *  - 所有变体都支持 `prefers-reduced-motion`（在组件里判断）
 */
export function getTransitionVariants(effect: TransitionEffect): MotionVariant {
  switch (effect) {
    /* ---------- 淡入 ---------- */
    case 'fade':
    default:
      return {
        initial: { opacity: 0 },
        enter: {
          opacity: 1,
          transition: { duration: 240, ease: COMMON_EASE },
        },
      }

    /* ---------- 滑动：左右上下 ---------- */
    case 'slide':
    case 'slide-right':
      return {
        initial: { opacity: 0, x: 40 },
        enter: {
          opacity: 1,
          x: 0,
          transition: { duration: COMMON_DURATION, ease: COMMON_EASE },
        },
      }

    case 'slide-left':
      return {
        initial: { opacity: 0, x: -40 },
        enter: {
          opacity: 1,
          x: 0,
          transition: { duration: COMMON_DURATION, ease: COMMON_EASE },
        },
      }

    case 'slide-up':
      return {
        initial: { opacity: 0, y: 32 },
        enter: {
          opacity: 1,
          y: 0,
          transition: { duration: COMMON_DURATION, ease: COMMON_EASE },
        },
      }

    case 'slide-down':
      return {
        initial: { opacity: 0, y: -32 },
        enter: {
          opacity: 1,
          y: 0,
          transition: { duration: COMMON_DURATION, ease: COMMON_EASE },
        },
      }

    /* ---------- 缩放 ---------- */
    case 'zoom':
    case 'scale':
      return {
        initial: { opacity: 0, scale: 0.96 },
        enter: {
          opacity: 1,
          scale: 1,
          transition: { duration: 260, ease: COMMON_EASE },
        },
      }

    /* ---------- 淡入 + 滑动 ---------- */
    case 'fade-slide':
      return {
        initial: { opacity: 0, y: 16 },
        enter: {
          opacity: 1,
          y: 0,
          transition: { duration: 300, ease: COMMON_EASE },
        },
      }

    /* ---------- 翻转 ---------- */
    case 'flip':
      return {
        initial: { opacity: 0, rotateY: 45, perspective: 1000 },
        enter: {
          opacity: 1,
          rotateY: 0,
          perspective: 1000,
          transition: { duration: 420, ease: COMMON_EASE },
        },
      }
  }
}

/** 用户是否开启了"减少动画" */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 无动画变体（减少动画 / effect 为 none 时使用） */
export const NO_MOTION_VARIANT: MotionVariant = {
  initial: { opacity: 1 },
  enter: { opacity: 1 },
}
