import { baixar, cabecalho, COR, novoPdf, rodape, t } from './comum';
import { dataHoje, exibirData } from '@/lib/datetime';
import { ehAlta, STATUS_LABEL } from '@/lib/stats';
import { mascararDocumento } from '@/lib/text';
import type { Registro } from '@/types';

export interface OpcoesRelatorio {
  titulo: string;
  periodoTxt: string;
  /** Registros com entrada dentro do período (já filtrados). */
  dados: Registro[];
  /** Base inteira (para contar "presentes agora"). */
  presentes: Registro[];
  setor?: string;
  usuario: string;
  logo?: string | null;
}

export async function gerarRelatorioPdf(o: OpcoesRelatorio) {
  const { doc, autoTable } = await novoPdf('landscape');
  const w = doc.internal.pageSize.getWidth();
  const presentes = o.setor ? o.presentes.filter((r) => r.setor === o.setor) : o.presentes;
  const dados = o.dados;

  let y = cabecalho(doc, `Relatório ${o.titulo}${o.setor ? ` - ${o.setor}` : ''}`, `Período: ${o.periodoTxt}`, o.logo);

  const acomp = dados.filter((r) => r.tipo === 'acompanhante');
  const visit = dados.filter((r) => r.tipo === 'visita');
  const pa = presentes.filter((r) => r.status === 'presente' && r.tipo === 'acompanhante').length;
  const pv = presentes.filter((r) => r.status === 'presente' && r.tipo === 'visita').length;

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...COR.primaria).text('RESUMO DO PERÍODO', 14, y);
  y += 4;
  const bw = (w - 28 - 4) / 2;
  const bloco = (x: number, rot: string, cor: [number, number, number], fundo: [number, number, number], linhas: string[], dir: string[]) => {
    doc.setFillColor(...fundo).roundedRect(x, y, bw, 28, 2, 2, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...cor).text(rot, x + 5, y + 7);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...COR.texto);
    linhas.forEach((l, i) => doc.text(t(l), x + 5, y + 14 + i * 5.5));
    doc.setFont('helvetica', 'bold');
    dir.forEach((l, i) => doc.text(t(l), x + bw / 2 + 5, y + 14 + i * 5.5));
  };
  bloco(14, 'ACOMPANHANTES', COR.primaria, COR.primariaSuave,
    [`Entradas no período: ${acomp.length}`, `Saídas registradas: ${acomp.filter((r) => r.status === 'saiu').length}`, `Trocas de acompanhante: ${acomp.filter((r) => r.status === 'trocado').length}`],
    [`Presentes agora: ${pa}`, `Altas de pacientes: ${dados.filter(ehAlta).length}`]);
  bloco(14 + bw + 4, 'VISITANTES', COR.visita, COR.visitaSuave,
    [`Entradas no período: ${visit.length}`, `Saídas automáticas (1h): ${visit.filter((r) => r.status === 'saiu').length}`],
    [`Presentes agora: ${pv}`]);
  y += 34;

  // Movimentação por setor
  if (!o.setor) {
    const m = new Map<string, number[]>();
    const get = (s: string) => m.get(s) ?? (m.set(s, [0, 0, 0, 0]), m.get(s)!);
    presentes.forEach((r) => { if (r.status === 'presente' && r.setor) get(r.setor)[r.tipo === 'acompanhante' ? 1 : 3]++; });
    dados.forEach((r) => { if (r.setor) get(r.setor)[r.tipo === 'acompanhante' ? 0 : 2]++; });
    if (m.size) {
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...COR.primaria).text('MOVIMENTAÇÃO POR SETOR', 14, y);
      autoTable(doc, {
        startY: y + 3,
        margin: { left: 14, right: 14 },
        head: [['Setor', 'Acompanhantes - entradas', 'Acompanhantes - ativos', 'Visitantes - entradas', 'Visitantes - ativos']],
        body: [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([s, v]) => [t(s), ...v.map(String)]),
        styles: { fontSize: 8.5, cellPadding: 2, textColor: COR.texto },
        headStyles: { fillColor: COR.primaria, textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
      });
      // @ts-expect-error propriedade adicionada pelo plugin autotable
      y = doc.lastAutoTable.finalY + 8;
    }
  }

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...COR.primaria).text('REGISTROS DETALHADOS', 14, y);
  autoTable(doc, {
    startY: y + 3,
    margin: { left: 14, right: 14, bottom: 20 },
    head: [['Tipo', 'Nome', 'Documento', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Entrada', 'Saída', 'Situação']],
    body: dados.map((r) => [
      r.tipo === 'visita' ? 'Visita' : 'Acomp.', t(r.nomeAcompanhante), mascararDocumento(r.documento).replaceAll('•', '*'), t(r.parentesco), t(r.nomePaciente), t(r.setor), r.leito || '-',
      `${exibirData(r.dataEntrada)} ${r.horaEntrada.slice(0, 5)}`, r.dataSaida ? `${exibirData(r.dataSaida)} ${(r.horaSaida ?? '').slice(0, 5)}` : '-', STATUS_LABEL[r.status] ?? r.status,
    ]),
    styles: { fontSize: 7.2, cellPadding: 1.8, textColor: COR.texto },
    headStyles: { fillColor: COR.primaria, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 9) {
        const v = String(d.cell.raw);
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.textColor = v === 'Presente' ? COR.verde : v === 'Saiu' ? COR.vermelho : COR.ambar;
      }
    },
  });

  rodape(doc, o.usuario);
  baixar(doc, `HRPI_Relatorio_${o.titulo}${o.setor ? '_' + o.setor : ''}_${dataHoje()}.pdf`);
}
