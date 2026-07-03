// ============================================
// HRPI - SISTEMA DE CONTROLE DE RECEPÇÃO
// script.js - Versão Adaptada ao Novo CSS
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

try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
}

const db = firebase.database();

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let usuarioLogado = null;
let acompanhantes = {};

// ============================================
// CONFIGURAÇÕES DE SEGURANÇA
// ============================================
const CONFIG = {
    SESSION_TIMEOUT: 30 * 60 * 1000,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000,
    MIN_PASSWORD_LENGTH: 6
};

// ============================================
// UTILITÁRIOS
// ============================================
function dataHoje() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

function horaAgora() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function gerarId() {
    return 'hrpi_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const message = document.getElementById('toastMessage');
    
    message.textContent = msg;
    icon.className = tipo === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
    t.className = `toast show ${tipo === 'error' ? 'error' : ''}`;
    
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), 4000);
}

function sanitizar(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function fecharModal() {
    document.getElementById('genericModal').classList.remove('active');
}

// ============================================
// LOGIN
// ============================================
let loginAttempts = 0;
let lockoutUntil = null;

document.addEventListener('DOMContentLoaded', function() {
    // Atualizar data
    atualizarDataAtual();
    
    // Carregar configurações
    carregarConfiguracoes();
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', fazerLogin);
    
    // Troca de senha
    document.getElementById('changePasswordForm').addEventListener('submit', trocarSenha);
    
    // Navegação
    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
        link.addEventListener('click', function() {
            navegarPara(this.getAttribute('data-page'));
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
                document.getElementById('sidebarOverlay').classList.remove('active');
            }
        });
    });
    
    // Mobile menu
    document.getElementById('mobileMenuBtn').addEventListener('click', function() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebarOverlay').classList.add('active');
    });
    
    document.getElementById('sidebarOverlay').addEventListener('click', function() {
        document.getElementById('sidebar').classList.remove('open');
        this.classList.remove('active');
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        if (confirm('Deseja realmente sair do sistema?')) logout();
    });
    
    // Theme toggle
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTema);
    
    // Modal close
    document.querySelector('#genericModal .modal-close').addEventListener('click', fecharModal);
    document.getElementById('genericModal').addEventListener('click', function(e) {
        if (e.target === this) fecharModal();
    });
    
    // Configurações
    document.getElementById('uploadLogo').addEventListener('change', uploadLogo);
    document.getElementById('uploadFundo').addEventListener('change', uploadFundo);
    document.getElementById('btnRemoverLogo').addEventListener('click', removerLogo);
    document.getElementById('btnRemoverFundo').addEventListener('click', removerFundo);
    document.getElementById('btnResetSenha').addEventListener('click', resetSenhaUsuario);
    
    // Novo usuário
    document.getElementById('btnNovoUsuario').addEventListener('click', abrirModalNovoUsuario);
    
    // Formulários
    document.getElementById('formEntradaAcompanhante').addEventListener('submit', registrarEntrada);
    document.getElementById('formVisita').addEventListener('submit', registrarVisita);
    document.getElementById('formTroca').addEventListener('submit', registrarTroca);
    document.getElementById('formSaida').addEventListener('submit', registrarSaida);
    
    // Eventos selects
    document.getElementById('saidaAcompanhante').addEventListener('change', atualizarInfoSaida);
    document.getElementById('trocaAcompanhanteAtual').addEventListener('change', atualizarInfoTroca);
    
    // Filtro
    document.getElementById('btnFiltrar').addEventListener('click', filtrarHistorico);
    
    // Verificar sessão
    verificarSessao();
    
    // Carregar usuários para select
    carregarSelectUsuarios();
});

function fazerLogin(e) {
    e.preventDefault();
    
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const min = Math.ceil((lockoutUntil - Date.now()) / 60000);
        document.getElementById('loginError').textContent = `Conta bloqueada. Tente em ${min} minuto(s).`;
        return;
    }
    
    const usuario = document.getElementById('username').value.trim();
    const senha = document.getElementById('password').value;
    const erroDiv = document.getElementById('loginError');
    const btnLogin = document.querySelector('.btn-login');
    
    if (!usuario || !senha) {
        erroDiv.textContent = 'Preencha todos os campos.';
        return;
    }
    
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner"></span> Entrando...';
    
    db.ref('usuarios').once('value').then(snapshot => {
        const usuarios = snapshot.val();
        if (!usuarios) {
            erroDiv.textContent = 'Sistema não configurado.';
            resetarBtnLogin();
            return;
        }
        
        const user = Object.values(usuarios).find(u => 
            u.usuario === usuario && u.senha === senha && u.ativo !== false
        );
        
        if (!user) {
            loginAttempts++;
            erroDiv.textContent = 'Usuário ou senha inválidos.';
            if (loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                lockoutUntil = Date.now() + CONFIG.LOCKOUT_TIME;
                erroDiv.textContent = 'Conta bloqueada por 15 minutos.';
                loginAttempts = 0;
            }
            resetarBtnLogin();
            return;
        }
        
        loginAttempts = 0;
        lockoutUntil = null;
        
        if (user.primeiroAcesso) {
            usuarioLogado = user;
            document.getElementById('firstAccessModal').classList.add('active');
            document.getElementById('firstAccessModal').style.display = 'flex';
            resetarBtnLogin();
            return;
        }
        
        completarLogin(user);
        resetarBtnLogin();
    }).catch(() => {
        erroDiv.textContent = 'Erro de conexão.';
        resetarBtnLogin();
    });
}

function resetarBtnLogin() {
    const btn = document.querySelector('.btn-login');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
}

function trocarSenha(e) {
    e.preventDefault();
    const nova = document.getElementById('newPassword').value;
    const confirma = document.getElementById('confirmPassword').value;
    const erroDiv = document.getElementById('passwordError');
    
    if (nova !== confirma) {
        erroDiv.textContent = 'As senhas não conferem.';
        erroDiv.style.display = 'block';
        return;
    }
    if (nova.length < CONFIG.MIN_PASSWORD_LENGTH) {
        erroDiv.textContent = `Mínimo ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
        erroDiv.style.display = 'block';
        return;
    }
    
    db.ref('usuarios/' + usuarioLogado.id).update({
        senha: nova, primeiroAcesso: false
    }).then(() => {
        usuarioLogado.senha = nova;
        usuarioLogado.primeiroAcesso = false;
        document.getElementById('firstAccessModal').classList.remove('active');
        document.getElementById('firstAccessModal').style.display = 'none';
        completarLogin(usuarioLogado);
        toast('Senha alterada com sucesso!');
    }).catch(() => {
        erroDiv.textContent = 'Erro ao alterar senha.';
        erroDiv.style.display = 'block';
    });
}

function completarLogin(user) {
    usuarioLogado = user;
    sessionStorage.setItem('hrpi_session', JSON.stringify({
        id: user.id, nome: user.nome, cargo: user.cargo, timestamp: Date.now()
    }));
    
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainSystem').classList.add('active');
    
    document.getElementById('userName').textContent = user.nome;
    
    const isAdmin = user.cargo === 'Administrador' || user.cargo === 'Supervisor';
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
    
    iniciarSistema();
    navegarPara('dashboard');
    toast(`Bem-vindo(a), ${user.nome}!`);
}

function logout() {
    sessionStorage.removeItem('hrpi_session');
    usuarioLogado = null;
    document.getElementById('mainSystem').classList.remove('active');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').textContent = '';
}

function verificarSessao() {
    const data = sessionStorage.getItem('hrpi_session');
    if (data) {
        try {
            const sessao = JSON.parse(data);
            if (Date.now() - sessao.timestamp < CONFIG.SESSION_TIMEOUT) {
                db.ref('usuarios/' + sessao.id).once('value').then(snap => {
                    const user = snap.val();
                    if (user && user.ativo !== false) {
                        completarLogin(user);
                    } else {
                        sessionStorage.removeItem('hrpi_session');
                    }
                });
            } else {
                sessionStorage.removeItem('hrpi_session');
            }
        } catch (e) {
            sessionStorage.removeItem('hrpi_session');
        }
    }
}

// ============================================
// NAVEGAÇÃO
// ============================================
function navegarPara(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    
    const page = document.getElementById(pageName);
    if (page) page.classList.add('active');
    
    const navLink = document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`);
    if (navLink) navLink.classList.add('active');
    
    if (pageName === 'usuarios') carregarUsuarios();
    if (pageName === 'acompanhantesAtivos') atualizarAtivos();
    if (pageName === 'historico') atualizarHistorico();
}

// ============================================
// INICIALIZAÇÃO
// ============================================
function iniciarSistema() {
    db.ref('acompanhantes').on('value', snapshot => {
        acompanhantes = snapshot.val() || {};
        atualizarDashboard();
        atualizarAtivos();
        atualizarHistorico();
        atualizarSelects();
    });
}

// ============================================
// DASHBOARD
// ============================================
function atualizarDashboard() {
    const hoje = dataHoje();
    let presentes = 0, visitas = 0, entradas = 0, trocas = 0, saidas = 0;
    let entSemana = 0, saiSemana = 0, entMes = 0, saiMes = 0;
    const ultimos = [];
    
    const agora = new Date();
    const iniSemana = new Date(agora); iniSemana.setDate(agora.getDate() - agora.getDay());
    const iniMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    
    Object.values(acompanhantes).forEach(ac => {
        if (ac.status === 'presente') { presentes++; if (ac.tipo === 'visita') visitas++; }
        if (ac.dataEntrada === hoje) entradas++;
        if (ac.dataSaida === hoje) { if (ac.status === 'saiu') saidas++; if (ac.status === 'trocado') trocas++; }
        
        const [d, m, a] = ac.dataEntrada.split('-');
        const dataE = new Date(a, m-1, d);
        if (dataE >= iniSemana) entSemana++;
        if (dataE >= iniMes) entMes++;
        
        if (ac.dataSaida) {
            const [ds, ms, as] = ac.dataSaida.split('-');
            const dataS = new Date(as, ms-1, ds);
            if (dataS >= iniSemana) saiSemana++;
            if (dataS >= iniMes) saiMes++;
        }
        ultimos.push(ac);
    });
    
    document.getElementById('countAcompanhantesPresentes').textContent = presentes;
    document.getElementById('countVisitasAtivas').textContent = visitas;
    document.getElementById('countEntradasHoje').textContent = entradas;
    document.getElementById('countTrocasHoje').textContent = trocas;
    document.getElementById('countSaidasHoje').textContent = saidas;
    
    const elES = document.getElementById('countEntradasSemana');
    const elSS = document.getElementById('countSaidasSemana');
    const elEM = document.getElementById('countEntradasMes');
    const elSM = document.getElementById('countSaidasMes');
    if (elES) elES.textContent = entSemana;
    if (elSS) elSS.textContent = saiSemana;
    if (elEM) elEM.textContent = entMes;
    if (elSM) elSM.textContent = saiMes;
    
    ultimos.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-');
        const [db, mb, ab] = b.dataEntrada.split('-');
        return new Date(ab, mb-1, db) - new Date(aa, ma-1, da) || b.horaEntrada.localeCompare(a.horaEntrada);
    });
    
    const tbody = document.querySelector('#tabelaUltimosRegistros tbody');
    if (tbody) {
        if (ultimos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum registro</td></tr>';
        } else {
            tbody.innerHTML = ultimos.slice(0, 8).map(ac => `
                <tr>
                    <td><span class="badge ${ac.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                    <td>${sanitizar(ac.nomeAcompanhante)}</td>
                    <td>${sanitizar(ac.nomePaciente)}</td>
                    <td>${sanitizar(ac.setor)}${ac.leito ? ' / ' + sanitizar(ac.leito) : ''}</td>
                    <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                    <td><span class="badge ${ac.status === 'presente' ? 'badge-success' : ac.status === 'saiu' ? 'badge-danger' : 'badge-warning'}">${ac.status}</span></td>
                </tr>
            `).join('');
        }
    }
}

// ============================================
// TABELAS
// ============================================
function atualizarAtivos() {
    const ativos = Object.values(acompanhantes).filter(a => a.status === 'presente');
    const tbody = document.querySelector('#tabelaAtivos tbody');
    if (!tbody) return;
    
    if (ativos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum acompanhante ativo</td></tr>';
    } else {
        tbody.innerHTML = ativos.map(ac => `
            <tr>
                <td><span class="badge ${ac.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                <td>${sanitizar(ac.nomeAcompanhante)}</td>
                <td>${sanitizar(ac.documento) || '-'}</td>
                <td>${sanitizar(ac.parentesco)}</td>
                <td>${sanitizar(ac.nomePaciente)}</td>
                <td>${sanitizar(ac.setor)}</td>
                <td>${sanitizar(ac.leito) || '-'}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }
}

function atualizarHistorico() {
    let registros = Object.values(acompanhantes);
    registros.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-');
        const [db, mb, ab] = b.dataEntrada.split('-');
        return new Date(ab, mb-1, db) - new Date(aa, ma-1, da) || b.horaEntrada.localeCompare(a.horaEntrada);
    });
    renderizarTabelaHistorico(registros);
}

function filtrarHistorico() {
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
    
    registros.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-');
        const [db, mb, ab] = b.dataEntrada.split('-');
        return new Date(ab, mb-1, db) - new Date(aa, ma-1, da);
    });
    
    renderizarTabelaHistorico(registros);
    toast(`${registros.length} registro(s) encontrado(s).`);
}

function renderizarTabelaHistorico(registros) {
    const tbody = document.querySelector('#tabelaHistorico tbody');
    if (!tbody) return;
    
    if (registros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum registro encontrado</td></tr>';
    } else {
        tbody.innerHTML = registros.map(ac => `
            <tr>
                <td><span class="badge ${ac.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                <td>${sanitizar(ac.nomeAcompanhante)}</td>
                <td>${sanitizar(ac.documento) || '-'}</td>
                <td>${sanitizar(ac.parentesco)}</td>
                <td>${sanitizar(ac.nomePaciente)}</td>
                <td>${sanitizar(ac.setor)}</td>
                <td>${sanitizar(ac.leito) || '-'}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td>${ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-'}</td>
                <td><span class="badge ${ac.status === 'presente' ? 'badge-success' : ac.status === 'saiu' ? 'badge-danger' : 'badge-warning'}">${ac.status}</span></td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }
}

// ============================================
// FORMULÁRIOS DE REGISTRO
// ============================================
function registrarEntrada(e) {
    e.preventDefault();
    const dados = {
        id: gerarId(), tipo: 'acompanhante',
        nomeAcompanhante: sanitizar(document.getElementById('acNome').value.trim()),
        documento: sanitizar(document.getElementById('acDocumento').value.trim()),
        telefone: sanitizar(document.getElementById('acTelefone').value.trim()),
        parentesco: document.getElementById('acParentesco').value,
        nomePaciente: sanitizar(document.getElementById('acPaciente').value.trim()),
        setor: document.getElementById('acSetor').value,
        leito: sanitizar(document.getElementById('acLeito').value.trim()),
        dataEntrada: dataHoje(), horaEntrada: horaAgora(),
        dataSaida: null, horaSaida: null, status: 'presente',
        recepcionistaEntrada: usuarioLogado.nome, recepcionistaSaida: null,
        trocas: [], observacao: sanitizar(document.getElementById('acObservacao').value.trim()),
        duracaoVisita: null
    };
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('Entrada registrada com sucesso!');
        e.target.reset();
    }).catch(() => toast('Erro ao registrar.', 'error'));
}

function registrarVisita(e) {
    e.preventDefault();
    const duracao = parseInt(document.getElementById('visDuracao').value);
    const dados = {
        id: gerarId(), tipo: 'visita',
        nomeAcompanhante: sanitizar(document.getElementById('visNome').value.trim()),
        documento: sanitizar(document.getElementById('visDocumento').value.trim()),
        telefone: sanitizar(document.getElementById('visTelefone').value.trim()),
        parentesco: document.getElementById('visParentesco').value,
        nomePaciente: sanitizar(document.getElementById('visPaciente').value.trim()),
        setor: document.getElementById('visSetor').value,
        leito: sanitizar(document.getElementById('visLeito').value.trim()),
        dataEntrada: dataHoje(), horaEntrada: horaAgora(),
        dataSaida: dataHoje(), horaSaida: calcularHoraSaida(duracao),
        status: 'saiu',
        recepcionistaEntrada: usuarioLogado.nome, recepcionistaSaida: usuarioLogado.nome,
        trocas: [], observacao: '', duracaoVisita: duracao
    };
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('Visita registrada com sucesso!');
        e.target.reset();
    }).catch(() => toast('Erro ao registrar.', 'error'));
}

function calcularHoraSaida(minutos) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutos);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function registrarTroca(e) {
    e.preventDefault();
    const idAntigo = document.getElementById('trocaAcompanhanteAtual').value;
    const antigo = acompanhantes[idAntigo];
    if (!antigo) { toast('Selecione um acompanhante.', 'error'); return; }
    
    const trocas = antigo.trocas || [];
    trocas.push({
        dataHora: `${dataHoje()} ${horaAgora()}`,
        acompanhanteAntigo: antigo.nomeAcompanhante,
        acompanhanteNovo: sanitizar(document.getElementById('trocaNovoNome').value.trim()),
        recepcionista: usuarioLogado.nome
    });
    
    db.ref('acompanhantes/' + idAntigo).update({
        status: 'trocado', dataSaida: dataHoje(), horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado.nome, trocas: trocas
    });
    
    const novoId = gerarId();
    db.ref('acompanhantes/' + novoId).set({
        id: novoId, tipo: 'acompanhante',
        nomeAcompanhante: sanitizar(document.getElementById('trocaNovoNome').value.trim()),
        documento: sanitizar(document.getElementById('trocaNovoDocumento').value.trim()),
        telefone: sanitizar(document.getElementById('trocaNovoTelefone').value.trim()),
        parentesco: document.getElementById('trocaNovoParentesco').value,
        nomePaciente: antigo.nomePaciente, setor: antigo.setor, leito: antigo.leito,
        dataEntrada: dataHoje(), horaEntrada: horaAgora(),
        dataSaida: null, horaSaida: null, status: 'presente',
        recepcionistaEntrada: usuarioLogado.nome, recepcionistaSaida: null,
        trocas: [], observacao: `Substituiu: ${antigo.nomeAcompanhante}`, duracaoVisita: null
    }).then(() => {
        toast('Troca registrada com sucesso!');
        e.target.reset();
        document.getElementById('trocaInfoAtual').style.display = 'none';
    }).catch(() => toast('Erro ao registrar.', 'error'));
}

function registrarSaida(e) {
    e.preventDefault();
    const id = document.getElementById('saidaAcompanhante').value;
    const motivo = document.getElementById('saidaMotivo').value;
    if (!id || !motivo) { toast('Selecione acompanhante e motivo.', 'error'); return; }
    
    const atual = acompanhantes[id];
    const obs = atual.observacao ? `${atual.observacao} | Saída: ${motivo}` : `Saída: ${motivo}`;
    
    db.ref('acompanhantes/' + id).update({
        status: 'saiu', dataSaida: dataHoje(), horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado.nome, observacao: obs
    }).then(() => {
        toast('Saída registrada!');
        e.target.reset();
        document.getElementById('saidaInfo').style.display = 'none';
    }).catch(() => toast('Erro ao registrar.', 'error'));
}

// ============================================
// ATUALIZAR SELECTS E INFOS
// ============================================
function atualizarSelects() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente');
    
    const selSaida = document.getElementById('saidaAcompanhante');
    if (selSaida) {
        selSaida.innerHTML = '<option value="">Selecione...</option>' +
            presentes.map(ac => `<option value="${ac.id}">${ac.tipo === 'visita' ? '[VISITA]' : '[ACOMP.]'} ${sanitizar(ac.nomeAcompanhante)} - ${sanitizar(ac.nomePaciente)}</option>`).join('');
    }
    
    const selTroca = document.getElementById('trocaAcompanhanteAtual');
    if (selTroca) {
        selTroca.innerHTML = '<option value="">Selecione...</option>' +
            presentes.filter(a => a.tipo === 'acompanhante').map(ac => `<option value="${ac.id}">${sanitizar(ac.nomeAcompanhante)} - ${sanitizar(ac.nomePaciente)}</option>`).join('');
    }
}

function atualizarInfoSaida() {
    const id = this.value;
    const info = document.getElementById('saidaInfo');
    if (id && acompanhantes[id]) {
        const ac = acompanhantes[id];
        document.getElementById('saidaPaciente').textContent = ac.nomePaciente;
        document.getElementById('saidaSetor').textContent = ac.setor;
        document.getElementById('saidaEntrada').textContent = `${ac.dataEntrada} ${ac.horaEntrada}`;
        info.style.display = 'block';
    } else { info.style.display = 'none'; }
}

function atualizarInfoTroca() {
    const id = this.value;
    const info = document.getElementById('trocaInfoAtual');
    if (id && acompanhantes[id]) {
        const ac = acompanhantes[id];
        document.getElementById('trocaPaciente').textContent = ac.nomePaciente;
        document.getElementById('trocaSetor').textContent = ac.setor;
        document.getElementById('trocaLeito').textContent = ac.leito || '-';
        info.style.display = 'block';
    } else { info.style.display = 'none'; }
}

// ============================================
// EDITAR / EXCLUIR
// ============================================
function editarRegistro(id) {
    const ac = acompanhantes[id];
    if (!ac) return;
    
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Registro';
    document.getElementById('modalBody').innerHTML = `
        <form id="formEditar">
            <div class="form-grid">
                <div class="form-group"><label>Nome <span class="required">*</span></label><input type="text" id="editNome" value="${sanitizar(ac.nomeAcompanhante)}" required></div>
                <div class="form-group"><label>Documento</label><input type="text" id="editDoc" value="${sanitizar(ac.documento || '')}"></div>
                <div class="form-group"><label>Telefone</label><input type="text" id="editTel" value="${sanitizar(ac.telefone || '')}"></div>
                <div class="form-group"><label>Parentesco</label><select id="editParentesco"><option>Filho(a)</option><option>Pai/Mãe</option><option>Cônjuge</option><option>Irmão/Irmã</option><option>Neto(a)</option><option>Sobrinho(a)</option><option>Amigo(a)</option><option>Cuidador(a)</option><option>Outro</option></select></div>
                <div class="form-group"><label>Paciente</label><input type="text" id="editPaciente" value="${sanitizar(ac.nomePaciente)}"></div>
                <div class="form-group"><label>Setor</label><select id="editSetor"><option>Oncologia I</option><option>Oncologia II</option><option>UTI I</option><option>UTI II</option><option>Clínica Médica I</option><option>Clínica Médica II</option><option>Clínica Cirúrgica</option><option>Pediatria</option><option>Saúde Mental</option></select></div>
                <div class="form-group"><label>Leito</label><input type="text" id="editLeito" value="${sanitizar(ac.leito || '')}"></div>
                <div class="form-group"><label>Observação</label><input type="text" id="editObs" value="${sanitizar(ac.observacao || '')}"></div>
            </div>
            <div class="form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button></div>
        </form>
    `;
    
    document.getElementById('genericModal').classList.add('active');
    
    setTimeout(() => {
        document.getElementById('editSetor').value = ac.setor;
        document.getElementById('editParentesco').value = ac.parentesco;
        document.getElementById('formEditar').addEventListener('submit', function(e) {
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
            }).then(() => { toast('Atualizado!'); fecharModal(); })
              .catch(() => toast('Erro ao atualizar.', 'error'));
        });
    }, 100);
}

function excluirRegistro(id) {
    if (confirm('Excluir este registro permanentemente?')) {
        db.ref('acompanhantes/' + id).remove().then(() => toast('Excluído!'));
    }
}

// ============================================
// CONFIGURAÇÕES
// ============================================
function carregarConfiguracoes() {
    db.ref('configuracoes').once('value').then(snap => {
        const c = snap.val();
        if (c) {
            if (c.logoHospital) {
                document.getElementById('sidebarLogo').innerHTML = `<img src="${c.logoHospital}" alt="Logo">`;
                document.getElementById('loginLogo').innerHTML = `<img src="${c.logoHospital}" alt="Logo">`;
            }
            if (c.fundoLogin) {
                document.getElementById('loginScreen').style.setProperty('--login-bg-image', `url(${c.fundoLogin})`);
            }
            if (c.tema) {
                if (c.tema === 'dark') document.body.classList.add('dark-theme');
                else document.body.classList.remove('dark-theme');
                const icon = document.querySelector('#themeToggleBtn i');
                if (icon) icon.className = c.tema === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    });
}

function uploadLogo(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) { toast('Imagem inválida.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
        db.ref('configuracoes').update({ logoHospital: ev.target.result }).then(() => {
            document.getElementById('sidebarLogo').innerHTML = `<img src="${ev.target.result}" alt="Logo">`;
            document.getElementById('loginLogo').innerHTML = `<img src="${ev.target.result}" alt="Logo">`;
            toast('Logo atualizada!');
        });
    };
    reader.readAsDataURL(file);
}

function uploadFundo(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) { toast('Imagem inválida.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
        db.ref('configuracoes').update({ fundoLogin: ev.target.result }).then(() => {
            document.getElementById('loginScreen').style.setProperty('--login-bg-image', `url(${ev.target.result})`);
            toast('Fundo atualizado!');
        });
    };
    reader.readAsDataURL(file);
}

function removerLogo() {
    if (confirm('Remover a logo?')) {
        db.ref('configuracoes').update({ logoHospital: null }).then(() => {
            document.getElementById('sidebarLogo').innerHTML = '<i class="fas fa-hospital-alt"></i>';
            document.getElementById('loginLogo').innerHTML = '<span class="default-logo"><i class="fas fa-hospital-alt"></i></span>';
            toast('Logo removida.');
        });
    }
}

function removerFundo() {
    if (confirm('Remover o fundo?')) {
        db.ref('configuracoes').update({ fundoLogin: null }).then(() => {
            document.getElementById('loginScreen').style.removeProperty('--login-bg-image');
            toast('Fundo removido.');
        });
    }
}

function resetSenhaUsuario() {
    const userId = document.getElementById('selectUsuarioReset').value;
    if (!userId) { toast('Selecione um usuário.', 'error'); return; }
    if (confirm('Resetar senha para "123456"?')) {
        db.ref('usuarios/' + userId).update({ senha: '123456', primeiroAcesso: true })
            .then(() => toast('Senha resetada! Nova senha: 123456'));
    }
}

function toggleTema() {
    const isDark = document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('#themeToggleBtn i');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    db.ref('configuracoes').update({ tema: isDark ? 'dark' : 'light' });
}

// ============================================
// USUÁRIOS
// ============================================
function carregarSelectUsuarios() {
    db.ref('usuarios').on('value', snap => {
        const sel = document.getElementById('selectUsuarioReset');
        if (!sel) return;
        const usuarios = snap.val() || {};
        sel.innerHTML = '<option value="">Selecione um usuário...</option>' +
            Object.values(usuarios).map(u => `<option value="${u.id}">${sanitizar(u.nome)} (${sanitizar(u.usuario)})</option>`).join('');
    });
}

function carregarUsuarios() {
    db.ref('usuarios').once('value').then(snap => {
        const usuarios = snap.val() || {};
        const tbody = document.querySelector('#tabelaUsuarios tbody');
        if (!tbody) return;
        tbody.innerHTML = Object.values(usuarios).map(u => `
            <tr>
                <td>${sanitizar(u.nome)}</td><td>${sanitizar(u.usuario)}</td><td>${sanitizar(u.cargo)}</td>
                <td><span class="badge ${u.ativo !== false ? 'badge-success' : 'badge-danger'}">${u.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                <td><span class="badge ${u.primeiroAcesso ? 'badge-warning' : 'badge-info'}">${u.primeiroAcesso ? 'Pendente' : 'OK'}</span></td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarUsuario('${u.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-key" onclick="resetSenhaUser('${u.id}')" title="Resetar Senha"><i class="fas fa-key"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirUsuario('${u.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    });
}

function abrirModalNovoUsuario() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Novo Usuário';
    document.getElementById('modalBody').innerHTML = `
        <form id="formNovoUsuario">
            <div class="form-grid">
                <div class="form-group"><label>Nome <span class="required">*</span></label><input type="text" id="newUserNome" required></div>
                <div class="form-group"><label>Usuário <span class="required">*</span></label><input type="text" id="newUserUsername" required></div>
                <div class="form-group"><label>Cargo <span class="required">*</span></label><select id="newUserCargo" required><option value="">Selecione...</option><option>Administrador</option><option>Supervisor</option><option>Recepcionista</option></select></div>
                <div class="form-group"><label>Status</label><select id="newUserAtivo"><option value="true">Ativo</option><option value="false">Inativo</option></select></div>
            </div>
            <div class="form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Criar</button></div>
        </form>
    `;
    document.getElementById('genericModal').classList.add('active');
    
    document.getElementById('formNovoUsuario').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = 'user_' + Date.now();
        db.ref('usuarios/' + id).set({
            id, nome: sanitizar(document.getElementById('newUserNome').value.trim()),
            usuario: sanitizar(document.getElementById('newUserUsername').value.trim().toLowerCase()),
            senha: '123456', cargo: document.getElementById('newUserCargo').value,
            ativo: document.getElementById('newUserAtivo').value === 'true', primeiroAcesso: true
        }).then(() => {
            toast('Usuário criado! Senha: 123456');
            fecharModal();
            if (document.getElementById('usuarios').classList.contains('active')) carregarUsuarios();
            carregarSelectUsuarios();
        });
    });
}

function editarUsuario(id) {
    db.ref('usuarios/' + id).once('value').then(snap => {
        const u = snap.val();
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Usuário';
        document.getElementById('modalBody').innerHTML = `
            <form id="formEditarUsuario">
                <div class="form-grid">
                    <div class="form-group"><label>Nome <span class="required">*</span></label><input type="text" id="editUNome" value="${sanitizar(u.nome)}" required></div>
                    <div class="form-group"><label>Usuário <span class="required">*</span></label><input type="text" id="editUUser" value="${sanitizar(u.usuario)}" required></div>
                    <div class="form-group"><label>Cargo</label><select id="editUCargo"><option ${u.cargo==='Administrador'?'selected':''}>Administrador</option><option ${u.cargo==='Supervisor'?'selected':''}>Supervisor</option><option ${u.cargo==='Recepcionista'?'selected':''}>Recepcionista</option></select></div>
                    <div class="form-group"><label>Status</label><select id="editUAtivo"><option value="true" ${u.ativo!==false?'selected':''}>Ativo</option><option value="false" ${u.ativo===false?'selected':''}>Inativo</option></select></div>
                </div>
                <div class="form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button></div>
            </form>
        `;
        document.getElementById('genericModal').classList.add('active');
        
        document.getElementById('formEditarUsuario').addEventListener('submit', function(e) {
            e.preventDefault();
            db.ref('usuarios/' + id).update({
                nome: sanitizar(document.getElementById('editUNome').value.trim()),
                usuario: sanitizar(document.getElementById('editUUser').value.trim().toLowerCase()),
                cargo: document.getElementById('editUCargo').value,
                ativo: document.getElementById('editUAtivo').value === 'true'
            }).then(() => { toast('Atualizado!'); fecharModal(); carregarUsuarios(); });
        });
    });
}

function resetSenhaUser(id) {
    if (confirm('Resetar senha para "123456"?')) {
        db.ref('usuarios/' + id).update({ senha: '123456', primeiroAcesso: true })
            .then(() => { toast('Senha resetada!'); carregarUsuarios(); });
    }
}

function excluirUsuario(id) {
    if (confirm('Excluir este usuário?')) {
        db.ref('usuarios/' + id).remove().then(() => { toast('Excluído!'); carregarUsuarios(); carregarSelectUsuarios(); });
    }
}

// ============================================
// RELATÓRIOS PDF
// ============================================
function gerarRelatorio(tipo) {
    if (typeof window.jspdf === 'undefined') { toast('Carregando gerador...', 'error'); return; }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    let dataInicio, dataFim, titulo;
    const hoje = new Date();
    
    switch(tipo) {
        case 'diario': dataInicio = dataHoje(); dataFim = dataHoje(); titulo = 'Relatório Diário'; break;
        case 'semanal':
            const is = new Date(); is.setDate(hoje.getDate() - hoje.getDay());
            dataInicio = `${String(is.getDate()).padStart(2,'0')}-${String(is.getMonth()+1).padStart(2,'0')}-${is.getFullYear()}`;
            dataFim = dataHoje(); titulo = 'Relatório Semanal'; break;
        case 'mensal':
            dataInicio = `01-${String(hoje.getMonth()+1).padStart(2,'0')}-${hoje.getFullYear()}`;
            dataFim = dataHoje(); titulo = 'Relatório Mensal'; break;
        case 'personalizado':
            const ini = document.getElementById('dataInicioPersonalizado').value;
            const fim = document.getElementById('dataFimPersonalizado').value;
            if (!ini || !fim) { toast('Selecione as datas.', 'error'); return; }
            dataInicio = ini.split('-').reverse().join('-');
            dataFim = fim.split('-').reverse().join('-');
            titulo = 'Relatório Personalizado'; break;
    }
    
    db.ref('configuracoes/logoHospital').once('value').then(snapLogo => {
        if (snapLogo.val()) {
            try { doc.addImage(snapLogo.val(), 'PNG', 10, 8, 22, 22); } catch(e) {}
        }
        
        doc.setFontSize(16); doc.setTextColor(26, 107, 122);
        doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS', 148, 15, { align: 'center' });
        doc.setFontSize(11); doc.setTextColor(100);
        doc.text('Sistema de Controle de Recepção - HRPI', 148, 22, { align: 'center' });
        doc.setFontSize(13); doc.setTextColor(0);
        doc.text(`${titulo}: ${dataInicio} a ${dataFim}`, 148, 30, { align: 'center' });
        
        let dados = Object.values(acompanhantes);
        if (dataInicio) {
            const [di, mi, ai] = dataInicio.split('-');
            dados = dados.filter(ac => { const [d, m, a] = ac.dataEntrada.split('-'); return new Date(a, m-1, d) >= new Date(ai, mi-1, di); });
        }
        if (dataFim) {
            const [df, mf, af] = dataFim.split('-');
            dados = dados.filter(ac => { const [d, m, a] = ac.dataEntrada.split('-'); return new Date(a, m-1, d) <= new Date(af, mf-1, df, 23, 59, 59); });
        }
        
        doc.autoTable({
            startY: 38,
            head: [['Tipo', 'Nome', 'Documento', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Entrada', 'Saída', 'Status']],
            body: dados.map(ac => [ac.tipo === 'visita' ? 'Visita' : 'Acomp.', ac.nomeAcompanhante, ac.documento || '-', ac.parentesco, ac.nomePaciente, ac.setor, ac.leito || '-', ac.dataEntrada + ' ' + ac.horaEntrada, ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-', ac.status]),
            styles: { fontSize: 7.5 }, headStyles: { fillColor: [26, 107, 122] },
            alternateRowStyles: { fillColor: [232, 244, 247] }
        });
        
        doc.save(`HRPI_Relatorio_${tipo}_${dataHoje()}.pdf`);
        toast('PDF gerado com sucesso!');
    });
}

// ============================================
// DATA ATUAL
// ============================================
function atualizarDataAtual() {
    const el = document.getElementById('currentDate');
    if (el) {
        el.textContent = new Date().toLocaleDateString('pt-BR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}

console.log('✅ HRPI - Sistema de Controle de Recepção carregado!');
