import type { VariantProps } from 'class-variance-authority';

import { cva } from 'class-variance-authority';

export { default as Button } from './Button.vue';

export const buttonVariants = cva(
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 focus-visible:border-ring focus-visible:ring-ring/50 inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary hover:bg-primary/90 text-primary-foreground',
        destructive:
          'bg-destructive dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 focus-visible:ring-destructive/20 hover:bg-destructive/90 text-white',
        outline:
          'bg-background dark:bg-input/30 dark:border-input dark:hover:bg-input/50 hover:bg-accent hover:text-accent-foreground border shadow-xs',
        secondary:
          'bg-secondary hover:bg-secondary/80 text-secondary-foreground',
        ghost:
          'dark:hover:bg-accent/50 hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
export type ButtonVariants = VariantProps<typeof buttonVariants>;
