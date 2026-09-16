// ============================================
// 11-formularios-registro.js
// Envio dos formulários de entrada de acompanhante, visita e troca.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// FORMULÁRIOS DE REGISTRO
// ============================================
function verificarAcompanhanteAtivo(nomePaciente) {
    return Object.values(acompanhantes).find(ac => ac.status === 'presente' && ac.tipo === 'acompanhante' && ac.nomePaciente.toLowerCase() === nomePaciente.toLowerCase());
}
// Regra fixa do sistema: um paciente só pode ter UM acompanhante ativo por
// vez. Não existe mais opção de desativar isso ou "continuar mesmo assim" —
// se for para substituir o acompanhante, o caminho é "Troca de Acompanhante".
function verificarLimiteAcompanhante(nomePaciente, callback) {
    if (!nomePaciente) { toast('Nome do paciente é obrigatório.', 'error'); callback(false); return; }
    const ativo = verificarAcompanhanteAtivo(nomePaciente);
    if (ativo) {
        mostrarBloqueioAcompanhanteDuplicado(nomePaciente, ativo);
        callback(false);
    } else callback(true);
}

// Setores onde só é permitida visita (não pode ter acompanhante fixo).
const SETORES_SOMENTE_VISITA = ['UTI I', 'UTI II'];
function verificarSetorPermiteAcompanhante(setor, callback) {
    if (SETORES_SOMENTE_VISITA.includes(setor)) {
        toast(`⚠️ ${setor} permite apenas visitas — acompanhante fixo não é permitido nesse setor.`, 'error');
        callback(false);
    } else callback(true);
}

// Modal explicando o bloqueio de acompanhante duplicado, com atalho direto
// para a troca (o fluxo correto quando um acompanhante está sendo
// substituído por outro).
function mostrarBloqueioAcompanhanteDuplicado(nomePaciente, ativo) {
    document.getElementById('modalTitle').textContent = 'Paciente já tem acompanhante';
    document.getElementById('modalBody').innerHTML = `
        <div style="padding: 0 20px;">
            <div class="info-box" style="border-left: 4px solid var(--stat-saidas-acomp); background: var(--stat-saidas-acomp-bg);">
                <p style="margin-bottom:8px;"><i class="fas fa-exclamation-triangle" style="color:var(--stat-saidas-acomp);"></i> <strong>${sanitizar(nomePaciente)}</strong> já possui um acompanhante presente:</p>
                <p><strong>Nome:</strong> ${sanitizar(ativo.nomeAcompanhante)}</p>
                <p><strong>Setor:</strong> ${sanitizar(ativo.setor)} ${ativo.leito ? '• Leito ' + sanitizar(ativo.leito) : ''}</p>
                <p><strong>Desde:</strong> ${ativo.dataEntrada} ${ativo.horaEntrada}</p>
            </div>
            <p style="margin: 14px 0; font-size: 13px; color: var(--text-muted);">
                O sistema só permite <strong>um acompanhante ativo por paciente</strong> — isso evita contar a mesma pessoa duas vezes nos relatórios (a nutrição usa esse número para as refeições). Se este acompanhante está sendo substituído por outro, use a Troca de Acompanhante.
            </p>
            <div class="form-actions">
                <button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
                <button class="btn btn-accent" onclick="fecharModal(); irParaTrocaAcompanhante('${ativo.id}')"><i class="fas fa-exchange-alt"></i> Ir para Troca de Acompanhante</button>
            </div>
        </div>
    `;
    document.getElementById('genericModal').style.display = 'flex';
    document.getElementById('genericModal').classList.add('active');
}

// Leva para a tela de Troca de Acompanhante já com o acompanhante atual
// selecionado, pronto para preencher os dados do novo.
function irParaTrocaAcompanhante(id) {
    navegarPara('registroTroca');
    setTimeout(() => selecionarAcompanhanteTroca(id), 250);
}
function verificarBloqueioVisita(nomePaciente, callback) {
    if (!nomePaciente) { toast('Nome do paciente é obrigatório.', 'error'); callback(false); return; }
    const bloqueio = Object.values(bloqueios).find(b => b.paciente.toLowerCase() === nomePaciente.toLowerCase() && b.ativo === true);
    if (bloqueio) { toast(`⚠️ Visitas BLOQUEADAS para "${nomePaciente}"\nMotivo: ${bloqueio.motivo}`, 'error'); callback(false); }
    else callback(true);
}
function registrarEntrada(e) {
    e.preventDefault();
    const nomePaciente = sanitizar(document.getElementById('acPaciente')?.value?.trim() || '');
    const setorSelecionado = document.getElementById('acSetor')?.value || '';
    verificarSetorPermiteAcompanhante(setorSelecionado, (setorOk) => {
        if (!setorOk) return;
        verificarLimiteAcompanhante(nomePaciente, (permitido) => {
        if (!permitido) return;
        const dados = {
            id: gerarId(), tipo: 'acompanhante',
            nomeAcompanhante: sanitizar(document.getElementById('acNome')?.value?.trim() || ''),
            documento: sanitizar(document.getElementById('acDocumento')?.value?.trim() || ''),
            telefone: sanitizar(document.getElementById('acTelefone')?.value?.trim() || ''),
            parentesco: document.getElementById('acParentesco')?.value || '',
            nomePaciente, setor: document.getElementById('acSetor')?.value || '',
            leito: sanitizar(document.getElementById('acLeito')?.value?.trim() || ''),
            dataEntrada: dataHoje(), horaEntrada: horaAgora(),
            dataSaida: null, horaSaida: null, status: 'presente',
            recepcionistaEntrada: usuarioLogado?.nome || 'Sistema', recepcionistaSaida: null, trocas: [],
            observacao: sanitizar(document.getElementById('acObservacao')?.value?.trim() || ''), duracaoVisita: null,
            ultimaConfirmacao: dataHoje()
        };
        db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
            toast('Entrada registrada com sucesso!');
            e.target.reset();
            registrarLog('criar', `Acompanhante "${dados.nomeAcompanhante}" - Paciente "${dados.nomePaciente}".`, dados.id);
        }).catch(err => { console.error(err); toast('Erro ao registrar.', 'error'); });
        });
    });
}
function registrarVisita(e) {
    e.preventDefault();
    const nomePaciente = sanitizar(document.getElementById('visPaciente')?.value?.trim() || '');
    verificarBloqueioVisita(nomePaciente, (permitido) => {
        if (!permitido) return;
        const duracao = 60; // Fixo: saída automática 1h após a entrada (ver encerrarVisitasExpiradas)
        const dados = {
            id: gerarId(), tipo: 'visita',
            nomeAcompanhante: sanitizar(document.getElementById('visNome')?.value?.trim() || ''),
            documento: sanitizar(document.getElementById('visDocumento')?.value?.trim() || ''),
            telefone: sanitizar(document.getElementById('visTelefone')?.value?.trim() || ''),
            parentesco: document.getElementById('visParentesco')?.value || '',
            nomePaciente, setor: document.getElementById('visSetor')?.value || '',
            leito: sanitizar(document.getElementById('visLeito')?.value?.trim() || ''),
            dataEntrada: dataHoje(), horaEntrada: horaAgora(),
            dataSaida: null, horaSaida: null, status: 'presente',
            recepcionistaEntrada: usuarioLogado?.nome || 'Sistema', recepcionistaSaida: null, trocas: [],
            duracaoVisita: duracao, observacao: 'Visita de 1 hora (saída automática)'
        };
        db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
            toast('Visita registrada! Saída automática em 1 hora.');
            e.target.reset();
            registrarLog('criar', `Visita de "${dados.nomeAcompanhante}" - Paciente "${dados.nomePaciente}".`, dados.id);
        }).catch(err => { console.error(err); toast('Erro ao registrar.', 'error'); });
    });
}
function registrarTroca(e) {
    e.preventDefault();
    const idAntigo = document.getElementById('trocaAcompanhanteAtual')?.value;
    const antigo = acompanhantes[idAntigo];
    if (!antigo) { toast('Busque e selecione o acompanhante atual.', 'error'); return; }
    const trocas = antigo.trocas || [];
    trocas.push({ dataHora: `${dataHoje()} ${horaAgora()}`, acompanhanteAntigo: antigo.nomeAcompanhante, acompanhanteNovo: sanitizar(document.getElementById('trocaNovoNome')?.value?.trim() || ''), recepcionista: usuarioLogado?.nome || 'Sistema' });
    db.ref('acompanhantes/' + idAntigo).update({ status: 'trocado', dataSaida: dataHoje(), horaSaida: horaAgora(), recepcionistaSaida: usuarioLogado?.nome || 'Sistema', trocas });
    const novoId = gerarId();
    const novoNome = sanitizar(document.getElementById('trocaNovoNome')?.value?.trim() || '');
    db.ref('acompanhantes/' + novoId).set({
        id: novoId, tipo: 'acompanhante', nomeAcompanhante: novoNome,
        documento: sanitizar(document.getElementById('trocaNovoDocumento')?.value?.trim() || ''),
        telefone: sanitizar(document.getElementById('trocaNovoTelefone')?.value?.trim() || ''),
        parentesco: document.getElementById('trocaNovoParentesco')?.value || '',
        nomePaciente: antigo.nomePaciente, setor: antigo.setor, leito: antigo.leito,
        dataEntrada: dataHoje(), horaEntrada: horaAgora(), dataSaida: null, horaSaida: null, status: 'presente',
        recepcionistaEntrada: usuarioLogado?.nome || 'Sistema', recepcionistaSaida: null, trocas: [],
        observacao: `Substituiu: ${antigo.nomeAcompanhante}`, duracaoVisita: null,
        ultimaConfirmacao: dataHoje()
    }).then(() => {
        toast('Troca registrada com sucesso!');
        limparSelecaoTroca(true);
        document.getElementById('trocaNovoNome').value = '';
        document.getElementById('trocaNovoDocumento').value = '';
        document.getElementById('trocaNovoTelefone').value = '';
        document.getElementById('trocaNovoParentesco').value = '';
        registrarLog('troca', `Troca: "${antigo.nomeAcompanhante}" → "${novoNome}".`, novoId);
    }).catch(err => { console.error(err); toast('Erro ao registrar troca.', 'error'); });
}
function registrarSaida(e) {
    e.preventDefault();
    const id = document.getElementById('saidaAcompanhante')?.value;
    const motivo = document.getElementById('saidaMotivo')?.value;
    if (!id || !motivo) { toast('Busque e selecione um acompanhante/visitante e o motivo.', 'error'); return; }
    const atual = acompanhantes[id];
    if (!atual) { toast('Registro não encontrado.', 'error'); return; }
    const obs = atual.observacao ? `${atual.observacao} | Saída: ${motivo}` : `Saída: ${motivo}`;
    if (btnSaidaRapida) { btnSaidaRapida.disabled = true; btnSaidaRapida.innerHTML = '<span class="spinner"></span> Registrando...'; }
    db.ref('acompanhantes/' + id).update({ status: 'saiu', dataSaida: dataHoje(), horaSaida: horaAgora(), recepcionistaSaida: usuarioLogado?.nome || 'Sistema', observacao: obs })
    .then(() => {
        toast(`Saída de "${atual.nomeAcompanhante}" registrada com sucesso!`);
        registrarLog('saida', `Saída: "${atual.nomeAcompanhante}" - Motivo: ${motivo}.`, id);
        limparSelecaoSaida(true);
    }).catch(err => {
        console.error(err);
        toast('Erro ao registrar saída.', 'error');
    }).finally(() => {
        if (btnSaidaRapida) btnSaidaRapida.innerHTML = '<i class="fas fa-sign-out-alt"></i> Registrar Saída';
    });
}

