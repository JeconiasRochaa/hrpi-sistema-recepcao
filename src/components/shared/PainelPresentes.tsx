import { Link } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { exibirDataHora, entradaTs } from '@/lib/datetime';
import type { Registro } from '@/types';
import { TipoBadge } from './Badges';

/** Lista lateral de quem está no hospital agora (mais recentes primeiro). Com `onSelect`, um clique escolhe o registro. */
export function PainelPresentes({ presentes, titulo = 'No hospital agora', filtro, onSelect, selecionadoId, limite = 10 }: {
  presentes: Registro[]; titulo?: string; filtro?: (r: Registro) => boolean; onSelect?: (r: Registro) => void; selecionadoId?: string; limite?: number;
}) {
  const lista = presentes.filter((r) => !filtro || filtro(r)).sort((a, b) => entradaTs(b) - entradaTs(a));
  return (
    <Card className="flex min-h-0 flex-col self-start xl:sticky xl:top-0">
      <CardHeader title={titulo} description={`${lista.length} pessoa${lista.length === 1 ? '' : 's'}`} icon={<Users className="h-[18px] w-[18px]" />} />
      {lista.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Ninguém registrado no momento.</p> : (
        <ul className="divide-y overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {lista.slice(0, limite).map((r) => {
            const corpo = (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold">{r.nomeAcompanhante}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.nomePaciente} · {r.setor}{r.leito ? ` · ${r.leito}` : ''}</p>
                  <p className="text-[11px] text-muted-foreground">{exibirDataHora(r.dataEntrada, r.horaEntrada)}</p>
                </div>
                <TipoBadge tipo={r.tipo} />
              </>
            );
            return (
              <li key={r.id}>
                {onSelect
                  ? <button type="button" onClick={() => onSelect(r)} className={cn('flex w-full items-center gap-3 px-5 py-3 transition-colors hover:bg-muted', selecionadoId === r.id && 'bg-primary-soft')}>{corpo}</button>
                  : <div className="flex items-center gap-3 px-5 py-3">{corpo}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {lista.length > limite && <Link to="/ativos" className="flex items-center justify-center gap-1.5 border-t px-5 py-3 text-sm font-medium text-primary hover:bg-muted">Ver todos ({lista.length}) <ArrowRight className="h-4 w-4" /></Link>}
    </Card>
  );
}
