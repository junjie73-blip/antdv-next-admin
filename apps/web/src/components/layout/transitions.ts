import type { TransitionEffect } from '~/settings';

interface MotionVariant {
  initial: Record<string, unknown>;
  enter: Record<string, unknown>;
}

const COMMON_EASE = 'easeOut';
const COMMON_DURATION = 280;

export function getTransitionVariants(effect: TransitionEffect): MotionVariant {
  switch (effect) {
    case 'fade':
    default: {
      return {
        initial: { opacity: 0 },
        enter: { opacity: 1, transition: { duration: 240, ease: COMMON_EASE } },
      };
    }

    case 'slide':
    case 'slide-right': {
      return {
        initial: { opacity: 0, x: 40 },
        enter: {
          opacity: 1,
          x: 0,
          transition: { duration: COMMON_DURATION, ease: COMMON_EASE },
        },
      };
    }

    case 'slide-left': {
      return {
        initial: { opacity: 0, x: -40 },
        enter: {
          opacity: 1,
          x: 0,
          transition: { duration: COMMON_DURATION, ease: COMMON_EASE },
        },
      };
    }

    case 'slide-up': {
      return {
        initial: { opacity: 0, y: 32 },
        enter: {
          opacity: 1,
          y: 0,
          transition: { duration: COMMON_DURATION, ease: COMMON_EASE },
        },
      };
    }

    case 'slide-down': {
      return {
        initial: { opacity: 0, y: -32 },
        enter: {
          opacity: 1,
          y: 0,
          transition: { duration: COMMON_DURATION, ease: COMMON_EASE },
        },
      };
    }

    case 'zoom':
    case 'scale': {
      return {
        initial: { opacity: 0, scale: 0.96 },
        enter: {
          opacity: 1,
          scale: 1,
          transition: { duration: 260, ease: COMMON_EASE },
        },
      };
    }

    case 'fade-slide': {
      return {
        initial: { opacity: 0, y: 16 },
        enter: {
          opacity: 1,
          y: 0,
          transition: { duration: 300, ease: COMMON_EASE },
        },
      };
    }

    case 'flip': {
      return {
        initial: { opacity: 0, rotateY: 45, perspective: 1000 },
        enter: {
          opacity: 1,
          rotateY: 0,
          perspective: 1000,
          transition: { duration: 420, ease: COMMON_EASE },
        },
      };
    }
  }
}

export const NO_MOTION_VARIANT: MotionVariant = {
  initial: { opacity: 1 },
  enter: { opacity: 1 },
};
