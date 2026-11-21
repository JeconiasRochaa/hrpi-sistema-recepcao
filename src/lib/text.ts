/**
 * O sistema anterior gravava textos já "escapados" em HTML (ex.: "Jo&atilde;o", "A &amp; B").
 * O React já escapa na renderização, então novos dados são gravados em texto puro.
 * Esta função só "desfaz" o escape dos dados antigos para exibição correta.
 */
const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' };
export function limparLegado(s?: string | null): string {
  if (!s) return '';
  return s.replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENT[m] ?? m);
}

const cacheNorm = new Map<string, string>();
/** Texto sem acentos/caixa para comparar e buscar. Memoizado: listas grandes chamam isto milhões de vezes. */
export function normalizar(s?: string | null): string {
  if (!s) return '';
  const hit = cacheNorm.get(s);
  if (hit !== undefined) return hit;
  const r = limparLegado(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (cacheNorm.size > 40_000) cacheNorm.clear();
  cacheNorm.set(s, r);
  return r;
}

export function mesmoNome(a?: string | null, b?: string | null): boolean {
  return normalizar(a) === normalizar(b);
}

/** Remove caracteres de controle e limita o tamanho — usado antes de gravar. */
export function limpar(s: string | null | undefined, max = 200): string {
  return (s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Máscara LGPD para documentos: mostra apenas os 3 últimos caracteres. */
export function mascararDocumento(doc?: string | null): string {
  const d = limparLegado(doc).trim();
  if (!d) return '—';
  const digitos = d.replace(/\D/g, '');
  if (digitos.length === 11) return `•••.•••.${digitos.slice(6, 9)}-••`; // CPF
  if (d.length <= 3) return '•••';
  return `${'•'.repeat(Math.min(6, d.length - 3))}${d.slice(-3)}`;
}

export function mascararTelefone(tel?: string | null): string {
  const t = limparLegado(tel).trim();
  if (!t) return '—';
  const dig = t.replace(/\D/g, '');
  return dig.length >= 4 ? `(••) •••••-${dig.slice(-4)}` : '••••';
}

/** "Maria da Silva" -> "M. S." (para logs, sem expor o nome completo). */
export function iniciais(nome?: string | null): string {
  const partes = limparLegado(nome).split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p));
  if (!partes.length) return '—';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return `${primeira}.${ultima ? ` ${ultima}.` : ''}`.toUpperCase();
}

export function primeiroNome(nome?: string | null): string {
  return limparLegado(nome).trim().split(/\s+/)[0] || '';
}

export function iniciaisAvatar(nome?: string | null): string {
  const p = limparLegado(nome).trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function mascaraTelefoneInput(valor: string): string {
  let v = valor.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  if (v.length > 6) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  if (v.length > 2) return v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  if (v.length > 0) return `(${v}`;
  v = '';
  return v;
}

/** Cor de avatar estável a partir do nome. */
export function corAvatar(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 42%)`;
}
