import type { jsPDF } from 'jspdf';
import { HOSPITAL_NOME, SISTEMA_NOME } from '@/lib/constants';

export const COR = {
  primaria: [24, 87, 181] as [number, number, number],
  primariaSuave: [232, 240, 252] as [number, number, number],
  visita: [109, 76, 190] as [number, number, number],
  visitaSuave: [241, 236, 252] as [number, number, number],
  texto: [30, 41, 59] as [number, number, number],
  suave: [100, 116, 139] as [number, number, number],
  linha: [226, 232, 240] as [number, number, number],
  verde: [21, 128, 61] as [number, number, number],
  vermelho: [190, 30, 45] as [number, number, number],
  ambar: [180, 83, 9] as [number, number, number],
};

export async function novoPdf(orientacao: 'portrait' | 'landscape') {
  const [{ jsPDF: JsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new JsPDF({ orientation: orientacao, unit: 'mm', format: 'a4' });
  return { doc, autoTable: autoTableMod.default };
}

/** Remove caracteres fora do Latin-1 (as fontes padrão do PDF não os suportam). */
export const t = (s: string | undefined | null) => (s ?? '').replace(/[–—]/g, '-').replace(/[•·]/g, '-').replace(/[^\u0000-ÿ]/g, '');

export function cabecalho(doc: jsPDF, titulo: string, subtitulo: string, logo?: string | null): number {
  const w = doc.internal.pageSize.getWidth();
  const mx = 14;
  let x = mx;
  if (logo) {
    try {
      const fmt = /^data:image\/png/.test(logo) ? 'PNG' : 'JPEG';
      doc.addImage(logo, fmt, mx, 10, 16, 16, undefined, 'FAST');
      x = mx + 21;
    } catch { /* logo inválida: segue sem */ }
  }
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...COR.primaria);
  doc.text(t(HOSPITAL_NOME.toUpperCase()), x, 16);
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...COR.suave);
  doc.text(t(`${SISTEMA_NOME}  |  ${titulo}`), x, 21.5);
  if (subtitulo) doc.text(t(subtitulo), x, 26);
  doc.setDrawColor(...COR.primaria).setLineWidth(0.6).line(mx, 30, w - mx, 30);
  return 36;
}

export function rodape(doc: jsPDF, usuario: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COR.linha).setLineWidth(0.3).line(14, h - 14, w - 14, h - 14);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...COR.suave);
    doc.text(t(`DOCUMENTO CONFIDENCIAL - dados pessoais protegidos pela LGPD (Lei 13.709/2018). Uso restrito; não compartilhe sem autorização.`), 14, h - 10);
    doc.text(t(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${usuario}`), 14, h - 6.5);
    doc.text(`Página ${i} de ${n}`, w - 14, h - 6.5, { align: 'right' });
  }
}

export function baixar(doc: jsPDF, nome: string) {
  doc.save(nome.replace(/[^\w.\-]+/g, '_'));
}
