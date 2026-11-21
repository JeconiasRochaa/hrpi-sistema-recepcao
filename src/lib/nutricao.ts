import type { Registro } from '@/types';
import { entradaTs } from './datetime';
import { normalizar } from './text';
import { SETORES } from './constants';

export interface GrupoNutricao { setor: string; itens: Registro[] }

/** Acompanhantes presentes (visitantes não recebem refeição), agrupados por setor e ordenados por leito (1, 2, 10…). */
export function agruparNutricao(presentes: Registro[], filtro = '', setor = ''): GrupoNutricao[] {
  const t = normalizar(filtro);
  const por = new Map<string, Registro[]>();
  for (const r of presentes) {
    if (r.tipo !== 'acompanhante' || r.status !== 'presente') continue;
    if (setor && r.setor !== setor) continue;
    if (t && ![r.nomeAcompanhante, r.nomePaciente, r.leito, r.parentesco].some((c) => normalizar(c).includes(t))) continue;
    const g = por.get(r.setor);
    if (g) g.push(r); else por.set(r.setor, [r]);
  }
  const ordem = (s: string) => { const i = (SETORES as readonly string[]).indexOf(s); return i === -1 ? 999 : i; };
  return [...por.entries()]
    .sort((a, b) => ordem(a[0]) - ordem(b[0]) || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([s, itens]) => ({ setor: s, itens: itens.sort((a, b) => (a.leito ?? '').localeCompare(b.leito ?? '', 'pt-BR', { numeric: true }) || entradaTs(a) - entradaTs(b)) }));
}

export const totalNutricao = (g: GrupoNutricao[]) => g.reduce((n, x) => n + x.itens.length, 0);
