import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[.98] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline: 'border border-input bg-card hover:bg-muted',
        ghost: 'hover:bg-muted',
        danger: 'bg-danger text-white shadow-sm hover:bg-danger/90 dark:text-background',
        success: 'bg-success text-white shadow-sm hover:bg-success/90 dark:text-background',
        soft: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4', lg: 'h-11 px-6 text-[15px]', icon: 'h-8 w-8', 'icon-md': 'h-10 w-10' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, disabled, children, type = 'button', ...p }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...p}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
    {children}
  </button>
));
Button.displayName = 'Button';
