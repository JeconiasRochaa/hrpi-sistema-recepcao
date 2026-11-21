import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton', className)} {...p} />;
}

export function TableSkeleton({ linhas = 8, colunas = 6 }: { linhas?: number; colunas?: number }) {
  return (
    <div role="status" aria-label="Carregando dados" className="divide-y">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          {Array.from({ length: colunas }, (_, j) => (
            <Skeleton key={j} className={cn('h-4', j === 0 ? 'w-16' : j === 1 ? 'w-40' : 'flex-1')} style={{ opacity: 1 - i * 0.07 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-card" role="status" aria-label="Carregando">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-9 w-20" />
      <Skeleton className="mt-3 h-3 w-36" />
    </div>
  );
}

export function ChartSkeleton({ altura = 260 }: { altura?: number }) {
  return (
    <div className="flex items-end gap-2 px-5 pb-5 pt-8" style={{ height: altura }} role="status" aria-label="Carregando gráfico">
      {[40, 65, 50, 80, 58, 72, 45, 66, 52, 78].map((h, i) => <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />)}
    </div>
  );
}
