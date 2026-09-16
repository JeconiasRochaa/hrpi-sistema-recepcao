// ============================================
// 13-selects-editar-excluir.js
// Atualização de <select> das telas de Saída/Troca, e edição/exclusão de registros.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// ATUALIZAR SELECTS (Saída e Troca)
// ============================================
function atualizarSelects() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente');
    // Se o acompanhante selecionado na tela de Troca não estiver mais
    // presente (ex.: outra recepcionista já deu baixa nele), limpa a seleção.
    const idSelecionadoTroca = document.getElementById('trocaAcompanhanteAtual')?.value;
    if (idSelecionadoTroca && !presentes.some(a => a.id === idSelecionadoTroca)) {
        limparSelecaoTroca(true);
    }
    // Se o acompanhante/visitante selecionado na tela de Saída não estiver
    // mais presente (ex.: outra recepcionista já registrou a saída dele),
    // limpa a seleção para evitar registrar saída duplicada.
    const idSelecionadoSaida = document.getElementById('saidaAcompanhante')?.value;
    if (idSelecionadoSaida && !presentes.some(a => a.id === idSelecionadoSaida)) {
        limparSelecaoSaida(true);
    }
}

// ============================================
// EDITAR / EXCLUIR REGISTROS
// ============================================
function editarRegistro(id) {
    const ac = acompanhantes[id];
    if (!ac) { toast('Registro não encontrado.', 'error'); return; }
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Registro';
    document.getElementById('modalBody').innerHTML = `
        <form id="formEditar"><div class="form-grid">
            <div class="form-group"><label>Nome *</label><input type="text" id="editNome" value="${sanitizar(ac.nomeAcompanhante)}" required></div>
            <div class="form-group"><label>Documento</label><input type="text" id="editDoc" value="${sanitizar(ac.documento || '')}"></div>
            <div class="form-group"><label>Telefone</label><input type="text" id="editTel" value="${sanitizar(ac.telefone || '')}"></div>
            <div class="form-group"><label>Parentesco</label><select id="editParentesco">${['Filho(a)','Pai/Mãe','Cônjuge','Irmão/Irmã','Neto(a)','Sobrinho(a)','Amigo(a)','Cuidador(a)','Outro'].map(p => `<option>${p}</option>`).join('')}</select></div>
            <div class="form-group"><label>Paciente</label><input type="text" id="editPaciente" value="${sanitizar(ac.nomePaciente)}"></div>
            <div class="form-group"><label>Setor</label><select id="editSetor">${['Oncologia I','Oncologia II','UTI I','UTI II','Clínica Médica I','Clínica Médica II','Clínica Cirúrgica','Pediatria','Saúde Mental'].map(s => `<option>${s}</option>`).join('')}</select></div>
            <div class="form-group"><label>Leito</label><input type="text" id="editLeito" value="${sanitizar(ac.leito || '')}"></div>
            <div class="form-group"><label>Observação</label><input type="text" id="editObs" value="${sanitizar(ac.observacao || '')}"></div>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button></div></form>`;
    document.getElementById('genericModal').style.display = 'flex';
    document.getElementById('genericModal').classList.add('active');
    setTimeout(() => {
        document.getElementById('editSetor').value = ac.setor;
        document.getElementById('editParentesco').value = ac.parentesco;
        document.getElementById('formEditar').addEventListener('submit', function (e) {
            e.preventDefault();
            db.ref('acompanhantes/' + id).update({
                nomeAcompanhante: sanitizar(document.getElementById('editNome').value.trim()),
                documento: sanitizar(document.getElementById('editDoc').value.trim()),
                telefone: sanitizar(document.getElementById('editTel').value.trim()),
                parentesco: document.getElementById('editParentesco').value,
                nomePaciente: sanitizar(document.getElementById('editPaciente').value.trim()),
                setor: document.getElementById('editSetor').value,
                leito: sanitizar(document.getElementById('editLeito').value.trim()),
                observacao: sanitizar(document.getElementById('editObs').value.trim())
            }).then(() => { toast('Atualizado!'); fecharModal(); registrarLog('editar', `Registro "${ac.nomeAcompanhante}" editado.`, id); })
            .catch(err => { console.error(err); toast('Erro ao atualizar.', 'error'); });
        });
    }, 100);
}
function excluirRegistro(id) {
    const nome = acompanhantes[id]?.nomeAcompanhante || 'desconhecido';
    if (confirm(`Excluir permanentemente "${nome}"?`)) {
        db.ref('acompanhantes/' + id).remove().then(() => { toast('Excluído!'); registrarLog('excluir', `Registro "${nome}" excluído.`, id); })
        .catch(err => { console.error(err); toast('Erro ao excluir.', 'error'); });
    }
}

