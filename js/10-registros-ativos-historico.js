// ============================================
// 10-registros-ativos-historico.js
// Listagem de acompanhantes/visitas ativas e histórico completo, com filtros.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// DEMAIS FUNÇÕES MANTIDAS (ATIVOS, HISTÓRICO, ETC.)
// ============================================

function atualizarUltimosRegistros() {
    const todos = Object.values(acompanhantes);
    todos.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-').map(Number);
        const [db, mb, ab] = b.dataEntrada.split('-').map(Number);
        const dateA = new Date(aa, ma - 1, da, ...a.horaEntrada.split(':').map(Number));
        const dateB = new Date(ab, mb - 1, db, ...b.horaEntrada.split(':').map(Number));
        return dateB - dateA;
    });
    const ultimos = todos.slice(0, 15);
    const tbody = document.querySelector('#tabelaUltimosRegistros tbody');
    if (!tbody) return;
    if (ultimos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum registro recente</td></tr>';
        return;
    }
    tbody.innerHTML = ultimos.map(ac => {
        const tipoBadge = ac.tipo === 'visita' ? 'badge-visita' : 'badge-info';
        const tipoTexto = ac.tipo === 'visita' ? 'Visita' : 'Acomp.';
        let statusBadge = 'badge-success';
        if (ac.status === 'saiu') statusBadge = 'badge-danger';
        else if (ac.status === 'trocado') statusBadge = 'badge-warning';
        return `<tr>
            <td><span class="badge ${tipoBadge}">${tipoTexto}</span></td>
            <td>${sanitizar(ac.nomeAcompanhante)}</td>
            <td>${sanitizar(ac.nomePaciente)}</td>
            <td>${sanitizar(ac.setor)}${ac.leito ? ' / Leito ' + sanitizar(ac.leito) : ''}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td><span class="badge ${statusBadge}">${ac.status}</span></td>
        </tr>`;
    }).join('');
}

// Quantos dias já se passaram desde uma data "DD-MM-AAAA" (0 = hoje).
function diasDesde(dataStr) {
    if (!dataStr) return 0;
    const [d, m, a] = dataStr.split('-').map(Number);
    const data = new Date(a, m - 1, d); data.setHours(0, 0, 0, 0);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((hoje - data) / 86400000));
}

function atualizarAtivos() {
    const ativos = Object.values(acompanhantes).filter(a => a.status === 'presente');
    const tbody = document.querySelector('#tabelaAtivos tbody');
    if (!tbody) return;
    if (ativos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum acompanhante ou visitante ativo no momento</td></tr>';
        atualizarAlertaPresenca();
        atualizarAlertaDuplicidade();
        return;
    }
    // Pacientes com mais de um acompanhante ativo, para destacar na tabela
    const pacientesDuplicados = new Set(detectarAcompanhantesDuplicados().map(g => g[0].nomePaciente.trim().toLowerCase()));
    ativos.sort((a, b) => (b.dataEntrada + b.horaEntrada).localeCompare(a.dataEntrada + a.horaEntrada));
    tbody.innerHTML = ativos.map(ac => {
        let situacao = '-';
        if (ac.tipo === 'visita' && ac.duracaoVisita) {
            const [h, m, s] = ac.horaEntrada.split(':');
            const entrada = new Date();
            const [d, mm, aa] = ac.dataEntrada.split('-');
            entrada.setFullYear(parseInt(aa), parseInt(mm) - 1, parseInt(d));
            entrada.setHours(parseInt(h), parseInt(m), parseInt(s), 0);
            const minutosPassados = Math.floor((Date.now() - entrada.getTime()) / 60000);
            const restante = ac.duracaoVisita - minutosPassados;
            if (restante > 60) situacao = `${Math.floor(restante / 60)}h ${restante % 60}min`;
            else if (restante > 0) situacao = `${restante} min`;
            else situacao = '<span style="color:#e5484d;font-weight:600;">Expirado</span>';
        } else if (ac.tipo === 'acompanhante') {
            // Confirmação de presença: sinaliza quem está há dias sem
            // confirmação, para a recepção verificar se realmente ainda
            // está no hospital (dado usado pela nutrição para as refeições).
            const dias = diasDesde(ac.ultimaConfirmacao || ac.dataEntrada);
            if (dias >= CONFIG.DIAS_ALERTA_PRESENCA) {
                situacao = `<button class="btn-alerta-presenca" onclick="confirmarPresenca('${ac.id}')" title="Confirmar que ainda está presente no hospital"><i class="fas fa-exclamation-triangle"></i> Confirmar (${dias}d)</button>`;
            } else {
                situacao = `<span style="color:var(--text-muted);font-size:12px;white-space:nowrap;"><i class="fas fa-check-circle" style="color:#16a34a"></i> OK (${dias === 0 ? 'hoje' : dias + 'd'})</span>`;
            }
        }
        const tipoBadge = ac.tipo === 'visita' ? 'badge-visita' : 'badge-info';
        const tipoTexto = ac.tipo === 'visita' ? 'Visita' : 'Acomp.';
        const duplicado = ac.tipo === 'acompanhante' && pacientesDuplicados.has(ac.nomePaciente.trim().toLowerCase());
        return `<tr${duplicado ? ' style="background:var(--stat-saidas-acomp-bg);"' : ''}>
            <td><span class="badge ${tipoBadge}">${tipoTexto}</span></td>
            <td><a href="javascript:void(0)" onclick="verHistoricoAcompanhante('${ac.id}')" style="color:var(--text);font-weight:600;text-decoration:none;" title="Ver todo o histórico deste acompanhante/visitante">${sanitizar(ac.nomeAcompanhante)}</a></td>
            <td>${sanitizar(ac.documento) || '-'}</td>
            <td>${sanitizar(ac.parentesco)}</td>
            <td><a href="javascript:void(0)" onclick="verDetalhesPaciente('${ac.id}')" style="color:var(--primary);font-weight:600;text-decoration:none;" title="Ver histórico completo deste paciente">${sanitizar(ac.nomePaciente)}</a>${duplicado ? ' <span class="badge badge-danger" title="Este paciente tem mais de um acompanhante ativo">Duplicado</span>' : ''}</td>
            <td>${sanitizar(ac.setor)}</td>
            <td>${sanitizar(ac.leito) || '-'}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td>${situacao}</td>
            <td>
                <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="abrirCracha('${ac.id}')" style="color:#1b4f9c" title="Crachá"><i class="fas fa-id-card"></i></button>
                <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
    atualizarAlertaPresenca();
    atualizarAlertaDuplicidade();
}

// Confirma que um acompanhante específico ainda está presente hoje.
function confirmarPresenca(id) {
    const ac = acompanhantes[id];
    if (!ac) return;
    db.ref('acompanhantes/' + id).update({ ultimaConfirmacao: dataHoje() }).then(() => {
        toast(`Presença de "${ac.nomeAcompanhante}" confirmada.`);
        registrarLog('editar', `Presença confirmada: "${ac.nomeAcompanhante}".`, id);
    }).catch(err => { console.error(err); toast('Erro ao confirmar presença.', 'error'); });
}

// Confirma de uma vez todos os acompanhantes presentes (útil no início do
// plantão/dia, evitando ter que clicar um por um quando está tudo certo).
function confirmarTodasPresencas() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente' && a.tipo === 'acompanhante');
    if (presentes.length === 0) { toast('Nenhum acompanhante presente para confirmar.', 'error'); return; }
    if (!confirm(`Confirmar presença de ${presentes.length} acompanhante(s) hoje?`)) return;
    const updates = {};
    presentes.forEach(ac => { updates['acompanhantes/' + ac.id + '/ultimaConfirmacao'] = dataHoje(); });
    db.ref().update(updates).then(() => {
        toast('Presença confirmada para todos os acompanhantes.');
        registrarLog('editar', `Confirmação em lote de presença para ${presentes.length} acompanhante(s).`);
    }).catch(err => { console.error(err); toast('Erro ao confirmar presenças.', 'error'); });
}

// Mostra/esconde o banner de alerta no Painel Gerencial quando há
// acompanhantes pendentes de confirmação de presença.
function atualizarAlertaPresenca() {
    const banner = document.getElementById('alertaPresencaPendente');
    const pendentes = Object.values(acompanhantes).filter(ac =>
        ac.status === 'presente' && ac.tipo === 'acompanhante' &&
        diasDesde(ac.ultimaConfirmacao || ac.dataEntrada) >= CONFIG.DIAS_ALERTA_PRESENCA
    );
    if (banner) {
        if (pendentes.length === 0) { banner.style.display = 'none'; }
        else {
            const texto = pendentes.length === 1
                ? `1 acompanhante está há ${CONFIG.DIAS_ALERTA_PRESENCA}+ dias sem confirmação de presença — pode ter saído sem que a saída fosse registrada. Isso afeta a contagem de refeições da nutrição.`
                : `${pendentes.length} acompanhantes estão há ${CONFIG.DIAS_ALERTA_PRESENCA}+ dias sem confirmação de presença — podem ter saído sem que a saída fosse registrada. Isso afeta a contagem de refeições da nutrição.`;
            document.getElementById('alertaPresencaTexto').textContent = texto;
            banner.style.display = 'flex';
        }
    }
    atualizarBadgeSidebar();
}

// Encontra pacientes com mais de um acompanhante ativo ao mesmo tempo —
// duplicidade que o bloqueio (verificarLimiteAcompanhante) agora evita
// para registros novos, mas que pode ter ficado de antes dele existir.
function detectarAcompanhantesDuplicados() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente' && a.tipo === 'acompanhante');
    const grupos = {};
    presentes.forEach(ac => {
        const chave = ac.nomePaciente.trim().toLowerCase();
        (grupos[chave] = grupos[chave] || []).push(ac);
    });
    return Object.values(grupos).filter(g => g.length > 1);
}

function atualizarAlertaDuplicidade() {
    const banner = document.getElementById('alertaDuplicidade');
    const duplicados = detectarAcompanhantesDuplicados();
    if (banner) {
        if (duplicados.length === 0) { banner.style.display = 'none'; }
        else {
            const totalExtras = duplicados.reduce((soma, g) => soma + (g.length - 1), 0);
            const texto = duplicados.length === 1
                ? `1 paciente está com mais de um acompanhante ativo ao mesmo tempo (${totalExtras} registro extra) — provavelmente uma saída que não foi dada baixa antes de um novo acompanhante entrar.`
                : `${duplicados.length} pacientes estão com mais de um acompanhante ativo ao mesmo tempo (${totalExtras} registros extras no total) — provavelmente saídas que não foram dadas baixa antes de um novo acompanhante entrar.`;
            document.getElementById('alertaDuplicidadeTexto').textContent = texto;
            banner.style.display = 'flex';
        }
    }
    atualizarBadgeSidebar();
}

// MELHORIA: selo numérico no item "Painel" do menu lateral, somando
// acompanhantes pendentes de confirmação de presença + pacientes com
// acompanhante duplicado. Antes, esses dois alertas só apareciam depois
// de a pessoa abrir o Painel Gerencial — agora ficam visíveis a partir de
// qualquer tela do sistema, com o número exato de itens pendentes.
function atualizarBadgeSidebar() {
    const badge = document.getElementById('sidebarAlertBadge');
    if (!badge) return;
    const pendentesPresenca = Object.values(acompanhantes).filter(ac =>
        ac.status === 'presente' && ac.tipo === 'acompanhante' &&
        diasDesde(ac.ultimaConfirmacao || ac.dataEntrada) >= CONFIG.DIAS_ALERTA_PRESENCA
    ).length;
    const duplicados = detectarAcompanhantesDuplicados().length;
    const total = pendentesPresenca + duplicados;
    if (total > 0) {
        badge.textContent = total > 99 ? '99+' : String(total);
        badge.style.display = 'inline-flex';
        badge.title = `${total} pendência(s): confirmação de presença e/ou acompanhantes duplicados`;
    } else {
        badge.style.display = 'none';
    }
}

// Abre um modal listando cada paciente com acompanhantes duplicados,
// para a recepção decidir quem realmente está presente e dar baixa nos
// demais em um clique.
function resolverDuplicidades() {
    const duplicados = detectarAcompanhantesDuplicados();
    if (duplicados.length === 0) { toast('Nenhuma duplicidade encontrada no momento.'); return; }

    document.getElementById('modalTitle').textContent = 'Acompanhantes Duplicados';
    document.getElementById('modalBody').innerHTML = `
        <div style="padding: 0 20px;">
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
                Estes pacientes têm mais de um acompanhante marcado como presente. Confirme quem realmente está no hospital e clique em "Dar Saída" nos demais.
            </p>
            ${duplicados.map(grupo => `
                <div class="info-box" style="margin-bottom: 12px;">
                    <p style="margin-bottom:8px;"><strong>${sanitizar(grupo[0].nomePaciente)}</strong> — ${sanitizar(grupo[0].setor)} ${grupo[0].leito ? '• Leito ' + sanitizar(grupo[0].leito) : ''}</p>
                    ${grupo.map(ac => `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-top:1px solid var(--border-light);">
                            <span style="font-size:13px;">${sanitizar(ac.nomeAcompanhante)} <span style="color:var(--text-muted);">— desde ${ac.dataEntrada} ${ac.horaEntrada}</span></span>
                            <button class="btn-alerta-presenca danger" onclick="darSaidaDuplicidade('${ac.id}')"><i class="fas fa-sign-out-alt"></i> Dar Saída</button>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
            <div class="form-actions"><button class="btn btn-outline" onclick="fecharModal()">Fechar</button></div>
        </div>
    `;
    document.getElementById('genericModal').style.display = 'flex';
    document.getElementById('genericModal').classList.add('active');
}

// Dá saída rápida num acompanhante duplicado a partir do modal de resolução.
function darSaidaDuplicidade(id) {
    const ac = acompanhantes[id];
    if (!ac) return;
    db.ref('acompanhantes/' + id).update({
        status: 'saiu', dataSaida: dataHoje(), horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado?.nome || 'Sistema',
        observacao: (ac.observacao ? ac.observacao + ' | ' : '') + 'Saída: correção de acompanhante duplicado'
    }).then(() => {
        toast(`Saída de "${ac.nomeAcompanhante}" registrada.`);
        registrarLog('saida', `Saída (correção de duplicidade): "${ac.nomeAcompanhante}".`, id);
        // Reabre o modal já atualizado, ou fecha se não houver mais duplicidade
        const restam = detectarAcompanhantesDuplicados();
        if (restam.length > 0) resolverDuplicidades(); else fecharModal();
    }).catch(err => { console.error(err); toast('Erro ao registrar saída.', 'error'); });
}

function atualizarHistorico() {
    const registros = Object.values(acompanhantes);
    registros.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-').map(Number);
        const [db, mb, ab] = b.dataEntrada.split('-').map(Number);
        const dateA = new Date(aa, ma - 1, da, ...a.horaEntrada.split(':').map(Number));
        const dateB = new Date(ab, mb - 1, db, ...b.horaEntrada.split(':').map(Number));
        return dateB - dateA;
    });
    renderizarTabelaHistorico(registros);
}
function filtrarHistorico() {
    const inicio = document.getElementById('filtroDataInicio')?.value;
    const fim = document.getElementById('filtroDataFim')?.value;
    const status = document.getElementById('filtroStatus')?.value;
    const tipo = document.getElementById('filtroTipo')?.value;
    const texto = document.getElementById('filtroTexto')?.value?.trim().toLowerCase();
    let registros = Object.values(acompanhantes);
    if (status) registros = registros.filter(a => a.status === status);
    if (tipo) registros = registros.filter(a => a.tipo === tipo);
    if (inicio) registros = registros.filter(a => { const [d, m, y] = a.dataEntrada.split('-'); return new Date(y, m - 1, d) >= new Date(inicio + 'T00:00:00'); });
    if (fim) registros = registros.filter(a => { const [d, m, y] = a.dataEntrada.split('-'); return new Date(y, m - 1, d) <= new Date(fim + 'T23:59:59'); });
    if (texto) registros = registros.filter(a => { const campos = ['nomeAcompanhante', 'documento', 'nomePaciente', 'setor', 'leito', 'parentesco', 'observacao']; return campos.some(campo => a[campo] && a[campo].toLowerCase().includes(texto)); });
    registros.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-').map(Number);
        const [db, mb, ab] = b.dataEntrada.split('-').map(Number);
        const dateA = new Date(aa, ma - 1, da, ...a.horaEntrada.split(':').map(Number));
        const dateB = new Date(ab, mb - 1, db, ...b.horaEntrada.split(':').map(Number));
        return dateB - dateA;
    });
    renderizarTabelaHistorico(registros);
    toast(`${registros.length} registro(s) encontrado(s).`);
}
function renderizarTabelaHistorico(registros) {
    const tbody = document.querySelector('#tabelaHistorico tbody');
    if (!tbody) return;
    if (registros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum registro encontrado</td></tr>';
        return;
    }
    tbody.innerHTML = registros.map(ac => {
        const tipoBadge = ac.tipo === 'visita' ? 'badge-visita' : 'badge-info';
        const tipoTexto = ac.tipo === 'visita' ? 'Visita' : 'Acomp.';
        let statusBadge = 'badge-info';
        if (ac.status === 'presente') statusBadge = 'badge-success';
        else if (ac.status === 'saiu') statusBadge = 'badge-danger';
        else if (ac.status === 'trocado') statusBadge = 'badge-warning';
        return `<tr>
            <td><span class="badge ${tipoBadge}">${tipoTexto}</span></td>
            <td><a href="javascript:void(0)" onclick="verHistoricoAcompanhante('${ac.id}')" style="color:var(--text);font-weight:600;text-decoration:none;" title="Ver todo o histórico deste acompanhante/visitante">${sanitizar(ac.nomeAcompanhante)}</a></td>
            <td>${sanitizar(ac.documento) || '-'}</td>
            <td>${sanitizar(ac.parentesco)}</td>
            <td><a href="javascript:void(0)" onclick="verDetalhesPaciente('${ac.id}')" style="color:var(--primary);font-weight:600;text-decoration:none;" title="Ver histórico completo deste paciente">${sanitizar(ac.nomePaciente)}</a></td>
            <td>${sanitizar(ac.setor)}</td>
            <td>${sanitizar(ac.leito) || '-'}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td>${ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-'}</td>
            <td><span class="badge ${statusBadge}">${ac.status}</span></td>
            <td>
                <button class="btn-icon" onclick="verHistoricoAcompanhante('${ac.id}')" style="color:var(--text-muted)" title="Histórico do acompanhante"><i class="fas fa-user-clock"></i></button>
                <button class="btn-icon" onclick="verDetalhesPaciente('${ac.id}')" style="color:#1b4f9c" title="Histórico do paciente"><i class="fas fa-history"></i></button>
                <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// Mostra, num modal, todo o histórico de um paciente: todos os
// acompanhantes/visitantes que já passaram por ele, entradas, saídas e
// trocas registradas — a partir do ID de qualquer registro dele.
function verDetalhesPaciente(idRegistro) {
    const registro = acompanhantes[idRegistro];
    if (!registro) { toast('Registro não encontrado.', 'error'); return; }
    const nomePaciente = registro.nomePaciente;

    const registrosPaciente = Object.values(acompanhantes)
        .filter(ac => ac.nomePaciente && ac.nomePaciente.trim().toLowerCase() === nomePaciente.trim().toLowerCase());

    // Monta uma linha do tempo única: entradas/saídas de cada registro +
    // as trocas registradas dentro de cada um (campo "trocas").
    const eventos = [];
    registrosPaciente.forEach(ac => {
        eventos.push({
            dataHora: `${ac.dataEntrada} ${ac.horaEntrada}`,
            tipo: ac.tipo === 'visita' ? 'Visita' : 'Acompanhante',
            evento: 'Entrada',
            pessoa: ac.nomeAcompanhante,
            detalhe: `${sanitizar(ac.setor)}${ac.leito ? ' • Leito ' + sanitizar(ac.leito) : ''} • Recepção: ${sanitizar(ac.recepcionistaEntrada) || '-'}`
        });
        if (ac.dataSaida) {
            eventos.push({
                dataHora: `${ac.dataSaida} ${ac.horaSaida}`,
                tipo: ac.tipo === 'visita' ? 'Visita' : 'Acompanhante',
                evento: ac.status === 'trocado' ? 'Troca' : 'Saída',
                pessoa: ac.nomeAcompanhante,
                detalhe: sanitizar(ac.observacao) || '-'
            });
        }
        (ac.trocas || []).forEach(t => {
            eventos.push({
                dataHora: t.dataHora,
                tipo: 'Troca',
                evento: 'Troca de Acompanhante',
                pessoa: `${sanitizar(t.acompanhanteAntigo)} → ${sanitizar(t.acompanhanteNovo)}`,
                detalhe: `Recepção: ${sanitizar(t.recepcionista) || '-'}`
            });
        });
    });

    eventos.sort((a, b) => dataHoraLog({ dataHora: b.dataHora }) - dataHoraLog({ dataHora: a.dataHora }));

    const totalAcompanhantes = registrosPaciente.filter(ac => ac.tipo === 'acompanhante').length;
    const totalVisitas = registrosPaciente.filter(ac => ac.tipo === 'visita').length;
    const totalTrocas = registrosPaciente.reduce((soma, ac) => soma + (ac.trocas?.length || 0), 0);
    const atual = registrosPaciente.find(ac => ac.status === 'presente' && ac.tipo === 'acompanhante');

    const badgeEvento = { 'Entrada': 'badge-success', 'Saída': 'badge-danger', 'Troca': 'badge-warning' };

    document.getElementById('modalTitle').textContent = `Histórico de ${sanitizar(nomePaciente)}`;
    document.getElementById('modalBody').innerHTML = `
        <div style="padding: 0 20px;">
            <div class="info-box" style="margin-bottom: 16px;">
                <p><strong>Situação atual:</strong> ${atual ? `Acompanhado(a) por ${sanitizar(atual.nomeAcompanhante)} desde ${atual.dataEntrada}` : 'Sem acompanhante presente no momento'}</p>
                <p><strong>Total de acompanhantes diferentes:</strong> ${totalAcompanhantes} &nbsp;|&nbsp; <strong>Visitas:</strong> ${totalVisitas} &nbsp;|&nbsp; <strong>Trocas:</strong> ${totalTrocas}</p>
            </div>
            <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                <table>
                    <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Evento</th><th>Quem</th><th>Detalhe</th></tr></thead>
                    <tbody>
                        ${eventos.map(e => `<tr>
                            <td style="white-space:nowrap;">${e.dataHora}</td>
                            <td>${e.tipo}</td>
                            <td><span class="badge ${badgeEvento[e.evento] || 'badge-info'}">${e.evento}</span></td>
                            <td>${e.pessoa}</td>
                            <td>${e.detalhe}</td>
                        </tr>`).join('') || '<tr><td colspan="5" class="empty-table-message">Nenhum evento encontrado</td></tr>'}
                    </tbody>
                </table>
            </div>
            <div class="form-actions" style="padding: 16px 0 0;"><button class="btn btn-outline" onclick="fecharModal()">Fechar</button></div>
        </div>
    `;
    document.getElementById('genericModal').style.display = 'flex';
    document.getElementById('genericModal').classList.add('active');
}

// Mostra, num modal, todo o histórico de uma PESSOA (acompanhante ou
// visitante) — todos os pacientes que ela já acompanhou/visitou, com
// datas de entrada e saída. Complementa verDetalhesPaciente, que mostra
// o histórico por PACIENTE; este mostra por PESSOA.
function verHistoricoAcompanhante(idRegistro) {
    const registro = acompanhantes[idRegistro];
    if (!registro) { toast('Registro não encontrado.', 'error'); return; }

    // Identifica a pessoa pelo documento quando disponível (mais confiável
    // — evita confundir duas pessoas com o mesmo nome); sem documento,
    // usa o nome mesmo.
    const doc = (registro.documento || '').trim().toLowerCase();
    const nome = registro.nomeAcompanhante.trim().toLowerCase();
    const registrosPessoa = Object.values(acompanhantes).filter(ac => {
        const acDoc = (ac.documento || '').trim().toLowerCase();
        const acNome = ac.nomeAcompanhante.trim().toLowerCase();
        return doc ? (acDoc === doc || (!acDoc && acNome === nome)) : acNome === nome;
    });

    registrosPessoa.sort((a, b) => dataHoraLog({ dataHora: `${b.dataEntrada} ${b.horaEntrada}` }) - dataHoraLog({ dataHora: `${a.dataEntrada} ${a.horaEntrada}` }));

    const pacientesUnicos = new Set(registrosPessoa.map(ac => ac.nomePaciente.trim().toLowerCase())).size;
    const totalAcompanhamentos = registrosPessoa.filter(ac => ac.tipo === 'acompanhante').length;
    const totalVisitas = registrosPessoa.filter(ac => ac.tipo === 'visita').length;
    const presenteAgora = registrosPessoa.find(ac => ac.status === 'presente');

    const badgeStatus = { presente: 'badge-success', saiu: 'badge-danger', trocado: 'badge-warning' };

    document.getElementById('modalTitle').textContent = `Histórico de ${sanitizar(registro.nomeAcompanhante)}`;
    document.getElementById('modalBody').innerHTML = `
        <div style="padding: 0 20px;">
            <div class="info-box" style="margin-bottom: 16px;">
                <p><strong>Situação atual:</strong> ${presenteAgora ? `Presente agora, acompanhando/visitando "${sanitizar(presenteAgora.nomePaciente)}"` : 'Não está presente no momento'}</p>
                <p><strong>Pacientes diferentes:</strong> ${pacientesUnicos} &nbsp;|&nbsp; <strong>Vezes como acompanhante:</strong> ${totalAcompanhamentos} &nbsp;|&nbsp; <strong>Vezes como visitante:</strong> ${totalVisitas}</p>
            </div>
            <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                <table>
                    <thead><tr><th>Tipo</th><th>Paciente</th><th>Setor</th><th>Entrada</th><th>Saída</th><th>Status</th></tr></thead>
                    <tbody>
                        ${registrosPessoa.map(ac => `<tr>
                            <td><span class="badge ${ac.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                            <td><a href="javascript:void(0)" onclick="fecharModal(); verDetalhesPaciente('${ac.id}')" style="color:var(--primary);text-decoration:none;font-weight:600;">${sanitizar(ac.nomePaciente)}</a></td>
                            <td>${sanitizar(ac.setor)}${ac.leito ? ' / Leito ' + sanitizar(ac.leito) : ''}</td>
                            <td style="white-space:nowrap;">${ac.dataEntrada} ${ac.horaEntrada}</td>
                            <td style="white-space:nowrap;">${ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-'}</td>
                            <td><span class="badge ${badgeStatus[ac.status] || 'badge-info'}">${ac.status}</span></td>
                        </tr>`).join('') || '<tr><td colspan="6" class="empty-table-message">Nenhum registro encontrado</td></tr>'}
                    </tbody>
                </table>
            </div>
            <div class="form-actions" style="padding: 16px 0 0;"><button class="btn btn-outline" onclick="fecharModal()">Fechar</button></div>
        </div>
    `;
    document.getElementById('genericModal').style.display = 'flex';
    document.getElementById('genericModal').classList.add('active');
}

