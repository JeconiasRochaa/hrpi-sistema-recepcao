import type { Registro } from '@/types';

const p2 = (n: number) => String(n).padStart(2, '0');

/** "DD-MM-AAAA" do dia de hoje (formato histórico do banco). */
export function dataHoje(d = new Date()): string {
  return `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`;
}
export function horaAgora(d = new Date()): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
export function formatarData(d: Date): string {
  return dataHoje(d);
}

/** Converte "DD-MM-AAAA" (+ "HH:MM[:SS]") em Date local. Retorna Invalid Date se inválido. */
export function parseDataHora(data?: string | null, hora?: string | null): Date {
  if (!data) return new Date(NaN);
  const [d, m, a] = data.split('-').map(Number);
  const [h = 0, mi = 0, s = 0] = (hora || '00:00:00').split(':').map(Number);
  return new Date(a, (m || 1) - 1, d || 1, h, mi, s);
}

export function entradaTs(r: Pick<Registro, 'entradaTs' | 'dataEntrada' | 'horaEntrada'>): number {
  return r.entradaTs ?? parseDataHora(r.dataEntrada, r.horaEntrada).getTime();
}
export function saidaTs(r: Pick<Registro, 'dataSaida' | 'horaSaida'>): number | null {
  if (!r.dataSaida) return null;
  const t = parseDataHora(r.dataSaida, r.horaSaida).getTime();
  return Number.isNaN(t) ? null : t;
}

/** "AAAA-MM-DD" (input type=date) -> início do dia local. */
export function inicioDoDia(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}
export function fimDoDia(iso: string): Date {
  return new Date(`${iso}T23:59:59.999`);
}

/** Dias corridos desde "DD-MM-AAAA" (0 = hoje). */
export function diasDesde(data?: string | null): number {
  if (!data) return 0;
  const d = parseDataHora(data);
  d.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((hoje.getTime() - d.getTime()) / 86_400_000));
}

export function formatarDuracao(ms: number): string {
  const horas = ms / 3_600_000;
  if (horas < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (horas < 24) return `${horas.toFixed(1).replace('.', ',')} h`;
  const dias = Math.floor(horas / 24);
  const resto = Math.round(horas % 24);
  return resto ? `${dias}d ${resto}h` : `${dias}d`;
}

export function formatarDataHoraTs(ts: number): string {
  const d = new Date(ts);
  return `${dataHoje(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "DD-MM-AAAA" -> "DD/MM/AAAA" para exibição. */
export function exibirData(data?: string | null): string {
  return data ? data.replaceAll('-', '/') : '';
}
export function exibirDataHora(data?: string | null, hora?: string | null): string {
  if (!data) return '—';
  return `${exibirData(data)} ${(hora || '').slice(0, 5)}`.trim();
}

export function nomeDoMes(d = new Date()): string {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
