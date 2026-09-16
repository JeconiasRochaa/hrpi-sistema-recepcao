// ============================================
// 21-logs-auditoria.js
// Tela de Logs de Auditoria.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// LOGS DE AUDITORIA
// ============================================
function carregarLogs() {
    if (!usuarioLogado || (usuarioLogado.cargo !== 'Administrador' && usuarioLogado.cargo !== 'Supervisor')) {
        return;
    }
    
    db.ref('logs').once('value').then(snap => {
        const logs = Object.values(snap.val() || {});
        // Ordena por data/hora real (não por comparação de texto — ver
        // dataHoraLog() para o motivo: comparar "31-07-2026" e "01-08-2026"
        // como texto simples colocava agosto "antes" de julho).
        logs.sort((a, b) => dataHoraLog(b) - dataHoraLog(a));
        renderizarTabelaLogs(logs);
    }).catch(err => {
        console.error('Erro ao carregar logs:', err);
    });
}

// Apaga o histórico de logs. Por padrão remove tudo; se um número de dias
// for informado, mantém os logs mais recentes que esse período.
function limparLogs() {
    if (!usuarioLogado || (usuarioLogado.cargo !== 'Administrador' && usuarioLogado.cargo !== 'Supervisor')) {
        toast('Apenas Administradores/Supervisores podem limpar os logs.', 'error');
        return;
    }
    const dias = prompt('Manter logs dos últimos quantos dias? Deixe em branco para apagar TODOS os logs.', '');
    if (dias === null) return; // cancelou

    const diasNum = dias.trim() === '' ? null : parseInt(dias, 10);
    if (dias.trim() !== '' && (isNaN(diasNum) || diasNum < 0)) {
        toast('Informe um número de dias válido.', 'error');
        return;
    }

    const mensagemConfirm = diasNum === null
        ? 'Isso vai apagar TODOS os logs de auditoria permanentemente. Esta ação não pode ser desfeita. Deseja continuar?'
        : `Isso vai apagar todos os logs com mais de ${diasNum} dia(s), permanentemente. Deseja continuar?`;
    if (!confirm(mensagemConfirm)) return;

    db.ref('logs').once('value').then(snap => {
        const logs = snap.val() || {};
        const entradas = Object.entries(logs);

        if (diasNum === null) {
            return db.ref('logs').remove().then(() => entradas.length);
        }

        const corte = new Date();
        corte.setDate(corte.getDate() - diasNum);
        const paraRemover = entradas.filter(([, log]) => dataHoraLog(log) < corte);
        const updates = {};
        paraRemover.forEach(([key]) => { updates[key] = null; });
        return db.ref('logs').update(updates).then(() => paraRemover.length);
    }).then((quantidade) => {
        toast(`${quantidade} log(s) removido(s) com sucesso.`);
        carregarLogs();
        // O próprio ato de limpar os logs também gera um log (autoexplicativo).
        registrarLog('config', `Logs de auditoria limpos (${diasNum === null ? 'todos' : 'mantidos últimos ' + diasNum + ' dias'}).`);
    }).catch(err => {
        console.error('Erro ao limpar logs:', err);
        toast('Erro ao limpar logs.', 'error');
    });
}

function filtrarLogs() {
    const inicio = document.getElementById('filtroLogDataInicio')?.value;
    const fim = document.getElementById('filtroLogDataFim')?.value;
    const usuario = document.getElementById('filtroLogUsuario')?.value;
    const acao = document.getElementById('filtroLogAcao')?.value;
    
    db.ref('logs').once('value').then(snap => {
        let logs = Object.values(snap.val() || {});
        
        if (inicio) {
            const dataInicio = new Date(inicio + 'T00:00:00');
            logs = logs.filter(log => dataHoraLog(log) >= dataInicio);
        }
        if (fim) {
            const dataFim = new Date(fim + 'T23:59:59');
            logs = logs.filter(log => dataHoraLog(log) <= dataFim);
        }
        if (usuario) logs = logs.filter(log => log.usuarioId === usuario);
        if (acao) logs = logs.filter(log => log.acao === acao);
        
        logs.sort((a, b) => dataHoraLog(b) - dataHoraLog(a));
        renderizarTabelaLogs(logs);
        toast(`${logs.length} log(s) encontrado(s).`);
    });
}

function renderizarTabelaLogs(logs) {
    const tbody = document.querySelector('#tabelaLogs tbody');
    if (!tbody) return;
    
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum log encontrado</td></tr>';
        return;
    }
    
    const coresAcao = {
        'login': '#2f6fed',
        'logout': '#8b96a5',
        'criar': '#16a34a',
        'editar': '#0fb5b0',
        'excluir': '#e5484d',
        'troca': '#f59e0b',
        'saida': '#c2410c',
        'usuario': '#7c5cfc',
        'config': '#2456c4',
        'bloqueio': '#be123c'
    };
    
    tbody.innerHTML = logs.map(log => {
        const cor = coresAcao[log.acao] || '#2f6fed';
        return `
            <tr>
                <td style="white-space:nowrap;">${log.dataHora}</td>
                <td>${sanitizar(log.usuario)}</td>
                <td>
                    <span style="background:${cor}15;color:${cor};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">
                        ${log.acao.toUpperCase()}
                    </span>
                </td>
                <td>${sanitizar(log.descricao)}</td>
                <td style="font-size:11px;color:var(--text-muted);font-family:monospace;">
                    ${log.registroId ? log.registroId.substring(0, 14) + '...' : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

function carregarUsuariosFiltroLogs() {
    db.ref('usuarios').once('value').then(snap => {
        const sel = document.getElementById('filtroLogUsuario');
        if (!sel) return;
        
        const usuarios = snap.val() || {};
        const valorAtual = sel.value;
        
        sel.innerHTML = '<option value="">Todos os Usuários</option>' +
            Object.entries(usuarios)
                .sort(([, a], [, b]) => a.nome.localeCompare(b.nome))
                .map(([key, u]) => `<option value="${key}">${sanitizar(u.nome)}</option>`)
                .join('');
        
        if (valorAtual) sel.value = valorAtual;
    });
}

