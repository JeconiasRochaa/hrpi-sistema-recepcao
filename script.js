// ============================================
// HRPI - SISTEMA DE CONTROLE DE RECEPÇÃO
// script.js - VERSÃO CORRIGIDA COM DEBUG
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
    console.log('✅ Firebase inicializado');
} catch (error) {
    console.error('❌ Erro Firebase:', error);
}

const db = firebase.database();

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let usuarioLogado = null;
let acompanhantes = {};

// ============================================
// CONFIGURAÇÕES
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
    
    if (!t || !icon || !message) {
        alert(msg);
        return;
    }
    
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
    const modal = document.getElementById('genericModal');
    if (modal) modal.classList.remove('active');
}

// ============================================
// LOGIN - COMPLETAMENTE REESCRITO
// ============================================
let loginAttempts = 0;
let lockoutUntil = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🟢 DOM Carregado');
    
    // Atualizar data
    atualizarDataAtual();
    
    // Carregar configurações
    carregarConfiguracoes();
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', fazerLogin);
        console.log('✅ Evento de login vinculado');
    } else {
        console.error('❌ Formulário de login não encontrado!');
    }
    
    // Troca de senha
    const changePassForm = document.getElementById('changePasswordForm');
    if (changePassForm) {
        changePassForm.addEventListener('submit', trocarSenha);
    }
    
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
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    if (mobileBtn) {
        mobileBtn.addEventListener('click', function() {
            document.getElementById('sidebar').classList.add('open');
            if (sidebarOverlay) sidebarOverlay.classList.add('active');
        });
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            document.getElementById('sidebar').classList.remove('open');
            this.classList.remove('active');
        });
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Deseja realmente sair do sistema?')) logout();
        });
    }
    
    // Theme toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTema);
    }
    
    // Modal close
    const modalCloseBtn = document.querySelector('#genericModal .modal-close');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', fecharModal);
    }
    
    const genericModal = document.getElementById('genericModal');
    if (genericModal) {
        genericModal.addEventListener('click', function(e) {
            if (e.target === this) fecharModal();
        });
    }
    
    // Configurações
    const uploadLogoEl = document.getElementById('uploadLogo');
    const uploadFundoEl = document.getElementById('uploadFundo');
    const btnRemoverLogo = document.getElementById('btnRemoverLogo');
    const btnRemoverFundo = document.getElementById('btnRemoverFundo');
    const btnResetSenha = document.getElementById('btnResetSenha');
    
    if (uploadLogoEl) uploadLogoEl.addEventListener('change', uploadLogo);
    if (uploadFundoEl) uploadFundoEl.addEventListener('change', uploadFundo);
    if (btnRemoverLogo) btnRemoverLogo.addEventListener('click', removerLogo);
    if (btnRemoverFundo) btnRemoverFundo.addEventListener('click', removerFundo);
    if (btnResetSenha) btnResetSenha.addEventListener('click', resetSenhaUsuario);
    
    // Novo usuário
    const btnNovoUsuario = document.getElementById('btnNovoUsuario');
    if (btnNovoUsuario) btnNovoUsuario.addEventListener('click', abrirModalNovoUsuario);
    
    // Formulários
    const formEntrada = document.getElementById('formEntradaAcompanhante');
    const formVisita = document.getElementById('formVisita');
    const formTroca = document.getElementById('formTroca');
    const formSaida = document.getElementById('formSaida');
    
    if (formEntrada) formEntrada.addEventListener('submit', registrarEntrada);
    if (formVisita) formVisita.addEventListener('submit', registrarVisita);
    if (formTroca) formTroca.addEventListener('submit', registrarTroca);
    if (formSaida) formSaida.addEventListener('submit', registrarSaida);
    
    // Eventos selects
    const saidaSelect = document.getElementById('saidaAcompanhante');
    const trocaSelect = document.getElementById('trocaAcompanhanteAtual');
    
    if (saidaSelect) saidaSelect.addEventListener('change', atualizarInfoSaida);
    if (trocaSelect) trocaSelect.addEventListener('change', atualizarInfoTroca);
    
    // Filtro
    const btnFiltrar = document.getElementById('btnFiltrar');
    if (btnFiltrar) btnFiltrar.addEventListener('click', filtrarHistorico);
    
    // Verificar sessão
    verificarSessao();
    
    // Carregar usuários para select
    carregarSelectUsuarios();
    
    console.log('✅ Sistema inicializado!');
});

function fazerLogin(e) {
    e.preventDefault();
    console.log('🔐 ========== TENTATIVA DE LOGIN ==========');
    
    // Verificar lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const min = Math.ceil((lockoutUntil - Date.now()) / 60000);
        const erroDiv = document.getElementById('loginError');
        if (erroDiv) erroDiv.textContent = `Conta bloqueada. Tente em ${min} minuto(s).`;
        return;
    }
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const erroDiv = document.getElementById('loginError');
    const btnLogin = document.querySelector('.btn-login');
    
    if (!usernameInput || !passwordInput) {
        console.error('❌ Campos de login não encontrados!');
        return;
    }
    
    const usuario = usernameInput.value.trim();
    const senha = passwordInput.value;
    
    console.log('📝 Usuário digitado:', usuario);
    console.log('🔑 Senha digitada:', senha.replace(/./g, '*'));
    
    if (!usuario || !senha) {
        if (erroDiv) erroDiv.textContent = 'Preencha todos os campos.';
        return;
    }
    
    if (btnLogin) {
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<span class="spinner"></span> Entrando...';
    }
    
    // BUSCAR NO FIREBASE
    console.log('🔍 Buscando usuários no Firebase...');
    
    db.ref('usuarios').once('value').then(snapshot => {
        const usuarios = snapshot.val();
        console.log('📦 Dados brutos do Firebase:', usuarios);
        console.log('📊 Total de usuários:', usuarios ? Object.keys(usuarios).length : 0);
        
        if (!usuarios) {
            console.error('❌ Nenhum usuário cadastrado no banco!');
            if (erroDiv) erroDiv.textContent = 'Nenhum usuário cadastrado. Execute o setup primeiro.';
            resetarBtnLogin();
            return;
        }
        
        // CORREÇÃO: Converter para array e buscar
        let userEncontrado = null;
        const listaUsuarios = Object.entries(usuarios);
        
        console.log('🔍 Procurando usuário:', usuario);
        
        for (const [key, user] of listaUsuarios) {
            console.log(`   Verificando: ID=${key}, usuario=${user.usuario}, senha=${user.senha}, ativo=${user.ativo}`);
            
            // Verificação exata
            if (user.usuario === usuario && user.senha === senha) {
                console.log('   ✅ Usuário e senha conferem!');
                
                if (user.ativo === false) {
                    console.log('   ⚠️ Usuário está INATIVO!');
                    continue;
                }
                
                userEncontrado = { ...user, id: key };
                console.log('   🎯 USUÁRIO ENCONTRADO:', userEncontrado);
                break;
            } else {
                if (user.usuario !== usuario) {
                    console.log(`   ❌ Usuário não confere: "${user.usuario}" !== "${usuario}"`);
                }
                if (user.senha !== senha) {
                    console.log(`   ❌ Senha não confere`);
                }
            }
        }
        
        if (!userEncontrado) {
            loginAttempts++;
            console.error('❌ USUÁRIO NÃO ENCONTRADO!');
            console.error(`   Tentativa ${loginAttempts} de ${CONFIG.MAX_LOGIN_ATTEMPTS}`);
            
            if (erroDiv) erroDiv.textContent = 'Usuário ou senha inválidos.';
            
            if (loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                lockoutUntil = Date.now() + CONFIG.LOCKOUT_TIME;
                if (erroDiv) erroDiv.textContent = 'Conta bloqueada por 15 minutos.';
                loginAttempts = 0;
            }
            resetarBtnLogin();
            return;
        }
        
        // LOGIN BEM-SUCEDIDO
        console.log('🎉 LOGIN BEM-SUCEDIDO!');
        loginAttempts = 0;
        lockoutUntil = null;
        
        if (userEncontrado.primeiroAcesso) {
            console.log('🔐 Primeiro acesso - solicitando troca de senha');
            usuarioLogado = userEncontrado;
            const firstAccessModal = document.getElementById('firstAccessModal');
            if (firstAccessModal) {
                firstAccessModal.style.display = 'flex';
            }
            resetarBtnLogin();
            return;
        }
        
        completarLogin(userEncontrado);
        resetarBtnLogin();
        
    }).catch(error => {
        console.error('🔥 ERRO NO FIREBASE:', error);
        if (erroDiv) erroDiv.textContent = 'Erro de conexão com o servidor. Verifique sua internet.';
        resetarBtnLogin();
    });
}

function resetarBtnLogin() {
    const btn = document.querySelector('.btn-login');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
    }
}

function trocarSenha(e) {
    e.preventDefault();
    console.log('🔑 Trocando senha...');
    
    const novaSenha = document.getElementById('newPassword').value;
    const confirmaSenha = document.getElementById('confirmPassword').value;
    const erroDiv = document.getElementById('passwordError');
    
    if (novaSenha !== confirmaSenha) {
        if (erroDiv) {
            erroDiv.textContent = 'As senhas não conferem.';
            erroDiv.style.display = 'block';
        }
        return;
    }
    
    if (novaSenha.length < CONFIG.MIN_PASSWORD_LENGTH) {
        if (erroDiv) {
            erroDiv.textContent = `Mínimo ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            erroDiv.style.display = 'block';
        }
        return;
    }
    
    if (!usuarioLogado || !usuarioLogado.id) {
        console.error('❌ usuárioLogado não definido!');
        if (erroDiv) {
            erroDiv.textContent = 'Erro interno. Faça login novamente.';
            erroDiv.style.display = 'block';
        }
        return;
    }
    
    console.log('📝 Atualizando senha para ID:', usuarioLogado.id);
    
    db.ref('usuarios/' + usuarioLogado.id).update({
        senha: novaSenha,
        primeiroAcesso: false
    }).then(() => {
        console.log('✅ Senha atualizada!');
        usuarioLogado.senha = novaSenha;
        usuarioLogado.primeiroAcesso = false;
        
        const firstAccessModal = document.getElementById('firstAccessModal');
        if (firstAccessModal) {
            firstAccessModal.style.display = 'none';
        }
        
        completarLogin(usuarioLogado);
        toast('Senha alterada com sucesso!');
    }).catch(error => {
        console.error('❌ Erro ao atualizar senha:', error);
        if (erroDiv) {
            erroDiv.textContent = 'Erro ao salvar. Tente novamente.';
            erroDiv.style.display = 'block';
        }
    });
}

function completarLogin(user) {
    console.log('✅ Completando login para:', user.nome, '(ID:', user.id, ')');
    
    usuarioLogado = user;
    
    // Salvar sessão
    sessionStorage.setItem('hrpi_session', JSON.stringify({
        id: user.id,
        nome: user.nome,
        cargo: user.cargo,
        timestamp: Date.now()
    }));
    
    // Esconder login, mostrar sistema
    const loginScreen = document.getElementById('loginScreen');
    const mainSystem = document.getElementById('mainSystem');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainSystem) mainSystem.classList.add('active');
    
    // Atualizar nome
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = user.nome;
    
    // Mostrar/ocultar admin
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
    
    const mainSystem = document.getElementById('mainSystem');
    const loginScreen = document.getElementById('loginScreen');
    const loginForm = document.getElementById('loginForm');
    
    if (mainSystem) mainSystem.classList.remove('active');
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (loginForm) loginForm.reset();
    
    const erroDiv = document.getElementById('loginError');
    if (erroDiv) erroDiv.textContent = '';
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
                }).catch(() => {
                    sessionStorage.removeItem('hrpi_session');
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
    const iniSemana = new Date(agora);
    iniSemana.setDate(agora.getDate() - agora.getDay());
    iniSemana.setHours(0, 0, 0, 0);
    
    const iniMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    
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
    
    // Atualizar elementos
    setText('countAcompanhantesPresentes', presentes);
    setText('countVisitasAtivas', visitas);
    setText('countEntradasHoje', entradas);
    setText('countTrocasHoje', trocas);
    setText('countSaidasHoje', saidas);
    setText('countEntradasSemana', entSemana);
    setText('countSaidasSemana', saiSemana);
    setText('countEntradasMes', entMes);
    setText('countSaidasMes', saiMes);
    
    // Últimos registros
    ultimos.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-');
        const [db, mb, ab] = b.dataEntrada.split('-');
        const cmp = new Date(ab, mb-1, db) - new Date(aa, ma-1, da);
        if (cmp !== 0) return cmp;
        return b.horaEntrada.localeCompare(a.horaEntrada);
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

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ============================================
// TABELAS
// ============================================
function atualizarAtivos() {
    const ativos = Object.values(acompanhantes).filter(a => a.status === 'presente');
    const tbody = document.querySelector('#tabelaAtivos tbody');
    if (!tbody) return;
    
    if (ativos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum ativo</td></tr>';
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
                    <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')"><i class="fas fa-trash"></i></button>
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
        const cmp = new Date(ab, mb-1, db) - new Date(aa, ma-1, da);
        if (cmp !== 0) return cmp;
        return b.horaEntrada.localeCompare(a.horaEntrada);
    });
    renderizarTabelaHistorico(registros);
}

function filtrarHistorico() {
    const inicio = document.getElementById('filtroDataInicio')?.value;
    const fim = document.getElementById('filtroDataFim')?.value;
    const status = document.getElementById('filtroStatus')?.value;
    const tipo = document.getElementById('filtroTipo')?.value;
    
    let registros = Object.values(acompanhantes);
    if (status) registros = registros.filter(a => a.status === status);
    if (tipo) registros = registros.filter(a => a.tipo === tipo);
    if (inicio) {
        registros = registros.filter(a => {
            const [d, m, an] = a.dataEntrada.split('-');
            return new Date(an, m-1, d) >= new Date(inicio + 'T00:00:00');
        });
    }
    if (fim) {
        registros = registros.filter(a => {
            const [d, m, an] = a.dataEntrada.split('-');
            return new Date(an, m-1, d) <= new Date(fim + 'T23:59:59');
        });
    }
    
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
        tbody.innerHTML = '<tr><td colspan="11" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum registro</td></tr>';
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
                    <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }
}

// ============================================
// FORMULÁRIOS
// ============================================
function registrarEntrada(e) {
    e.preventDefault();
    const dados = {
        id: gerarId(), tipo: 'acompanhante',
        nomeAcompanhante: sanitizar(document.getElementById('acNome')?.value?.trim() || ''),
        documento: sanitizar(document.getElementById('acDocumento')?.value?.trim() || ''),
        telefone: sanitizar(document.getElementById('acTelefone')?.value?.trim() || ''),
        parentesco: document.getElementById('acParentesco')?.value || '',
        nomePaciente: sanitizar(document.getElementById('acPaciente')?.value?.trim() || ''),
        setor: document.getElementById('acSetor')?.value || '',
        leito: sanitizar(document.getElementById('acLeito')?.value?.trim() || ''),
        dataEntrada: dataHoje(), horaEntrada: horaAgora(),
        dataSaida: null, horaSaida: null, status: 'presente',
        recepcionistaEntrada: usuarioLogado?.nome || 'Sistema',
        recepcionistaSaida: null, trocas: [],
        observacao: sanitizar(document.getElementById('acObservacao')?.value?.trim() || ''),
        duracaoVisita: null
    };
    
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('Entrada registrada!');
        e.target.reset();
    }).catch(err => {
        console.error(err);
        toast('Erro ao registrar.', 'error');
    });
}

function registrarVisita(e) {
    e.preventDefault();
    const duracao = parseInt(document.getElementById('visDuracao')?.value || 30);
    const dados = {
        id: gerarId(), tipo: 'visita',
        nomeAcompanhante: sanitizar(document.getElementById('visNome')?.value?.trim() || ''),
        documento: sanitizar(document.getElementById('visDocumento')?.value?.trim() || ''),
        telefone: sanitizar(document.getElementById('visTelefone')?.value?.trim() || ''),
        parentesco: document.getElementById('visParentesco')?.value || '',
        nomePaciente: sanitizar(document.getElementById('visPaciente')?.value?.trim() || ''),
        setor: document.getElementById('visSetor')?.value || '',
        leito: sanitizar(document.getElementById('visLeito')?.value?.trim() || ''),
        dataEntrada: dataHoje(), horaEntrada: horaAgora(),
        dataSaida: dataHoje(), horaSaida: calcularHoraSaida(duracao),
        status: 'saiu',
        recepcionistaEntrada: usuarioLogado?.nome || 'Sistema',
        recepcionistaSaida: usuarioLogado?.nome || 'Sistema',
        trocas: [], observacao: '', duracaoVisita: duracao
    };
    
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('Visita registrada!');
        e.target.reset();
    }).catch(err => {
        console.error(err);
        toast('Erro ao registrar.', 'error');
    });
}

function calcularHoraSaida(minutos) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutos);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function registrarTroca(e) {
    e.preventDefault();
    const idAntigo = document.getElementById('trocaAcompanhanteAtual')?.value;
    const antigo = acompanhantes[idAntigo];
    if (!antigo) { toast('Selecione um acompanhante.', 'error'); return; }
    
    const trocas = antigo.trocas || [];
    trocas.push({
        dataHora: `${dataHoje()} ${horaAgora()}`,
        acompanhanteAntigo: antigo.nomeAcompanhante,
        acompanhanteNovo: sanitizar(document.getElementById('trocaNovoNome')?.value?.trim() || ''),
        recepcionista: usuarioLogado?.nome || 'Sistema'
    });
    
    db.ref('acompanhantes/' + idAntigo).update({
        status: 'trocado', dataSaida: dataHoje(), horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado?.nome || 'Sistema', trocas: trocas
    });
    
    const novoId = gerarId();
    db.ref('acompanhantes/' + novoId).set({
        id: novoId, tipo: 'acompanhante',
        nomeAcompanhante: sanitizar(document.getElementById('trocaNovoNome')?.value?.trim() || ''),
        documento: sanitizar(document.getElementById('trocaNovoDocumento')?.value?.trim() || ''),
        telefone: sanitizar(document.getElementById('trocaNovoTelefone')?.value?.trim() || ''),
        parentesco: document.getElementById('trocaNovoParentesco')?.value || '',
        nomePaciente: antigo.nomePaciente, setor: antigo.setor, leito: antigo.leito,
        dataEntrada: dataHoje(), horaEntrada: horaAgora(),
        dataSaida: null, horaSaida: null, status: 'presente',
        recepcionistaEntrada: usuarioLogado?.nome || 'Sistema', recepcionistaSaida: null,
        trocas: [], observacao: `Substituiu: ${antigo.nomeAcompanhante}`, duracaoVisita: null
    }).then(() => {
        toast('Troca registrada!');
        e.target.reset();
        const info = document.getElementById('trocaInfoAtual');
        if (info) info.style.display = 'none';
    }).catch(err => {
        console.error(err);
        toast('Erro ao registrar.', 'error');
    });
}

function registrarSaida(e) {
    e.preventDefault();
    const id = document.getElementById('saidaAcompanhante')?.value;
    const motivo = document.getElementById('saidaMotivo')?.value;
    if (!id || !motivo) { toast('Selecione tudo.', 'error'); return; }
    
    const atual = acompanhantes[id];
    if (!atual) { toast('Não encontrado.', 'error'); return; }
    
    const obs = atual.observacao ? `${atual.observacao} | Saída: ${motivo}` : `Saída: ${motivo}`;
    
    db.ref('acompanhantes/' + id).update({
        status: 'saiu', dataSaida: dataHoje(), horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado?.nome || 'Sistema', observacao: obs
    }).then(() => {
        toast('Saída registrada!');
        e.target.reset();
        const info = document.getElementById('saidaInfo');
        if (info) info.style.display = 'none';
    }).catch(err => {
        console.error(err);
        toast('Erro.', 'error');
    });
}

// ============================================
// ATUALIZAR SELECTS
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
        setText('saidaPaciente', ac.nomePaciente);
        setText('saidaSetor', ac.setor);
        setText('saidaEntrada', `${ac.dataEntrada} ${ac.horaEntrada}`);
        if (info) info.style.display = 'block';
    } else {
        if (info) info.style.display = 'none';
    }
}

function atualizarInfoTroca() {
    const id = this.value;
    const info = document.getElementById('trocaInfoAtual');
    if (id && acompanhantes[id]) {
        const ac = acompanhantes[id];
        setText('trocaPaciente', ac.nomePaciente);
        setText('trocaSetor', ac.setor);
        setText('trocaLeito', ac.leito || '-');
        if (info) info.style.display = 'block';
    } else {
        if (info) info.style.display = 'none';
    }
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
                <div class="form-group"><label>Nome *</label><input type="text" id="editNome" value="${sanitizar(ac.nomeAcompanhante)}" required></div>
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
              .catch(err => { console.error(err); toast('Erro.', 'error'); });
        });
    }, 100);
}

function excluirRegistro(id) {
    if (confirm('Excluir permanentemente?')) {
        db.ref('acompanhantes/' + id).remove()
            .then(() => toast('Excluído!'))
            .catch(err => { console.error(err); toast('Erro.', 'error'); });
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
                const sl = document.getElementById('sidebarLogo');
                const ll = document.getElementById('loginLogo');
                if (sl) sl.innerHTML = `<img src="${c.logoHospital}" alt="Logo">`;
                if (ll) ll.innerHTML = `<img src="${c.logoHospital}" alt="Logo">`;
            }
            if (c.fundoLogin) {
                const ls = document.getElementById('loginScreen');
                if (ls) ls.style.setProperty('--login-bg-image', `url(${c.fundoLogin})`);
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
            const sl = document.getElementById('sidebarLogo');
            const ll = document.getElementById('loginLogo');
            if (sl) sl.innerHTML = `<img src="${ev.target.result}" alt="Logo">`;
            if (ll) ll.innerHTML = `<img src="${ev.target.result}" alt="Logo">`;
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
            const ls = document.getElementById('loginScreen');
            if (ls) ls.style.setProperty('--login-bg-image', `url(${ev.target.result})`);
            toast('Fundo atualizado!');
        });
    };
    reader.readAsDataURL(file);
}

function removerLogo() {
    if (confirm('Remover logo?')) {
        db.ref('configuracoes').update({ logoHospital: null }).then(() => {
            const sl = document.getElementById('sidebarLogo');
            const ll = document.getElementById('loginLogo');
            if (sl) sl.innerHTML = '<i class="fas fa-hospital-alt"></i>';
            if (ll) ll.innerHTML = '<span class="default-logo"><i class="fas fa-hospital-alt"></i></span>';
            toast('Logo removida.');
        });
    }
}

function removerFundo() {
    if (confirm('Remover fundo?')) {
        db.ref('configuracoes').update({ fundoLogin: null }).then(() => {
            const ls = document.getElementById('loginScreen');
            if (ls) ls.style.removeProperty('--login-bg-image');
            toast('Fundo removido.');
        });
    }
}

function resetSenhaUsuario() {
    const userId = document.getElementById('selectUsuarioReset')?.value;
    if (!userId) { toast('Selecione um usuário.', 'error'); return; }
    if (confirm('Resetar senha para "123456"?')) {
        db.ref('usuarios/' + userId).update({ senha: '123456', primeiroAcesso: true })
            .then(() => toast('Senha resetada!'))
            .catch(err => { console.error(err); toast('Erro.', 'error'); });
    }
}

function toggleTema() {
    const isDark = document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('#themeToggleBtn i');
    if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
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
        sel.innerHTML = '<option value="">Selecione...</option>' +
            Object.entries(usuarios).map(([key, u]) => `<option value="${key}">${sanitizar(u.nome)} (${sanitizar(u.usuario)})</option>`).join('');
    });
}

function carregarUsuarios() {
    db.ref('usuarios').once('value').then(snap => {
        const usuarios = snap.val() || {};
        const tbody = document.querySelector('#tabelaUsuarios tbody');
        if (!tbody) return;
        
        if (Object.keys(usuarios).length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum usuário</td></tr>';
            return;
        }
        
        tbody.innerHTML = Object.entries(usuarios).map(([key, u]) => `
            <tr>
                <td>${sanitizar(u.nome)}</td>
                <td>${sanitizar(u.usuario)}</td>
                <td>${sanitizar(u.cargo)}</td>
                <td><span class="badge ${u.ativo !== false ? 'badge-success' : 'badge-danger'}">${u.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                <td><span class="badge ${u.primeiroAcesso ? 'badge-warning' : 'badge-info'}">${u.primeiroAcesso ? 'Pendente' : 'OK'}</span></td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarUsuario('${key}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-key" onclick="resetSenhaUser('${key}')"><i class="fas fa-key"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirUsuario('${key}')"><i class="fas fa-trash"></i></button>
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
                <div class="form-group"><label>Nome *</label><input type="text" id="newUserNome" required></div>
                <div class="form-group"><label>Usuário *</label><input type="text" id="newUserUsername" required></div>
                <div class="form-group"><label>Cargo *</label><select id="newUserCargo" required><option value="">Selecione...</option><option>Administrador</option><option>Supervisor</option><option>Recepcionista</option></select></div>
                <div class="form-group"><label>Status</label><select id="newUserAtivo"><option value="true">Ativo</option><option value="false">Inativo</option></select></div>
            </div>
            <div class="form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Criar</button></div>
        </form>
    `;
    document.getElementById('genericModal').classList.add('active');
    
    document.getElementById('formNovoUsuario').addEventListener('submit', function(e) {
        e.preventDefault();
        const novoId = 'user_' + Date.now();
        const userData = {
            id: novoId,
            nome: sanitizar(document.getElementById('newUserNome').value.trim()),
            usuario: sanitizar(document.getElementById('newUserUsername').value.trim().toLowerCase()),
            cargo: document.getElementById('newUserCargo').value,
            ativo: document.getElementById('newUserAtivo').value === 'true',
            senha: '123456',
            primeiroAcesso: true
        };
        
        console.log('📝 Criando usuário:', userData);
        
        db.ref('usuarios/' + novoId).set(userData).then(() => {
            console.log('✅ Usuário criado!');
            toast('Usuário criado! Senha: 123456');
            fecharModal();
            carregarUsuarios();
            carregarSelectUsuarios();
        }).catch(err => {
            console.error('❌ Erro:', err);
            toast('Erro ao criar.', 'error');
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
                    <div class="form-group"><label>Nome *</label><input type="text" id="editUNome" value="${sanitizar(u.nome)}" required></div>
                    <div class="form-group"><label>Usuário *</label><input type="text" id="editUUser" value="${sanitizar(u.usuario)}" required></div>
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
    if (confirm('Excluir permanentemente?')) {
        db.ref('usuarios/' + id).remove()
            .then(() => { toast('Excluído!'); carregarUsuarios(); carregarSelectUsuarios(); });
    }
}

// ============================================
// RELATÓRIOS PDF
// ============================================
function gerarRelatorio(tipo) {
    if (typeof window.jspdf === 'undefined') { toast('Carregando...', 'error'); return; }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    let dataInicio, dataFim, titulo;
    const hoje = new Date();
    
    switch(tipo) {
        case 'diario': dataInicio = dataHoje(); dataFim = dataHoje(); titulo = 'Diário'; break;
        case 'semanal':
            const is = new Date(); is.setDate(hoje.getDate() - hoje.getDay());
            dataInicio = `${String(is.getDate()).padStart(2,'0')}-${String(is.getMonth()+1).padStart(2,'0')}-${is.getFullYear()}`;
            dataFim = dataHoje(); titulo = 'Semanal'; break;
        case 'mensal':
            dataInicio = `01-${String(hoje.getMonth()+1).padStart(2,'0')}-${hoje.getFullYear()}`;
            dataFim = dataHoje(); titulo = 'Mensal'; break;
        case 'personalizado':
            const ini = document.getElementById('dataInicioPersonalizado')?.value;
            const fim = document.getElementById('dataFimPersonalizado')?.value;
            if (!ini || !fim) { toast('Selecione datas.', 'error'); return; }
            dataInicio = ini.split('-').reverse().join('-');
            dataFim = fim.split('-').reverse().join('-');
            titulo = 'Personalizado'; break;
    }
    
    db.ref('configuracoes/logoHospital').once('value').then(snapLogo => {
        if (snapLogo.val()) try { doc.addImage(snapLogo.val(), 'PNG', 10, 8, 22, 22); } catch(e) {}
        
        doc.setFontSize(16); doc.setTextColor(26, 107, 122);
        doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS', 148, 15, { align: 'center' });
        doc.setFontSize(11); doc.setTextColor(100);
        doc.text('Sistema de Controle de Recepção', 148, 22, { align: 'center' });
        doc.setFontSize(13); doc.setTextColor(0);
        doc.text(`Relatório ${titulo}: ${dataInicio} a ${dataFim}`, 148, 30, { align: 'center' });
        
        let dados = Object.values(acompanhantes);
        if (dataInicio) { const [di, mi, ai] = dataInicio.split('-'); dados = dados.filter(ac => { const [d, m, a] = ac.dataEntrada.split('-'); return new Date(a, m-1, d) >= new Date(ai, mi-1, di); }); }
        if (dataFim) { const [df, mf, af] = dataFim.split('-'); dados = dados.filter(ac => { const [d, m, a] = ac.dataEntrada.split('-'); return new Date(a, m-1, d) <= new Date(af, mf-1, df, 23, 59, 59); }); }
        
        doc.autoTable({
            startY: 38,
            head: [['Tipo', 'Nome', 'Doc', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Entrada', 'Saída', 'Status']],
            body: dados.map(ac => [ac.tipo==='visita'?'Visita':'Acomp.', ac.nomeAcompanhante, ac.documento||'-', ac.parentesco, ac.nomePaciente, ac.setor, ac.leito||'-', ac.dataEntrada+' '+ac.horaEntrada, ac.dataSaida?ac.dataSaida+' '+ac.horaSaida:'-', ac.status]),
            styles: { fontSize: 7 }, headStyles: { fillColor: [26, 107, 122] },
            alternateRowStyles: { fillColor: [232, 244, 247] }
        });
        
        doc.save(`HRPI_${titulo}_${dataHoje()}.pdf`);
        toast('PDF gerado!');
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

console.log('✅ HRPI - Sistema carregado!');
