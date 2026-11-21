import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export const Table = ({ className, ...p }: HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto">
    <table className={cn('w-full border-collapse text-left text-sm', className)} {...p} />
  </div>
);
export const THead = (p: HTMLAttributes<HTMLTableSectionElement>) => <thead className="bg-muted/60" {...p} />;
export const Th = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:pl-5 last:pr-5', className)} {...p} />
);
export const Td = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-3 align-middle first:pl-5 last:pr-5', className)} {...p} />
);
export const Tr = ({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-t transition-colors hover:bg-muted/40', className)} {...p} />
);

export function EmptyState({ titulo, descricao, icone, acao }: { titulo: string; descricao?: string; icone?: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">{icone ?? <Inbox className="h-5 w-5" />}</span>
      <p className="text-sm font-semibold">{titulo}</p>
      {descricao && <p className="max-w-sm text-[13px] text-muted-foreground">{descricao}</p>}
      {acao}
    </div>
  );
}

export function Paginacao({ pagina, total, porPagina, onChange }: { pagina: number; total: number; porPagina: number; onChange: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total <= porPagina) return null;
  const ini = pagina * porPagina + 1;
  const fim = Math.min(total, (pagina + 1) * porPagina);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-[13px] text-muted-foreground">
      <span className="tabular">{ini}–{fim} de {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Página anterior" disabled={pagina === 0} onClick={() => onChange(pagina - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="tabular px-2">{pagina + 1} / {paginas}</span>
        <Button variant="outline" size="icon" aria-label="Próxima página" disabled={pagina >= paginas - 1} onClick={() => onChange(pagina + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
