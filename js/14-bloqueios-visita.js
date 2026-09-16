// ============================================
// 14-bloqueios-visita.js
// Bloqueios de visita por paciente.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// BLOQUEIOS DE VISITA
// ============================================
function carregarBloqueios() {
    const tbody = document.querySelector('#tabelaBloqueios tbody');
    if (!tbody) return;
    const lista = Object.values(bloqueios).filter(b => b.ativo === true);
    lista.sort((a, b) => b.dataBloqueio.localeCompare(a.dataBloqueio));
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum bloqueio ativo</td></tr>';
        return;
    }
    tbody.innerHTML = lista.map(b => `<tr>
        <td><strong>${sanitizar(b.paciente)}</strong> <span class="badge badge-danger">Bloqueado</span></td>
        <td>${sanitizar(b.setor)}</td><td>${sanitizar(b.leito) || '-'}</td><td>${sanitizar(b.motivo)}</td>
        <td>${sanitizar(b.solicitante)}</td><td>${b.dataBloqueio}</td>
        <td><button class="btn btn-danger btn-sm" onclick="removerBloqueio('${b.id}')"><i class="fas fa-unlock"></i> Remover</button></td>
    </tr>`).join('');
}
function abrirModalNovoBloqueio() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-ban"></i> Novo Bloqueio';
    document.getElementById('modalBody').innerHTML = `
        <form id="formNovoBloqueio"><div class="form-grid">
            <div class="form-group"><label>Paciente *</label><input type="text" id="bloqueioPaciente" required></div>
            <div class="form-group"><label>Setor</label><select id="bloqueioSetor"><option value="">Selecione...</option>${['Oncologia I','Oncologia II','UTI I','UTI II','Clínica Médica I','Clínica Médica II','Clínica Cirúrgica','Pediatria','Saúde Mental'].map(s => `<option>${s}</option>`).join('')}</select></div>
            <div class="form-group"><label>Leito</label><input type="text" id="bloqueioLeito"></div>
            <div class="form-group" style="grid-column:1/-1"><label>Motivo *</label><textarea id="bloqueioMotivo" rows="3" required></textarea></div>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-danger"><i class="fas fa-ban"></i> Bloquear</button></div></form>`;
    document.getElementById('genericModal').style.display = 'flex';
    document.getElementById('genericModal').classList.add('active');
    document.getElementById('formNovoBloqueio').addEventListener('submit', function (e) {
        e.preventDefault();
        const bloqueio = {
            id: gerarId(), paciente: sanitizar(document.getElementById('bloqueioPaciente').value.trim()),
            setor: document.getElementById('bloqueioSetor').value,
            leito: sanitizar(document.getElementById('bloqueioLeito').value.trim()),
            motivo: sanitizar(document.getElementById('bloqueioMotivo').value.trim()),
            solicitante: usuarioLogado.nome, dataBloqueio: `${dataHoje()} ${horaAgora()}`, ativo: true
        };
        if (!bloqueio.paciente || !bloqueio.motivo) { toast('Preencha os campos obrigatórios.', 'error'); return; }
        db.ref('bloqueios/' + bloqueio.id).set(bloqueio).then(() => { toast('Bloqueio registrado!'); fecharModal(); registrarLog('bloqueio', `Bloqueio: "${bloqueio.paciente}".`); })
        .catch(err => { console.error(err); toast('Erro ao registrar.', 'error'); });
    });
}
function removerBloqueio(id) {
    if (confirm('Remover este bloqueio?')) {
        db.ref('bloqueios/' + id).update({ ativo: false }).then(() => { toast('Bloqueio removido!'); registrarLog('bloqueio', 'Bloqueio removido.'); })
        .catch(err => { console.error(err); toast('Erro ao remover.', 'error'); });
    }
}

