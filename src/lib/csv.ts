/** Escapa uma célula CSV e neutraliza "injeção de fórmula" (=, +, -, @) ao abrir no Excel. */
function celula(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export function baixarCsv(nome: string, cabecalho: string[], linhas: unknown[][]) {
  const csv = '﻿' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
