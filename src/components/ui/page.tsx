import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({ titulo, descricao, acoes, icone }: { titulo: string; descricao?: string; acoes?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icone && <span className="hidden h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary sm:flex">{icone}</span>}
        <div>
          <h1 className="text-[22px] font-bold leading-tight tracking-tight">{titulo}</h1>
          {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

const tons = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  visit: 'bg-visit-soft text-visit',
  neutral: 'bg-muted text-muted-foreground',
} as const;

export function StatCard({
  titulo, valor, sub, icone, tom = 'primary', alerta,
}: { titulo: string; valor: ReactNode; sub?: ReactNode; icone: ReactNode; tom?: keyof typeof tons; alerta?: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card p-5 shadow-card transition-shadow hover:shadow-pop/60">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{titulo}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', tons[tom])}>{icone}</span>
      </div>
      <p className="tabular mt-3 text-[32px] font-bold leading-none tracking-tight">{valor}</p>
      {sub && <p className={cn('mt-2.5 text-xs', alerta ? 'font-medium text-warning' : 'text-muted-foreground')}>{sub}</p>}
    </div>
  );
}

export function DualStat({
  titulo, icone, esquerda, direita, tom = 'primary',
}: { titulo: string; icone: ReactNode; esquerda: { rotulo: string; valor: ReactNode }; direita: { rotulo: string; valor: ReactNode }; tom?: keyof typeof tons }) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{titulo}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', tons[tom])}>{icone}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 divide-x">
        <div className="pr-4">
          <p className="tabular text-[30px] font-bold leading-none tracking-tight text-primary">{esquerda.valor}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{esquerda.rotulo}</p>
        </div>
        <div className="pl-4">
          <p className="tabular text-[30px] font-bold leading-none tracking-tight text-visit">{direita.valor}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{direita.rotulo}</p>
        </div>
      </div>
    </div>
  );
}

export function SectionTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</h2>
      {extra}
    </div>
  );
}

export function Avatar({ nome, cor, tamanho = 32, className }: { nome: string; cor: string; tamanho?: number; className?: string }) {
  const ini = nome.trim().split(/\s+/).filter(Boolean);
  const t = ((ini[0]?.[0] ?? '?') + (ini.length > 1 ? ini[ini.length - 1][0] : '')).toUpperCase();
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-card', className)}
      style={{ width: tamanho, height: tamanho, background: cor, fontSize: tamanho * 0.38 }}
      aria-hidden
    >
      {t}
    </span>
  );
}
