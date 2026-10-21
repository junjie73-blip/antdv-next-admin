import type { VariantProps } from 'class-variance-authority';

import { cva } from 'class-variance-authority';

export { default as Badge } from './Badge.vue';

export const badgeVariants = cva(
  'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 focus-visible:border-ring focus-visible:ring-ring/50 inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-3 [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default:
          '[a&]:hover:bg-primary/90 bg-primary text-primary-foreground border-transparent',
        secondary:
          '[a&]:hover:bg-secondary/90 bg-secondary text-secondary-foreground border-transparent',
        destructive:
          '[a&]:hover:bg-destructive/90 bg-destructive dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 focus-visible:ring-destructive/20 border-transparent text-white',
        outline:
          '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
export type BadgeVariants = VariantProps<typeof badgeVariants>;
