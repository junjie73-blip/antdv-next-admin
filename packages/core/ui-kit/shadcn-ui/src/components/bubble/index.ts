import type { VariantProps } from 'class-variance-authority';

import { cva } from 'class-variance-authority';

export { default as Bubble } from './Bubble.vue';
export { default as BubbleContent } from './BubbleContent.vue';
export { default as BubbleGroup } from './BubbleGroup.vue';
export { default as BubbleReactions } from './BubbleReactions.vue';

export const bubbleVariants = cva(
  'group/bubble relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end data-[align=end]:self-end data-[variant=ghost]:max-w-full',
  {
    variants: {
      variant: {
        default:
          '*:data-[slot=bubble-content]:bg-primary *:data-[slot=bubble-content]:text-primary-foreground [&>[data-slot=bubble-content]:is(button,a):hover]:bg-primary/80',
        secondary:
          '*:data-[slot=bubble-content]:bg-secondary *:data-[slot=bubble-content]:text-secondary-foreground [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,hsl(var(--secondary)),hsl(var(--foreground))_5%)]',
        muted:
          '*:data-[slot=bubble-content]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,hsl(var(--muted)),hsl(var(--foreground))_5%)]',
        tinted:
          '*:data-[slot=bubble-content]:text-foreground *:data-[slot=bubble-content]:bg-[oklch(from_hsl(var(--primary))_0.93_calc(c*0.4)_h)] dark:*:data-[slot=bubble-content]:bg-[oklch(from_hsl(var(--primary))_0.3_calc(c*0.4)_h)] [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_hsl(var(--primary))_0.88_calc(c*0.5)_h)] dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_hsl(var(--primary))_0.35_calc(c*0.5)_h)]',
        outline:
          '*:data-[slot=bubble-content]:bg-background *:data-[slot=bubble-content]:border-border [&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-input/30',
        ghost:
          '[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted/50 border-none *:data-[slot=bubble-content]:rounded-none *:data-[slot=bubble-content]:bg-transparent *:data-[slot=bubble-content]:p-0',
        destructive:
          '*:data-[slot=bubble-content]:bg-destructive/10 *:data-[slot=bubble-content]:text-destructive [&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/20 dark:*:data-[slot=bubble-content]:bg-destructive/20 dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
export type BubbleVariants = VariantProps<typeof bubbleVariants>;

export const bubbleReactionsVariants = cva(
  'bg-muted ring-card absolute z-10 flex w-fit shrink-0 items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-sm ring-3 has-[button]:p-0',
  {
    variants: {
      side: {
        top: 'top-0 -translate-y-3/4',
        bottom: 'bottom-0 translate-y-3/4',
      },
      align: {
        start: 'left-3',
        end: 'right-3',
      },
    },
    defaultVariants: {
      side: 'bottom',
      align: 'end',
    },
  },
);
export type BubbleReactionsVariants = VariantProps<
  typeof bubbleReactionsVariants
>;
