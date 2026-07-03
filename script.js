// ============================================
// CONFIGURAÇÃO FIREBASE
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyDcUK7ZwpxX7voL5vGr71ltW0WclRm8NJ8",
    authDomain: "hrpi-sistema-recepcao.firebaseapp.com",
    databaseURL: "https://hrpi-sistema-recepcao-default-rtdb.firebaseio.com",
    projectId: "hrpi-sistema-recepcao",
    storageBucket: "hrpi-sistema-recepcao.firebasestorage.app",
    messagingSenderId: "233408674656",
    appId: "1:233408674656:web:45805b396a7cd7d6e1bc05"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let usuarioLogado = null;
let acompanhantes = {};

// ============================================
// UTILITÁRIOS
// ============================================
function dataHoje() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

function horaAgora() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function gerarId() {
    return 'ac_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function toast(msg, erro = false) {
    const t = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = msg;
    t.className = 'toast show' + (erro ? ' error' : '');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ============================================
// LOGIN
// ============================================
function fazerLoginEvento(e) {
    e.preventDefault();
    const usuario = document.getElementById('username').value.trim();
    const senha = document.getElementById('password').value.trim();
    const erroDiv = document.getElementById('loginError');
    
    if (!usuario || !senha) {
        erroDiv.textContent = 'Preencha usuário e senha';
        erroDiv.style.display = 'block';
        return;
    }
    
    db.ref('usuarios').once('value').then(snapshot => {
        const usuarios = snapshot.val();
        
        if (!usuarios) {
            erroDiv.textContent = 'Nenhum usuário cadastrado. Execute o setup primeiro.';
            erroDiv.style.display = 'block';
            return;
        }
        
        const user = Object.values(usuarios).find(u => 
            u.usuario === usuario && u.senha === senha && u.ativo !== false
        );
        
        if (!user) {
            erroDiv.textContent = 'Usuário ou senha inválidos';
            erroDiv.style.display = 'block';
            return;
        }
        
        if (user.primeiroAcesso) {
            // Forçar troca de senha
            usuarioLogado = user;
            document.getElementById('firstAccessModal').style.display = 'flex';
            return;
        }
        
        completarLogin(user);
    }).catch(erro => {
        erroDiv.textContent = 'Erro: ' + erro.message;
        erroDiv.style.display = 'block';
    });
}

function completarLogin(user) {
    usuarioLogado = user;
    sessionStorage.setItem('hrpi_user', JSON.stringify(user));
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('firstAccessModal').style.display = 'none';
    document.getElementById('mainSystem').style.display = 'flex';
    
    document.getElementById('userName').textContent = user.nome;
    document.getElementById('userRole').textContent = user.cargo;
    
    // Mostrar/esconder itens admin
    const isAdmin = user.cargo === 'Administrador' || user.cargo === 'Supervisor';
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
    if (isAdmin) {
        document.getElementById('indicadoresAvancados').style.display = 'block';
    }
    
    iniciarSistema();
    toast('Bem-vindo(a), ' + user.nome + '!');
}

function logout() {
    sessionStorage.removeItem('hrpi_user');
    usuarioLogado = null;
    document.getElementById('mainSystem').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginForm').reset();
}

// ============================================
// TROCA DE SENHA (PRIMEIRO ACESSO)
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', fazerLoginEvento);
    
    // Troca de senha
    document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const nova = document.getElementById('newPassword').value;
        const confirma = document.getElementById('confirmPassword').value;
        const erroDiv = document.getElementById('passwordError');
        
        if (nova !== confirma) {
            erroDiv.textContent = 'As senhas não conferem';
            erroDiv.style.display = 'block';
            return;
        }
        
        if (nova.length < 4) {
            erroDiv.textContent = 'Mínimo 4 caracteres';
            erroDiv.style.display = 'block';
            return;
        }
        
        db.ref('usuarios/' + usuarioLogado.id).update({
            senha: nova,
            primeiroAcesso: false
        }).then(() => {
            usuarioLogado.senha = nova;
            usuarioLogado.primeiroAcesso = false;
            completarLogin(usuarioLogado);
            toast('Senha alterada com sucesso!');
        }).catch(erro => {
            erroDiv.textContent = erro.message;
            erroDiv.style.display = 'block';
        });
    });
    
    // Verificar sessão
    const userData = sessionStorage.getItem('hrpi_user');
    if (userData) {
        usuarioLogado = JSON.parse(userData);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainSystem').style.display = 'flex';
        document.getElementById('userName').textContent = usuarioLogado.nome;
        document.getElementById('userRole').textContent = usuarioLogado.cargo;
        iniciarSistema();
    }
    
    // Atualizar data
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
});

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================
function iniciarSistema() {
    db.ref('acompanhantes').on('value', snapshot => {
        acompanhantes = snapshot.val() || {};
        atualizarDashboard();
        atualizarAtivos();
        atualizarHistorico();
        atualizarSelects();
    });
    
    navegarPara('dashboard');
}

// ============================================
// NAVEGAÇÃO
// ============================================
function navegarPara(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const sec = document.getElementById(section);
    if (sec) sec.classList.add('active');
    
    const nav = document.querySelector(`[data-section="${section}"]`);
    if (nav) nav.classList.add('active');
    
    document.getElementById('sectionTitle').textContent = {
        'dashboard': 'Dashboard',
        'entradaAcompanhante': 'Entrada de Acompanhante',
        'registroVisita': 'Registro de Visita',
        'registroTroca': 'Troca de Acompanhante',
        'registroSaida': 'Registro de Saída',
        'acompanhantesAtivos': 'Acompanhantes Ativos',
        'historico': 'Histórico Completo',
        'relatorios': 'Relatórios em PDF',
        'usuarios': 'Gerenciamento de Usuários',
        'configuracoes': 'Configurações'
    }[section] || '';
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        navegarPara(this.getAttribute('data-section'));
    });
});

// Mobile menu
document.getElementById('mobileMenuToggle').addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('mobile-open');
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Deseja sair do sistema?')) logout();
});

// Theme toggle
document.getElementById('themeToggle').addEventListener('click', function() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    this.querySelector('i').className = next === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    db.ref('configuracoes').update({ tema: next });
});

// ============================================
// DASHBOARD
// ============================================
function atualizarDashboard() {
    const hoje = dataHoje();
    let presentes = 0, visitas = 0, entradas = 0, trocas = 0, saidas = 0;
    const ultimos = [];
    
    Object.values(acompanhantes).forEach(ac => {
        if (ac.status === 'presente') {
            presentes++;
            if (ac.tipo === 'visita') visitas++;
        }
        if (ac.dataEntrada === hoje) entradas++;
        if (ac.dataSaida === hoje) {
            if (ac.status === 'saiu') saidas++;
            if (ac.status === 'trocado') trocas++;
        }
        ultimos.push(ac);
    });
    
    document.getElementById('countAcompanhantesPresentes').textContent = presentes;
    document.getElementById('countVisitasAtivas').textContent = visitas;
    document.getElementById('countEntradasHoje').textContent = entradas;
    document.getElementById('countTrocasHoje').textContent = trocas;
    document.getElementById('countSaidasHoje').textContent = saidas;
    
    // Ordenar
    ultimos.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-');
        const [db, mb, ab] = b.dataEntrada.split('-');
        return new Date(ab, mb-1, db) - new Date(aa, ma-1, da);
    });
    
    const tbody = document.querySelector('#tabelaUltimosRegistros tbody');
    tbody.innerHTML = ultimos.slice(0, 8).map(ac => `
        <tr>
            <td><span class="badge badge-${ac.tipo}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
            <td>${ac.nomeAcompanhante}</td>
            <td>${ac.nomePaciente}</td>
            <td>${ac.setor}${ac.leito ? ' / ' + ac.leito : ''}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td><span class="status-badge status-${ac.status}">${ac.status}</span></td>
        </tr>
    `).join('');
}

// ============================================
// ENTRADA DE ACOMPANHANTE
// ============================================
document.getElementById('formEntradaAcompanhante').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const dados = {
        id: gerarId(),
        tipo: 'acompanhante',
        nomeAcompanhante: document.getElementById('acNome').value,
        documento: document.getElementById('acDocumento').value,
        telefone: document.getElementById('acTelefone').value,
        parentesco: document.getElementById('acParentesco').value,
        nomePaciente: document.getElementById('acPaciente').value,
        setor: document.getElementById('acSetor').value,
        leito: document.getElementById('acLeito').value,
        dataEntrada: dataHoje(),
        horaEntrada: horaAgora(),
        dataSaida: null,
        horaSaida: null,
        status: 'presente',
        recepcionistaEntrada: usuarioLogado.nome,
        recepcionistaSaida: null,
        trocas: [],
        observacao: document.getElementById('acObservacao').value,
        duracaoVisita: null
    };
    
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('Entrada registrada com sucesso!');
        this.reset();
    }).catch(erro => toast('Erro: ' + erro.message, true));
});

// ============================================
// REGISTRO DE VISITA
// ============================================
document.getElementById('formVisita').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const duracao = parseInt(document.getElementById('visDuracao').value);
    const entrada = new Date();
    const saida = new Date(entrada.getTime() + duracao * 60000);
    
    const dados = {
        id: gerarId(),
        tipo: 'visita',
        nomeAcompanhante: document.getElementById('visNome').value,
        documento: document.getElementById('visDocumento').value,
        telefone: document.getElementById('visTelefone').value,
        parentesco: document.getElementById('visParentesco').value,
        nomePaciente: document.getElementById('visPaciente').value,
        setor: document.getElementById('visSetor').value,
        leito: document.getElementById('visLeito').value,
        dataEntrada: dataHoje(),
        horaEntrada: horaAgora(),
        dataSaida: `${String(saida.getDate()).padStart(2,'0')}-${String(saida.getMonth()+1).padStart(2,'0')}-${saida.getFullYear()}`,
        horaSaida: `${String(saida.getHours()).padStart(2,'0')}:${String(saida.getMinutes()).padStart(2,'0')}`,
        status: 'saiu',
        recepcionistaEntrada: usuarioLogado.nome,
        recepcionistaSaida: usuarioLogado.nome,
        trocas: [],
        observacao: document.getElementById('visObservacao').value,
        duracaoVisita: duracao
    };
    
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('Visita registrada com sucesso!');
        this.reset();
    }).catch(erro => toast('Erro: ' + erro.message, true));
});

// ============================================
// REGISTRO DE SAÍDA
// ============================================
document.getElementById('saidaAcompanhante').addEventListener('change', function() {
    const id = this.value;
    const info = document.getElementById('saidaInfo');
    if (id && acompanhantes[id]) {
        const ac = acompanhantes[id];
        document.getElementById('saidaPaciente').textContent = ac.nomePaciente;
        document.getElementById('saidaSetor').textContent = ac.setor;
        document.getElementById('saidaEntrada').textContent = ac.dataEntrada + ' ' + ac.horaEntrada;
        info.style.display = 'block';
    } else {
        info.style.display = 'none';
    }
});

document.getElementById('formSaida').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const id = document.getElementById('saidaAcompanhante').value;
    const motivo = document.getElementById('saidaMotivo').value;
    
    if (!id || !motivo) {
        toast('Selecione o acompanhante e o motivo', true);
        return;
    }
    
    const atual = acompanhantes[id];
    const obs = atual.observacao ? atual.observacao + ' | Saída: ' + motivo : 'Saída: ' + motivo;
    
    db.ref('acompanhantes/' + id).update({
        status: 'saiu',
        dataSaida: dataHoje(),
        horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado.nome,
        observacao: obs
    }).then(() => {
        toast('Saída registrada!');
        this.reset();
        document.getElementById('saidaInfo').style.display = 'none';
    }).catch(erro => toast('Erro: ' + erro.message, true));
});

// ============================================
// REGISTRO DE TROCA
// ============================================
document.getElementById('trocaAcompanhanteAtual').addEventListener('change', function() {
    const id = this.value;
    const info = document.getElementById('trocaInfoAtual');
    if (id && acompanhantes[id]) {
        const ac = acompanhantes[id];
        document.getElementById('trocaPaciente').textContent = ac.nomePaciente;
        document.getElementById('trocaSetor').textContent = ac.setor;
        document.getElementById('trocaLeito').textContent = ac.leito || '-';
        info.style.display = 'block';
    } else {
        info.style.display = 'none';
    }
});

document.getElementById('formTroca').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const idAntigo = document.getElementById('trocaAcompanhanteAtual').value;
    const antigo = acompanhantes[idAntigo];
    
    if (!antigo) {
        toast('Selecione um acompanhante', true);
        return;
    }
    
    // Atualizar antigo
    db.ref('acompanhantes/' + idAntigo).update({
        status: 'trocado',
        dataSaida: dataHoje(),
        horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado.nome,
        trocas: [...(antigo.trocas || []), {
            dataHora: dataHoje() + ' ' + horaAgora(),
            acompanhanteAntigo: antigo.nomeAcompanhante,
            acompanhanteNovo: document.getElementById('trocaNovoNome').value,
            recepcionista: usuarioLogado.nome
        }]
    });
    
    // Criar novo
    const novoId = gerarId();
    db.ref('acompanhantes/' + novoId).set({
        id: novoId,
        tipo: 'acompanhante',
        nomeAcompanhante: document.getElementById('trocaNovoNome').value,
        documento: document.getElementById('trocaNovoDocumento').value,
        telefone: document.getElementById('trocaNovoTelefone').value,
        parentesco: document.getElementById('trocaNovoParentesco').value,
        nomePaciente: antigo.nomePaciente,
        setor: antigo.setor,
        leito: antigo.leito,
        dataEntrada: dataHoje(),
        horaEntrada: horaAgora(),
        dataSaida: null,
        horaSaida: null,
        status: 'presente',
        recepcionistaEntrada: usuarioLogado.nome,
        recepcionistaSaida: null,
        trocas: [],
        observacao: 'Substituiu: ' + antigo.nomeAcompanhante,
        duracaoVisita: null
    }).then(() => {
        toast('Troca registrada!');
        this.reset();
        document.getElementById('trocaInfoAtual').style.display = 'none';
    });
});

// ============================================
// ATIVOS
// ============================================
function atualizarAtivos() {
    const tbody = document.querySelector('#tabelaAtivos tbody');
    const ativos = Object.values(acompanhantes).filter(a => a.status === 'presente');
    
    tbody.innerHTML = ativos.length === 0 
        ? '<tr><td colspan="9" style="text-align:center;">Nenhum ativo</td></tr>'
        : ativos.map(ac => `
            <tr>
                <td><span class="badge badge-${ac.tipo}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                <td>${ac.nomeAcompanhante}</td>
                <td>${ac.documento || '-'}</td>
                <td>${ac.parentesco}</td>
                <td>${ac.nomePaciente}</td>
                <td>${ac.setor}</td>
                <td>${ac.leito || '-'}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
}

// ============================================
// HISTÓRICO
// ============================================
function atualizarHistorico() {
    const tbody = document.querySelector('#tabelaHistorico tbody');
    let registros = Object.values(acompanhantes);
    
    registros.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-');
        const [db, mb, ab] = b.dataEntrada.split('-');
        return new Date(ab, mb-1, db) - new Date(aa, ma-1, da);
    });
    
    tbody.innerHTML = registros.map(ac => `
        <tr>
            <td><span class="badge badge-${ac.tipo}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
            <td>${ac.nomeAcompanhante}</td>
            <td>${ac.documento || '-'}</td>
            <td>${ac.parentesco}</td>
            <td>${ac.nomePaciente}</td>
            <td>${ac.setor}</td>
            <td>${ac.leito || '-'}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td>${ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-'}</td>
            <td><span class="status-badge status-${ac.status}">${ac.status}</span></td>
            <td>
                <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('btnFiltrar').addEventListener('click', function() {
    const inicio = document.getElementById('filtroDataInicio').value;
    const fim = document.getElementById('filtroDataFim').value;
    const status = document.getElementById('filtroStatus').value;
    const tipo = document.getElementById('filtroTipo').value;
    
    let registros = Object.values(acompanhantes);
    
    if (status) registros = registros.filter(a => a.status === status);
    if (tipo) registros = registros.filter(a => a.tipo === tipo);
    if (inicio) registros = registros.filter(a => {
        const [d, m, an] = a.dataEntrada.split('-');
        return new Date(an, m-1, d) >= new Date(inicio + 'T00:00:00');
    });
    if (fim) registros = registros.filter(a => {
        const [d, m, an] = a.dataEntrada.split('-');
        return new Date(an, m-1, d) <= new Date(fim + 'T23:59:59');
    });
    
    const tbody = document.querySelector('#tabelaHistorico tbody');
    tbody.innerHTML = registros.map(ac => `
        <tr>
            <td><span class="badge badge-${ac.tipo}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
            <td>${ac.nomeAcompanhante}</td>
            <td>${ac.documento || '-'}</td>
            <td>${ac.parentesco}</td>
            <td>${ac.nomePaciente}</td>
            <td>${ac.setor}</td>
            <td>${ac.leito || '-'}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td>${ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-'}</td>
            <td><span class="status-badge status-${ac.status}">${ac.status}</span></td>
            <td>
                <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
});

// ============================================
// EDITAR / EXCLUIR
// ============================================
function editarRegistro(id) {
    const ac = acompanhantes[id];
    if (!ac) return;
    
    document.getElementById('modalTitle').textContent = 'Editar Registro';
    document.getElementById('modalBody').innerHTML = `
        <form id="formEditar" class="modern-form">
            <div class="form-row">
                <div class="form-group">
                    <label>Nome *</label>
                    <input type="text" id="editNome" value="${ac.nomeAcompanhante}" required>
                </div>
                <div class="form-group">
                    <label>Documento</label>
                    <input type="text" id="editDoc" value="${ac.documento || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Telefone</label>
                    <input type="text" id="editTel" value="${ac.telefone || ''}">
                </div>
                <div class="form-group">
                    <label>Parentesco</label>
                    <input type="text" id="editParentesco" value="${ac.parentesco}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Paciente</label>
                    <input type="text" id="editPaciente" value="${ac.nomePaciente}">
                </div>
                <div class="form-group">
                    <label>Setor</label>
                    <select id="editSetor">
                        <option>Oncologia I</option><option>Oncologia II</option>
                        <option>UTI I</option><option>UTI II</option>
                        <option>Clínica Médica I</option><option>Clínica Médica II</option>
                        <option>Clínica Cirúrgica</option><option>Pediatria</option>
                        <option>Saúde Mental</option>
                    </select>
                </div>
            </div>
            <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Salvar</button>
        </form>
    `;
    
    document.getElementById('genericModal').style.display = 'flex';
    
    setTimeout(() => {
        document.getElementById('editSetor').value = ac.setor;
        document.getElementById('formEditar').addEventListener('submit', function(e) {
            e.preventDefault();
            db.ref('acompanhantes/' + id).update({
                nomeAcompanhante: document.getElementById('editNome').value,
                documento: document.getElementById('editDoc').value,
                telefone: document.getElementById('editTel').value,
                parentesco: document.getElementById('editParentesco').value,
                nomePaciente: document.getElementById('editPaciente').value,
                setor: document.getElementById('editSetor').value
            }).then(() => {
                toast('Registro atualizado!');
                document.getElementById('genericModal').style.display = 'none';
            });
        });
    }, 100);
}

function excluirRegistro(id) {
    if (confirm('Excluir este registro?')) {
        db.ref('acompanhantes/' + id).remove().then(() => toast('Excluído!'));
    }
}

// Fechar modal
document.querySelector('.modal-close').addEventListener('click', function() {
    document.getElementById('genericModal').style.display = 'none';
});

document.getElementById('genericModal').addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
});

// ============================================
// ATUALIZAR SELECTS
// ============================================
function atualizarSelects() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente');
    
    const selectSaida = document.getElementById('saidaAcompanhante');
    if (selectSaida) {
        selectSaida.innerHTML = '<option value="">Selecione...</option>' +
            presentes.map(ac => {
                const prefixo = ac.tipo === 'visita' ? '[VISITA] ' : '';
                return `<option value="${ac.id}">${prefixo}${ac.nomeAcompanhante} - ${ac.nomePaciente}</option>`;
            }).join('');
    }
    
    const selectTroca = document.getElementById('trocaAcompanhanteAtual');
    if (selectTroca) {
        selectTroca.innerHTML = '<option value="">Selecione...</option>' +
            presentes.filter(a => a.tipo === 'acompanhante').map(ac =>
                `<option value="${ac.id}">${ac.nomeAcompanhante} - ${ac.nomePaciente} - ${ac.setor}</option>`
            ).join('');
    }
}

// ============================================
// RELATÓRIOS PDF
// ============================================
function gerarRelatorio(tipo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    let dataInicio, dataFim, titulo;
    const hoje = new Date();
    
    switch(tipo) {
        case 'diario':
            dataInicio = dataHoje();
            dataFim = dataHoje();
            titulo = 'Relatório Diário';
            break;
        case 'semanal':
            const inicioSemana = new Date();
            inicioSemana.setDate(hoje.getDate() - hoje.getDay());
            dataInicio = `${String(inicioSemana.getDate()).padStart(2,'0')}-${String(inicioSemana.getMonth()+1).padStart(2,'0')}-${inicioSemana.getFullYear()}`;
            dataFim = dataHoje();
            titulo = 'Relatório Semanal';
            break;
        case 'mensal':
            dataInicio = `01-${String(hoje.getMonth()+1).padStart(2,'0')}-${hoje.getFullYear()}`;
            dataFim = dataHoje();
            titulo = 'Relatório Mensal';
            break;
        case 'personalizado':
            dataInicio = document.getElementById('dataInicioPersonalizado').value.split('-').reverse().join('-');
            dataFim = document.getElementById('dataFimPersonalizado').value.split('-').reverse().join('-');
            titulo = 'Relatório Personalizado';
            break;
    }
    
    // Cabeçalho
    doc.setFontSize(16);
    doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS - HRPI', 140, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(titulo + ' - ' + dataInicio + ' a ' + dataFim, 140, 30, { align: 'center' });
    
    // Dados
    let dados = Object.values(acompanhantes);
    if (dataInicio) {
        const [di, mi, ai] = dataInicio.split('-');
        const dataI = new Date(ai, mi-1, di);
        dados = dados.filter(ac => {
            const [d, m, a] = ac.dataEntrada.split('-');
            return new Date(a, m-1, d) >= dataI;
        });
    }
    if (dataFim) {
        const [df, mf, af] = dataFim.split('-');
        const dataF = new Date(af, mf-1, df, 23, 59, 59);
        dados = dados.filter(ac => {
            const [d, m, a] = ac.dataEntrada.split('-');
            return new Date(a, m-1, d) <= dataF;
        });
    }
    
    const tableData = dados.map(ac => [
        ac.tipo === 'visita' ? 'Visita' : 'Acomp.',
        ac.nomeAcompanhante,
        ac.documento || '-',
        ac.parentesco,
        ac.nomePaciente,
        ac.setor,
        ac.leito || '-',
        ac.dataEntrada + ' ' + ac.horaEntrada,
        ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-',
        ac.status
    ]);
    
    doc.autoTable({
        startY: 40,
        head: [['Tipo', 'Nome', 'Documento', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Entrada', 'Saída', 'Status']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 105, 92] }
    });
    
    doc.save(`Relatorio_${tipo}_${dataHoje()}.pdf`);
    toast('PDF gerado com sucesso!');
}

console.log('✅ HRPI - Sistema pronto!');
