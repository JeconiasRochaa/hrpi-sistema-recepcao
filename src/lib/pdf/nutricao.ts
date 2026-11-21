import { baixar, cabecalho, COR, novoPdf, rodape, t } from './comum';
import { dataHoje, exibirDataHora } from '@/lib/datetime';
import { totalNutricao, type GrupoNutricao } from '@/lib/nutricao';

/** Lista de acompanhantes para a nutrição: uma tabela por setor, com total, pronta para imprimir (A4 retrato). */
export async function gerarPdfNutricao(grupos: GrupoNutricao[], op: { usuario: string; logo?: string | null }) {
  const { doc, autoTable } = await novoPdf('portrait');
  const w = doc.internal.pageSize.getWidth();
  const agora = new Date().toLocaleString('pt-BR');
  let y = cabecalho(doc, 'Lista para a Nutrição', `Acompanhantes presentes em ${agora}`, op.logo);

  const total = totalNutricao(grupos);
  doc.setFillColor(...COR.primariaSuave).roundedRect(14, y - 2, w - 28, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...COR.primaria);
  doc.text(t(`${total} acompanhante${total === 1 ? '' : 's'} em ${grupos.length} setor${grupos.length === 1 ? '' : 'es'}`), 18, y + 6.5);
  y += 18;

  grupos.forEach((g) => {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14, bottom: 20 },
      head: [[{ content: t(`${g.setor}  -  ${g.itens.length} acompanhante${g.itens.length === 1 ? '' : 's'}`), colSpan: 5, styles: { halign: 'left', fillColor: COR.primaria, textColor: 255, fontSize: 10 } }],
        ['Leito', 'Paciente', 'Acompanhante', 'Parentesco', 'Desde']],
      body: g.itens.map((r) => [r.leito || '-', t(r.nomePaciente), t(r.nomeAcompanhante), t(r.parentesco || '-'), exibirDataHora(r.dataEntrada, r.horaEntrada)]),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, textColor: COR.texto, lineColor: COR.linha, lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold', halign: 'center' }, 4: { cellWidth: 32 } },
      didParseCell: (d) => { if (d.section === 'head' && d.row.index === 1) { d.cell.styles.fillColor = COR.primariaSuave; d.cell.styles.textColor = COR.primaria; d.cell.styles.fontStyle = 'bold'; } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  });
  rodape(doc, op.usuario);
  baixar(doc, `HRPI_Lista_Nutricao_${dataHoje()}.pdf`);
}
