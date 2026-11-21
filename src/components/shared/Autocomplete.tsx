import { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck } from 'lucide-react';
import { entradaTs } from '@/lib/datetime';
import { buscarPacientes, buscarPessoas, destacar, pontuar, type SugPaciente, type SugPessoa } from '@/lib/sugestoes';
import { mascararDocumento, normalizar } from '@/lib/text';
import type { Registro } from '@/types';
import { Combobox, Destaque } from './Combobox';
import { TipoBadge } from './Badges';

/** Nome do paciente: sugere pacientes já conhecidos (evita grafias diferentes) e traz setor/leito do último registro. */
export function PacienteAutocomplete({ id, value, onChange, indice, onPick, invalid }: {
  id?: string; value: string; onChange: (v: string) => void; indice: SugPaciente[]; onPick?: (p: SugPaciente) => void; invalid?: boolean;
}) {
  const items = useMemo(() => buscarPacientes(indice, value), [indice, value]);
  return (
    <Combobox<SugPaciente>
      id={id} value={value} onChange={onChange} items={items} itemKey={(p) => normalizar(p.nome)} invalid={invalid} placeholder="Nome do paciente" maxLength={120}
      onPick={(p) => { onChange(p.nome); onPick?.(p); }}
      titulo="Pacientes já registrados"
      render={(p) => (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold"><Destaque partes={destacar(p.nome, value)} /></p>
            <p className="truncate text-xs text-muted-foreground">{p.setor}{p.leito ? ` · Leito ${p.leito}` : ''}</p>
          </div>
          {p.presente && <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning" title={`Acompanhante atual: ${p.acompanhante}`}>Já tem acompanhante</span>}
        </div>
      )}
    />
  );
}

/** Nome do acompanhante/visitante: quem já passou pela recepção preenche documento, telefone e parentesco com um clique. */
export function PessoaAutocomplete({ id, value, onChange, indice, onPick, invalid, rotulo, autoFocus }: {
  id?: string; value: string; onChange: (v: string) => void; indice: SugPessoa[]; onPick?: (p: SugPessoa) => void; invalid?: boolean; rotulo?: string; autoFocus?: boolean;
}) {
  const items = useMemo(() => buscarPessoas(indice, value), [indice, value]);
  return (
    <Combobox<SugPessoa>
      id={id} value={value} onChange={onChange} items={items} itemKey={(p) => normalizar(p.nome)} invalid={invalid} placeholder={rotulo ?? 'Nome completo'} maxLength={120} autoFocus={autoFocus}
      onPick={(p) => { onChange(p.nome); onPick?.(p); }}
      titulo="Já passou pela recepção — preencher dados"
      render={(p) => (
        <div className="flex items-center gap-3">
          <UserCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold"><Destaque partes={destacar(p.nome, value)} /></p>
            <p className="truncate text-xs text-muted-foreground">{[p.parentesco, p.documento ? mascararDocumento(p.documento) : '', p.usos > 1 ? `${p.usos} registros` : ''].filter(Boolean).join(' · ') || 'Sem outros dados'}</p>
          </div>
          {p.presente && <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">Presente agora</span>}
        </div>
      )}
    />
  );
}

/** Busca entre os acompanhantes presentes (Saída e Troca). Com o campo vazio, mostra as entradas mais recentes. */
export function BuscaPresente({ presentes, selecionado, onSelect, onLimpar, autoFocus }: { presentes: Registro[]; selecionado?: Registro | null; onSelect: (r: Registro) => void; onLimpar: () => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  // Seleção feita fora do campo (ex.: clique na lista lateral) também preenche o texto
  useEffect(() => { if (selecionado) setQ(selecionado.nomeAcompanhante); }, [selecionado?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = useMemo(() => presentes.filter((r) => r.tipo === 'acompanhante'), [presentes]);
  const items = useMemo(() => {
    if (selecionado) return [];
    if (normalizar(q).length < 2) return [...base].sort((a, b) => entradaTs(b) - entradaTs(a)).slice(0, 6);
    return base
      .map((r) => ({ r, p: Math.max(...[r.nomeAcompanhante, r.nomePaciente, r.documento, r.leito].map((c) => pontuar(c ?? '', q))) }))
      .filter((x) => x.p > 0).sort((a, b) => b.p - a.p || entradaTs(b.r) - entradaTs(a.r)).slice(0, 8).map((x) => x.r);
  }, [q, base, selecionado]);
  return (
    <Combobox<Registro>
      value={q} onChange={(v) => { setQ(v); if (selecionado) onLimpar(); }} items={items} itemKey={(r) => r.id} autoFocus={autoFocus} abrirVazio
      inputClassName="h-12 pl-10 text-[15px]" placeholder="Nome do acompanhante, do paciente, leito ou documento…" vazio="Nenhum acompanhante presente encontrado."
      titulo={normalizar(q).length < 2 ? 'Entradas mais recentes' : undefined}
      leading={<Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />}
      onPick={(r) => { onSelect(r); setQ(r.nomeAcompanhante); }}
      render={(r) => (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold"><Destaque partes={destacar(r.nomeAcompanhante, q)} /></p>
            <p className="truncate text-xs text-muted-foreground">{r.nomePaciente} · {r.setor}{r.leito ? ` · Leito ${r.leito}` : ''}</p>
          </div>
          <TipoBadge tipo={r.tipo} />
        </div>
      )}
    />
  );
}
