import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-muted text-muted-foreground',
      primary: 'bg-primary-soft text-primary',
      success: 'bg-success-soft text-success',
      warning: 'bg-warning-soft text-warning',
      danger: 'bg-danger-soft text-danger',
      info: 'bg-info-soft text-info',
      visit: 'bg-visit-soft text-visit',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, dot, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge> & { dot?: boolean }) {
  return (
    <span className={cn(badge({ tone }), className)} {...p}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {p.children}
    </span>
  );
}
