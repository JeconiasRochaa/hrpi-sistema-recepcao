// ============================================
// 09-dashboard.js
// Painel Gerencial: cartões de estatísticas, gráficos (Chart.js) e alertas (presença pendente / duplicidade).
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// PAINEL GERENCIAL REFORMULADO
// ============================================

function atualizarDashboardGerencial() {
    const dados = Object.values(acompanhantes);
    atualizarCards(dados);
    atualizarLabelPeriodo();
    atualizarAlertaPresenca();
    atualizarAlertaDuplicidade();

    const isAdmin = usuarioLogado && (usuarioLogado.cargo === 'Administrador' || usuarioLogado.cargo === 'Supervisor');
    const chartsRows = document.querySelectorAll('.charts-row');
    const painelInsights = document.querySelector('.painel-insights');
    const cardsRow = document.getElementById('cardsGerenciais');

    if (isAdmin) {
        chartsRows.forEach(row => row.style.display = '');
        if (painelInsights) painelInsights.style.display = '';
        atualizarGraficosGerenciais(dados);
        gerarInsights(dados);
    } else {
        chartsRows.forEach(row => row.style.display = 'none');
        if (painelInsights) painelInsights.style.display = 'none';
    }
}

// Mostra "Dados completos de [Mês] de [Ano]" no cabeçalho do painel.
function atualizarLabelPeriodo() {
    const el = document.getElementById('dashboardPeriodoLabel');
    if (!el) return;
    const nomesMeses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const agora = new Date();
    el.textContent = `Dados completos de ${nomesMeses[agora.getMonth()]} de ${agora.getFullYear()}`;
}

// Retorna os registros do mês corrente (do dia 1 até hoje). O Painel
// Gerencial sempre exibe o mês atual por completo — sem filtro manual.
function obterDadosFiltrados() {
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
    return Object.values(acompanhantes).filter(ac => {
        const [d, m, a] = ac.dataEntrada.split('-');
        const data = new Date(a, m - 1, d);
        return data >= inicio && data <= fim;
    });
}

function atualizarCards(dados) {
    const hoje = dataHoje();
    const todos = Object.values(acompanhantes);

    // Presentes agora, contados separadamente por tipo — este é o número
    // que a nutrição usa para calcular as refeições, então precisa estar
    // bem visível e nunca somado (acompanhante + visitante são coisas
    // muito diferentes em termos de tempo de permanência e refeições).
    const acompanhantesPresentes = todos.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante').length;
    const visitantesPresentes = todos.filter(ac => ac.status === 'presente' && ac.tipo === 'visita').length;

    // Pacientes Internados com Acompanhante (únicos, status presente)
    const acompPresentes = todos.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante');
    const pacientesUnicos = new Set(acompPresentes.map(ac => ac.nomePaciente)).size;

    // Entradas Hoje — contadas separadamente por tipo (acompanhante x visitante),
    // em vez de somadas num único número (que escondia a proporção de cada um).
    const entradasAcompanhantesHoje = todos.filter(ac => ac.dataEntrada === hoje && ac.tipo === 'acompanhante').length;
    const entradasVisitantesHoje = todos.filter(ac => ac.dataEntrada === hoje && ac.tipo === 'visita').length;

    // Saídas Hoje — mesma lógica, separadas por tipo.
    const saidasAcompanhantesHoje = todos.filter(ac => ac.dataSaida === hoje && ac.status === 'saiu' && ac.tipo === 'acompanhante').length;
    const saidasVisitantesHoje = todos.filter(ac => ac.dataSaida === hoje && ac.status === 'saiu' && ac.tipo === 'visita').length;

    // Trocas Hoje
    const trocasHoje = todos.filter(ac => ac.dataSaida === hoje && ac.status === 'trocado').length;

    // Altas de Pacientes (apenas acompanhantes que saíram por alta)
    const altasHoje = todos.filter(ac =>
        ac.dataSaida === hoje &&
        ac.status === 'saiu' &&
        ac.tipo === 'acompanhante' &&
        ac.observacao &&
        ac.observacao.toLowerCase().includes('alta do paciente')
    ).length;

    // Média Diária de Visitas no mês corrente (dia 1 até hoje)
    const dadosFiltrados = obterDadosFiltrados();
    const visitasFiltradas = dadosFiltrados.filter(ac => ac.tipo === 'visita');
    const agoraCard = new Date();
    const totalDias = agoraCard.getDate(); // dias corridos do mês até hoje
    const mediaVisitas = (visitasFiltradas.length / totalDias).toFixed(1);

    // Totais do Período — Acompanhantes e Visitantes, na semana (últimos 7
    // dias corridos, incluindo hoje) e no mês corrente (dia 1 até hoje).
    const inicioSemana7d = new Date(agoraCard);
    inicioSemana7d.setHours(0, 0, 0, 0);
    inicioSemana7d.setDate(inicioSemana7d.getDate() - 6);
    const fimHoje = new Date(agoraCard);
    fimHoje.setHours(23, 59, 59, 999);
    const dadosSemana = todos.filter(ac => {
        const [d, m, a] = ac.dataEntrada.split('-');
        const data = new Date(a, m - 1, d);
        return data >= inicioSemana7d && data <= fimHoje;
    });
    const acompanhantesSemana = dadosSemana.filter(ac => ac.tipo === 'acompanhante').length;
    const visitantesSemana = dadosSemana.filter(ac => ac.tipo === 'visita').length;
    const acompanhantesMes = dadosFiltrados.filter(ac => ac.tipo === 'acompanhante').length;
    const visitantesMes = visitasFiltradas.length;

    // Permanência Média dos Acompanhantes (baseado nos dados filtrados)
    const acompComSaida = dadosFiltrados.filter(ac => ac.tipo === 'acompanhante' && ac.status === 'saiu' && ac.dataSaida && ac.horaSaida);
    let permanenciaTotal = 0;
    acompComSaida.forEach(ac => {
        const entrada = new Date(ac.dataEntrada.split('-')[2], ac.dataEntrada.split('-')[1] - 1, ac.dataEntrada.split('-')[0], ...ac.horaEntrada.split(':').map(Number));
        const saida = new Date(ac.dataSaida.split('-')[2], ac.dataSaida.split('-')[1] - 1, ac.dataSaida.split('-')[0], ...ac.horaSaida.split(':').map(Number));
        permanenciaTotal += (saida - entrada) / (1000 * 3600);
    });
    const permanenciaMedia = acompComSaida.length ? (permanenciaTotal / acompComSaida.length).toFixed(1) : 0;

    // Atualiza o HTML
    document.getElementById('cardAcompanhantesPresentes').textContent = acompanhantesPresentes;
    document.getElementById('cardVisitantesPresentes').textContent = visitantesPresentes;

    // Subtexto do card "Acompanhantes Presentes": mostra para quantos
    // pacientes diferentes são, e alerta se o número de acompanhantes for
    // maior que o de pacientes (sinal de possível duplicidade — ver
    // detectarAcompanhantesDuplicados / alerta no topo do painel).
    const subPacientes = document.getElementById('cardPacientesAcompanhadosSub');
    if (subPacientes) {
        if (acompanhantesPresentes > pacientesUnicos) {
            subPacientes.textContent = `para ${pacientesUnicos} pacientes (${acompanhantesPresentes - pacientesUnicos} duplicado${acompanhantesPresentes - pacientesUnicos > 1 ? 's' : ''} — ver alerta acima)`;
            subPacientes.classList.add('alerta');
        } else {
            subPacientes.textContent = `para ${pacientesUnicos} paciente${pacientesUnicos !== 1 ? 's' : ''}`;
            subPacientes.classList.remove('alerta');
        }
    }

    document.getElementById('cardEntradasAcompanhantesHoje').textContent = entradasAcompanhantesHoje;
    document.getElementById('cardEntradasVisitantesHoje').textContent = entradasVisitantesHoje;
    document.getElementById('cardSaidasAcompanhantesHoje').textContent = saidasAcompanhantesHoje;
    document.getElementById('cardSaidasVisitantesHoje').textContent = saidasVisitantesHoje;
    document.getElementById('cardTrocasHoje').textContent = trocasHoje;
    document.getElementById('cardAltasHoje').textContent = altasHoje;
    document.getElementById('cardMediaVisitas').textContent = mediaVisitas;
    document.getElementById('cardPermanenciaMedia').textContent = permanenciaMedia + 'h';
    document.getElementById('cardAcompanhantesSemana').textContent = acompanhantesSemana;
    document.getElementById('cardVisitantesSemana').textContent = visitantesSemana;
    document.getElementById('cardAcompanhantesMes').textContent = acompanhantesMes;
    document.getElementById('cardVisitantesMes').textContent = visitantesMes;

    // Mesmos totais, espelhados na página de Relatórios.
    const elAcSemRel = document.getElementById('cardAcompanhantesSemanaRel');
    const elViSemRel = document.getElementById('cardVisitantesSemanaRel');
    const elAcMesRel = document.getElementById('cardAcompanhantesMesRel');
    const elViMesRel = document.getElementById('cardVisitantesMesRel');
    if (elAcSemRel) elAcSemRel.textContent = acompanhantesSemana;
    if (elViSemRel) elViSemRel.textContent = visitantesSemana;
    if (elAcMesRel) elAcMesRel.textContent = acompanhantesMes;
    if (elViMesRel) elViMesRel.textContent = visitantesMes;
}

function atualizarGraficosGerenciais(dados) {
    Object.values(graficos).forEach(g => g.destroy());
    graficos = {};
    if (document.getElementById('graficoSemanal')) graficoSemanal(dados);
    if (document.getElementById('graficoSetores')) graficoSetores(dados);
    if (document.getElementById('graficoTendencia')) graficoTendencia(dados);
    if (document.getElementById('graficoTrocasDiarias')) graficoTrocasDiarias(dados);
    if (document.getElementById('graficoHorarioMovimento')) graficoHorarioMovimento(dados);
    if (document.getElementById('graficoRankingSetores')) graficoRankingSetores(dados);
    if (document.getElementById('graficoPermanenciaSetor')) graficoPermanenciaSetor(dados);
    if (document.getElementById('graficoFluxoDiario')) graficoFluxoDiario(dados);
}

function graficoSemanal(dados) {
    const canvas = document.getElementById('graficoSemanal');
    if (!canvas) return;
    const dias = [], entradasAcomp = [], entradasVisit = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dataStr = formatarData(d);
        dias.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
        entradasAcomp.push(dados.filter(ac => ac.dataEntrada === dataStr && ac.tipo === 'acompanhante').length);
        entradasVisit.push(dados.filter(ac => ac.dataEntrada === dataStr && ac.tipo === 'visita').length);
    }
    graficos.semanal = new Chart(canvas, {
        type: 'bar',
        data: { labels: dias, datasets: [
            { label: 'Entradas de Acompanhantes', data: entradasAcomp, backgroundColor: '#2456c4', borderRadius: 6 },
            { label: 'Entradas de Visitantes', data: entradasVisit, backgroundColor: '#7c5cfc', borderRadius: 6 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function graficoSetores(dados) {
    const canvas = document.getElementById('graficoSetores');
    if (!canvas) return;
    const setores = {};
    dados.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante').forEach(ac => setores[ac.setor] = (setores[ac.setor] || 0) + 1);
    const labels = Object.keys(setores), values = Object.values(setores);
    const total = values.reduce((a, b) => a + b, 0);
    let html = '<table><tr><th>Setor</th><th>Qtd</th><th>%</th></tr>';
    labels.forEach((l, i) => { const pct = total ? ((values[i] / total) * 100).toFixed(1) : 0; html += `<tr><td>${l}</td><td>${values[i]}</td><td>${pct}%</td></tr>`; });
    document.getElementById('tabelaSetores').innerHTML = html;
    graficos.setores = new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: ['#2f6fed','#16a34a','#f59e0b','#7c5cfc','#e5484d','#0fb5b0','#c2410c','#1b4f9c'] }] },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            layout: { padding: 10 }
        }
    });
}

function graficoTendencia(dados) {
    const canvas = document.getElementById('graficoTendencia');
    if (!canvas) return;
    const dias = [], visitas = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dataStr = formatarData(d);
        dias.push(dataStr.substring(0, 5));
        visitas.push(dados.filter(ac => ac.dataEntrada === dataStr && ac.tipo === 'visita').length);
    }
    graficos.tendencia = new Chart(canvas, {
        type: 'line',
        data: { labels: dias, datasets: [{ data: visitas, borderColor: '#7c5cfc', backgroundColor: 'rgba(124,92,252,0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function graficoTrocasDiarias(dados) {
    const canvas = document.getElementById('graficoTrocasDiarias');
    if (!canvas) return;
    const dias = [], trocas = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dataStr = formatarData(d);
        dias.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
        trocas.push(dados.filter(ac => ac.dataSaida === dataStr && ac.status === 'trocado').length);
    }
    graficos.trocas = new Chart(canvas, {
        type: 'bar',
        data: { labels: dias, datasets: [{ data: trocas, backgroundColor: '#f59e0b', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function graficoHorarioMovimento(dados) {
    const canvas = document.getElementById('graficoHorarioMovimento');
    if (!canvas) return;
    const horas = Array.from({length: 16}, (_, i) => `${String(i + 7).padStart(2, '0')}h`);
    const entradas = Array(16).fill(0), saidas = Array(16).fill(0), trocas = Array(16).fill(0);
    dados.forEach(ac => {
        const h = parseInt(ac.horaEntrada.split(':')[0]);
        if (h >= 7 && h < 23) entradas[h - 7]++;
        if (ac.horaSaida) { 
            const hs = parseInt(ac.horaSaida.split(':')[0]); 
            if (hs >= 7 && hs < 23) saidas[hs - 7]++; 
            if (ac.status === 'trocado') trocas[hs - 7]++; 
        }
    });
    graficos.horario = new Chart(canvas, {
        type: 'bar',
        data: { labels: horas, datasets: [
            { label: 'Entradas', data: entradas, backgroundColor: '#2f6fed' },
            { label: 'Saídas', data: saidas, backgroundColor: '#e5484d' },
            { label: 'Trocas', data: trocas, backgroundColor: '#f59e0b' }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
    });
}

function graficoRankingSetores(dados) {
    const canvas = document.getElementById('graficoRankingSetores');
    if (!canvas) return;
    const setores = {};
    dados.forEach(ac => {
        if (!ac.setor) return;
        if (!setores[ac.setor]) setores[ac.setor] = { acompanhantes: 0, visitas: 0, trocas: 0 };
        if (ac.tipo === 'acompanhante') setores[ac.setor].acompanhantes++;
        if (ac.tipo === 'visita') setores[ac.setor].visitas++;
        if (ac.status === 'trocado') setores[ac.setor].trocas++;
    });
    const labels = Object.keys(setores).sort((a, b) => (setores[b].acompanhantes + setores[b].visitas) - (setores[a].acompanhantes + setores[a].visitas));
    graficos.ranking = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Acompanhantes', data: labels.map(l => setores[l].acompanhantes), backgroundColor: '#2456c4' },
            { label: 'Visitas', data: labels.map(l => setores[l].visitas), backgroundColor: '#7c5cfc' },
            { label: 'Trocas', data: labels.map(l => setores[l].trocas), backgroundColor: '#f59e0b' }
        ]},
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { beginAtZero: true } } }
    });
}

function graficoPermanenciaSetor(dados) {
    const canvas = document.getElementById('graficoPermanenciaSetor');
    if (!canvas) return;
    const permanencia = {};
    dados.filter(ac => ac.tipo === 'acompanhante' && ac.status === 'saiu').forEach(ac => {
        const entrada = new Date(ac.dataEntrada.split('-')[2], ac.dataEntrada.split('-')[1] - 1, ac.dataEntrada.split('-')[0], ...ac.horaEntrada.split(':').map(Number));
        const saida = new Date(ac.dataSaida.split('-')[2], ac.dataSaida.split('-')[1] - 1, ac.dataSaida.split('-')[0], ...ac.horaSaida.split(':').map(Number));
        const horas = (saida - entrada) / (1000 * 3600);
        if (!permanencia[ac.setor]) permanencia[ac.setor] = { total: 0, count: 0 };
        permanencia[ac.setor].total += horas;
        permanencia[ac.setor].count++;
    });
    const labels = Object.keys(permanencia).sort((a, b) => (permanencia[b].total / permanencia[b].count) - (permanencia[a].total / permanencia[a].count));
    const medias = labels.map(l => (permanencia[l].total / permanencia[l].count).toFixed(1));
    graficos.permanencia = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ data: medias, backgroundColor: '#0fb5b0', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function graficoFluxoDiario(dados) {
    const canvas = document.getElementById('graficoFluxoDiario');
    if (!canvas) return;
    const horas = Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}h`);
    const entradas = Array(24).fill(0), saidas = Array(24).fill(0), trocas = Array(24).fill(0);
    dados.forEach(ac => {
        const h = parseInt(ac.horaEntrada.split(':')[0]);
        entradas[h]++;
        if (ac.horaSaida) { 
            const hs = parseInt(ac.horaSaida.split(':')[0]); 
            saidas[hs]++; 
            if (ac.status === 'trocado') trocas[hs]++; 
        }
    });
    graficos.fluxo = new Chart(canvas, {
        type: 'line',
        data: { labels: horas, datasets: [
            { label: 'Entradas', data: entradas, borderColor: '#2f6fed', tension: 0.3 },
            { label: 'Saídas', data: saidas, borderColor: '#e5484d', tension: 0.3 },
            { label: 'Trocas', data: trocas, borderColor: '#f59e0b', tension: 0.3 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
    });
}

function gerarInsights(dados) {
    const insights = [];
    const hoje = dataHoje();
    
    // 1. Setor com maior concentração de acompanhantes
    const setores = {};
    dados.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante').forEach(ac => {
        setores[ac.setor] = (setores[ac.setor] || 0) + 1;
    });
    const totalAcomp = Object.values(setores).reduce((a, b) => a + b, 0);
    const setorPrincipal = Object.entries(setores).sort((a, b) => b[1] - a[1])[0];
    if (setorPrincipal) {
        const pct = ((setorPrincipal[1] / totalAcomp) * 100).toFixed(1);
        insights.push(`O setor <strong>${setorPrincipal[0]}</strong> concentra ${pct}% dos acompanhantes.`);
    }

    // 2. Trocas hoje
    const trocasHoje = dados.filter(ac => ac.dataSaida === hoje && ac.status === 'trocado').length;
    if (trocasHoje > 0) {
        insights.push(`Hoje ocorreram <strong>${trocasHoje} trocas</strong> de acompanhantes.`);
    }

    // 3. Horário de maior movimento
    const horas = Array(24).fill(0);
    dados.forEach(ac => horas[parseInt(ac.horaEntrada.split(':')[0])]++);
    const pico = horas.indexOf(Math.max(...horas));
    insights.push(`O horário de maior movimento é por volta das <strong>${String(pico).padStart(2, '0')}h</strong>.`);

    // 4. Permanência média
    const acompComSaida = dados.filter(ac => ac.tipo === 'acompanhante' && ac.status === 'saiu' && ac.dataSaida && ac.horaSaida);
    let permanenciaTotal = 0;
    acompComSaida.forEach(ac => {
        const entrada = new Date(ac.dataEntrada.split('-')[2], ac.dataEntrada.split('-')[1] - 1, ac.dataEntrada.split('-')[0], ...ac.horaEntrada.split(':').map(Number));
        const saida = new Date(ac.dataSaida.split('-')[2], ac.dataSaida.split('-')[1] - 1, ac.dataSaida.split('-')[0], ...ac.horaSaida.split(':').map(Number));
        permanenciaTotal += (saida - entrada) / (1000 * 3600);
    });
    const permanenciaMedia = acompComSaida.length ? Math.round(permanenciaTotal / acompComSaida.length) : 0;
    if (permanenciaMedia > 0) {
        insights.push(`A permanência média dos acompanhantes é de <strong>${permanenciaMedia} horas</strong>.`);
    }

    // 5. Visitas por setor (setor com mais visitas na semana)
    const semanaInicio = new Date(); semanaInicio.setDate(semanaInicio.getDate() - 6);
    const visitasSetorSemana = {};
    dados.filter(ac => ac.tipo === 'visita' && new Date(ac.dataEntrada.split('-')[2], ac.dataEntrada.split('-')[1] - 1, ac.dataEntrada.split('-')[0]) >= semanaInicio)
        .forEach(ac => visitasSetorSemana[ac.setor] = (visitasSetorSemana[ac.setor] || 0) + 1);
    const setorMaisVisitas = Object.entries(visitasSetorSemana).sort((a, b) => b[1] - a[1])[0];
    if (setorMaisVisitas) {
        insights.push(`O setor <strong>${setorMaisVisitas[0]}</strong> teve o maior número de visitas nesta semana (${setorMaisVisitas[1]}).`);
    }

    // 6. Média diária de visitas
    const visitas = dados.filter(ac => ac.tipo === 'visita');
    const dataInicio = dados.length > 0 ? dados.reduce((min, ac) => ac.dataEntrada < min ? ac.dataEntrada : min, dados[0].dataEntrada) : hoje;
    const inicio = new Date(dataInicio.split('-')[2], dataInicio.split('-')[1] - 1, dataInicio.split('-')[0]);
    const totalDias = Math.max(1, Math.ceil((new Date() - inicio) / 86400000));
    const mediaDiaria = Math.round(visitas.length / totalDias);
    if (mediaDiaria > 0) {
        insights.push(`A média diária de visitas é de <strong>${mediaDiaria}</strong> por dia.`);
    }

    // 7. Variação de trocas (comparação com semana anterior)
    const estaSemana = dados.filter(ac => {
        const d = new Date(ac.dataSaida?.split('-')[2], ac.dataSaida?.split('-')[1] - 1, ac.dataSaida?.split('-')[0]);
        const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - 6);
        return ac.status === 'trocado' && d >= inicioSemana;
    }).length;
    const semanaPassada = dados.filter(ac => {
        const d = new Date(ac.dataSaida?.split('-')[2], ac.dataSaida?.split('-')[1] - 1, ac.dataSaida?.split('-')[0]);
        const inicio = new Date(); inicio.setDate(inicio.getDate() - 13);
        const fim = new Date(); fim.setDate(fim.getDate() - 7);
        return ac.status === 'trocado' && d >= inicio && d <= fim;
    }).length;
    if (semanaPassada > 0) {
        const variacao = (((estaSemana - semanaPassada) / semanaPassada) * 100).toFixed(0);
        const sinal = variacao > 0 ? '+' : '';
        insights.push(`O número de trocas variou <strong>${sinal}${variacao}%</strong> em relação à semana anterior.`);
    }

    const container = document.getElementById('insightsContainer');
    if (container) container.innerHTML = insights.map(i => `<div class="insight-item"><i class="fas fa-lightbulb"></i> ${i}</div>`).join('');
}

