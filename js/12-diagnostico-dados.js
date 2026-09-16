// ============================================
// 12-diagnostico-dados.js
// Ferramenta de diagnóstico: encontra registros "presente" há tempo demais.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// DIAGNÓSTICO DE DADOS — encontra registros "presente" há tempo
// demais (provável esquecimento de saída pela recepção), que causam
// divergência entre o Painel (conta tudo que está "presente") e os
// Relatórios em PDF (contam movimentação dentro de um período).
// ============================================
function parseDataHora(dataStr, horaStr) {
    const [d, m, a] = dataStr.split('-');
    const [h, min] = (horaStr || '00:00').split(':').map(Number);
    return new Date(a, m - 1, d, h, min);
}

function formatarTempoDecorrido(ms) {
    const horas = ms / (1000 * 60 * 60);
    if (horas < 24) return `${horas.toFixed(1)}h`;
    const dias = Math.floor(horas / 24);
    const horasRestantes = Math.round(horas % 24);
    return `${dias}d ${horasRestantes}h`;
}

function limparResultadoDiagnostico() {
    const resultCard = document.getElementById('diagResultadoCard');
    const vazioCard = document.getElementById('diagVazioCard');
    if (resultCard) resultCard.style.display = 'none';
    if (vazioCard) vazioCard.style.display = 'none';
    const tbody = document.getElementById('diagTbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum registro analisado ainda</td></tr>';
}

function rodarDiagnostico() {
    const limiteDias = parseFloat(document.getElementById('diagLimiteAcompanhanteDias')?.value) || 15;
    const limiteHoras = parseFloat(document.getElementById('diagLimiteVisitanteHoras')?.value) || 2;
    const agora = new Date();

    const suspeitos = Object.values(acompanhantes).filter(ac => {
        if (ac.status !== 'presente') return false;
        const entrada = parseDataHora(ac.dataEntrada, ac.horaEntrada);
        const horasPresente = (agora - entrada) / (1000 * 60 * 60);
        if (ac.tipo === 'acompanhante') return horasPresente > limiteDias * 24;
        return horasPresente > limiteHoras;
    }).sort((a, b) => parseDataHora(a.dataEntrada, a.horaEntrada) - parseDataHora(b.dataEntrada, b.horaEntrada));

    const resultCard = document.getElementById('diagResultadoCard');
    const vazioCard = document.getElementById('diagVazioCard');
    const tbody = document.getElementById('diagTbody');
    const contador = document.getElementById('diagContador');

    if (suspeitos.length === 0) {
        resultCard.style.display = 'none';
        vazioCard.style.display = '';
        return;
    }

    vazioCard.style.display = 'none';
    resultCard.style.display = '';
    contador.textContent = suspeitos.length;

    tbody.innerHTML = suspeitos.map(ac => {
        const entrada = parseDataHora(ac.dataEntrada, ac.horaEntrada);
        const tempo = formatarTempoDecorrido(agora - entrada);
        const tipoBadge = ac.tipo === 'visita' ? 'badge-visita' : 'badge-info';
        const tipoLabel = ac.tipo === 'visita' ? 'Visitante' : 'Acompanhante';
        return `<tr>
            <td><input type="checkbox" class="diag-check" data-id="${ac.id}" onclick="atualizarBotaoLoteDiagnostico()"></td>
            <td><span class="badge ${tipoBadge}">${tipoLabel}</span></td>
            <td>${ac.nomeAcompanhante || '-'}</td>
            <td>${ac.nomePaciente || '-'}</td>
            <td>${ac.setor || '-'}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td><span class="badge badge-danger">${tempo}</span></td>
            <td><button class="btn-icon" title="Registrar saída deste registro" onclick="darSaidaSingleDiagnostico('${ac.id}')"><i class="fas fa-sign-out-alt"></i></button></td>
        </tr>`;
    }).join('');

    const selTodos = document.getElementById('diagSelecionarTodos');
    if (selTodos) selTodos.checked = false;
    atualizarBotaoLoteDiagnostico();
}

function toggleSelecionarTodosDiagnostico(origem) {
    document.querySelectorAll('.diag-check').forEach(chk => chk.checked = origem.checked);
    atualizarBotaoLoteDiagnostico();
}

function atualizarBotaoLoteDiagnostico() {
    const marcados = document.querySelectorAll('.diag-check:checked').length;
    const btn = document.getElementById('btnDarSaidaLote');
    if (btn) {
        btn.disabled = marcados === 0;
        btn.innerHTML = marcados > 0
            ? `<i class="fas fa-sign-out-alt"></i> Registrar Saída dos Selecionados (${marcados})`
            : `<i class="fas fa-sign-out-alt"></i> Registrar Saída dos Selecionados`;
    }
}

function darSaidaLoteDiagnostico() {
    const ids = Array.from(document.querySelectorAll('.diag-check:checked')).map(chk => chk.dataset.id);
    if (ids.length === 0) return;
    const motivo = document.getElementById('diagMotivoLote')?.value?.trim() || 'Correção de registro — saída não computada no sistema';
    if (!confirm(`Registrar saída de ${ids.length} registro(s) agora, com motivo:\n"${motivo}"?\n\nEsta ação atualiza o banco de dados e não pode ser desfeita automaticamente.`)) return;

    const btn = document.getElementById('btnDarSaidaLote');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Registrando...'; }

    const atualizacoes = {};
    ids.forEach(id => {
        const atual = acompanhantes[id];
        if (!atual) return;
        const obs = atual.observacao ? `${atual.observacao} | Saída: ${motivo}` : `Saída: ${motivo}`;
        atualizacoes[id] = { ...atual, status: 'saiu', dataSaida: dataHoje(), horaSaida: horaAgora(), recepcionistaSaida: usuarioLogado?.nome || 'Sistema', observacao: obs };
    });

    const promessas = Object.keys(atualizacoes).map(id => db.ref('acompanhantes/' + id).update(atualizacoes[id]));
    Promise.all(promessas).then(() => {
        toast(`Saída registrada para ${ids.length} registro(s).`);
        registrarLog('saida', `Diagnóstico de dados: correção em lote de ${ids.length} registro(s) esquecido(s). Motivo: ${motivo}.`);
        rodarDiagnostico();
    }).catch(err => {
        console.error(err);
        toast('Erro ao registrar saída em lote.', 'error');
    }).finally(() => {
        if (btn) btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Registrar Saída dos Selecionados';
    });
}

function darSaidaSingleDiagnostico(id) {
    const atual = acompanhantes[id];
    if (!atual) { toast('Registro não encontrado.', 'error'); return; }
    const motivo = document.getElementById('diagMotivoLote')?.value?.trim() || 'Correção de registro — saída não computada no sistema';
    if (!confirm(`Registrar saída de "${atual.nomeAcompanhante}" agora, com motivo:\n"${motivo}"?`)) return;
    const obs = atual.observacao ? `${atual.observacao} | Saída: ${motivo}` : `Saída: ${motivo}`;
    db.ref('acompanhantes/' + id).update({ status: 'saiu', dataSaida: dataHoje(), horaSaida: horaAgora(), recepcionistaSaida: usuarioLogado?.nome || 'Sistema', observacao: obs })
    .then(() => {
        toast(`Saída de "${atual.nomeAcompanhante}" registrada com sucesso!`);
        registrarLog('saida', `Diagnóstico de dados: correção individual - "${atual.nomeAcompanhante}". Motivo: ${motivo}.`, id);
        rodarDiagnostico();
    }).catch(err => {
        console.error(err);
        toast('Erro ao registrar saída.', 'error');
    });
}

