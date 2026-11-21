import { CONFIG } from './constants';
import { dataHoje, diasDesde, entradaTs, formatarData, parseDataHora, saidaTs } from './datetime';
import { limparLegado, mesmoNome, normalizar } from './text';
import type { Registro } from '@/types';

/** Normaliza um registro vindo do banco (dados antigos podem ter HTML escapado ou campos ausentes). */
export function normalizarRegistro(raw: Record<string, unknown>, id?: string): Registro {
  const s = (k: string) => limparLegado((raw[k] as string | undefined) ?? '');
  return {
    ...(raw as unknown as Registro),
    id: (raw.id as string) || id || '',
    nomeAcompanhante: s('nomeAcompanhante'),
    documento: s('documento'),
    telefone: s('telefone'),
    parentesco: s('parentesco'),
    nomePaciente: s('nomePaciente'),
    setor: s('setor'),
    leito: s('leito'),
    observacao: s('observacao'),
    recepcionistaEntrada: s('recepcionistaEntrada'),
    recepcionistaSaida: s('recepcionistaSaida') || null,
    tipo: raw.tipo === 'visita' ? 'visita' : 'acompanhante',
    trocas: Array.isArray(raw.trocas)
      ? (raw.trocas as Registro['trocas'])!.map((t) => ({
          ...t,
          acompanhanteAntigo: limparLegado(t.acompanhanteAntigo),
          acompanhanteNovo: limparLegado(t.acompanhanteNovo),
          recepcionista: limparLegado(t.recepcionista),
        }))
      : [],
  };
}

export const porEntradaDesc = (a: Registro, b: Registro) => entradaTs(b) - entradaTs(a);

export const ehAcompanhante = (r: Registro) => r.tipo === 'acompanhante';
export const ehVisita = (r: Registro) => r.tipo === 'visita';

/** Saída motivada por alta do paciente (exclui saída automática, fim de horário e desistência). */
export function ehAlta(r: Registro): boolean {
  const o = (r.observacao || '').toLowerCase();
  return r.status === 'saiu' && r.tipo === 'acompanhante' && o.includes('alta do paciente') && !o.includes('saída automática') && !o.includes('desistência');
}

export function agruparDuplicados(presentes: Registro[]): Registro[][] {
  const g = new Map<string, Registro[]>();
  for (const r of presentes) {
    if (r.status !== 'presente' || r.tipo !== 'acompanhante') continue;
    const k = normalizar(r.nomePaciente);
    g.set(k, [...(g.get(k) ?? []), r]);
  }
  return [...g.values()].filter((x) => x.length > 1);
}

export function pendentesPresenca(presentes: Registro[]): Registro[] {
  return presentes.filter(
    (r) => r.status === 'presente' && r.tipo === 'acompanhante' && diasDesde(r.ultimaConfirmacao || r.dataEntrada) >= CONFIG.DIAS_ALERTA_PRESENCA,
  );
}

export function filtrarPorEntrada(list: Registro[], inicio: Date, fim: Date): Registro[] {
  const a = inicio.getTime();
  const b = fim.getTime();
  return list.filter((r) => {
    const t = entradaTs(r);
    return t >= a && t <= b;
  });
}

export function inicioMes(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
export function fimDeHoje(d = new Date()) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
export function inicioHoje(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function ultimosNDias(n: number, d = new Date()) { const x = inicioHoje(d); x.setDate(x.getDate() - (n - 1)); return x; }

export function permanenciaHoras(r: Registro): number | null {
  const s = saidaTs(r);
  const e = entradaTs(r);
  if (s === null || Number.isNaN(e) || s < e) return null;
  return (s - e) / 3_600_000;
}

export function permanenciaMediaHoras(list: Registro[]): number {
  const v = list.filter((r) => r.tipo === 'acompanhante' && r.status === 'saiu').map(permanenciaHoras).filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

export interface ResumoHoje {
  presentesAcomp: number; presentesVisit: number; pacientesAcompanhados: number;
  entradasAcomp: number; entradasVisit: number; saidasAcomp: number; saidasVisit: number;
  trocas: number; altas: number;
}

export function resumoHoje(todos: Registro[], presentes: Registro[], hoje = dataHoje()): ResumoHoje {
  const pa = presentes.filter((r) => r.status === 'presente' && r.tipo === 'acompanhante');
  return {
    presentesAcomp: pa.length,
    presentesVisit: presentes.filter((r) => r.status === 'presente' && r.tipo === 'visita').length,
    pacientesAcompanhados: new Set(pa.map((r) => normalizar(r.nomePaciente))).size,
    entradasAcomp: todos.filter((r) => r.dataEntrada === hoje && r.tipo === 'acompanhante').length,
    entradasVisit: todos.filter((r) => r.dataEntrada === hoje && r.tipo === 'visita').length,
    saidasAcomp: todos.filter((r) => r.dataSaida === hoje && r.status === 'saiu' && r.tipo === 'acompanhante').length,
    saidasVisit: todos.filter((r) => r.dataSaida === hoje && r.status === 'saiu' && r.tipo === 'visita').length,
    trocas: todos.filter((r) => r.dataSaida === hoje && r.status === 'trocado').length,
    altas: todos.filter((r) => r.dataSaida === hoje && ehAlta(r)).length,
  };
}

export function serieDiaria(list: Registro[], dias: number, fn: (r: Registro, dia: string) => boolean, d = new Date()) {
  const out: { dia: string; rotulo: string; valor: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(x.getDate() - i);
    const dia = formatarData(x);
    out.push({ dia, rotulo: dias <= 7 ? x.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : dia.slice(0, 5).replace('-', '/'), valor: list.filter((r) => fn(r, dia)).length });
  }
  return out;
}

export function porHora(list: Registro[]) {
  const h = Array.from({ length: 24 }, (_, i) => ({ hora: `${String(i).padStart(2, '0')}h`, entradas: 0, saidas: 0, trocas: 0 }));
  for (const r of list) {
    const he = parseInt(r.horaEntrada?.split(':')[0] ?? '', 10);
    if (!Number.isNaN(he)) h[he].entradas++;
    if (r.horaSaida) {
      const hs = parseInt(r.horaSaida.split(':')[0], 10);
      if (!Number.isNaN(hs)) { h[hs].saidas++; if (r.status === 'trocado') h[hs].trocas++; }
    }
  }
  return h;
}

export function rankingSetores(list: Registro[]) {
  const m = new Map<string, { setor: string; acompanhantes: number; visitas: number; trocas: number }>();
  for (const r of list) {
    if (!r.setor) continue;
    const x = m.get(r.setor) ?? { setor: r.setor, acompanhantes: 0, visitas: 0, trocas: 0 };
    if (r.tipo === 'acompanhante') x.acompanhantes++; else x.visitas++;
    if (r.status === 'trocado') x.trocas++;
    m.set(r.setor, x);
  }
  return [...m.values()].sort((a, b) => b.acompanhantes + b.visitas - (a.acompanhantes + a.visitas));
}

export function presentesPorSetor(presentes: Registro[]) {
  const m = new Map<string, number>();
  for (const r of presentes) if (r.status === 'presente' && r.tipo === 'acompanhante' && r.setor) m.set(r.setor, (m.get(r.setor) ?? 0) + 1);
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m.entries()].map(([setor, qtd]) => ({ setor, qtd, pct: total ? (qtd / total) * 100 : 0 })).sort((a, b) => b.qtd - a.qtd);
}

export function permanenciaPorSetor(list: Registro[]) {
  const m = new Map<string, { t: number; n: number }>();
  for (const r of list) {
    if (r.tipo !== 'acompanhante' || r.status !== 'saiu' || !r.setor) continue;
    const h = permanenciaHoras(r);
    if (h === null) continue;
    const x = m.get(r.setor) ?? { t: 0, n: 0 };
    x.t += h; x.n++;
    m.set(r.setor, x);
  }
  return [...m.entries()].map(([setor, x]) => ({ setor, horas: +(x.t / x.n).toFixed(1) })).sort((a, b) => b.horas - a.horas);
}

export interface Insight { antes: string; destaque: string; depois?: string }

export function gerarInsights(mes: Registro[], presentes: Registro[], todos: Registro[], hoje = new Date()): Insight[] {
  const out: Insight[] = [];
  const ps = presentesPorSetor(presentes);
  if (ps[0]) out.push({ antes: 'O setor ', destaque: ps[0].setor, depois: ` concentra ${ps[0].pct.toFixed(1).replace('.', ',')}% dos acompanhantes presentes.` });

  const hojeStr = dataHoje(hoje);
  const trocasHoje = todos.filter((r) => r.dataSaida === hojeStr && r.status === 'trocado').length;
  if (trocasHoje > 0) out.push({ antes: 'Hoje ocorreram ', destaque: `${trocasHoje} troca${trocasHoje > 1 ? 's' : ''}`, depois: ' de acompanhante.' });

  const horas = porHora(mes);
  const max = Math.max(...horas.map((h) => h.entradas));
  if (max > 0) out.push({ antes: 'O horário de maior movimento é por volta das ', destaque: horas.find((h) => h.entradas === max)!.hora, depois: '.' });

  const pm = permanenciaMediaHoras(mes);
  if (pm > 0) out.push({ antes: 'A permanência média dos acompanhantes é de ', destaque: pm >= 48 ? `${(pm / 24).toFixed(1).replace('.', ',')} dias` : `${Math.round(pm)} horas`, depois: '.' });

  const sem = ultimosNDias(7, hoje).getTime();
  const vs = new Map<string, number>();
  for (const r of mes) if (r.tipo === 'visita' && entradaTs(r) >= sem) vs.set(r.setor, (vs.get(r.setor) ?? 0) + 1);
  const top = [...vs.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) out.push({ antes: 'O setor ', destaque: top[0], depois: ` teve o maior número de visitas nesta semana (${top[1]}).` });

  const trocasEntre = (ini: Date, fim: Date) => todos.filter((r) => r.status === 'trocado' && r.dataSaida && (() => { const t = parseDataHora(r.dataSaida).getTime(); return t >= ini.getTime() && t <= fim.getTime(); })()).length;
  const estaSemana = trocasEntre(ultimosNDias(7, hoje), fimDeHoje(hoje));
  const ant = new Date(ultimosNDias(7, hoje)); ant.setDate(ant.getDate() - 7);
  const fimAnt = new Date(ultimosNDias(7, hoje)); fimAnt.setMilliseconds(-1);
  const semAnt = trocasEntre(ant, fimAnt);
  if (semAnt > 0) {
    const v = Math.round(((estaSemana - semAnt) / semAnt) * 100);
    out.push({ antes: 'O número de trocas variou ', destaque: `${v > 0 ? '+' : ''}${v}%`, depois: ' em relação à semana anterior.' });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Históricos
// ---------------------------------------------------------------------------------------------
export interface EventoHistorico {
  ts: number;
  dataHora: string;
  tipo: 'Acompanhante' | 'Visita' | 'Troca';
  evento: 'Entrada' | 'Saída' | 'Troca' | 'Troca de acompanhante';
  pessoa: string;
  detalhe: string;
  registroId: string;
}

export interface HistoricoPaciente {
  paciente: string;
  registros: Registro[];
  eventos: EventoHistorico[];
  atual?: Registro;
  totalAcompanhantes: number;
  totalVisitas: number;
  totalTrocas: number;
  acompanhantesDistintos: number;
}

/** Agrupa os registros por paciente em UMA passada (evita o custo N × pacientes). */
export function agruparPorPaciente(todos: Registro[]): Map<string, Registro[]> {
  const m = new Map<string, Registro[]>();
  for (const r of todos) {
    const k = normalizar(r.nomePaciente);
    if (!k) continue;
    const g = m.get(k);
    if (g) g.push(r); else m.set(k, [r]);
  }
  return m;
}

export function historicoDoPaciente(todos: Registro[], nomePaciente: string): HistoricoPaciente {
  return montarHistorico(nomePaciente, todos.filter((r) => mesmoNome(r.nomePaciente, nomePaciente)));
}

/** Monta o histórico a partir dos registros JÁ filtrados do paciente. */
export function montarHistorico(nomePaciente: string, doPaciente: Registro[]): HistoricoPaciente {
  const registros = [...doPaciente].sort(porEntradaDesc);
  const eventos: EventoHistorico[] = [];
  for (const r of registros) {
    const tipo = r.tipo === 'visita' ? 'Visita' : 'Acompanhante';
    eventos.push({
      ts: entradaTs(r), dataHora: `${r.dataEntrada} ${r.horaEntrada}`, tipo, evento: 'Entrada', pessoa: r.nomeAcompanhante,
      detalhe: `${r.setor}${r.leito ? ` • Leito ${r.leito}` : ''}${r.parentesco ? ` • ${r.parentesco}` : ''} • Recepção: ${r.recepcionistaEntrada || '—'}`, registroId: r.id,
    });
    const s = saidaTs(r);
    if (r.dataSaida && s !== null) {
      eventos.push({
        ts: s, dataHora: `${r.dataSaida} ${r.horaSaida ?? ''}`.trim(), tipo, evento: r.status === 'trocado' ? 'Troca' : 'Saída', pessoa: r.nomeAcompanhante,
        detalhe: r.observacao || '—', registroId: r.id,
      });
    }
  }
  eventos.sort((a, b) => b.ts - a.ts);
  const acomp = registros.filter(ehAcompanhante);
  return {
    paciente: nomePaciente,
    registros,
    eventos,
    atual: registros.find((r) => r.status === 'presente' && r.tipo === 'acompanhante'),
    totalAcompanhantes: acomp.length,
    totalVisitas: registros.filter(ehVisita).length,
    totalTrocas: registros.filter((r) => r.status === 'trocado').length,
    acompanhantesDistintos: new Set(acomp.map((r) => normalizar(r.documento) || normalizar(r.nomeAcompanhante))).size,
  };
}

export function historicoDaPessoa(todos: Registro[], base: Registro): Registro[] {
  const doc = normalizar(base.documento);
  const nome = normalizar(base.nomeAcompanhante);
  return todos
    .filter((r) => {
      const d = normalizar(r.documento);
      const n = normalizar(r.nomeAcompanhante);
      return doc ? d === doc || (!d && n === nome) : n === nome;
    })
    .sort(porEntradaDesc);
}

export function nomesDePacientes(todos: Registro[]): string[] {
  const m = new Map<string, string>();
  for (const r of todos) {
    const k = normalizar(r.nomePaciente);
    if (k && !m.has(k)) m.set(k, r.nomePaciente);
  }
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export const STATUS_LABEL: Record<Registro['status'], string> = { presente: 'Presente', saiu: 'Saiu', trocado: 'Trocado' };
