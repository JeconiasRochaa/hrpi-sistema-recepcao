// ============================================
// 15-usuarios.js
// Gerenciamento de usuários do sistema (cargos, permissões, reset de senha).
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// GERENCIAMENTO DE USUÁRIOS
// ============================================
function carregarSelectUsuarios() {
    db.ref('usuarios').on('value', snap => {
        const sel = document.getElementById('selectUsuarioReset');
        if (!sel) return;
        const usuarios = snap.val() || {};
        sel.innerHTML = '<option value="">Selecione um usuário...</option>' + Object.entries(usuarios).sort(([, a], [, b]) => a.nome.localeCompare(b.nome)).map(([key, u]) => `<option value="${key}">${sanitizar(u.nome)} (${sanitizar(u.usuario)})</option>`).join('');
    });
}
function carregarUsuarios() {
    if (!usuarioLogado || (usuarioLogado.cargo !== 'Administrador' && usuarioLogado.cargo !== 'Supervisor')) return;
    db.ref('usuarios').once('value').then(snap => {
        const usuarios = snap.val() || {};
        const tbody = document.querySelector('#tabelaUsuarios tbody');
        if (!tbody) return;
        if (Object.keys(usuarios).length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="empty-table-message">Nenhum usuário</td></tr>'; return; }
        tbody.innerHTML = Object.entries(usuarios).sort(([, a], [, b]) => a.nome.localeCompare(b.nome)).map(([key, u]) => `<tr>
            <td>${sanitizar(u.nome)}</td><td>${sanitizar(u.usuario)}</td><td>${sanitizar(u.cargo)}</td>
            <td><span class="badge ${u.ativo !== false ? 'badge-success' : 'badge-danger'}">${u.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
            <td><span class="badge ${u.primeiroAcesso ? 'badge-warning' : 'badge-info'}">${u.primeiroAcesso ? 'Pendente' : 'OK'}</span></td>
            <td>
                <button class="btn-icon btn-edit" onclick="editarUsuario('${key}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon btn-key" onclick="resetSenhaUser('${key}')"><i class="fas fa-key"></i></button>
                <button class="btn-icon btn-delete" onclick="excluirUsuario('${key}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
    });
}
function abrirModalNovoUsuario() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Novo Usuário';
    document.getElementById('modalBody').innerHTML = `
        <form id="formNovoUsuario">
            <div class="form-grid">
                <div class="form-group">
                    <label>Nome Completo <span class="required">*</span></label>
                    <input type="text" id="newUserNome" required>
                </div>
                <div class="form-group">
                    <label>Nome de Usuário <span class="required">*</span></label>
                    <input type="text" id="newUserUsername" required>
                </div>
                <div class="form-group">
                    <label>Cargo <span class="required">*</span></label>
                    <select id="newUserCargo" required>
                        <option value="">Selecione...</option>
                        <option>Administrador</option>
                        <option>Supervisor</option>
                        <option>Recepcionista</option>
                        <option>Serviço Social</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="newUserAtivo">
                        <option value="true">Ativo</option>
                        <option value="false">Inativo</option>
                    </select>
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Criar Usuário</button>
            </div>
        </form>
    `;
    
    document.getElementById('genericModal').style.display = 'flex';
    document.getElementById('genericModal').classList.add('active');
    
    document.getElementById('formNovoUsuario').addEventListener('submit', async function(e) {
        e.preventDefault();

        const nome = sanitizar(document.getElementById('newUserNome').value.trim());
        const usuario = sanitizar(document.getElementById('newUserUsername').value.trim().toLowerCase());
        const cargo = document.getElementById('newUserCargo').value;
        const ativo = document.getElementById('newUserAtivo').value === 'true';

        if (!nome || !usuario || !cargo) {
            toast('Preencha todos os campos obrigatórios.', 'error');
            return;
        }
        if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
            toast('Usuário deve ter 3-30 caracteres (letras, números, ".", "_" ou "-").', 'error');
            return;
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner"></span> Criando...'; }
        try {
            const existente = await db.ref('usuarios').orderByChild('usuario').equalTo(usuario).once('value');
            if (existente.exists()) {
                toast('Já existe um usuário com este nome de usuário.', 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-save"></i> Criar Usuário'; }
                return;
            }
            const novoId = 'user_' + Date.now();
            const { salt, senhaHash } = await criarCredenciais('123456');
            const userData = { id: novoId, nome, usuario, cargo, ativo, senhaHash, salt, primeiroAcesso: true };
            await db.ref('usuarios/' + novoId).set(userData);
            toast('Usuário criado com sucesso! Senha padrão: 123456');
            fecharModal();
            carregarUsuarios();
            carregarSelectUsuarios();
            registrarLog('usuario', `Novo usuário "${userData.usuario}" (${userData.cargo}) criado.`, novoId);
        } catch (err) {
            console.error('Erro ao criar usuário:', err);
            toast('Erro ao criar usuário.', 'error');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-save"></i> Criar Usuário'; }
        }
    });
}

function editarUsuario(id) {
    db.ref('usuarios/' + id).once('value').then(snap => {
        const u = snap.val();
        if (!u) {
            toast('Usuário não encontrado.', 'error');
            return;
        }
        
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Usuário';
        document.getElementById('modalBody').innerHTML = `
            <form id="formEditarUsuario">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Nome Completo <span class="required">*</span></label>
                        <input type="text" id="editUNome" value="${sanitizar(u.nome)}" required>
                    </div>
                    <div class="form-group">
                        <label>Nome de Usuário <span class="required">*</span></label>
                        <input type="text" id="editUUser" value="${sanitizar(u.usuario)}" required>
                    </div>
                    <div class="form-group">
                        <label>Cargo</label>
                        <select id="editUCargo">
                            <option ${u.cargo === 'Administrador' ? 'selected' : ''}>Administrador</option>
                            <option ${u.cargo === 'Supervisor' ? 'selected' : ''}>Supervisor</option>
                            <option ${u.cargo === 'Recepcionista' ? 'selected' : ''}>Recepcionista</option>
                            <option ${u.cargo === 'Serviço Social' ? 'selected' : ''}>Serviço Social</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="editUAtivo">
                            <option value="true" ${u.ativo !== false ? 'selected' : ''}>Ativo</option>
                            <option value="false" ${u.ativo === false ? 'selected' : ''}>Inativo</option>
                        </select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar Alterações</button>
                </div>
            </form>
        `;
        
        document.getElementById('genericModal').style.display = 'flex';
        document.getElementById('genericModal').classList.add('active');
        
        document.getElementById('formEditarUsuario').addEventListener('submit', function(e) {
            e.preventDefault();
            
            db.ref('usuarios/' + id).update({
                nome: sanitizar(document.getElementById('editUNome').value.trim()),
                usuario: sanitizar(document.getElementById('editUUser').value.trim().toLowerCase()),
                cargo: document.getElementById('editUCargo').value,
                ativo: document.getElementById('editUAtivo').value === 'true'
            }).then(() => {
                toast('Usuário atualizado com sucesso!');
                fecharModal();
                carregarUsuarios();
                registrarLog('usuario', `Usuário "${u.usuario}" editado.`, id);
            }).catch(err => {
                console.error('Erro ao atualizar:', err);
                toast('Erro ao atualizar usuário.', 'error');
            });
        });
    });
}

async function resetSenhaUser(id) {
    if (!confirm('Resetar senha para "123456"? O usuário precisará criar uma nova senha no próximo acesso.')) return;
    try {
        const { salt, senhaHash } = await criarCredenciais('123456');
        await db.ref('usuarios/' + id).update({ senhaHash, salt, senha: null, primeiroAcesso: true });
        toast('Senha resetada com sucesso!');
        carregarUsuarios();
        registrarLog('usuario', `Senha do usuário "${id}" resetada para o padrão.`);
    } catch (err) {
        console.error('Erro ao resetar senha:', err);
        toast('Erro ao resetar senha.', 'error');
    }
}

function excluirUsuario(id) {
    if (confirm('Tem certeza que deseja excluir este usuário permanentemente?')) {
        db.ref('usuarios/' + id).remove().then(() => {
            toast('Usuário excluído com sucesso!');
            carregarUsuarios();
            carregarSelectUsuarios();
            registrarLog('usuario', `Usuário "${id}" excluído.`);
        }).catch(err => {
            console.error('Erro ao excluir:', err);
            toast('Erro ao excluir usuário.', 'error');
        });
    }
}

function resetSenhaUsuario() {
    const userId = document.getElementById('selectUsuarioReset')?.value;
    if (!userId) {
        toast('Selecione um usuário.', 'error');
        return;
    }
    resetSenhaUser(userId);
}

