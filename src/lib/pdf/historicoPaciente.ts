import { baixar, cabecalho, COR, novoPdf, rodape, t } from './comum';
import { exibirData } from '@/lib/datetime';
import type { HistoricoPaciente } from '@/lib/stats';
import { dataHoje } from '@/lib/datetime';

export interface OpcoesPdfHistorico {
  usuario: string;
  logo?: string | null;
  periodo?: string;
}

/**
 * PDF de histórico por paciente: acompanhantes, visitas e trocas de acompanhante.
 * Cada paciente começa em uma nova página. Documentos/telefones NÃO são impressos (minimização LGPD).
 */
export async function gerarPdfHistoricoPacientes(pacientes: HistoricoPaciente[], op: OpcoesPdfHistorico) {
  const { doc, autoTable } = await novoPdf('portrait');
  const w = doc.internal.pageSize.getWidth();

  for (let idx = 0; idx < pacientes.length; idx++) {
    const h = pacientes[idx];
    if (idx > 0) doc.addPage();
    if (idx > 0 && idx % 8 === 0) await new Promise((r) => setTimeout(r, 0)); // respira para a tela não congelar em PDFs grandes
    let y = cabecalho(doc, 'Histórico do paciente', op.periodo ? `Período: ${op.periodo}` : 'Histórico completo', op.logo);

    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...COR.texto);
    doc.text(t(h.paciente), 14, y + 2);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...COR.suave);
    const ultimo = h.registros[0];
    if (ultimo) doc.text(t(`${ultimo.setor}${ultimo.leito ? `  |  Leito ${ultimo.leito}` : ''}`), 14, y + 7.5);
    y += 12;

    // Cartões-resumo
    const cards: [string, string | number, [number, number, number]][] = [
      ['Acompanhantes', h.totalAcompanhantes, COR.primaria],
      ['Visitas', h.totalVisitas, COR.visita],
      ['Trocas', h.totalTrocas, COR.ambar],
      ['Acomp. diferentes', h.acompanhantesDistintos, COR.texto],
    ];
    const cw = (w - 28 - 9) / 4;
    cards.forEach(([rot, val, cor], i) => {
      const x = 14 + i * (cw + 3);
      doc.setFillColor(...COR.primariaSuave).roundedRect(x, y, cw, 16, 2, 2, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...cor).text(String(val), x + 4, y + 8.5);
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...COR.suave).text(t(rot), x + 4, y + 13.5);
    });
    y += 22;

    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...COR.texto);
    doc.text(t(h.atual ? `Situação atual: acompanhado(a) por ${h.atual.nomeAcompanhante} desde ${exibirData(h.atual.dataEntrada)}` : 'Situação atual: sem acompanhante presente'), 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14, bottom: 20 },
      head: [['Data / hora', 'Tipo', 'Evento', 'Pessoa', 'Detalhes']],
      body: h.eventos.length
        ? h.eventos.map((e) => [exibirData(e.dataHora.split(' ')[0]) + ' ' + (e.dataHora.split(' ')[1] ?? '').slice(0, 5), e.tipo, e.evento, t(e.pessoa), t(e.detalhe)])
        : [['', '', '', 'Nenhum evento no período', '']],
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: COR.texto, lineColor: COR.linha, lineWidth: 0.1 },
      headStyles: { fillColor: COR.primaria, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 27 }, 1: { cellWidth: 24 }, 2: { cellWidth: 20 }, 3: { cellWidth: 40 } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 2) {
          const v = String(d.cell.raw);
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.textColor = v === 'Entrada' ? COR.verde : v === 'Saída' ? COR.vermelho : COR.ambar;
        }
      },
    });
  }

  rodape(doc, op.usuario);
  const nome = pacientes.length === 1 ? `Historico_${pacientes[0].paciente.split(' ')[0]}_${dataHoje()}.pdf` : `Historico_pacientes_${dataHoje()}.pdf`;
  baixar(doc, nome);
}
