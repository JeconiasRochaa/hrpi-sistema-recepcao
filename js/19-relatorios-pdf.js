// ============================================
// 19-relatorios-pdf.js
// Relatórios em PDF (diário/semanal/mensal/personalizado) e o novo Relatório por Setor.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// RELATÓRIOS EM PDF
// ============================================
function gerarRelatorio(tipo) {
    if (typeof window.jspdf === 'undefined') {
        toast('Carregando biblioteca de PDF... Aguarde e tente novamente.', 'error');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    let dataInicio, dataFim, titulo;
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    
    switch (tipo) {
        case 'diario':
            dataInicio = new Date(agora);
            dataFim = new Date(agora);
            dataFim.setHours(23, 59, 59, 999);
            titulo = 'Diário';
            break;
        case 'semanal':
            const inicioSemana = new Date(agora);
            inicioSemana.setDate(agora.getDate() - 6);
            dataInicio = new Date(inicioSemana);
            dataFim = new Date(agora);
            dataFim.setHours(23, 59, 59, 999);
            titulo = 'Semanal';
            break;
        case 'mensal':
            dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
            dataFim = new Date(agora);
            dataFim.setHours(23, 59, 59, 999);
            titulo = 'Mensal';
            break;
        case 'personalizado':
            const ini = document.getElementById('dataInicioPersonalizado')?.value;
            const fim = document.getElementById('dataFimPersonalizado')?.value;
            if (!ini || !fim) {
                toast('Selecione as datas inicial e final.', 'error');
                return;
            }
            dataInicio = new Date(ini + 'T00:00:00');
            dataFim = new Date(fim + 'T23:59:59');
            titulo = 'Personalizado';
            break;
        default:
            toast('Tipo de relatório inválido.', 'error');
            return;
    }
    
    const formatar = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    const strInicio = formatar(dataInicio);
    const strFim = formatar(dataFim);
    
    // Filtrar dados (movimentação do período: entradas, saídas, trocas)
    let dados = Object.values(acompanhantes).filter(ac => {
        const [d, m, a] = ac.dataEntrada.split('-');
        const dataRegistro = new Date(a, m - 1, d);
        return dataRegistro >= dataInicio && dataRegistro <= dataFim;
    });
    
    // ============================================
    // CALCULAR ESTATÍSTICAS
    // ============================================
    let totalAcompanhantes = 0;
    let totalVisitas = 0;
    let totalEntradas = dados.length;
    let saidasAcompanhantes = 0;
    let saidasVisitantes = 0;
    let totalAltas = 0;
    let totalTrocas = 0;

    // "Presentes agora" é uma contagem do momento atual, não do período do
    // relatório — por isso usa a base completa (todosAcompanhantes), igual
    // ao Painel Gerencial. Se usasse "dados" (filtrado pelo período), quem
    // entrou antes do período e ainda não teve saída registrada sumiria da
    // contagem, gerando divergência com o número mostrado no Painel.
    const todosAcompanhantes = Object.values(acompanhantes);
    let acompanhantesAtivos = todosAcompanhantes.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante').length;
    let visitasAtivas = todosAcompanhantes.filter(ac => ac.status === 'presente' && ac.tipo === 'visita').length;
    
    // Agrupar por setor (acompanhantes e visitantes contados separadamente)
    const setoresMap = {};
    // "Ativos" por setor também usa a base completa, pelo mesmo motivo acima.
    todosAcompanhantes.forEach(ac => {
        if (ac.status === 'presente' && ac.setor) {
            if (!setoresMap[ac.setor]) setoresMap[ac.setor] = { entradasAcomp: 0, entradasVisit: 0, ativosAcomp: 0, ativosVisit: 0 };
            if (ac.tipo === 'acompanhante') setoresMap[ac.setor].ativosAcomp++;
            else setoresMap[ac.setor].ativosVisit++;
        }
    });
    
    dados.forEach(ac => {
        // Contagem por tipo
        if (ac.tipo === 'acompanhante') totalAcompanhantes++;
        if (ac.tipo === 'visita') totalVisitas++;
        
        // Status (saídas e trocas continuam contadas dentro do período — isso
        // está correto, pois representam eventos que aconteceram no período)
        if (ac.status === 'saiu' && ac.tipo === 'acompanhante') saidasAcompanhantes++;
        if (ac.status === 'saiu' && ac.tipo === 'visita') saidasVisitantes++;
        if (ac.status === 'trocado') totalTrocas++;
        
        // Alta de paciente = saída de acompanhante cujo motivo registrado foi "alta do paciente"
        // (exclui saída automática de visita, fim de horário e desistência)
        if (ac.status === 'saiu' && 
            ac.observacao && 
            ac.observacao.toLowerCase().includes('alta do paciente') &&
            !ac.observacao.toLowerCase().includes('saída automática') &&
            !ac.observacao.toLowerCase().includes('fim do horário') &&
            !ac.observacao.toLowerCase().includes('desistência')) {
            totalAltas++;
        }
        
        // Agrupar por setor — entradas do período (ativos já foi calculado acima, com a base completa)
        if (ac.setor) {
            if (!setoresMap[ac.setor]) setoresMap[ac.setor] = { entradasAcomp: 0, entradasVisit: 0, ativosAcomp: 0, ativosVisit: 0 };
            if (ac.tipo === 'acompanhante') setoresMap[ac.setor].entradasAcomp++;
            else setoresMap[ac.setor].entradasVisit++;
        }
    });
    
    // Ordenar dados por data
    dados.sort((a, b) => {
        const da = new Date(a.dataEntrada.split('-')[2], a.dataEntrada.split('-')[1] - 1, a.dataEntrada.split('-')[0]);
        const db = new Date(b.dataEntrada.split('-')[2], b.dataEntrada.split('-')[1] - 1, b.dataEntrada.split('-')[0]);
        return db - da || b.horaEntrada.localeCompare(a.horaEntrada);
    });
    
    // Tentar carregar a logo
    db.ref('configuracoes/logoHospital').once('value').then(snapLogo => {
        if (snapLogo.val()) {
            try { 
                doc.addImage(snapLogo.val(), 'PNG', 10, 8, 22, 22); 
            } catch (e) {
                console.warn('Não foi possível adicionar a logo ao PDF');
            }
        }
        
        // Cabeçalho
        doc.setFontSize(16);
        doc.setTextColor(27, 79, 156);
        doc.setFont('helvetica', 'bold');
        doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS', 148, 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistema de Controle de Recepção - Relatório ' + titulo, 148, 22, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Período: ${strInicio} a ${strFim}`, 148, 28, { align: 'center' });
        
        // Linha separadora
        doc.setDrawColor(27, 79, 156);
        doc.setLineWidth(0.5);
        doc.line(14, 31, 283, 31);
        
        // ============================================
        // RESUMO COM INDICADORES — em dois blocos separados
        // (Acompanhantes x Visitantes), para não misturar números
        // que representam coisas diferentes.
        // ============================================
        let yAtual = 38;
        
        doc.setFontSize(12);
        doc.setTextColor(27, 79, 156);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO DO PERÍODO', 14, yAtual);
        yAtual += 6;

        const larguraBloco = 133;
        const xAcomp = 14, xVisit = 14 + larguraBloco + 3;
        const alturaBloco = 30;

        // Bloco Acompanhantes
        doc.setFillColor(232, 238, 253); // --stat-presentes-acomp-bg
        doc.roundedRect(xAcomp, yAtual, larguraBloco, alturaBloco, 2, 2, 'F');
        doc.setDrawColor(27, 79, 156);
        doc.setLineWidth(0.3);
        doc.roundedRect(xAcomp, yAtual, larguraBloco, alturaBloco, 2, 2, 'S');
        doc.setFontSize(10);
        doc.setTextColor(27, 79, 156);
        doc.setFont('helvetica', 'bold');
        doc.text('ACOMPANHANTES', xAcomp + 5, yAtual + 7);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        doc.text(`Entradas no período: ${totalAcompanhantes}`, xAcomp + 5, yAtual + 15);
        doc.text(`Saídas registradas: ${saidasAcompanhantes}`, xAcomp + 5, yAtual + 21);
        doc.text(`Trocas de acompanhante: ${totalTrocas}`, xAcomp + 5, yAtual + 27);
        doc.setFont('helvetica', 'bold');
        doc.text(`Presentes agora: ${acompanhantesAtivos}`, xAcomp + 75, yAtual + 15);
        doc.text(`Altas de pacientes: ${totalAltas}`, xAcomp + 75, yAtual + 21);

        // Bloco Visitantes
        doc.setFillColor(240, 236, 254); // --stat-presentes-visit-bg
        doc.roundedRect(xVisit, yAtual, larguraBloco, alturaBloco, 2, 2, 'F');
        doc.setDrawColor(124, 92, 252);
        doc.roundedRect(xVisit, yAtual, larguraBloco, alturaBloco, 2, 2, 'S');
        doc.setFontSize(10);
        doc.setTextColor(124, 92, 252);
        doc.setFont('helvetica', 'bold');
        doc.text('VISITANTES', xVisit + 5, yAtual + 7);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        doc.text(`Entradas no período: ${totalVisitas}`, xVisit + 5, yAtual + 15);
        doc.text(`Saídas automáticas (1h): ${saidasVisitantes}`, xVisit + 5, yAtual + 21);
        doc.setFont('helvetica', 'bold');
        doc.text(`Presentes agora: ${visitasAtivas}`, xVisit + 75, yAtual + 15);

        yAtual += alturaBloco + 8;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.setFont('helvetica', 'italic');
        doc.text(`Total de registros no período: ${totalEntradas}  (${totalAcompanhantes} acompanhantes + ${totalVisitas} visitantes)`, 14, yAtual);
        yAtual += 8;
        
        // ============================================
        // RESUMO POR SETOR (acompanhantes e visitantes em colunas separadas)
        // ============================================
        if (Object.keys(setoresMap).length > 0) {
            doc.setFontSize(11);
            doc.setTextColor(27, 79, 156);
            doc.setFont('helvetica', 'bold');
            doc.text('MOVIMENTAÇÃO POR SETOR', 14, yAtual);
            
            yAtual += 7;
            
            // Cabeçalho da tabela de setores
            const colSetor = 14, wSetor = 68;
            const colEntAc = colSetor + wSetor, wCol = 43;
            const colAtAc = colEntAc + wCol;
            const colEntVi = colAtAc + wCol;
            const colAtVi = colEntVi + wCol;

            doc.setFillColor(27, 79, 156);
            doc.setTextColor(255);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.rect(colSetor, yAtual, wSetor, 10, 'F');
            doc.rect(colEntAc, yAtual, wCol, 5, 'F');
            doc.rect(colAtAc, yAtual, wCol, 5, 'F');
            doc.rect(colEntVi, yAtual, wCol, 5, 'F');
            doc.rect(colAtVi, yAtual, wCol, 5, 'F');
            doc.text('Acompanhantes', colEntAc + wCol, yAtual + 3.5, { align: 'center' });
            doc.rect(colEntAc, yAtual + 5, wCol, 5, 'F');
            doc.rect(colAtAc, yAtual + 5, wCol, 5, 'F');
            doc.text('Visitantes', colEntVi + wCol, yAtual + 3.5, { align: 'center' });
            doc.rect(colEntVi, yAtual + 5, wCol, 5, 'F');
            doc.rect(colAtVi, yAtual + 5, wCol, 5, 'F');

            doc.setFontSize(7);
            doc.text('Setor', colSetor + 2, yAtual + 6.5);
            doc.text('Entradas', colEntAc + wCol / 2, yAtual + 8.5, { align: 'center' });
            doc.text('Ativos', colAtAc + wCol / 2, yAtual + 8.5, { align: 'center' });
            doc.text('Entradas', colEntVi + wCol / 2, yAtual + 8.5, { align: 'center' });
            doc.text('Ativos', colAtVi + wCol / 2, yAtual + 8.5, { align: 'center' });
            
            yAtual += 10;
            
            // Dados dos setores
            Object.entries(setoresMap).sort().forEach(([setor, d], index) => {
                if (index % 2 === 0) {
                    doc.setFillColor(245, 250, 252);
                    doc.rect(colSetor, yAtual, wSetor, 5, 'F');
                    doc.rect(colEntAc, yAtual, wCol, 5, 'F');
                    doc.rect(colAtAc, yAtual, wCol, 5, 'F');
                    doc.rect(colEntVi, yAtual, wCol, 5, 'F');
                    doc.rect(colAtVi, yAtual, wCol, 5, 'F');
                }
                
                doc.setTextColor(50);
                doc.setFont('helvetica', 'normal');
                doc.text(setor, colSetor + 2, yAtual + 3.5);
                doc.text(String(d.entradasAcomp), colEntAc + wCol / 2, yAtual + 3.5, { align: 'center' });
                doc.text(String(d.ativosAcomp), colAtAc + wCol / 2, yAtual + 3.5, { align: 'center' });
                doc.text(String(d.entradasVisit), colEntVi + wCol / 2, yAtual + 3.5, { align: 'center' });
                doc.text(String(d.ativosVisit), colAtVi + wCol / 2, yAtual + 3.5, { align: 'center' });
                
                yAtual += 6;
            });
            
            yAtual += 8;
        }
        
        // ============================================
        // TABELA DETALHADA
        // ============================================
        doc.setFontSize(11);
        doc.setTextColor(27, 79, 156);
        doc.setFont('helvetica', 'bold');
        doc.text('REGISTROS DETALHADOS', 14, yAtual);
        
        yAtual += 2;
        
        doc.autoTable({
            startY: yAtual,
            head: [['Tipo', 'Nome', 'Documento', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Entrada', 'Saída', 'Situação']],
            body: dados.map(ac => [
                ac.tipo === 'visita' ? 'Visita' : 'Acomp.',
                ac.nomeAcompanhante,
                ac.documento || '-',
                ac.parentesco,
                ac.nomePaciente,
                ac.setor,
                ac.leito || '-',
                ac.dataEntrada + ' ' + ac.horaEntrada,
                ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-',
                { presente: 'Presente', saiu: 'Saiu', trocado: 'Trocado' }[ac.status] || ac.status
            ]),
            styles: { fontSize: 7 },
            headStyles: { fillColor: [27, 79, 156], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [232, 238, 253] },
            margin: { left: 14, right: 14 },
            didParseCell: function (data) {
                // Colore a coluna "Situação" para leitura rápida do status
                if (data.section === 'body' && data.column.index === 9) {
                    const valor = data.cell.raw;
                    if (valor === 'Presente') { data.cell.styles.textColor = [21, 128, 61]; data.cell.styles.fontStyle = 'bold'; }
                    else if (valor === 'Saiu') { data.cell.styles.textColor = [194, 32, 38]; }
                    else if (valor === 'Trocado') { data.cell.styles.textColor = [180, 83, 9]; }
                }
            }
        });
        
        // Rodapé
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.setFont('helvetica', 'italic');
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, finalY);
        doc.text(`${totalAcompanhantes} acompanhantes + ${totalVisitas} visitantes = ${totalEntradas} registros no período | Gerado por: ${usuarioLogado?.nome || 'Sistema'}`, 148, finalY, { align: 'center' });
        doc.text('Hospital Regional de Palmeira dos Índios', 283, finalY, { align: 'right' });
        
        // Salvar
        doc.save(`HRPI_Relatorio_${titulo}_${formatar(agora)}.pdf`);
        toast('PDF gerado com sucesso!');
    }).catch(err => {
        console.error('Erro ao gerar PDF:', err);
        toast('Erro ao gerar relatório PDF.', 'error');
    });
}

// ============================================
// RELATÓRIO PERSONALIZADO POR SETOR
// ------------------------------------------
// Gera um PDF com os dados de apenas UM setor (ex.: só Pediatria, só
// UTI I), em vez do hospital inteiro. Útil para repassar o número exato
// de um setor a quem coordena aquele setor especificamente, sem misturar
// com os outros — o relatório geral (gerarRelatorio) já mostra todos os
// setores lado a lado, mas nunca isolados num documento só deles.
// ============================================
function gerarRelatorioSetor() {
    if (typeof window.jspdf === 'undefined') {
        toast('Carregando biblioteca de PDF... Aguarde e tente novamente.', 'error');
        return;
    }

    const setor = document.getElementById('relSetorSelecionado')?.value;
    if (!setor) { toast('Selecione um setor.', 'error'); return; }

    const periodoTipo = document.getElementById('relSetorPeriodo')?.value || 'mes';
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    let dataInicio, dataFim, rotuloPeriodo;

    if (periodoTipo === 'semana') {
        dataInicio = new Date(agora); dataInicio.setDate(agora.getDate() - 6);
        dataFim = new Date(agora); dataFim.setHours(23, 59, 59, 999);
        rotuloPeriodo = 'Últimos 7 dias';
    } else if (periodoTipo === 'personalizado') {
        const ini = document.getElementById('relSetorDataInicio')?.value;
        const fim = document.getElementById('relSetorDataFim')?.value;
        if (!ini || !fim) { toast('Selecione as datas inicial e final.', 'error'); return; }
        dataInicio = new Date(ini + 'T00:00:00');
        dataFim = new Date(fim + 'T23:59:59');
        rotuloPeriodo = 'Personalizado';
    } else {
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
        dataFim = new Date(agora); dataFim.setHours(23, 59, 59, 999);
        rotuloPeriodo = 'Mês atual';
    }

    const formatar = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;

    const todosDoSetor = Object.values(acompanhantes).filter(ac => ac.setor === setor);
    const dados = todosDoSetor.filter(ac => {
        const [d, m, a] = ac.dataEntrada.split('-');
        const dataRegistro = new Date(a, m - 1, d);
        return dataRegistro >= dataInicio && dataRegistro <= dataFim;
    }).sort((a, b) => {
        const da = new Date(a.dataEntrada.split('-')[2], a.dataEntrada.split('-')[1] - 1, a.dataEntrada.split('-')[0]);
        const db = new Date(b.dataEntrada.split('-')[2], b.dataEntrada.split('-')[1] - 1, b.dataEntrada.split('-')[0]);
        return db - da || b.horaEntrada.localeCompare(a.horaEntrada);
    });

    if (dados.length === 0) {
        toast(`Nenhum registro de "${setor}" no período selecionado.`, 'error');
        return;
    }

    let entradasAcomp = 0, entradasVisit = 0, saidasAcomp = 0, saidasVisit = 0, trocas = 0;
    dados.forEach(ac => {
        if (ac.tipo === 'acompanhante') entradasAcomp++; else entradasVisit++;
        if (ac.status === 'saiu' && ac.tipo === 'acompanhante') saidasAcomp++;
        if (ac.status === 'saiu' && ac.tipo === 'visita') saidasVisit++;
        if (ac.status === 'trocado') trocas++;
    });
    const ativosAcomp = todosDoSetor.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante').length;
    const ativosVisit = todosDoSetor.filter(ac => ac.status === 'presente' && ac.tipo === 'visita').length;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait');

    db.ref('configuracoes/logoHospital').once('value').then(snapLogo => {
        if (snapLogo.val()) {
            try { doc.addImage(snapLogo.val(), 'PNG', 15, 10, 20, 20); } catch (e) { console.warn('Não foi possível adicionar a logo ao PDF'); }
        }

        doc.setFontSize(15);
        doc.setTextColor(27, 79, 156);
        doc.setFont('helvetica', 'bold');
        doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS', 105, 16, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistema de Controle de Recepção', 105, 22, { align: 'center' });

        doc.setDrawColor(47, 111, 237);
        doc.setLineWidth(0.6);
        doc.line(14, 32, 196, 32);

        // Título do setor em destaque
        doc.setFillColor(232, 238, 253);
        doc.roundedRect(14, 37, 182, 16, 3, 3, 'F');
        doc.setFontSize(14);
        doc.setTextColor(27, 79, 156);
        doc.setFont('helvetica', 'bold');
        doc.text(`SETOR: ${setor.toUpperCase()}`, 20, 47);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text(`Período: ${rotuloPeriodo} (${formatar(dataInicio)} a ${formatar(dataFim)})`, 176, 47, { align: 'right' });

        let y = 63;
        doc.setFontSize(11);
        doc.setTextColor(27, 79, 156);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO DO SETOR', 14, y);
        y += 6;

        const cartoes = [
            { label: 'Entradas Acomp.', valor: entradasAcomp, cor: [22, 163, 74] },
            { label: 'Entradas Visit.', valor: entradasVisit, cor: [15, 181, 176] },
            { label: 'Saídas Acomp.', valor: saidasAcomp, cor: [229, 72, 77] },
            { label: 'Trocas', valor: trocas, cor: [245, 158, 11] },
        ];
        const wCartao = 43, hCartao = 24, gap = 2;
        cartoes.forEach((c, i) => {
            const x = 14 + i * (wCartao + gap);
            doc.setFillColor(250, 250, 252);
            doc.setDrawColor(...c.cor);
            doc.roundedRect(x, y, wCartao, hCartao, 2, 2, 'FD');
            doc.setTextColor(...c.cor);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(String(c.valor), x + wCartao / 2, y + 13, { align: 'center' });
            doc.setFontSize(7);
            doc.setTextColor(90);
            doc.setFont('helvetica', 'normal');
            doc.text(c.label, x + wCartao / 2, y + 19, { align: 'center' });
        });
        y += hCartao + 8;

        doc.setFontSize(9.5);
        doc.setTextColor(50);
        doc.setFont('helvetica', 'bold');
        doc.text(`Presentes agora no setor: ${ativosAcomp} acompanhante(s) e ${ativosVisit} visitante(s)`, 14, y);
        y += 8;

        doc.setFontSize(11);
        doc.setTextColor(27, 79, 156);
        doc.setFont('helvetica', 'bold');
        doc.text('REGISTROS DO PERÍODO', 14, y);
        y += 2;

        doc.autoTable({
            startY: y,
            head: [['Tipo', 'Nome', 'Paciente', 'Leito', 'Entrada', 'Saída', 'Situação']],
            body: dados.map(ac => [
                ac.tipo === 'visita' ? 'Visita' : 'Acomp.',
                ac.nomeAcompanhante,
                ac.nomePaciente,
                ac.leito || '-',
                ac.dataEntrada + ' ' + ac.horaEntrada,
                ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-',
                { presente: 'Presente', saiu: 'Saiu', trocado: 'Trocado' }[ac.status] || ac.status
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [27, 79, 156], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [232, 238, 253] },
            margin: { left: 14, right: 14 },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 6) {
                    const valor = data.cell.raw;
                    if (valor === 'Presente') { data.cell.styles.textColor = [21, 128, 61]; data.cell.styles.fontStyle = 'bold'; }
                    else if (valor === 'Saiu') { data.cell.styles.textColor = [194, 32, 38]; }
                    else if (valor === 'Trocado') { data.cell.styles.textColor = [180, 83, 9]; }
                }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.setFont('helvetica', 'italic');
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Por: ${usuarioLogado?.nome || 'Sistema'}`, 14, finalY);
        doc.text('Hospital Regional de Palmeira dos Índios', 196, finalY, { align: 'right' });

        doc.save(`HRPI_Relatorio_${setor.replace(/\s+/g, '_')}_${formatar(agora)}.pdf`);
        toast('PDF do setor gerado com sucesso!');
    }).catch(err => {
        console.error('Erro ao gerar PDF do setor:', err);
        toast('Erro ao gerar relatório do setor.', 'error');
    });
}

