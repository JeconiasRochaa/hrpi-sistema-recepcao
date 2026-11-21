import type { Registro } from '@/types';
import { entradaTs } from './datetime';
import { normalizar } from './text';

/**
 * Memória do sistema para agilizar o preenchimento: tudo é calculado em memória a partir dos registros já carregados
 * (nada de dado pessoal é guardado no navegador — LGPD).
 */

export interface SugPaciente { nome: string; setor: string; leito: string; presente: boolean; acompanhante?: string; ultima: number; usos: number }
export interface SugPessoa { nome: string; documento: string; telefone: string; parentesco: string; ultima: number; usos: number; presente: boolean }

const tokens = (t: string) => normalizar(t).split(/\s+/).filter(Boolean);

/** Pontuação de correspondência (0 = não bate). Prefixo do nome > início de palavra > contém. */
export function pontuar(nome: string, termo: string): number {
  const n = normalizar(nome);
  const ts = tokens(termo);
  if (!ts.length) return 1;
  let total = 0;
  for (const t of ts) {
    if (n.startsWith(t)) total += 4;
    else if (n.includes(` ${t}`)) total += 3;
    else if (n.includes(t)) total += 1;
    else return 0;
  }
  return total;
}

function ordenar<T extends { ultima: number; usos: number }>(arr: (T & { _p: number })[]): T[] {
  return arr.sort((a, b) => b._p - a._p || b.ultima - a.ultima || b.usos - a.usos).map(({ _p, ...r }) => r as unknown as T);
}

export function indicePacientes(todos: Registro[]): SugPaciente[] {
  const m = new Map<string, SugPaciente>();
  for (const r of todos) {
    const k = normalizar(r.nomePaciente);
    if (!k) continue;
    const ts = entradaTs(r);
    const cur = m.get(k);
    const presenteAcomp = r.status === 'presente' && r.tipo === 'acompanhante';
    if (!cur) {
      m.set(k, { nome: r.nomePaciente, setor: r.setor, leito: r.leito ?? '', presente: presenteAcomp, acompanhante: presenteAcomp ? r.nomeAcompanhante : undefined, ultima: ts, usos: 1 });
      continue;
    }
    cur.usos++;
    if (presenteAcomp) { cur.presente = true; cur.acompanhante = r.nomeAcompanhante; }
    if (ts > cur.ultima) { cur.ultima = ts; cur.nome = r.nomePaciente; cur.setor = r.setor; cur.leito = r.leito ?? ''; }
  }
  return [...m.values()];
}

export function buscarPacientes(indice: SugPaciente[], termo: string, limite = 6): SugPaciente[] {
  const t = normalizar(termo);
  if (t.length < 2) return [];
  const achados = indice.map((p) => ({ ...p, _p: pontuar(p.nome, termo) })).filter((p) => p._p > 0 && normalizar(p.nome) !== t);
  return ordenar(achados).slice(0, limite);
}

/** Pacientes atendidos mais recentemente (para sugerir antes de digitar). */
export function pacientesRecentes(indice: SugPaciente[], limite = 5): SugPaciente[] {
  return [...indice].sort((a, b) => b.ultima - a.ultima).slice(0, limite);
}

export function indicePessoas(todos: Registro[]): SugPessoa[] {
  const m = new Map<string, SugPessoa>();
  for (const r of todos) {
    const k = normalizar(r.nomeAcompanhante);
    if (!k) continue;
    const ts = entradaTs(r);
    const presente = r.status === 'presente';
    const cur = m.get(k);
    if (!cur) { m.set(k, { nome: r.nomeAcompanhante, documento: r.documento ?? '', telefone: r.telefone ?? '', parentesco: r.parentesco ?? '', ultima: ts, usos: 1, presente }); continue; }
    cur.usos++;
    cur.presente = cur.presente || presente;
    if (ts > cur.ultima) { cur.ultima = ts; cur.nome = r.nomeAcompanhante; cur.documento = r.documento || cur.documento; cur.telefone = r.telefone || cur.telefone; cur.parentesco = r.parentesco || cur.parentesco; }
  }
  return [...m.values()];
}

export function buscarPessoas(indice: SugPessoa[], termo: string, limite = 6): SugPessoa[] {
  const t = normalizar(termo);
  if (t.length < 3) return [];
  const achados = indice.map((p) => ({ ...p, _p: pontuar(p.nome, termo) })).filter((p) => p._p > 0 && normalizar(p.nome) !== t);
  return ordenar(achados).slice(0, limite);
}

/** Leitos já usados no setor, em ordem natural (1, 2, 10…). */
export function leitosDoSetor(todos: Registro[], setor: string): string[] {
  if (!setor) return [];
  const s = new Set<string>();
  for (const r of todos) if (r.setor === setor && r.leito) s.add(r.leito);
  return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).slice(0, 60);
}

/** Divide o texto em [antes, trecho, depois] para destacar o que foi digitado (sem HTML: seguro contra injeção). */
export function destacar(texto: string, termo: string): [string, string, string] {
  const ts = tokens(termo);
  if (!ts.length) return [texto, '', ''];
  const n = normalizar(texto);
  // normalizar() mantém o tamanho para letras acentuadas pré-compostas; se divergir, não destaca
  if (n.length !== texto.length) return [texto, '', ''];
  for (const t of ts) {
    const i = n.indexOf(t);
    if (i >= 0) return [texto.slice(0, i), texto.slice(i, i + t.length), texto.slice(i + t.length)];
  }
  return [texto, '', ''];
}
