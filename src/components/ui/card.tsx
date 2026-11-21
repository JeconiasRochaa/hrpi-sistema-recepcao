import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border bg-card text-card-foreground shadow-card', className)} {...p} />;
}
export function CardHeader({ title, description, icon, actions, className }: { title: ReactNode; description?: ReactNode; icon?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4', className)}>
      <div className="flex items-center gap-3">
        {icon && <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">{icon}</span>}
        <div>
          <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}
export const CardBody = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('p-5', className)} {...p} />;
