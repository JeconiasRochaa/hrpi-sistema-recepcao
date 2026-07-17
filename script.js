// ============================================
// HRPI - SISTEMA DE CONTROLE DE RECEPÇÃO
// script.js - COMPLETO COM LOG DE AUDITORIA
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
// LOG DE AUDITORIA
// ============================================
function registrarLog(acao, descricao, registroId = null) {
    const log = {
        id: gerarId(),
        dataHora: `${dataHoje()} ${horaAgora()}`,
        usuario: usuarioLogado ? usuarioLogado.nome : 'Sistema',
        usuarioId: usuarioLogado ? usuarioLogado.id : 'sistema',
        acao: acao,
        descricao: descricao,
        registroId: registroId || ''
    };
    
    db.ref('logs/' + log.id).set(log).catch(err => {
        console.error('Erro ao registrar log:', err);
    });
}

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let usuarioLogado = null;
let acompanhantes = {};
let logoHospitalCache = null;

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
// LOGIN
// ============================================
let loginAttempts = 0;
let lockoutUntil = null;

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('btnExportarExcel')?.addEventListener('click', exportarExcel);
    console.log('🟢 DOM Carregado');
    
    atualizarDataAtual();
    carregarConfiguracoes();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', fazerLogin);
        console.log('✅ Evento de login vinculado');
    } else {
        console.error('❌ Formulário de login não encontrado!');
    }
    
    const changePassForm = document.getElementById('changePasswordForm');
    if (changePassForm) {
        changePassForm.addEventListener('submit', trocarSenha);
    }

    const chkBloqueio = document.getElementById('bloqueioRigido');
if (chkBloqueio) {
    chkBloqueio.addEventListener('change', function() {
        bloqueioRigido = this.checked;
        db.ref('configuracoes').update({ bloqueioRigido: this.checked });
    });
}
    
    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
        link.addEventListener('click', function() {
            navegarPara(this.getAttribute('data-page'));
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
                document.getElementById('sidebarOverlay').classList.remove('active');
            }
        });
    });
    
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
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Deseja realmente sair do sistema?')) logout();
        });
    }
    
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTema);
    }
    
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
    
    const btnNovoUsuario = document.getElementById('btnNovoUsuario');
    if (btnNovoUsuario) btnNovoUsuario.addEventListener('click', abrirModalNovoUsuario);
    
    const formEntrada = document.getElementById('formEntradaAcompanhante');
    const formVisita = document.getElementById('formVisita');
    const formTroca = document.getElementById('formTroca');
    const formSaida = document.getElementById('formSaida');
    
    if (formEntrada) formEntrada.addEventListener('submit', registrarEntrada);
    if (formVisita) formVisita.addEventListener('submit', registrarVisita);
    if (formTroca) formTroca.addEventListener('submit', registrarTroca);
    if (formSaida) formSaida.addEventListener('submit', registrarSaida);
    
    const saidaSelect = document.getElementById('saidaAcompanhante');
    const trocaSelect = document.getElementById('trocaAcompanhanteAtual');
    
    if (saidaSelect) saidaSelect.addEventListener('change', atualizarInfoSaida);
    if (trocaSelect) trocaSelect.addEventListener('change', atualizarInfoTroca);
    
    const btnFiltrar = document.getElementById('btnFiltrar');
    if (btnFiltrar) btnFiltrar.addEventListener('click', filtrarHistorico);

    const btnFiltrarLogs = document.getElementById('btnFiltrarLogs');
    if (btnFiltrarLogs) btnFiltrarLogs.addEventListener('click', filtrarLogs);
    
    verificarSessao();
    carregarSelectUsuarios();
    inicializarBuscaGlobal();
    
    console.log('✅ Sistema inicializado!');
});

function fazerLogin(e) {
    e.preventDefault();
    console.log('🔐 ========== TENTATIVA DE LOGIN ==========');
    
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
        
        let userEncontrado = null;
        const listaUsuarios = Object.entries(usuarios);
        
        console.log('🔍 Procurando usuário:', usuario);
        
        for (const [key, user] of listaUsuarios) {
            console.log(`   Verificando: ID=${key}, usuario=${user.usuario}, senha=${user.senha}, ativo=${user.ativo}`);
            
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
        
        console.log('🎉 LOGIN BEM-SUCEDIDO!');
        loginAttempts = 0;
        lockoutUntil = null;
        
        if (userEncontrado.primeiroAcesso) {
            console.log('🔐 Primeiro acesso - redirecionando para troca de senha');
            console.log('📝 User ID:', userEncontrado.id);
            
            sessionStorage.setItem('hrpi_user_id_temp', userEncontrado.id);
            window.location.href = 'trocar-senha.html?id=' + userEncontrado.id;
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
    
    sessionStorage.setItem('hrpi_session', JSON.stringify({
        id: user.id,
        nome: user.nome,
        cargo: user.cargo,
        timestamp: Date.now()
    }));
    
    const loginScreen = document.getElementById('loginScreen');
    const mainSystem = document.getElementById('mainSystem');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainSystem) mainSystem.classList.add('active');
    
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = user.nome;
    
    const isAdmin = user.cargo === 'Administrador' || user.cargo === 'Supervisor';
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
    
    iniciarSistema();
    navegarPara('dashboard');
    toast(`Bem-vindo(a), ${user.nome}!`);
    registrarLog('login', `Usuário "${user.nome}" fez login no sistema.`);
}

function logout() {
    if (usuarioLogado) {
        registrarLog('logout', `Usuário "${usuarioLogado.nome}" saiu do sistema.`);
    }
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
// FUNÇÃO DE ESTENDER VISITA
// ============================================
function estenderVisita(id) {
    const ac = acompanhantes[id];
    if (!ac || ac.tipo !== 'visita') {
        toast('Registro não encontrado ou não é uma visita.', 'error');
        return;
    }
    
    // Incrementa 15 minutos na duração
    const novaDuracao = (ac.duracaoVisita || 30) + 15;
    const [h, m, s] = ac.horaEntrada.split(':');
    const entrada = new Date();
    entrada.setHours(parseInt(h), parseInt(m), parseInt(s), 0);
    entrada.setMinutes(entrada.getMinutes() + novaDuracao);
    
    const novaHoraSaida = `${String(entrada.getHours()).padStart(2,'0')}:${String(entrada.getMinutes()).padStart(2,'0')}:${String(entrada.getSeconds()).padStart(2,'0')}`;
    
    db.ref('acompanhantes/' + id).update({
        duracaoVisita: novaDuracao,
        horaSaida: novaHoraSaida,   // atualiza a previsão de saída
        status: 'presente'          // permanece presente
    }).then(() => {
        toast('Visita estendida em +15 minutos!');
    }).catch(err => {
        console.error(err);
        toast('Erro ao estender.', 'error');
    });
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
    if (pageName === 'logs') {
        carregarLogs();
        carregarUsuariosFiltroLogs();
    }
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
        atualizarGraficos();
        
        // Atualizar lista de pacientes para autocomplete
        atualizarListaPacientes();
    });
    
    // Inicializar autocomplete após os dados serem carregados
    // (também será atualizado sempre que houver mudança nos dados)
    inicializarAutocompletePacientes();
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
    
    setText('countAcompanhantesPresentes', presentes);
    setText('countVisitasAtivas', visitas);
    setText('countEntradasHoje', entradas);
    setText('countTrocasHoje', trocas);
    setText('countSaidasHoje', saidas);
    setText('countEntradasSemana', entSemana);
    setText('countSaidasSemana', saiSemana);
    setText('countEntradasMes', entMes);
    setText('countSaidasMes', saiMes);
    
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
// GRÁFICOS DO DASHBOARD
// ============================================
let graficoSemanalInst = null;
let graficoSetoresInst = null;
let graficoTendenciaInst = null;

function atualizarGraficos() {
    // Só renderiza gráficos se for admin ou supervisor
    if (!usuarioLogado || (usuarioLogado.cargo !== 'Administrador' && usuarioLogado.cargo !== 'Supervisor')) {
        // Esconder os containers dos gráficos
        const chartsRow = document.querySelector('.charts-row');
        const tendenciaCard = document.getElementById('graficoTendencia')?.closest('.card');
        if (chartsRow) chartsRow.style.display = 'none';
        if (tendenciaCard) tendenciaCard.style.display = 'none';
        return;
    }
    // Mostrar containers
    const chartsRow = document.querySelector('.charts-row');
    const tendenciaCard = document.getElementById('graficoTendencia')?.closest('.card');
    if (chartsRow) chartsRow.style.display = '';
    if (tendenciaCard) tendenciaCard.style.display = '';
    
    atualizarGraficoSemanal();
    atualizarGraficoSetores();
    atualizarGraficoTendencia();
}

function atualizarGraficoSemanal() {
    const canvas = document.getElementById('graficoSemanal');
    if (!canvas) return;
    
    if (graficoSemanalInst) graficoSemanalInst.destroy();
    
    const dias = [];
    const entradas = [];
    const saidas = [];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dataStr = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'short' });
        dias.push(diaSemana);
        
        let ent = 0, sai = 0;
        Object.values(acompanhantes).forEach(ac => {
            if (ac.dataEntrada === dataStr) ent++;
            if (ac.dataSaida === dataStr && (ac.status === 'saiu' || ac.status === 'trocado')) sai++;
        });
        entradas.push(ent);
        saidas.push(sai);
    }
    
    const ctx = canvas.getContext('2d');
    graficoSemanalInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dias,
            datasets: [
                {
                    label: 'Entradas',
                    data: entradas,
                    backgroundColor: 'rgba(45, 139, 78, 0.7)',
                    borderColor: '#2d8b4e',
                    borderWidth: 1,
                    borderRadius: 6
                },
                {
                    label: 'Saídas',
                    data: saidas,
                    backgroundColor: 'rgba(192, 57, 43, 0.7)',
                    borderColor: '#c0392b',
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, padding: 20 }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

function atualizarGraficoSetores() {
    const canvas = document.getElementById('graficoSetores');
    if (!canvas) return;
    if (graficoSetoresInst) graficoSetoresInst.destroy();
    
    const setoresMap = {};
    Object.values(acompanhantes).forEach(ac => {
        if (ac.status === 'presente' && ac.setor) {
            setoresMap[ac.setor] = (setoresMap[ac.setor] || 0) + 1;
        }
    });
    
    const labels = Object.keys(setoresMap);
    const data = Object.values(setoresMap);
    const cores = ['#2d8b4e', '#1a6b7a', '#c7841a', '#8e44ad', '#c0392b', '#2c9aaf', '#e8913a', '#3498db', '#27ae60', '#e74c3c'];
    
    const ctx = canvas.getContext('2d');
    if (labels.length === 0) {
        canvas.style.display = 'none';
        const parent = canvas.parentElement;
        const msg = document.createElement('div');
        msg.className = 'empty-table-message';
        msg.innerHTML = '<i class="fas fa-chart-pie"></i> Nenhum acompanhante ativo';
        parent.appendChild(msg);
        return;
    }
    
    graficoSetoresInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: cores.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 15, usePointStyle: true } }
            }
        }
    });
}

function atualizarGraficoTendencia() {
    const canvas = document.getElementById('graficoTendencia');
    if (!canvas) return;
    if (graficoTendenciaInst) graficoTendenciaInst.destroy();
    
    const dias = [];
    const visitasPorDia = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dataStr = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        dias.push(dataStr.substring(0, 5));
        let count = 0;
        Object.values(acompanhantes).forEach(ac => {
            if (ac.dataEntrada === dataStr && ac.tipo === 'visita') count++;
        });
        visitasPorDia.push(count);
    }
    
    const ctx = canvas.getContext('2d');
    graficoTendenciaInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dias,
            datasets: [{
                label: 'Visitas',
                data: visitasPorDia,
                borderColor: '#8e44ad',
                backgroundColor: 'rgba(142, 68, 173, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// ============================================
// TABELAS
// ============================================
function atualizarAtivos() {
    const ativos = Object.values(acompanhantes).filter(a => a.status === 'presente');
    const tbody = document.querySelector('#tabelaAtivos tbody');
    if (!tbody) return;
    
    if (ativos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum ativo</td></tr>';
        return;
    }
    
    tbody.innerHTML = ativos.map(ac => {
        let tempoRestanteHTML = '<span style="color: var(--text-muted);">-</span>';
        
        if (ac.tipo === 'visita' && ac.duracaoVisita) {
            const agora = new Date();
            const [h, m, s] = ac.horaEntrada.split(':');
            const entrada = new Date();
            entrada.setHours(parseInt(h), parseInt(m), parseInt(s), 0);
            
            const decorrido = Math.floor((agora - entrada) / 60000);
            const duracaoTotal = ac.duracaoVisita;
            const restante = duracaoTotal - decorrido;
            const percentual = Math.min(100, Math.max(0, Math.floor((decorrido / duracaoTotal) * 100)));
            
            let cor = 'green';
            let alerta = '';
            if (restante <= 0) { cor = 'expired'; alerta = 'Expirado!'; }
            else if (restante <= 5) { cor = 'red'; alerta = 'Crítico'; }
            else if (restante <= 10) { cor = 'yellow'; alerta = 'Atenção'; }
            
            const minutos = Math.floor(restante);
            const segundos = Math.floor((restante - minutos) * 60);
            const tempoStr = restante > 0 ? `${minutos}:${String(segundos).padStart(2,'0')}` : '00:00';
            
            tempoRestanteHTML = `
                <div>
                    <span class="tempo-restante" style="color: ${restante <= 5 ? 'var(--danger)' : restante <= 10 ? 'var(--warning)' : 'var(--text)'};">
                        ${tempoStr} ${alerta ? `<small>(${alerta})</small>` : ''}
                    </span>
                    <button class="btn-extend" onclick="estenderVisita('${ac.id}')" title="Estender +15 min">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                    <div class="progress-bar">
                        <div class="fill ${cor}" style="width: ${percentual}%;"></div>
                    </div>
                </div>
            `;
        }
        
        return `
            <tr>
                <td><span class="badge ${ac.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                <td>${sanitizar(ac.nomeAcompanhante)}</td>
                <td>${sanitizar(ac.documento) || '-'}</td>
                <td>${sanitizar(ac.parentesco)}</td>
                <td>${sanitizar(ac.nomePaciente)}</td>
                <td>${sanitizar(ac.setor)}</td>
                <td>${sanitizar(ac.leito) || '-'}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td>${tempoRestanteHTML}</td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" onclick="abrirCracha('${ac.id}')" title="Imprimir Crachá" style="color: #1a6b7a;"><i class="fas fa-id-card"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
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
    const texto = document.getElementById('filtroTexto')?.value?.trim().toLowerCase();
    
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
    if (texto) {
        registros = registros.filter(ac => {
            const campos = [
                ac.nomeAcompanhante, ac.documento, ac.nomePaciente, ac.setor,
                ac.leito, ac.parentesco, ac.observacao, ac.recepcionistaEntrada, ac.recepcionistaSaida
            ];
            return campos.some(campo => campo && campo.toLowerCase().includes(texto));
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
// LIMITE DE ACOMPANHANTES POR LEITO
// ============================================
let bloqueioRigido = false; // padrão: apenas aviso

function verificarAcompanhanteAtivo(nomePaciente) {
    // Retorna o acompanhante ativo se já existir, ou null
    return Object.values(acompanhantes).find(ac => 
        ac.status === 'presente' && 
        ac.nomePaciente.toLowerCase() === nomePaciente.toLowerCase()
    );
}

function verificarLimiteAcompanhante(nomePaciente, callback) {
    const ativo = verificarAcompanhanteAtivo(nomePaciente);
    if (ativo) {
        const msg = `Já existe um acompanhante ativo para "${nomePaciente}":\n\n` +
                    `Nome: ${ativo.nomeAcompanhante}\n` +
                    `Tipo: ${ativo.tipo === 'visita' ? 'Visita' : 'Acompanhante'}\n` +
                    `Setor: ${ativo.setor}\n` +
                    `Leito: ${ativo.leito || '-'}\n` +
                    `Entrada: ${ativo.dataEntrada} ${ativo.horaEntrada}\n\n` +
                    (bloqueioRigido ? 'Não é permitido múltiplos acompanhantes para o mesmo paciente.' : 'Deseja continuar mesmo assim?');
        
        if (bloqueioRigido) {
            toast(msg, 'error');
            callback(false);
        } else {
            if (confirm(msg)) {
                callback(true);
            } else {
                callback(false);
            }
        }
    } else {
        callback(true);
    }
}

// ============================================
// FORMULÁRIOS
// ============================================
function registrarEntrada(e) {
    e.preventDefault();
    const nomePaciente = sanitizar(document.getElementById('acPaciente')?.value?.trim() || '');
    
    verificarLimiteAcompanhante(nomePaciente, (permitido) => {
        if (!permitido) return;
        
        const dados = {
            id: gerarId(), tipo: 'acompanhante',
            nomeAcompanhante: sanitizar(document.getElementById('acNome')?.value?.trim() || ''),
            documento: sanitizar(document.getElementById('acDocumento')?.value?.trim() || ''),
            telefone: sanitizar(document.getElementById('acTelefone')?.value?.trim() || ''),
            parentesco: document.getElementById('acParentesco')?.value || '',
            nomePaciente: nomePaciente,
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
            registrarLog('criar', `Acompanhante "${dados.nomeAcompanhante}" registrado para paciente "${dados.nomePaciente}".`, dados.id);
        }).catch(err => { console.error(err); toast('Erro.', 'error'); });
    });
}

// VISITA: status inicial 'presente', sem dataSaida definida

function registrarVisita(e) {
    e.preventDefault();
    const nomePaciente = sanitizar(document.getElementById('visPaciente')?.value?.trim() || '');
    
    verificarLimiteAcompanhante(nomePaciente, (permitido) => {
        if (!permitido) return;
        
        const duracao = parseInt(document.getElementById('visDuracao')?.value || 30);
        const [h, m, s] = horaAgora().split(':');
        const entrada = new Date(); entrada.setHours(parseInt(h), parseInt(m), parseInt(s), 0);
        entrada.setMinutes(entrada.getMinutes() + duracao);
        const horaPrevista = `${String(entrada.getHours()).padStart(2,'0')}:${String(entrada.getMinutes()).padStart(2,'0')}:${String(entrada.getSeconds()).padStart(2,'0')}`;
        
        const dados = {
            id: gerarId(), tipo: 'visita',
            nomeAcompanhante: sanitizar(document.getElementById('visNome')?.value?.trim() || ''),
            documento: sanitizar(document.getElementById('visDocumento')?.value?.trim() || ''),
            telefone: sanitizar(document.getElementById('visTelefone')?.value?.trim() || ''),
            parentesco: document.getElementById('visParentesco')?.value || '',
            nomePaciente: nomePaciente,
            setor: document.getElementById('visSetor')?.value || '',
            leito: sanitizar(document.getElementById('visLeito')?.value?.trim() || ''),
            dataEntrada: dataHoje(), horaEntrada: horaAgora(),
            dataSaida: null, horaSaida: horaPrevista,
            status: 'presente',
            recepcionistaEntrada: usuarioLogado?.nome || 'Sistema',
            recepcionistaSaida: null, trocas: [], observacao: '',
            duracaoVisita: duracao
        };
        
        db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
            toast('Visita registrada!');
            e.target.reset();
            registrarLog('criar', `Visita de "${dados.nomeAcompanhante}" registrada para paciente "${dados.nomePaciente}".`, dados.id);
        }).catch(err => { console.error(err); toast('Erro.', 'error'); });
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
        registrarLog('troca', `Troca: "${antigo.nomeAcompanhante}" substituído por "${document.getElementById('trocaNovoNome')?.value}".`, novoId);
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
        registrarLog('saida', `Saída registrada: "${atual.nomeAcompanhante}" - Motivo: ${motivo}.`, id);
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
            }).then(() => { 
                toast('Atualizado!'); 
                fecharModal(); 
                registrarLog('editar', `Registro "${ac.nomeAcompanhante}" editado.`, id);
            })
              .catch(err => { console.error(err); toast('Erro.', 'error'); });
        });
    }, 100);
}

function excluirRegistro(id) {
    const nome = acompanhantes[id]?.nomeAcompanhante || id;
    if (confirm('Excluir permanentemente?')) {
        db.ref('acompanhantes/' + id).remove()
            .then(() => {
                toast('Excluído!');
                registrarLog('excluir', `Registro "${nome}" excluído.`, id);
            })
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
                logoHospitalCache = c.logoHospital || null;
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
            if (c.bloqueioRigido !== undefined) {
    bloqueioRigido = c.bloqueioRigido;
    const chkBloqueio = document.getElementById('bloqueioRigido');
    if (chkBloqueio) chkBloqueio.checked = bloqueioRigido;
}
        }
    });
}

function comprimirImagem(file, maxWidth, maxHeight, qualidade = 0.6) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (maxHeight / height) * width;
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', qualidade));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function uploadLogo(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        toast('Imagem inválida.', 'error'); return;
    }
    
    const base64 = await comprimirImagem(file, 200, 80, 0.5); // logo pequena
    db.ref('configuracoes').update({ logoHospital: base64 }).then(() => {
        logoHospitalCache = base64;
        sessionStorage.setItem('hrpi_logo', base64); // cache local
        document.getElementById('sidebarLogo').innerHTML = `<img src="${base64}" alt="Logo">`;
        document.getElementById('loginLogo').innerHTML = `<img src="${base64}" alt="Logo">`;
        toast('Logo atualizada!');
        registrarLog('config', 'Logo atualizada.');
    });
}

async function uploadFundo(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        toast('Imagem inválida.', 'error'); return;
    }
    
    const base64 = await comprimirImagem(file, 1200, 800, 0.4); // fundo maior, mas comprimido
    db.ref('configuracoes').update({ fundoLogin: base64 }).then(() => {
        sessionStorage.setItem('hrpi_fundo', base64); // cache local
        aplicarFundoLogin(base64);
        toast('Fundo atualizado!');
        registrarLog('config', 'Fundo atualizado.');
    });
}

function removerLogo() {
    if (confirm('Remover logo?')) {
        db.ref('configuracoes').update({ logoHospital: null }).then(() => {
            logoHospitalCache = null;
            const sl = document.getElementById('sidebarLogo');
            const ll = document.getElementById('loginLogo');
            if (sl) sl.innerHTML = '<i class="fas fa-hospital-alt"></i>';
            if (ll) ll.innerHTML = '<span class="default-logo"><i class="fas fa-hospital-alt"></i></span>';
            toast('Logo removida.');
            registrarLog('config', 'Logo do sistema removida.');
        });
    }
}

function removerFundo() {
    if (confirm('Remover fundo?')) {
        db.ref('configuracoes').update({ fundoLogin: null }).then(() => {
            const ls = document.getElementById('loginScreen');
            if (ls) ls.style.removeProperty('--login-bg-image');
            toast('Fundo removido.');
            registrarLog('config', 'Fundo de login removido.');
        });
    }
}

function resetSenhaUsuario() {
    const userId = document.getElementById('selectUsuarioReset')?.value;
    if (!userId) { toast('Selecione um usuário.', 'error'); return; }
    if (confirm('Resetar senha para "123456"?')) {
        db.ref('usuarios/' + userId).update({ senha: '123456', primeiroAcesso: true })
            .then(() => {
                toast('Senha resetada!');
                registrarLog('usuario', `Senha do usuário "${userId}" resetada pelo admin.`);
            })
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
            registrarLog('usuario', `Novo usuário "${userData.usuario}" criado.`, novoId);
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
            }).then(() => { 
                toast('Atualizado!'); 
                fecharModal(); 
                carregarUsuarios();
                registrarLog('usuario', `Usuário "${u.usuario}" editado.`, id);
            });
        });
    });
}

function resetSenhaUser(id) {
    if (confirm('Resetar senha para "123456"?')) {
        db.ref('usuarios/' + id).update({ senha: '123456', primeiroAcesso: true })
            .then(() => { 
                toast('Senha resetada!'); 
                carregarUsuarios();
                registrarLog('usuario', `Senha do usuário "${id}" resetada.`);
            });
    }
}

function excluirUsuario(id) {
    if (confirm('Excluir permanentemente?')) {
        db.ref('usuarios/' + id).remove()
            .then(() => { 
                toast('Excluído!'); 
                carregarUsuarios(); 
                carregarSelectUsuarios();
                registrarLog('usuario', `Usuário "${id}" excluído.`);
            });
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
    const agora = new Date();
    agora.setHours(0,0,0,0); // hoje 00:00:00
    
    switch(tipo) {
        case 'diario':
            dataInicio = new Date(agora);
            dataFim = new Date(agora);
            dataFim.setHours(23,59,59,999);
            titulo = 'Diário';
            break;
        case 'semanal':
            const inicioSemana = new Date(agora);
            inicioSemana.setDate(agora.getDate() - 6); // últimos 7 dias (inclui hoje)
            dataInicio = new Date(inicioSemana);
            dataFim = new Date(agora);
            dataFim.setHours(23, 59, 59, 999);
            titulo = 'Semanal';
            break;
        case 'mensal':
            dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
            dataFim = new Date(agora);
            dataFim.setHours(23,59,59,999);
            titulo = 'Mensal';
            break;
        case 'personalizado':
            const ini = document.getElementById('dataInicioPersonalizado')?.value;
            const fim = document.getElementById('dataFimPersonalizado')?.value;
            if (!ini || !fim) { toast('Selecione datas.', 'error'); return; }
            dataInicio = new Date(ini + 'T00:00:00');
            dataFim = new Date(fim + 'T23:59:59');
            titulo = 'Personalizado';
            break;
    }
    
    const formatar = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    const strInicio = formatar(dataInicio);
    const strFim = formatar(dataFim);
    
    db.ref('configuracoes/logoHospital').once('value').then(snapLogo => {
        if (snapLogo.val()) try { doc.addImage(snapLogo.val(), 'PNG', 10, 8, 22, 22); } catch(e) {}
        
        // Cabeçalho
        doc.setFontSize(16); doc.setTextColor(26, 107, 122);
        doc.setFont('helvetica', 'bold');
        doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS', 148, 15, { align: 'center' });
        doc.setFontSize(11); doc.setTextColor(100);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistema de Controle de Recepção', 148, 22, { align: 'center' });
        doc.setFontSize(13); doc.setTextColor(0);
        doc.text(`Relatório ${titulo}: ${strInicio} a ${strFim}`, 148, 30, { align: 'center' });
        
        // Filtrar dados
        let dados = Object.values(acompanhantes).filter(ac => {
            const [d, m, a] = ac.dataEntrada.split('-');
            const dataRegistro = new Date(a, m-1, d);
            return dataRegistro >= dataInicio && dataRegistro <= dataFim;
        });
        
        dados.sort((a, b) => {
            const da = new Date(a.dataEntrada.split('-')[2], a.dataEntrada.split('-')[1]-1, a.dataEntrada.split('-')[0]);
            const db = new Date(b.dataEntrada.split('-')[2], b.dataEntrada.split('-')[1]-1, b.dataEntrada.split('-')[0]);
            return db - da || b.horaEntrada.localeCompare(a.horaEntrada);
        });
        
        // ========== ESTATÍSTICAS ==========
        const totalGeral = dados.length;
        const totalAcompanhantes = dados.filter(ac => ac.tipo === 'acompanhante').length;
        const totalVisitas = dados.filter(ac => ac.tipo === 'visita').length;
        const totalPresentes = dados.filter(ac => ac.status === 'presente').length;
        const totalSaiu = dados.filter(ac => ac.status === 'saiu').length;
        const totalTrocado = dados.filter(ac => ac.status === 'trocado').length;
        
        // Linha decorativa
        doc.setDrawColor(26, 107, 122);
        doc.setLineWidth(0.3);
        doc.line(14, 34, 283, 34);
        
        // Bloco de estatísticas
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO DO PERÍODO', 14, 40);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        const statsY = 47;
        const col1 = 14;
        const col2 = 100;
        const col3 = 190;
        
        doc.text(`Total Geral de Registros: ${totalGeral}`, col1, statsY);
        doc.text(`Acompanhantes: ${totalAcompanhantes}`, col2, statsY);
        doc.text(`Visitas: ${totalVisitas}`, col3, statsY);
        
        doc.text(`Presentes: ${totalPresentes}`, col1, statsY + 7);
        doc.text(`Saídas: ${totalSaiu}`, col2, statsY + 7);
        doc.text(`Trocas: ${totalTrocado}`, col3, statsY + 7);
        
        // Linha após estatísticas
        doc.setDrawColor(200);
        doc.line(14, statsY + 13, 283, statsY + 13);
        
        // ========== TABELA ==========
        doc.autoTable({
            startY: statsY + 17,
            head: [['Tipo', 'Nome', 'Doc', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Entrada', 'Saída', 'Status']],
            body: dados.map(ac => [
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
            ]),
            styles: { fontSize: 7 },
            headStyles: { fillColor: [26, 107, 122], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [232, 244, 247] },
            margin: { left: 14, right: 14 }
        });
        
        // Rodapé com data de geração
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.setFont('helvetica', 'italic');
        const dataGeracao = new Date().toLocaleString('pt-BR');
        doc.text(`Documento gerado em: ${dataGeracao} — Total de registros: ${totalGeral}`, 148, finalY, { align: 'center' });
        
        doc.save(`HRPI_${titulo}_${formatar(agora)}.pdf`);
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

// ============================================
// BUSCA RÁPIDA GLOBAL
// ============================================
function inicializarBuscaGlobal() {
    const globalSearchInput = document.getElementById('globalSearchInput');
    const searchResults = document.getElementById('searchResults');

    if (!globalSearchInput || !searchResults) {
        console.warn('⚠️ Elementos da busca global não encontrados');
        return;
    }

    console.log('✅ Barra de busca global ativada');

    globalSearchInput.addEventListener('input', function() {
        const termo = this.value.trim().toLowerCase();
        
        if (termo.length < 2) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            return;
        }
        
        const resultados = Object.values(acompanhantes).filter(ac => {
            const campos = [
                ac.nomeAcompanhante,
                ac.documento,
                ac.nomePaciente,
                ac.setor,
                ac.leito,
                ac.parentesco,
                ac.observacao
            ];
            return campos.some(campo => campo && campo.toLowerCase().includes(termo));
        });
        
        if (resultados.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item" style="justify-content:center;color:var(--text-muted);">Nenhum resultado encontrado</div>';
        } else {
            searchResults.innerHTML = resultados.slice(0, 10).map(ac => `
                <div class="search-result-item" onclick="selecionarItemBusca('${ac.id}')">
                    <div class="info">
                        <span class="name">${sanitizar(ac.nomeAcompanhante)}</span>
                        <span class="detail">${sanitizar(ac.nomePaciente)} • ${sanitizar(ac.setor)} ${ac.leito ? '• Leito ' + sanitizar(ac.leito) : ''}</span>
                    </div>
                    <span class="badge ${ac.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span>
                </div>
            `).join('');
        }
        searchResults.style.display = 'block';
    });
    
    document.addEventListener('click', function(e) {
        const searchBox = document.getElementById('searchBox');
        if (searchBox && !searchBox.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
    
    globalSearchInput.addEventListener('blur', function() {
        setTimeout(() => {
            searchResults.style.display = 'none';
        }, 200);
    });
}

function selecionarItemBusca(id) {
    const searchResults = document.getElementById('searchResults');
    const globalSearchInput = document.getElementById('globalSearchInput');
    
    if (searchResults) searchResults.style.display = 'none';
    if (globalSearchInput) globalSearchInput.value = '';
    
    const ac = acompanhantes[id];
    if (ac) {
        navegarPara('historico');
        setTimeout(() => {
            const campoTexto = document.getElementById('filtroTexto');
            if (campoTexto) {
                campoTexto.value = ac.nomeAcompanhante;
            }
            filtrarHistorico();
        }, 300);
    }
}

// ============================================
// IMPRESSÃO DE CRACHÁ
// ============================================
function abrirCracha(id) {
    const ac = acompanhantes[id];
    if (!ac) {
        toast('Registro não encontrado.', 'error');
        return;
    }
    
    const modal = document.getElementById('badgeModal');
    const content = document.getElementById('badgeContent');
    
    if (!modal || !content) {
        console.error('❌ Modal de crachá não encontrado');
        return;
    }
    
    const logoHTML = logoHospitalCache
        ? `<img src="${logoHospitalCache}" alt="Logo">`
        : '<i class="fas fa-hospital-alt"></i>';
    
    content.innerHTML = `
        <div class="cracha-container">
            <div class="cracha-logo">${logoHTML}</div>
            <div class="cracha-titulo">Hospital Regional de Palmeira dos Índios</div>
            <div class="cracha-subtitulo">Controle de Recepção</div>
            
            <div class="cracha-nome">${sanitizar(ac.nomeAcompanhante)}</div>
            <span class="cracha-tipo-badge">${ac.tipo === 'visita' ? 'VISITANTE' : 'ACOMPANHANTE'}</span>
            
            <div class="cracha-info">
                <div class="campo">
                    <strong>Paciente</strong>
                    <span>${sanitizar(ac.nomePaciente)}</span>
                </div>
                <div class="campo">
                    <strong>Setor</strong>
                    <span>${sanitizar(ac.setor)}</span>
                </div>
                <div class="campo">
                    <strong>Leito</strong>
                    <span>${sanitizar(ac.leito) || '-'}</span>
                </div>
                <div class="campo">
                    <strong>Entrada</strong>
                    <span>${ac.dataEntrada} ${ac.horaEntrada}</span>
                </div>
            </div>
            
            <div class="cracha-codigo">
                <i class="fas fa-barcode"></i>
                ${ac.id}
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function imprimirCracha() {
    const modal = document.getElementById('badgeModal');
    if (!modal) return;
    
    modal.style.display = '';
    modal.classList.add('active');
    
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }, 500);
    }, 100);
}

// ============================================
// AUTO-SUGESTÃO DE PACIENTES
// ============================================
let listaPacientesUnicos = [];

function atualizarListaPacientes() {
    const pacientesMap = new Map();
    
    Object.values(acompanhantes).forEach(ac => {
        if (ac.nomePaciente) {
            const nome = ac.nomePaciente.trim();
            if (!pacientesMap.has(nome)) {
                pacientesMap.set(nome, {
                    nome: nome,
                    setor: ac.setor || '',
                    leito: ac.leito || ''
                });
            }
        }
    });
    
    listaPacientesUnicos = Array.from(pacientesMap.values());
    listaPacientesUnicos.sort((a, b) => a.nome.localeCompare(b.nome));
}

function configurarAutocompletePaciente(inputId, sugestoesId, setorId = null, leitoId = null) {
    const input = document.getElementById(inputId);
    const sugestoesDiv = document.getElementById(sugestoesId);
    
    if (!input || !sugestoesDiv) return;
    
    const formGroup = input.closest('.form-group');
    if (formGroup) {
        formGroup.style.position = 'relative';
    }
    
    input.addEventListener('input', function() {
        const termo = this.value.trim().toLowerCase();
        
        if (termo.length < 2) {
            sugestoesDiv.style.display = 'none';
            sugestoesDiv.innerHTML = '';
            return;
        }
        
        const sugestoes = listaPacientesUnicos.filter(p => 
            p.nome.toLowerCase().includes(termo)
        );
        
        if (sugestoes.length === 0) {
            sugestoesDiv.style.display = 'none';
            sugestoesDiv.innerHTML = '';
            return;
        }
        
        sugestoesDiv.innerHTML = sugestoes.slice(0, 8).map(p => `
            <div class="sugestao-item" data-nome="${sanitizar(p.nome)}" data-setor="${sanitizar(p.setor)}" data-leito="${sanitizar(p.leito)}">
                <span class="paciente-nome">${sanitizar(p.nome)}</span>
                <span class="paciente-info">${p.setor ? sanitizar(p.setor) : ''} ${p.leito ? '· Leito ' + sanitizar(p.leito) : ''}</span>
            </div>
        `).join('');
        
        sugestoesDiv.style.display = 'block';
        
        sugestoesDiv.querySelectorAll('.sugestao-item').forEach(item => {
            item.addEventListener('click', function() {
                const nome = this.getAttribute('data-nome');
                const setor = this.getAttribute('data-setor');
                const leito = this.getAttribute('data-leito');
                
                input.value = nome;
                sugestoesDiv.style.display = 'none';
                
                if (setorId && setor) {
                    const setorEl = document.getElementById(setorId);
                    if (setorEl && setorEl.tagName === 'SELECT') {
                        const option = Array.from(setorEl.options).find(o => o.value === setor);
                        if (option) setorEl.value = setor;
                    }
                }
                if (leitoId && leito) {
                    const leitoEl = document.getElementById(leitoId);
                    if (leitoEl) leitoEl.value = leito;
                }
            });
        });
    });
    
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !sugestoesDiv.contains(e.target)) {
            sugestoesDiv.style.display = 'none';
        }
    });
    
    input.addEventListener('blur', function() {
        setTimeout(() => {
            sugestoesDiv.style.display = 'none';
        }, 200);
    });
}

function inicializarAutocompletePacientes() {
    configurarAutocompletePaciente('acPaciente', 'sugestoesAcPaciente', 'acSetor', 'acLeito');
    configurarAutocompletePaciente('visPaciente', 'sugestoesVisPaciente', 'visSetor', 'visLeito');
}

// ============================================
// CARREGAR E EXIBIR LOGS
// ============================================
function carregarLogs() {
    db.ref('logs').once('value').then(snap => {
        const logs = snap.val() || {};
        const arrayLogs = Object.values(logs);
        arrayLogs.sort((a, b) => b.dataHora.localeCompare(a.dataHora));
        renderizarTabelaLogs(arrayLogs);
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
            logs = logs.filter(log => {
                const [d, h] = log.dataHora.split(' ');
                const [dd, mm, aa] = d.split('-');
                return new Date(aa, mm-1, dd) >= new Date(inicio + 'T00:00:00');
            });
        }
        if (fim) {
            logs = logs.filter(log => {
                const [d, h] = log.dataHora.split(' ');
                const [dd, mm, aa] = d.split('-');
                return new Date(aa, mm-1, dd) <= new Date(fim + 'T23:59:59');
            });
        }
        if (usuario) {
            logs = logs.filter(log => log.usuarioId === usuario);
        }
        if (acao) {
            logs = logs.filter(log => log.acao === acao);
        }
        
        logs.sort((a, b) => b.dataHora.localeCompare(a.dataHora));
        renderizarTabelaLogs(logs);
    });
}

function renderizarTabelaLogs(logs) {
    const tbody = document.querySelector('#tabelaLogs tbody');
    if (!tbody) return;
    
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum log encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${log.dataHora}</td>
            <td>${sanitizar(log.usuario)}</td>
            <td><span class="log-destaque log-acao-${log.acao}">${log.acao.toUpperCase()}</span></td>
            <td>${sanitizar(log.descricao)}</td>
            <td style="font-size:11px;color:var(--text-muted);">${log.registroId ? log.registroId.substring(0, 12) + '...' : '-'}</td>
        </tr>
    `).join('');
}

function carregarUsuariosFiltroLogs() {
    db.ref('usuarios').once('value').then(snap => {
        const sel = document.getElementById('filtroLogUsuario');
        if (!sel) return;
        const usuarios = snap.val() || {};
        sel.innerHTML = '<option value="">Todos os Usuários</option>' +
            Object.entries(usuarios).map(([key, u]) => `<option value="${key}">${sanitizar(u.nome)}</option>`).join('');
    });
}

// ============================================
// EXPORTAR EXCEL (CSV)
// ============================================
function exportarExcel() {
    // Usa os mesmos filtros do histórico
    const inicio = document.getElementById('filtroDataInicio')?.value;
    const fim = document.getElementById('filtroDataFim')?.value;
    const status = document.getElementById('filtroStatus')?.value;
    const tipo = document.getElementById('filtroTipo')?.value;
    const texto = document.getElementById('filtroTexto')?.value?.trim().toLowerCase();
    
    let registros = Object.values(acompanhantes);
    if (status) registros = registros.filter(a => a.status === status);
    if (tipo) registros = registros.filter(a => a.tipo === tipo);
    if (inicio) registros = registros.filter(a => new Date(a.dataEntrada.split('-')[2], a.dataEntrada.split('-')[1]-1, a.dataEntrada.split('-')[0]) >= new Date(inicio+'T00:00:00'));
    if (fim) registros = registros.filter(a => new Date(a.dataEntrada.split('-')[2], a.dataEntrada.split('-')[1]-1, a.dataEntrada.split('-')[0]) <= new Date(fim+'T23:59:59'));
    if (texto) registros = registros.filter(a => ['nomeAcompanhante','documento','nomePaciente','setor','leito','parentesco','observacao'].some(c => a[c] && a[c].toLowerCase().includes(texto)));
    
    // Criar CSV
    let csv = 'Tipo;Nome;Documento;Parentesco;Paciente;Setor;Leito;Entrada;Saída;Status\n';
    registros.forEach(ac => {
        csv += `${ac.tipo};"${ac.nomeAcompanhante}";"${ac.documento||''}";"${ac.parentesco}";"${ac.nomePaciente}";"${ac.setor}";"${ac.leito||''}";"${ac.dataEntrada} ${ac.horaEntrada}";"${ac.dataSaida?ac.dataSaida+' '+ac.horaSaida:''}";"${ac.status}"\n`;
    });
    
    // Download
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HRPI_export_${dataHoje()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`${registros.length} registro(s) exportado(s)!`);
}

console.log('✅ HRPI - Sistema carregado!');
