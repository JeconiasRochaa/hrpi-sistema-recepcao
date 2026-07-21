// ============================================
// HRPI - SISTEMA DE CONTROLE DE RECEPÇÃO
// script.js - VERSÃO CORRIGIDA E COMPLETA
// ============================================

// Inicializar Firebase
try { 
    firebase.initializeApp(firebaseConfig); 
    console.log('✅ Firebase inicializado com sucesso!'); 
} catch (error) { 
    console.error('❌ Erro ao inicializar Firebase:', error); 
}

const db = firebase.database();

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let usuarioLogado = null;
let acompanhantes = {};
let bloqueios = {};
let logoHospitalCache = null;
let fundoCarregado = false;
let bloqueioRigido = false;

// ============================================
// CONFIGURAÇÕES
// ============================================
const CONFIG = {
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutos
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutos
    MIN_PASSWORD_LENGTH: 6
};

// ============================================
// FUNÇÕES UTILITÁRIAS
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
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function registrarLog(acao, descricao, registroId = null) {
    if (!usuarioLogado) return;
    const log = {
        id: gerarId(),
        dataHora: `${dataHoje()} ${horaAgora()}`,
        usuario: usuarioLogado.nome,
        usuarioId: usuarioLogado.id,
        acao: acao,
        descricao: descricao,
        registroId: registroId || ''
    };
    db.ref('logs/' + log.id).set(log).catch(err => console.error('Erro ao registrar log:', err));
}

// ============================================
// FUNÇÃO DE HASH SIMPLES PARA SENHAS
// ============================================
function hashSenha(senha) {
    let hash = 0;
    for (let i = 0; i < senha.length; i++) {
        const char = senha.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'hash_' + Math.abs(hash).toString(16);
}

// ============================================
// INICIALIZAÇÃO DO DOM
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🟢 DOM Carregado - Inicializando sistema...');
    
    atualizarDataAtual();
    carregarConfiguracoes();
    
    // Event listeners de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', fazerLogin);
    
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) changePasswordForm.addEventListener('submit', trocarSenhaPrimeiroAcesso);
    
    // Navegação da sidebar
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
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            document.getElementById('sidebar').classList.add('open');
            document.getElementById('sidebarOverlay').classList.add('active');
        });
    }
    
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            document.getElementById('sidebar').classList.remove('open');
            this.classList.remove('active');
        });
    }
    
    // Logout e tema
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Deseja realmente sair do sistema?')) logout();
        });
    }
    
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTema);
    
    // Modal genérico - fechar ao clicar no overlay
    const genericModal = document.getElementById('genericModal');
    if (genericModal) {
        genericModal.addEventListener('click', function(e) {
            if (e.target === this) fecharModal();
        });
    }
    
    // Modal de primeiro acesso - fechar ao clicar no overlay
    const firstAccessModal = document.getElementById('firstAccessModal');
    if (firstAccessModal) {
        firstAccessModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                // Voltar para a tela de login
                document.getElementById('loginScreen').classList.remove('hidden');
                usuarioLogado = null;
            }
        });
    }
    
    // Modal de crachá - fechar ao clicar no overlay
    const badgeModal = document.getElementById('badgeModal');
    if (badgeModal) {
        badgeModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                this.classList.remove('active');
            }
        });
    }
    
    // Configurações - eventos de upload
    const uploadLogo = document.getElementById('uploadLogo');
    if (uploadLogo) uploadLogo.addEventListener('change', uploadLogoHandler);
    
    const uploadFundo = document.getElementById('uploadFundo');
    if (uploadFundo) uploadFundo.addEventListener('change', uploadFundoHandler);
    
    const btnRemoverLogo = document.getElementById('btnRemoverLogo');
    if (btnRemoverLogo) btnRemoverLogo.addEventListener('click', removerLogo);
    
    const btnRemoverFundo = document.getElementById('btnRemoverFundo');
    if (btnRemoverFundo) btnRemoverFundo.addEventListener('click', removerFundo);
    
    const btnResetSenha = document.getElementById('btnResetSenha');
    if (btnResetSenha) btnResetSenha.addEventListener('click', resetSenhaUsuario);
    
    const btnNovoUsuario = document.getElementById('btnNovoUsuario');
    if (btnNovoUsuario) btnNovoUsuario.addEventListener('click', abrirModalNovoUsuario);
    
    const btnNovoBloqueio = document.getElementById('btnNovoBloqueio');
    if (btnNovoBloqueio) btnNovoBloqueio.addEventListener('click', abrirModalNovoBloqueio);
    
    // Formulários principais
    const formEntrada = document.getElementById('formEntradaAcompanhante');
    if (formEntrada) formEntrada.addEventListener('submit', registrarEntrada);
    
    const formVisita = document.getElementById('formVisita');
    if (formVisita) formVisita.addEventListener('submit', registrarVisita);
    
    const formTroca = document.getElementById('formTroca');
    if (formTroca) formTroca.addEventListener('submit', registrarTroca);
    
    const formSaida = document.getElementById('formSaida');
    if (formSaida) formSaida.addEventListener('submit', registrarSaida);
    
    // Eventos de change para selects
    const saidaAcompanhante = document.getElementById('saidaAcompanhante');
    if (saidaAcompanhante) saidaAcompanhante.addEventListener('change', atualizarInfoSaida);
    
    const trocaAcompanhanteAtual = document.getElementById('trocaAcompanhanteAtual');
    if (trocaAcompanhanteAtual) trocaAcompanhanteAtual.addEventListener('change', atualizarInfoTroca);
    
    // Botões de filtro
    const btnFiltrar = document.getElementById('btnFiltrar');
    if (btnFiltrar) btnFiltrar.addEventListener('click', filtrarHistorico);
    
    const btnFiltrarLogs = document.getElementById('btnFiltrarLogs');
    if (btnFiltrarLogs) btnFiltrarLogs.addEventListener('click', filtrarLogs);
    
    const btnExportarExcel = document.getElementById('btnExportarExcel');
    if (btnExportarExcel) btnExportarExcel.addEventListener('click', exportarExcel);
    
    // Bloqueio rígido
    const chkBloqueio = document.getElementById('bloqueioRigido');
    if (chkBloqueio) {
        chkBloqueio.addEventListener('change', function() {
            bloqueioRigido = this.checked;
            db.ref('configuracoes').update({ bloqueioRigido: this.checked });
        });
    }
    
    // Inicializar sistema
    verificarSessao();
    carregarSelectUsuarios();
    inicializarBuscaGlobal();
    
    console.log('✅ Sistema inicializado com sucesso!');
});

// ============================================
// SISTEMA DE LOGIN - CORRIGIDO
// ============================================
let loginAttempts = 0;
let lockoutUntil = null;

function fazerLogin(e) {
    e.preventDefault();
    console.log('🔐 Tentativa de login...');
    
    // Verificar bloqueio por tentativas
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const min = Math.ceil((lockoutUntil - Date.now()) / 60000);
        const erroDiv = document.getElementById('loginError');
        if (erroDiv) {
            erroDiv.textContent = `Conta bloqueada. Tente novamente em ${min} minuto(s).`;
            erroDiv.style.display = 'block';
        }
        return;
    }
    
    const usuario = document.getElementById('username').value.trim();
    const senha = document.getElementById('password').value;
    const erroDiv = document.getElementById('loginError');
    const btnLogin = document.querySelector('.btn-login');
    
    if (!usuario || !senha) {
        if (erroDiv) {
            erroDiv.textContent = 'Preencha todos os campos.';
            erroDiv.style.display = 'block';
        }
        return;
    }
    
    // Desabilitar botão durante o login
    if (btnLogin) {
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<span class="spinner"></span> Entrando...';
    }
    
    console.log('📡 Buscando usuários no Firebase...');
    
    db.ref('usuarios').once('value').then(snapshot => {
        const usuarios = snapshot.val();
        console.log('📦 Usuários encontrados:', usuarios ? Object.keys(usuarios).length : 0);
        
        if (!usuarios) {
            if (erroDiv) {
                erroDiv.textContent = 'Nenhum usuário cadastrado no sistema.';
                erroDiv.style.display = 'block';
            }
            resetarBtnLogin();
            return;
        }
        
        let userEncontrado = null;
        for (const [key, user] of Object.entries(usuarios)) {
            console.log(`   Verificando: ${user.usuario} (${user.cargo}) - Ativo: ${user.ativo}`);
            
            if (user.usuario === usuario && user.senha === senha) {
                if (user.ativo === false) {
                    console.log('   ⚠️ Usuário INATIVO!');
                    continue;
                }
                userEncontrado = { ...user, id: key };
                console.log('   ✅ USUÁRIO ENCONTRADO!');
                break;
            }
        }
        
        if (!userEncontrado) {
            loginAttempts++;
            console.log('❌ Usuário não encontrado ou senha incorreta');
            
            if (erroDiv) {
                erroDiv.textContent = 'Usuário ou senha inválidos.';
                erroDiv.style.display = 'block';
            }
            
            if (loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                lockoutUntil = Date.now() + CONFIG.LOCKOUT_TIME;
                if (erroDiv) {
                    erroDiv.textContent = 'Conta bloqueada por 15 minutos devido a múltiplas tentativas.';
                    erroDiv.style.display = 'block';
                }
                loginAttempts = 0;
            }
            resetarBtnLogin();
            return;
        }
        
        // Login bem-sucedido
        loginAttempts = 0;
        console.log('🎉 Login bem-sucedido! Cargo:', userEncontrado.cargo);
        
        // VERIFICAÇÃO DE PRIMEIRO ACESSO
        if (userEncontrado.primeiroAcesso === true) {
            console.log('🔑 PRIMEIRO ACESSO DETECTADO! Abrindo modal de troca de senha...');
            
            // Salvar usuário temporariamente
            usuarioLogado = userEncontrado;
            
            // Esconder tela de login
            document.getElementById('loginScreen').classList.add('hidden');
            
            // Mostrar modal de troca de senha
            const modal = document.getElementById('firstAccessModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('active');
                console.log('✅ Modal de troca de senha exibido');
            } else {
                console.error('❌ Modal firstAccessModal não encontrado no DOM!');
            }
            
            resetarBtnLogin();
            return;
        }
        
        // Login normal (sem primeiro acesso)
        completarLogin(userEncontrado);
        resetarBtnLogin();
        
    }).catch((error) => {
        console.error('🔥 Erro no Firebase:', error);
        if (erroDiv) {
            erroDiv.textContent = 'Erro de conexão. Verifique sua internet.';
            erroDiv.style.display = 'block';
        }
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

// ============================================
// TROCA DE SENHA NO PRIMEIRO ACESSO
// ============================================
function trocarSenhaPrimeiroAcesso(e) {
    e.preventDefault();
    console.log('🔑 Processando troca de senha...');
    
    const novaSenha = document.getElementById('newPassword').value;
    const confirma = document.getElementById('confirmPassword').value;
    const erroDiv = document.getElementById('passwordError');
    
    // Esconder erro anterior
    if (erroDiv) erroDiv.style.display = 'none';
    
    // Validações
    if (!novaSenha || !confirma) {
        if (erroDiv) {
            erroDiv.textContent = 'Preencha todos os campos.';
            erroDiv.style.display = 'block';
        }
        return;
    }
    
    if (novaSenha !== confirma) {
        if (erroDiv) {
            erroDiv.textContent = 'As senhas não conferem. Digite novamente.';
            erroDiv.style.display = 'block';
        }
        return;
    }
    
    if (novaSenha.length < CONFIG.MIN_PASSWORD_LENGTH) {
        if (erroDiv) {
            erroDiv.textContent = `A senha deve ter no mínimo ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
            erroDiv.style.display = 'block';
        }
        return;
    }
    
    if (!usuarioLogado || !usuarioLogado.id) {
        console.error('❌ usuarioLogado não está definido!');
        if (erroDiv) {
            erroDiv.textContent = 'Erro de sessão. Faça login novamente.';
            erroDiv.style.display = 'block';
        }
        return;
    }
    
    console.log('💾 Salvando nova senha para usuário ID:', usuarioLogado.id);
    
    // Atualizar no Firebase
    db.ref('usuarios/' + usuarioLogado.id).update({
        senha: novaSenha,
        primeiroAcesso: false
    }).then(() => {
        console.log('✅ Senha atualizada com sucesso!');
        
        // Atualizar dados locais
        usuarioLogado.senha = novaSenha;
        usuarioLogado.primeiroAcesso = false;
        
        // Fechar modal de troca de senha
        document.getElementById('firstAccessModal').style.display = 'none';
        document.getElementById('firstAccessModal').classList.remove('active');
        
        // Mostrar sistema principal
        document.getElementById('mainSystem').classList.add('active');
        
        // Completar login
        completarLogin(usuarioLogado);
        
        toast('Senha criada com sucesso! Bem-vindo(a) ao sistema.');
        registrarLog('usuario', `Usuário "${usuarioLogado.nome}" criou nova senha no primeiro acesso.`);
        
    }).catch((error) => {
        console.error('❌ Erro ao salvar senha:', error);
        if (erroDiv) {
            erroDiv.textContent = 'Erro ao salvar. Tente novamente.';
            erroDiv.style.display = 'block';
        }
    });
}

// ============================================
// COMPLETAR LOGIN - COM VERIFICAÇÃO DE PERMISSÕES
// ============================================
function completarLogin(user) {
    console.log('✅ Completando login para:', user.nome, '| Cargo:', user.cargo, '| ID:', user.id);
    
    usuarioLogado = user;
    
    // Salvar sessão
    sessionStorage.setItem('hrpi_session', JSON.stringify({
        id: user.id,
        nome: user.nome,
        cargo: user.cargo,
        timestamp: Date.now()
    }));
    
    // Esconder login e mostrar sistema
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainSystem').classList.add('active');
    
    // Nome do usuário na sidebar
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = user.nome;
    
    // ============================================
    // VERIFICAÇÃO DE PERMISSÕES POR CARGO
    // ============================================
    const cargo = user.cargo;
    const isAdmin = (cargo === 'Administrador' || cargo === 'Supervisor');
    const isServicoSocial = (cargo === 'Serviço Social');
    const isRecepcionista = (cargo === 'Recepcionista');
    
    console.log('🔑 Configurando permissões:');
    console.log('   Admin/Supervisor:', isAdmin);
    console.log('   Serviço Social:', isServicoSocial);
    console.log('   Recepcionista:', isRecepcionista);
    
    // ============================================
    // LIMPAR TUDO PRIMEIRO (garantir estado limpo)
    // ============================================
    document.querySelectorAll('.social-admin, .admin-exclusive').forEach(el => {
        el.style.display = 'none';
    });
    
    // ============================================
    // APLICAR PERMISSÕES
    // ============================================
    
    if (isAdmin) {
        // ADMIN/SUPERVISOR: Ver TUDO
        document.querySelectorAll('.social-admin, .admin-exclusive').forEach(el => {
            el.style.display = '';
        });
        console.log('   ✅ Admin/Supervisor: Acesso TOTAL');
    } 
    else if (isServicoSocial) {
        // SERVIÇO SOCIAL: Ver Bloqueios e Relatórios (social-admin)
        document.querySelectorAll('.social-admin').forEach(el => {
            el.style.display = '';
        });
        // Garantir que admin-exclusive continue escondido
        document.querySelectorAll('.admin-exclusive').forEach(el => {
            el.style.display = 'none';
        });
        console.log('   ✅ Serviço Social: Painel + Acomp. Ativos + Histórico + Bloqueios + Relatórios');
    }
    else if (isRecepcionista) {
        // RECEPCIONISTA: NÃO ver nada de admin
        document.querySelectorAll('.social-admin, .admin-exclusive').forEach(el => {
            el.style.display = 'none';
        });
        console.log('   ✅ Recepcionista: Apenas menu principal');
    }
    
    // Iniciar listeners do Firebase
    iniciarSistema();
    
    // Navegar para o dashboard
    navegarPara('dashboard');
    
    toast(`Bem-vindo(a), ${user.nome}!`);
    registrarLog('login', `Usuário "${user.nome}" (${user.cargo}) fez login no sistema.`);
}
// ============================================
// LOGOUT
// ============================================
function logout() {
    if (usuarioLogado) {
        registrarLog('logout', `Usuário "${usuarioLogado.nome}" saiu do sistema.`);
    }
    
    sessionStorage.removeItem('hrpi_session');
    usuarioLogado = null;
    
    document.getElementById('mainSystem').classList.remove('active');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('firstAccessModal').style.display = 'none';
    document.getElementById('firstAccessModal').classList.remove('active');
    document.getElementById('loginForm').reset();
    
    const erroDiv = document.getElementById('loginError');
    if (erroDiv) {
        erroDiv.textContent = '';
        erroDiv.style.display = 'none';
    }
    
    // Limpar campos de senha
    document.getElementById('newPassword') && (document.getElementById('newPassword').value = '');
    document.getElementById('confirmPassword') && (document.getElementById('confirmPassword').value = '');
}

// ============================================
// VERIFICAÇÃO DE SESSÃO
// ============================================
function verificarSessao() {
    const data = sessionStorage.getItem('hrpi_session');
    if (data) {
        try {
            const sessao = JSON.parse(data);
            if (Date.now() - sessao.timestamp < CONFIG.SESSION_TIMEOUT) {
                db.ref('usuarios/' + sessao.id).once('value').then(snap => {
                    const user = snap.val();
                    if (user && user.ativo !== false) {
                        if (user.primeiroAcesso === true) {
                            // Ainda precisa trocar senha
                            usuarioLogado = { ...user, id: sessao.id };
                            document.getElementById('loginScreen').classList.add('hidden');
                            document.getElementById('firstAccessModal').style.display = 'flex';
                            document.getElementById('firstAccessModal').classList.add('active');
                        } else {
                            completarLogin({ ...user, id: sessao.id });
                        }
                    } else {
                        sessionStorage.removeItem('hrpi_session');
                    }
                }).catch(() => {
                    sessionStorage.removeItem('hrpi_session');
                });
            } else {
                sessionStorage.removeItem('hrpi_session');
                console.log('⏰ Sessão expirada');
            }
        } catch (e) {
            sessionStorage.removeItem('hrpi_session');
        }
    }
}

// ============================================
// NAVEGAÇÃO ENTRE PÁGINAS
// ============================================
function navegarPara(pageName) {
    // Desativar todas as páginas e links
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    
    // Ativar a página selecionada
    const page = document.getElementById(pageName);
    if (page) page.classList.add('active');
    
    // Ativar o link na sidebar
    const navLink = document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`);
    if (navLink) navLink.classList.add('active');
    
    // Carregar dados específicos da página
    switch(pageName) {
        case 'usuarios':
            carregarUsuarios();
            break;
        case 'acompanhantesAtivos':
            atualizarAtivos();
            break;
        case 'historico':
            atualizarHistorico();
            break;
        case 'bloqueios':
            carregarBloqueios();
            break;
        case 'logs':
            carregarLogs();
            carregarUsuariosFiltroLogs();
            break;
        case 'configuracoes':
            carregarSelectUsuarios();
            break;
    }
}

// ============================================
// INICIALIZAÇÃO DO SISTEMA (FIREBASE LISTENERS)
// ============================================
function iniciarSistema() {
    // Listener para acompanhantes
    db.ref('acompanhantes').on('value', snapshot => {
        acompanhantes = snapshot.val() || {};
        atualizarDashboard();
        atualizarAtivos();
        atualizarHistorico();
        atualizarSelects();
        
        // Gráficos apenas para admin/supervisor
        if (usuarioLogado && (usuarioLogado.cargo === 'Administrador' || usuarioLogado.cargo === 'Supervisor')) {
            atualizarGraficos();
        }
        
        atualizarListaPacientes();
    });
    
    // Listener para bloqueios
    db.ref('bloqueios').on('value', snapshot => {
        bloqueios = snapshot.val() || {};
    });
    
    // Inicializar autocomplete de pacientes
    inicializarAutocompletePacientes();
}

// ============================================
// ATUALIZAR DATA NO HEADER
// ============================================
function atualizarDataAtual() {
    const el = document.getElementById('currentDate');
    if (el) {
        const agora = new Date();
        el.textContent = agora.toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// ============================================
// DASHBOARD - ATUALIZAÇÃO DE INDICADORES
// ============================================
function atualizarDashboard() {
    const hoje = dataHoje();
    let presentes = 0, visitasAtivas = 0, entradas = 0, trocas = 0;
    let saidasHoje = 0, altasHoje = 0, visitantesHoje = 0;
    let entSemana = 0, saiSemana = 0, entMes = 0, saiMes = 0;
    
    const agora = new Date();
    const iniSemana = new Date(agora);
    iniSemana.setDate(agora.getDate() - agora.getDay());
    iniSemana.setHours(0, 0, 0, 0);
    
    const iniMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    
    const ultimos = [];
    
    Object.values(acompanhantes).forEach(ac => {
        // Contagem de status
        if (ac.status === 'presente' && ac.tipo === 'acompanhante') presentes++;
        if (ac.status === 'presente' && ac.tipo === 'visita') visitasAtivas++;
        
        // Entradas hoje
        if (ac.dataEntrada === hoje) {
            entradas++;
            if (ac.tipo === 'visita') visitantesHoje++;
        }
        
        // Trocas hoje
        if (ac.dataSaida === hoje && ac.status === 'trocado') trocas++;
        
        // Saídas hoje (TODAS - inclui altas, fim de visita, desistência, etc.)
        if (ac.dataSaida === hoje && ac.status === 'saiu') saidasHoje++;
        
        // Altas hoje (APENAS saídas por alta do paciente)
        if (ac.dataSaida === hoje && 
            ac.status === 'saiu' && 
            ac.observacao && 
            ac.observacao.toLowerCase().includes('alta do paciente')) {
            altasHoje++;
        }
        
        // Contagem semanal e mensal
        const [d, m, a] = ac.dataEntrada.split('-');
        const dataE = new Date(a, m - 1, d);
        if (dataE >= iniSemana) entSemana++;
        if (dataE >= iniMes) entMes++;
        
        if (ac.dataSaida) {
            const [ds, ms, as] = ac.dataSaida.split('-');
            const dataS = new Date(as, ms - 1, ds);
            if (dataS >= iniSemana) saiSemana++;
            if (dataS >= iniMes) saiMes++;
        }
        
        ultimos.push(ac);
    });
    
    // Atualizar contadores no HTML
    setText('countAcompanhantesPresentes', presentes);
    setText('countVisitasAtivas', visitasAtivas);
    setText('countEntradasHoje', entradas);
    setText('countTrocasHoje', trocas);
    setText('countSaidasHoje', saidasHoje);
    setText('countAltasHoje', altasHoje);
    setText('countVisitantesHoje', visitantesHoje);
    setText('countEntradasSemana', entSemana);
    setText('countSaidasSemana', saiSemana);
    setText('countEntradasMes', entMes);
    setText('countSaidasMes', saiMes);
    
    // Indicadores avançados (admin/supervisor)
    const indicadores = document.getElementById('indicadoresAvancados');
    if (indicadores && usuarioLogado) {
        indicadores.style.display = (usuarioLogado.cargo === 'Administrador' || usuarioLogado.cargo === 'Supervisor') ? '' : 'none';
    }
    
    // Últimos registros (tabela do dashboard)
    ultimos.sort((a, b) => {
        const keyA = (a.dataEntrada || '') + (a.horaEntrada || '');
        const keyB = (b.dataEntrada || '') + (b.horaEntrada || '');
        return keyB.localeCompare(keyA);
    });
    
    const tbody = document.querySelector('#tabelaUltimosRegistros tbody');
    if (tbody) {
        if (ultimos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum registro encontrado</td></tr>';
        } else {
            tbody.innerHTML = ultimos.slice(0, 8).map(ac => {
                const tipoBadge = ac.tipo === 'visita' ? 'badge-visita' : 'badge-info';
                const tipoTexto = ac.tipo === 'visita' ? 'Visita' : 'Acomp.';
                
                let statusBadge = 'badge-info';
                if (ac.status === 'presente') statusBadge = 'badge-success';
                else if (ac.status === 'saiu') statusBadge = 'badge-danger';
                else if (ac.status === 'trocado') statusBadge = 'badge-warning';
                
                return `
                    <tr>
                        <td><span class="badge ${tipoBadge}">${tipoTexto}</span></td>
                        <td>${sanitizar(ac.nomeAcompanhante)}</td>
                        <td>${sanitizar(ac.nomePaciente)}</td>
                        <td>${sanitizar(ac.setor)}${ac.leito ? ' / ' + sanitizar(ac.leito) : ''}</td>
                        <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                        <td><span class="badge ${statusBadge}">${ac.status}</span></td>
                    </tr>
                `;
            }).join('');
        }
    }
}

// ============================================
// GRÁFICOS (ADMIN/SUPERVISOR)
// ============================================
let graficoSemanalInst = null;
let graficoSetoresInst = null;
let graficoTendenciaInst = null;

function atualizarGraficos() {
    // Verificar permissão e existência dos elementos
    if (!usuarioLogado || (usuarioLogado.cargo !== 'Administrador' && usuarioLogado.cargo !== 'Supervisor')) {
        document.getElementById('chartsRow').style.display = 'none';
        document.getElementById('tendenciaCard').style.display = 'none';
        return;
    }
    
    const chartsRow = document.getElementById('chartsRow');
    const tendenciaCard = document.getElementById('tendenciaCard');
    
    if (chartsRow) chartsRow.style.display = '';
    if (tendenciaCard) tendenciaCard.style.display = '';
    
    atualizarGraficoSemanal();
    atualizarGraficoSetores();
    atualizarGraficoTendencia();
}

function atualizarGraficoSemanal() {
    const canvas = document.getElementById('graficoSemanal');
    if (!canvas) return;
    
    // Verificar se o canvas está visível
    if (canvas.offsetParent === null) return;
    
    // Destruir gráfico anterior
    if (graficoSemanalInst) {
        graficoSemanalInst.destroy();
        graficoSemanalInst = null;
    }
    
    const dias = [], entradas = [], saidas = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dataStr = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        dias.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
        
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
                    backgroundColor: 'rgba(45,139,78,0.7)', 
                    borderColor: '#2d8b4e', 
                    borderWidth: 1, 
                    borderRadius: 6 
                },
                { 
                    label: 'Saídas', 
                    data: saidas, 
                    backgroundColor: 'rgba(192,57,43,0.7)', 
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
                    labels: { 
                        usePointStyle: true, 
                        padding: 20,
                        font: { size: 12 }
                    } 
                } 
            },
            scales: { 
                y: { 
                    beginAtZero: true, 
                    ticks: { stepSize: 1 } 
                } 
            }
        }
    });
}

function atualizarGraficoSetores() {
    const canvas = document.getElementById('graficoSetores');
    if (!canvas) return;
    
    // Verificar se o canvas está visível
    if (canvas.offsetParent === null) return;
    
    // Destruir gráfico anterior
    if (graficoSetoresInst) {
        graficoSetoresInst.destroy();
        graficoSetoresInst = null;
    }
    
    const setoresMap = {};
    Object.values(acompanhantes).forEach(ac => {
        if (ac.status === 'presente' && ac.setor) {
            setoresMap[ac.setor] = (setoresMap[ac.setor] || 0) + 1;
        }
    });
    
    const labels = Object.keys(setoresMap);
    const data = Object.values(setoresMap);
    
    if (labels.length === 0) {
        canvas.style.display = 'none';
        return;
    }
    
    canvas.style.display = '';
    
    const ctx = canvas.getContext('2d');
    graficoSetoresInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: [
                    '#2d8b4e', '#1a6b7a', '#c7841a', '#8e44ad', 
                    '#c0392b', '#2c9aaf', '#e8913a', '#3498db'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        padding: 15, 
                        usePointStyle: true,
                        font: { size: 11 }
                    } 
                } 
            }
        }
    });
}

function atualizarGraficoTendencia() {
    const canvas = document.getElementById('graficoTendencia');
    if (!canvas) return;
    
    // Verificar se o canvas está visível
    if (canvas.offsetParent === null) return;
    
    // Destruir gráfico anterior
    if (graficoTendenciaInst) {
        graficoTendenciaInst.destroy();
        graficoTendenciaInst = null;
    }
    
    const dias = [], visitasPorDia = [];
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
                backgroundColor: 'rgba(142,68,173,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#8e44ad'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                } 
            }
        }
    });
}

// ============================================
// TABELAS DE DADOS
// ============================================
function atualizarAtivos() {
    const ativos = Object.values(acompanhantes).filter(a => a.status === 'presente');
    const tbody = document.querySelector('#tabelaAtivos tbody');
    if (!tbody) return;
    
    if (ativos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum acompanhante ou visitante ativo no momento</td></tr>';
        return;
    }
    
    // Ordenar por data/hora de entrada
    ativos.sort((a, b) => (b.dataEntrada + b.horaEntrada).localeCompare(a.dataEntrada + a.horaEntrada));
    
    tbody.innerHTML = ativos.map(ac => {
        // Calcular tempo restante para visitas
        let tempoRestante = '-';
        if (ac.tipo === 'visita' && ac.duracaoVisita) {
            const [h, m, s] = ac.horaEntrada.split(':');
            const entrada = new Date();
            const [d, mm, aa] = ac.dataEntrada.split('-');
            entrada.setFullYear(parseInt(aa), parseInt(mm) - 1, parseInt(d));
            entrada.setHours(parseInt(h), parseInt(m), parseInt(s), 0);
            
            const minutosPassados = Math.floor((Date.now() - entrada.getTime()) / 60000);
            const restante = ac.duracaoVisita - minutosPassados;
            
            if (restante > 60) {
                tempoRestante = `${Math.floor(restante / 60)}h ${restante % 60}min`;
            } else if (restante > 0) {
                tempoRestante = `${restante} min`;
            } else {
                tempoRestante = '<span style="color:#c0392b;font-weight:600;">Expirado</span>';
            }
        }
        
        const tipoBadge = ac.tipo === 'visita' ? 'badge-visita' : 'badge-info';
        const tipoTexto = ac.tipo === 'visita' ? 'Visita' : 'Acomp.';
        
        return `
            <tr>
                <td><span class="badge ${tipoBadge}">${tipoTexto}</span></td>
                <td>${sanitizar(ac.nomeAcompanhante)}</td>
                <td>${sanitizar(ac.documento) || '-'}</td>
                <td>${sanitizar(ac.parentesco)}</td>
                <td>${sanitizar(ac.nomePaciente)}</td>
                <td>${sanitizar(ac.setor)}</td>
                <td>${sanitizar(ac.leito) || '-'}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td>${tempoRestante}</td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" onclick="abrirCracha('${ac.id}')" style="color:#1a6b7a" title="Crachá"><i class="fas fa-id-card"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function atualizarHistorico() {
    const registros = Object.values(acompanhantes);
    registros.sort((a, b) => (b.dataEntrada + b.horaEntrada).localeCompare(a.dataEntrada + a.horaEntrada));
    renderizarTabelaHistorico(registros);
}

function filtrarHistorico() {
    const inicio = document.getElementById('filtroDataInicio')?.value;
    const fim = document.getElementById('filtroDataFim')?.value;
    const status = document.getElementById('filtroStatus')?.value;
    const tipo = document.getElementById('filtroTipo')?.value;
    const texto = document.getElementById('filtroTexto')?.value?.trim().toLowerCase();
    
    let registros = Object.values(acompanhantes);
    
    // Aplicar filtros
    if (status) registros = registros.filter(a => a.status === status);
    if (tipo) registros = registros.filter(a => a.tipo === tipo);
    
    if (inicio) {
        registros = registros.filter(a => {
            const [d, m, y] = a.dataEntrada.split('-');
            return new Date(y, m - 1, d) >= new Date(inicio + 'T00:00:00');
        });
    }
    
    if (fim) {
        registros = registros.filter(a => {
            const [d, m, y] = a.dataEntrada.split('-');
            return new Date(y, m - 1, d) <= new Date(fim + 'T23:59:59');
        });
    }
    
    if (texto) {
        registros = registros.filter(a => {
            const campos = ['nomeAcompanhante', 'documento', 'nomePaciente', 'setor', 'leito', 'parentesco', 'observacao'];
            return campos.some(campo => a[campo] && a[campo].toLowerCase().includes(texto));
        });
    }
    
    // Ordenar
    registros.sort((a, b) => (b.dataEntrada + b.horaEntrada).localeCompare(a.dataEntrada + a.horaEntrada));
    
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
        
        return `
            <tr>
                <td><span class="badge ${tipoBadge}">${tipoTexto}</span></td>
                <td>${sanitizar(ac.nomeAcompanhante)}</td>
                <td>${sanitizar(ac.documento) || '-'}</td>
                <td>${sanitizar(ac.parentesco)}</td>
                <td>${sanitizar(ac.nomePaciente)}</td>
                <td>${sanitizar(ac.setor)}</td>
                <td>${sanitizar(ac.leito) || '-'}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td>${ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-'}</td>
                <td><span class="badge ${statusBadge}">${ac.status}</span></td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// FORMULÁRIOS DE REGISTRO
// ============================================
function verificarAcompanhanteAtivo(nomePaciente) {
    return Object.values(acompanhantes).find(ac =>
        ac.status === 'presente' &&
        ac.tipo === 'acompanhante' &&
        ac.nomePaciente.toLowerCase() === nomePaciente.toLowerCase()
    );
}

function verificarLimiteAcompanhante(nomePaciente, callback) {
    if (!nomePaciente) {
        toast('Nome do paciente é obrigatório.', 'error');
        callback(false);
        return;
    }
    
    const ativo = verificarAcompanhanteAtivo(nomePaciente);
    if (ativo) {
        if (bloqueioRigido) {
            toast(`Já existe um acompanhante ativo para "${nomePaciente}". Apenas 1 acompanhante por paciente é permitido.`, 'error');
            callback(false);
        } else {
            if (confirm(`Já existe um acompanhante ativo para "${nomePaciente}":\n\n${ativo.nomeAcompanhante}\nSetor: ${ativo.setor}\nLeito: ${ativo.leito || '-'}\n\nDeseja continuar mesmo assim?`)) {
                callback(true);
            } else {
                callback(false);
            }
        }
    } else {
        callback(true);
    }
}

function verificarBloqueioVisita(nomePaciente, callback) {
    if (!nomePaciente) {
        toast('Nome do paciente é obrigatório.', 'error');
        callback(false);
        return;
    }
    
    const bloqueio = Object.values(bloqueios).find(b =>
        b.paciente.toLowerCase() === nomePaciente.toLowerCase() && b.ativo === true
    );
    
    if (bloqueio) {
        toast(`⚠️ Visitas BLOQUEADAS para "${nomePaciente}"\nMotivo: ${bloqueio.motivo}\nSolicitante: ${bloqueio.solicitante}`, 'error');
        callback(false);
    } else {
        callback(true);
    }
}

function registrarEntrada(e) {
    e.preventDefault();
    const nomePaciente = sanitizar(document.getElementById('acPaciente')?.value?.trim() || '');
    
    verificarLimiteAcompanhante(nomePaciente, (permitido) => {
        if (!permitido) return;
        
        const dados = {
            id: gerarId(),
            tipo: 'acompanhante',
            nomeAcompanhante: sanitizar(document.getElementById('acNome')?.value?.trim() || ''),
            documento: sanitizar(document.getElementById('acDocumento')?.value?.trim() || ''),
            telefone: sanitizar(document.getElementById('acTelefone')?.value?.trim() || ''),
            parentesco: document.getElementById('acParentesco')?.value || '',
            nomePaciente,
            setor: document.getElementById('acSetor')?.value || '',
            leito: sanitizar(document.getElementById('acLeito')?.value?.trim() || ''),
            dataEntrada: dataHoje(),
            horaEntrada: horaAgora(),
            dataSaida: null,
            horaSaida: null,
            status: 'presente',
            recepcionistaEntrada: usuarioLogado?.nome || 'Sistema',
            recepcionistaSaida: null,
            trocas: [],
            observacao: sanitizar(document.getElementById('acObservacao')?.value?.trim() || ''),
            duracaoVisita: null
        };
        
        db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
            toast('Entrada de acompanhante registrada com sucesso!');
            e.target.reset();
            registrarLog('criar', `Acompanhante "${dados.nomeAcompanhante}" registrado para paciente "${dados.nomePaciente}".`, dados.id);
        }).catch(err => {
            console.error('Erro ao registrar:', err);
            toast('Erro ao registrar entrada.', 'error');
        });
    });
}

function registrarVisita(e) {
    e.preventDefault();
    const nomePaciente = sanitizar(document.getElementById('visPaciente')?.value?.trim() || '');
    
    verificarBloqueioVisita(nomePaciente, (permitido) => {
        if (!permitido) return;
        
        // 👇 ALTERE ESTA LINHA - valor padrão 60 se estiver vazio
        const duracao = parseInt(document.getElementById('visDuracao')?.value) || 60;
        
        const dados = {
            id: gerarId(),
            tipo: 'visita',
            nomeAcompanhante: sanitizar(document.getElementById('visNome')?.value?.trim() || ''),
            documento: sanitizar(document.getElementById('visDocumento')?.value?.trim() || ''),
            telefone: sanitizar(document.getElementById('visTelefone')?.value?.trim() || ''),
            parentesco: document.getElementById('visParentesco')?.value || '',
            nomePaciente,
            setor: document.getElementById('visSetor')?.value || '',
            leito: sanitizar(document.getElementById('visLeito')?.value?.trim() || ''),
            dataEntrada: dataHoje(),
            horaEntrada: horaAgora(),
            dataSaida: null,
            horaSaida: null,
            status: 'presente',
            recepcionistaEntrada: usuarioLogado?.nome || 'Sistema',
            recepcionistaSaida: null,
            trocas: [],
            duracaoVisita: duracao,
            observacao: `Visita de ${duracao} minutos`
        };
        
        db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
            toast(`Visita registrada com sucesso! Duração: ${duracao} minutos.`);
            e.target.reset();
            
            // 👇 ADICIONE ESTA LINHA - restaurar valor padrão após reset
            document.getElementById('visDuracao').value = 60;
            
            registrarLog('criar', `Visita de "${dados.nomeAcompanhante}" para paciente "${dados.nomePaciente}".`, dados.id);
        }).catch(err => {
            console.error('Erro ao registrar:', err);
            toast('Erro ao registrar visita.', 'error');
        });
    });
}

function registrarTroca(e) {
    e.preventDefault();
    const idAntigo = document.getElementById('trocaAcompanhanteAtual')?.value;
    const antigo = acompanhantes[idAntigo];
    
    if (!antigo) {
        toast('Selecione um acompanhante atual.', 'error');
        return;
    }
    
    const trocas = antigo.trocas || [];
    trocas.push({
        dataHora: `${dataHoje()} ${horaAgora()}`,
        acompanhanteAntigo: antigo.nomeAcompanhante,
        acompanhanteNovo: sanitizar(document.getElementById('trocaNovoNome')?.value?.trim() || ''),
        recepcionista: usuarioLogado?.nome || 'Sistema'
    });
    
    // Marcar antigo como trocado
    db.ref('acompanhantes/' + idAntigo).update({
        status: 'trocado',
        dataSaida: dataHoje(),
        horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado?.nome || 'Sistema',
        trocas
    });
    
    // Criar novo registro
    const novoId = gerarId();
    const novoNome = sanitizar(document.getElementById('trocaNovoNome')?.value?.trim() || '');
    
    db.ref('acompanhantes/' + novoId).set({
        id: novoId,
        tipo: 'acompanhante',
        nomeAcompanhante: novoNome,
        documento: sanitizar(document.getElementById('trocaNovoDocumento')?.value?.trim() || ''),
        telefone: sanitizar(document.getElementById('trocaNovoTelefone')?.value?.trim() || ''),
        parentesco: document.getElementById('trocaNovoParentesco')?.value || '',
        nomePaciente: antigo.nomePaciente,
        setor: antigo.setor,
        leito: antigo.leito,
        dataEntrada: dataHoje(),
        horaEntrada: horaAgora(),
        dataSaida: null,
        horaSaida: null,
        status: 'presente',
        recepcionistaEntrada: usuarioLogado?.nome || 'Sistema',
        recepcionistaSaida: null,
        trocas: [],
        observacao: `Substituiu: ${antigo.nomeAcompanhante}`,
        duracaoVisita: null
    }).then(() => {
        toast('Troca de acompanhante registrada com sucesso!');
        e.target.reset();
        document.getElementById('trocaInfoAtual').style.display = 'none';
        registrarLog('troca', `Troca: "${antigo.nomeAcompanhante}" substituído por "${novoNome}".`, novoId);
    }).catch(err => {
        console.error('Erro ao registrar troca:', err);
        toast('Erro ao registrar troca.', 'error');
    });
}

function registrarSaida(e) {
    e.preventDefault();
    const id = document.getElementById('saidaAcompanhante')?.value;
    const motivo = document.getElementById('saidaMotivo')?.value;
    
    if (!id || !motivo) {
        toast('Selecione o acompanhante/visitante e o motivo da saída.', 'error');
        return;
    }
    
    const atual = acompanhantes[id];
    if (!atual) {
        toast('Registro não encontrado.', 'error');
        return;
    }
    
    const obs = atual.observacao
        ? `${atual.observacao} | Saída: ${motivo}`
        : `Saída: ${motivo}`;
    
    db.ref('acompanhantes/' + id).update({
        status: 'saiu',
        dataSaida: dataHoje(),
        horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado?.nome || 'Sistema',
        observacao: obs
    }).then(() => {
        toast('Saída registrada com sucesso!');
        e.target.reset();
        document.getElementById('saidaInfo').style.display = 'none';
        registrarLog('saida', `Saída registrada: "${atual.nomeAcompanhante}" - Motivo: ${motivo}.`, id);
    }).catch(err => {
        console.error('Erro ao registrar saída:', err);
        toast('Erro ao registrar saída.', 'error');
    });
}

// ============================================
// ATUALIZAR SELECTS (Saída e Troca)
// ============================================
function atualizarSelects() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente');
    
    // Select de saída
    const selSaida = document.getElementById('saidaAcompanhante');
    if (selSaida) {
        const valorAtual = selSaida.value;
        selSaida.innerHTML = '<option value="">Selecione...</option>' +
            presentes.map(ac => {
                const prefixo = ac.tipo === 'visita' ? '[VISITA]' : '[ACOMP.]';
                return `<option value="${ac.id}">${prefixo} ${sanitizar(ac.nomeAcompanhante)} - ${sanitizar(ac.nomePaciente)}</option>`;
            }).join('');
        
        // Restaurar valor selecionado se ainda existir
        if (valorAtual && presentes.some(a => a.id === valorAtual)) {
            selSaida.value = valorAtual;
        }
    }
    
    // Select de troca (apenas acompanhantes)
    const selTroca = document.getElementById('trocaAcompanhanteAtual');
    if (selTroca) {
        const valorAtual = selTroca.value;
        selTroca.innerHTML = '<option value="">Selecione...</option>' +
            presentes.filter(a => a.tipo === 'acompanhante').map(ac => 
                `<option value="${ac.id}">${sanitizar(ac.nomeAcompanhante)} - ${sanitizar(ac.nomePaciente)}</option>`
            ).join('');
        
        if (valorAtual && presentes.some(a => a.id === valorAtual)) {
            selTroca.value = valorAtual;
        }
    }
}

function atualizarInfoSaida() {
    const id = document.getElementById('saidaAcompanhante')?.value;
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
    const id = document.getElementById('trocaAcompanhanteAtual')?.value;
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
// EDITAR / EXCLUIR REGISTROS
// ============================================
function editarRegistro(id) {
    const ac = acompanhantes[id];
    if (!ac) {
        toast('Registro não encontrado.', 'error');
        return;
    }
    
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Registro';
    document.getElementById('modalBody').innerHTML = `
        <form id="formEditar">
            <div class="form-grid">
                <div class="form-group">
                    <label>Nome do Acompanhante <span class="required">*</span></label>
                    <input type="text" id="editNome" value="${sanitizar(ac.nomeAcompanhante)}" required>
                </div>
                <div class="form-group">
                    <label>Documento</label>
                    <input type="text" id="editDoc" value="${sanitizar(ac.documento || '')}">
                </div>
                <div class="form-group">
                    <label>Telefone</label>
                    <input type="text" id="editTel" value="${sanitizar(ac.telefone || '')}">
                </div>
                <div class="form-group">
                    <label>Parentesco</label>
                    <select id="editParentesco">
                        <option>Filho(a)</option><option>Pai/Mãe</option><option>Cônjuge</option>
                        <option>Irmão/Irmã</option><option>Neto(a)</option><option>Sobrinho(a)</option>
                        <option>Amigo(a)</option><option>Cuidador(a)</option><option>Outro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Nome do Paciente</label>
                    <input type="text" id="editPaciente" value="${sanitizar(ac.nomePaciente)}">
                </div>
                <div class="form-group">
                    <label>Setor</label>
                    <select id="editSetor">
                        <option>Oncologia I</option><option>Oncologia II</option><option>UTI I</option>
                        <option>UTI II</option><option>Clínica Médica I</option><option>Clínica Médica II</option>
                        <option>Clínica Cirúrgica</option><option>Pediatria</option><option>Saúde Mental</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Leito</label>
                    <input type="text" id="editLeito" value="${sanitizar(ac.leito || '')}">
                </div>
                <div class="form-group">
                    <label>Observação</label>
                    <input type="text" id="editObs" value="${sanitizar(ac.observacao || '')}">
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar Alterações</button>
            </div>
        </form>
    `;
    
    document.getElementById('genericModal').style.display = 'flex';
    document.getElementById('genericModal').classList.add('active');
    
    // Preencher selects com valores atuais
    setTimeout(() => {
        const editSetor = document.getElementById('editSetor');
        const editParentesco = document.getElementById('editParentesco');
        if (editSetor) editSetor.value = ac.setor;
        if (editParentesco) editParentesco.value = ac.parentesco;
        
        // Evento de submit do formulário de edição
        document.getElementById('formEditar').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const dadosAtualizados = {
                nomeAcompanhante: sanitizar(document.getElementById('editNome').value.trim()),
                documento: sanitizar(document.getElementById('editDoc').value.trim()),
                telefone: sanitizar(document.getElementById('editTel').value.trim()),
                parentesco: document.getElementById('editParentesco').value,
                nomePaciente: sanitizar(document.getElementById('editPaciente').value.trim()),
                setor: document.getElementById('editSetor').value,
                leito: sanitizar(document.getElementById('editLeito').value.trim()),
                observacao: sanitizar(document.getElementById('editObs').value.trim())
            };
            
            db.ref('acompanhantes/' + id).update(dadosAtualizados).then(() => {
                toast('Registro atualizado com sucesso!');
                fecharModal();
                registrarLog('editar', `Registro "${ac.nomeAcompanhante}" editado.`, id);
            }).catch(err => {
                console.error('Erro ao atualizar:', err);
                toast('Erro ao atualizar registro.', 'error');
            });
        });
    }, 100);
}

function excluirRegistro(id) {
    const nome = acompanhantes[id]?.nomeAcompanhante || 'desconhecido';
    if (confirm(`Tem certeza que deseja excluir permanentemente o registro de "${nome}"?\n\nEsta ação não pode ser desfeita.`)) {
        db.ref('acompanhantes/' + id).remove().then(() => {
            toast('Registro excluído com sucesso!');
            registrarLog('excluir', `Registro "${nome}" excluído do sistema.`, id);
        }).catch(err => {
            console.error('Erro ao excluir:', err);
            toast('Erro ao excluir registro.', 'error');
        });
    }
}

// ============================================
// BLOQUEIOS DE VISITA
// ============================================
function carregarBloqueios() {
    const tbody = document.querySelector('#tabelaBloqueios tbody');
    if (!tbody) return;
    
    const lista = Object.values(bloqueios).filter(b => b.ativo === true);
    lista.sort((a, b) => b.dataBloqueio.localeCompare(a.dataBloqueio));
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum bloqueio ativo no momento</td></tr>';
        return;
    }
    
    tbody.innerHTML = lista.map(b => `
        <tr>
            <td><strong>${sanitizar(b.paciente)}</strong> <span class="badge badge-danger">Bloqueado</span></td>
            <td>${sanitizar(b.setor)}</td>
            <td>${sanitizar(b.leito) || '-'}</td>
            <td>${sanitizar(b.motivo)}</td>
            <td>${sanitizar(b.solicitante)}</td>
            <td>${b.dataBloqueio}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="removerBloqueio('${b.id}')">
                    <i class="fas fa-unlock"></i> Remover Bloqueio
                </button>
            </td>
        </tr>
    `).join('');
}

function abrirModalNovoBloqueio() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-ban"></i> Novo Bloqueio de Visita';
    document.getElementById('modalBody').innerHTML = `
        <form id="formNovoBloqueio">
            <div class="form-grid">
                <div class="form-group">
                    <label>Nome do Paciente <span class="required">*</span></label>
                    <input type="text" id="bloqueioPaciente" placeholder="Nome do paciente" required autocomplete="off">
                    <div class="sugestoes-paciente" id="sugestoesBloqueioPaciente"></div>
                </div>
                <div class="form-group">
                    <label>Setor</label>
                    <select id="bloqueioSetor">
                        <option value="">Selecione...</option>
                        <option>Oncologia I</option><option>Oncologia II</option><option>UTI I</option>
                        <option>UTI II</option><option>Clínica Médica I</option><option>Clínica Médica II</option>
                        <option>Clínica Cirúrgica</option><option>Pediatria</option><option>Saúde Mental</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Leito</label>
                    <input type="text" id="bloqueioLeito" placeholder="Número do leito">
                </div>
                <div class="form-group" style="grid-column:1/-1">
                    <label>Motivo do Bloqueio <span class="required">*</span></label>
                    <textarea id="bloqueioMotivo" rows="3" placeholder="Ex: Isolamento, determinação judicial..." required></textarea>
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-danger"><i class="fas fa-ban"></i> Bloquear Visitas</button>
            </div>
        </form>
    `;
    
    document.getElementById('genericModal').style.display = 'flex';
    document.getElementById('genericModal').classList.add('active');
    
    // Configurar autocomplete para o campo de paciente do bloqueio
    configurarAutocompletePaciente('bloqueioPaciente', 'sugestoesBloqueioPaciente', 'bloqueioSetor', 'bloqueioLeito');
    
    // Evento de submit
    document.getElementById('formNovoBloqueio').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const id = gerarId();
        const bloqueio = {
            id: id,
            paciente: sanitizar(document.getElementById('bloqueioPaciente').value.trim()),
            setor: document.getElementById('bloqueioSetor').value,
            leito: sanitizar(document.getElementById('bloqueioLeito').value.trim()),
            motivo: sanitizar(document.getElementById('bloqueioMotivo').value.trim()),
            solicitante: usuarioLogado.nome,
            dataBloqueio: `${dataHoje()} ${horaAgora()}`,
            ativo: true
        };
        
        if (!bloqueio.paciente || !bloqueio.motivo) {
            toast('Preencha os campos obrigatórios.', 'error');
            return;
        }
        
        db.ref('bloqueios/' + id).set(bloqueio).then(() => {
            toast('Bloqueio de visitas registrado com sucesso!');
            fecharModal();
            registrarLog('bloqueio', `Bloqueio de visitas para "${bloqueio.paciente}" - Motivo: ${bloqueio.motivo}.`);
        }).catch(err => {
            console.error('Erro ao registrar bloqueio:', err);
            toast('Erro ao registrar bloqueio.', 'error');
        });
    });
}

function removerBloqueio(id) {
    if (confirm('Deseja remover este bloqueio? As visitas voltarão a ser permitidas para este paciente.')) {
        db.ref('bloqueios/' + id).update({ ativo: false }).then(() => {
            toast('Bloqueio removido com sucesso!');
            registrarLog('bloqueio', 'Bloqueio de visitas removido.');
        }).catch(err => {
            console.error('Erro ao remover bloqueio:', err);
            toast('Erro ao remover bloqueio.', 'error');
        });
    }
}

// ============================================
// GERENCIAMENTO DE USUÁRIOS
// ============================================
function carregarSelectUsuarios() {
    db.ref('usuarios').on('value', snap => {
        const sel = document.getElementById('selectUsuarioReset');
        if (!sel) return;
        
        const usuarios = snap.val() || {};
        const valorAtual = sel.value;
        
        sel.innerHTML = '<option value="">Selecione um usuário...</option>' +
            Object.entries(usuarios)
                .sort(([, a], [, b]) => a.nome.localeCompare(b.nome))
                .map(([key, u]) => `<option value="${key}">${sanitizar(u.nome)} (${sanitizar(u.usuario)})</option>`)
                .join('');
        
        if (valorAtual && usuarios[valorAtual]) {
            sel.value = valorAtual;
        }
    });
}

function carregarUsuarios() {
    if (!usuarioLogado || (usuarioLogado.cargo !== 'Administrador' && usuarioLogado.cargo !== 'Supervisor')) {
        return;
    }
    
    db.ref('usuarios').once('value').then(snap => {
        const usuarios = snap.val() || {};
        const tbody = document.querySelector('#tabelaUsuarios tbody');
        if (!tbody) return;
        
        if (Object.keys(usuarios).length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum usuário cadastrado</td></tr>';
            return;
        }
        
        const lista = Object.entries(usuarios).sort(([, a], [, b]) => a.nome.localeCompare(b.nome));
        
        tbody.innerHTML = lista.map(([key, u]) => `
            <tr>
                <td>${sanitizar(u.nome)}</td>
                <td>${sanitizar(u.usuario)}</td>
                <td>${sanitizar(u.cargo)}</td>
                <td>
                    <span class="badge ${u.ativo !== false ? 'badge-success' : 'badge-danger'}">
                        ${u.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td>
                    <span class="badge ${u.primeiroAcesso ? 'badge-warning' : 'badge-info'}">
                        ${u.primeiroAcesso ? 'Pendente' : 'OK'}
                    </span>
                </td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarUsuario('${key}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-key" onclick="resetSenhaUser('${key}')" title="Resetar Senha"><i class="fas fa-key"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirUsuario('${key}')" title="Excluir"><i class="fas fa-trash"></i></button>
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
        
        if (!userData.nome || !userData.usuario || !userData.cargo) {
            toast('Preencha todos os campos obrigatórios.', 'error');
            return;
        }
        
        db.ref('usuarios/' + novoId).set(userData).then(() => {
            toast('Usuário criado com sucesso! Senha padrão: 123456');
            fecharModal();
            carregarUsuarios();
            carregarSelectUsuarios();
            registrarLog('usuario', `Novo usuário "${userData.usuario}" (${userData.cargo}) criado.`, novoId);
        }).catch(err => {
            console.error('Erro ao criar usuário:', err);
            toast('Erro ao criar usuário.', 'error');
        });
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

function resetSenhaUser(id) {
    if (confirm('Resetar senha para "123456"? O usuário precisará criar uma nova senha no próximo acesso.')) {
        db.ref('usuarios/' + id).update({
            senha: '123456',
            primeiroAcesso: true
        }).then(() => {
            toast('Senha resetada com sucesso!');
            carregarUsuarios();
            registrarLog('usuario', `Senha do usuário "${id}" resetada para o padrão.`);
        }).catch(err => {
            console.error('Erro ao resetar senha:', err);
            toast('Erro ao resetar senha.', 'error');
        });
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

// ============================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================
function carregarConfiguracoes() {
    // Carregar do sessionStorage primeiro (mais rápido)
    const logoCache = sessionStorage.getItem('hrpi_logo');
    const fundoCache = sessionStorage.getItem('hrpi_fundo');
    
    if (logoCache) {
        logoHospitalCache = logoCache;
        document.getElementById('sidebarLogo').innerHTML = `<img src="${logoCache}" alt="Logo">`;
        document.getElementById('loginLogo').innerHTML = `<img src="${logoCache}" alt="Logo">`;
    }
    
    if (fundoCache) {
        aplicarFundoLogin(fundoCache);
    }
    
    // Carregar do Firebase para sincronizar
    db.ref('configuracoes').once('value').then(snap => {
        const c = snap.val();
        if (!c) return;
        
        if (c.logoHospital && c.logoHospital !== logoCache) {
            logoHospitalCache = c.logoHospital;
            sessionStorage.setItem('hrpi_logo', c.logoHospital);
            document.getElementById('sidebarLogo').innerHTML = `<img src="${c.logoHospital}" alt="Logo">`;
            document.getElementById('loginLogo').innerHTML = `<img src="${c.logoHospital}" alt="Logo">`;
        }
        
        if (c.fundoLogin && c.fundoLogin !== fundoCache) {
            sessionStorage.setItem('hrpi_fundo', c.fundoLogin);
            aplicarFundoLogin(c.fundoLogin);
        }
        
        if (c.tema) {
            document.body.classList.toggle('dark-theme', c.tema === 'dark');
            const icon = document.querySelector('#themeToggleBtn i');
            if (icon) icon.className = c.tema === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        if (c.bloqueioRigido !== undefined) {
            bloqueioRigido = c.bloqueioRigido;
            const chk = document.getElementById('bloqueioRigido');
            if (chk) chk.checked = bloqueioRigido;
        }
    });
}

function aplicarFundoLogin(base64) {
    const ls = document.getElementById('loginScreen');
    if (!ls) return;
    
    const img = new Image();
    img.onload = () => {
        ls.style.setProperty('--login-bg-image', `url(${base64})`);
        ls.classList.add('fundo-carregado');
        fundoCarregado = true;
    };
    img.onerror = () => {
        console.error('Erro ao carregar imagem de fundo');
    };
    img.src = base64;
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

async function uploadLogoHandler(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        toast('Selecione uma imagem válida (JPG, PNG).', 'error');
        return;
    }
    
    try {
        const base64 = await comprimirImagem(file, 200, 80, 0.5);
        await db.ref('configuracoes').update({ logoHospital: base64 });
        
        logoHospitalCache = base64;
        sessionStorage.setItem('hrpi_logo', base64);
        document.getElementById('sidebarLogo').innerHTML = `<img src="${base64}" alt="Logo">`;
        document.getElementById('loginLogo').innerHTML = `<img src="${base64}" alt="Logo">`;
        
        toast('Logo atualizada com sucesso!');
        registrarLog('config', 'Logo do sistema atualizada.');
    } catch (err) {
        console.error('Erro ao fazer upload da logo:', err);
        toast('Erro ao fazer upload da logo.', 'error');
    }
}

async function uploadFundoHandler(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        toast('Selecione uma imagem válida (JPG, PNG).', 'error');
        return;
    }
    
    try {
        const base64 = await comprimirImagem(file, 1200, 800, 0.4);
        await db.ref('configuracoes').update({ fundoLogin: base64 });
        
        sessionStorage.setItem('hrpi_fundo', base64);
        aplicarFundoLogin(base64);
        
        toast('Fundo de login atualizado com sucesso!');
        registrarLog('config', 'Fundo da tela de login atualizado.');
    } catch (err) {
        console.error('Erro ao fazer upload do fundo:', err);
        toast('Erro ao fazer upload do fundo.', 'error');
    }
}

function removerLogo() {
    if (confirm('Remover a logo personalizada? A logo padrão será exibida.')) {
        db.ref('configuracoes').update({ logoHospital: null }).then(() => {
            logoHospitalCache = null;
            sessionStorage.removeItem('hrpi_logo');
            document.getElementById('sidebarLogo').innerHTML = '<i class="fas fa-hospital-alt"></i>';
            document.getElementById('loginLogo').innerHTML = '<span class="default-logo"><i class="fas fa-hospital-alt"></i></span>';
            toast('Logo removida com sucesso!');
            registrarLog('config', 'Logo removida.');
        });
    }
}

function removerFundo() {
    if (confirm('Remover o fundo personalizado do login?')) {
        db.ref('configuracoes').update({ fundoLogin: null }).then(() => {
            sessionStorage.removeItem('hrpi_fundo');
            const ls = document.getElementById('loginScreen');
            if (ls) ls.style.removeProperty('--login-bg-image');
            toast('Fundo removido com sucesso!');
            registrarLog('config', 'Fundo removido.');
        });
    }
}

function toggleTema() {
    const isDark = document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('#themeToggleBtn i');
    if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    
    db.ref('configuracoes').update({ tema: isDark ? 'dark' : 'light' });
    toast(`Tema ${isDark ? 'escuro' : 'claro'} ativado!`);
}

// ============================================
// BUSCA GLOBAL E AUTOCOMPLETE
// ============================================
let listaPacientesUnicos = [];

function atualizarListaPacientes() {
    const pacientesMap = new Map();
    Object.values(acompanhantes).forEach(ac => {
        if (ac.nomePaciente) {
            const nome = ac.nomePaciente.trim();
            if (!pacientesMap.has(nome)) {
                pacientesMap.set(nome, { 
                    nome, 
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
            return;
        }
        
        sugestoesDiv.innerHTML = sugestoes.slice(0, 8).map(p => `
            <div class="sugestao-item" data-nome="${sanitizar(p.nome)}" data-setor="${sanitizar(p.setor)}" data-leito="${sanitizar(p.leito)}">
                <span class="paciente-nome">${sanitizar(p.nome)}</span>
                <span class="paciente-info">${p.setor ? sanitizar(p.setor) : ''} ${p.leito ? '· Leito ' + sanitizar(p.leito) : ''}</span>
            </div>
        `).join('');
        
        sugestoesDiv.style.display = 'block';
        
        // Adicionar eventos de clique
        sugestoesDiv.querySelectorAll('.sugestao-item').forEach(item => {
            item.addEventListener('click', function() {
                input.value = this.getAttribute('data-nome');
                sugestoesDiv.style.display = 'none';
                
                if (setorId) {
                    const setorEl = document.getElementById(setorId);
                    if (setorEl && setorEl.tagName === 'SELECT') {
                        const valor = this.getAttribute('data-setor');
                        // Verificar se o valor existe nas opções
                        const options = Array.from(setorEl.options).map(o => o.value);
                        if (options.includes(valor)) {
                            setorEl.value = valor;
                        }
                    }
                }
                
                if (leitoId) {
                    const leitoEl = document.getElementById(leitoId);
                    if (leitoEl) leitoEl.value = this.getAttribute('data-leito');
                }
            });
        });
    });
    
    // Fechar sugestões ao clicar fora
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !sugestoesDiv.contains(e.target)) {
            sugestoesDiv.style.display = 'none';
        }
    });
}

function inicializarAutocompletePacientes() {
    configurarAutocompletePaciente('acPaciente', 'sugestoesAcPaciente', 'acSetor', 'acLeito');
    configurarAutocompletePaciente('visPaciente', 'sugestoesVisPaciente', 'visSetor', 'visLeito');
}

function inicializarBuscaGlobal() {
    const globalSearchInput = document.getElementById('globalSearchInput');
    const searchResults = document.getElementById('searchResults');
    if (!globalSearchInput || !searchResults) return;
    
    globalSearchInput.addEventListener('input', function() {
        const termo = this.value.trim().toLowerCase();
        if (termo.length < 2) {
            searchResults.style.display = 'none';
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
            searchResults.innerHTML = `
                <div class="search-result-item" style="justify-content:center;color:var(--text-muted)">
                    <i class="fas fa-search" style="margin-right:8px;"></i> Nenhum resultado encontrado
                </div>
            `;
        } else {
            // Ordenar: primeiro os ativos, depois por data
            resultados.sort((a, b) => {
                if (a.status === 'presente' && b.status !== 'presente') return -1;
                if (a.status !== 'presente' && b.status === 'presente') return 1;
                return (b.dataEntrada + b.horaEntrada).localeCompare(a.dataEntrada + a.horaEntrada);
            });
            
            searchResults.innerHTML = resultados.slice(0, 10).map(ac => {
                const tipoBadge = ac.tipo === 'visita' ? 'badge-visita' : 'badge-info';
                const tipoTexto = ac.tipo === 'visita' ? 'Visita' : 'Acomp.';
                const statusIcon = ac.status === 'presente' ? '🟢' : '⚪';
                
                return `
                    <div class="search-result-item" onclick="selecionarItemBusca('${ac.id}')">
                        <div class="info">
                            <span class="name">${statusIcon} ${sanitizar(ac.nomeAcompanhante)}</span>
                            <span class="detail">
                                ${sanitizar(ac.nomePaciente)} • ${sanitizar(ac.setor)} 
                                ${ac.leito ? '• Leito ' + sanitizar(ac.leito) : ''}
                                ${ac.dataEntrada ? '• ' + ac.dataEntrada : ''}
                            </span>
                        </div>
                        <span class="badge ${tipoBadge}">${tipoTexto}</span>
                    </div>
                `;
            }).join('');
        }
        searchResults.style.display = 'block';
    });
    
    // Fechar ao clicar fora
    document.addEventListener('click', function(e) {
        const searchBox = document.getElementById('searchBox');
        if (searchBox && !searchBox.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
    
    // Navegação por teclado (Enter para o primeiro resultado)
    globalSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && searchResults.style.display === 'block') {
            const primeiro = searchResults.querySelector('.search-result-item');
            if (primeiro) primeiro.click();
        }
        if (e.key === 'Escape') {
            searchResults.style.display = 'none';
            this.blur();
        }
    });
}

function selecionarItemBusca(id) {
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('globalSearchInput').value = '';
    
    const ac = acompanhantes[id];
    if (ac) {
        navegarPara('historico');
        setTimeout(() => {
            const campoTexto = document.getElementById('filtroTexto');
            if (campoTexto) {
                campoTexto.value = ac.nomeAcompanhante;
                filtrarHistorico();
            }
        }, 300);
    }
}

// ============================================
// CRACHÁ
// ============================================
function abrirCracha(id) {
    const ac = acompanhantes[id];
    if (!ac) {
        toast('Registro não encontrado.', 'error');
        return;
    }
    
    const modal = document.getElementById('badgeModal');
    const content = document.getElementById('badgeContent');
    if (!modal || !content) return;
    
    const logoHTML = logoHospitalCache
        ? `<img src="${logoHospitalCache}" alt="Logo" style="max-width:80px;max-height:60px;">`
        : '<i class="fas fa-hospital-alt" style="font-size:40px;color:#1a6b7a;"></i>';
    
    const tipoBadge = ac.tipo === 'visita' 
        ? 'background:#f3e8ff;color:#8e44ad;' 
        : 'background:#e8f4fd;color:#2980b9;';
    const tipoTexto = ac.tipo === 'visita' ? 'VISITANTE' : 'ACOMPANHANTE';
    
    content.innerHTML = `
        <div class="cracha-container">
            <div class="cracha-logo">${logoHTML}</div>
            <div class="cracha-titulo">Hospital Regional de Palmeira dos Índios</div>
            <div class="cracha-subtitulo">Controle de Recepção</div>
            <div class="cracha-nome">${sanitizar(ac.nomeAcompanhante)}</div>
            <span class="cracha-tipo-badge" style="${tipoBadge}">${tipoTexto}</span>
            <div class="cracha-info">
                <div class="campo"><strong>Paciente</strong><span>${sanitizar(ac.nomePaciente)}</span></div>
                <div class="campo"><strong>Setor</strong><span>${sanitizar(ac.setor)}</span></div>
                <div class="campo"><strong>Leito</strong><span>${sanitizar(ac.leito) || '-'}</span></div>
                <div class="campo"><strong>Entrada</strong><span>${ac.dataEntrada} ${ac.horaEntrada}</span></div>
            </div>
            <div class="cracha-codigo">
                <i class="fas fa-qrcode"></i> ID: ${ac.id.substring(0, 16)}...
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function imprimirCracha() {
    window.print();
}

// ============================================
// RELATÓRIOS EM PDF - COM RESUMO E CONTADORES
// ============================================
function gerarRelatorio(tipo) {
    if (typeof window.jspdf === 'undefined') {
        toast('Carregando biblioteca de PDF... Aguarde e tente novamente.', 'error');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    let dataInicio, dataFim, titulo;
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    
    switch (tipo) {
        case 'diario':
            dataInicio = new Date(agora);
            dataFim = new Date(agora);
            dataFim.setHours(23, 59, 59, 999);
            titulo = 'Diário';
            break;
        case 'semanal':
            const inicioSemana = new Date(agora);
            inicioSemana.setDate(agora.getDate() - 6);
            dataInicio = new Date(inicioSemana);
            dataFim = new Date(agora);
            dataFim.setHours(23, 59, 59, 999);
            titulo = 'Semanal';
            break;
        case 'mensal':
            dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
            dataFim = new Date(agora);
            dataFim.setHours(23, 59, 59, 999);
            titulo = 'Mensal';
            break;
        case 'personalizado':
            const ini = document.getElementById('dataInicioPersonalizado')?.value;
            const fim = document.getElementById('dataFimPersonalizado')?.value;
            if (!ini || !fim) {
                toast('Selecione as datas inicial e final.', 'error');
                return;
            }
            dataInicio = new Date(ini + 'T00:00:00');
            dataFim = new Date(fim + 'T23:59:59');
            titulo = 'Personalizado';
            break;
        default:
            toast('Tipo de relatório inválido.', 'error');
            return;
    }
    
    const formatar = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    const strInicio = formatar(dataInicio);
    const strFim = formatar(dataFim);
    
    // Filtrar dados
    let dados = Object.values(acompanhantes).filter(ac => {
        const [d, m, a] = ac.dataEntrada.split('-');
        const dataRegistro = new Date(a, m - 1, d);
        return dataRegistro >= dataInicio && dataRegistro <= dataFim;
    });
    
    // ============================================
    // CALCULAR ESTATÍSTICAS
    // ============================================
    let totalAcompanhantes = 0;
    let totalVisitas = 0;
    let totalEntradas = dados.length;
    let totalSaidas = 0;
    let totalAltas = 0;
    let totalTrocas = 0;
    let acompanhantesAtivos = 0;
    let visitasAtivas = 0;
    
    // Agrupar por setor
    const setoresMap = {};
    
    dados.forEach(ac => {
        // Contagem por tipo
        if (ac.tipo === 'acompanhante') totalAcompanhantes++;
        if (ac.tipo === 'visita') totalVisitas++;
        
        // Status
        if (ac.status === 'presente' && ac.tipo === 'acompanhante') acompanhantesAtivos++;
        if (ac.status === 'presente' && ac.tipo === 'visita') visitasAtivas++;
        if (ac.status === 'saiu') totalSaidas++;
        if (ac.status === 'trocado') totalTrocas++;
        
        // Altas (saídas por alta do paciente)
        if (ac.status === 'saiu' && ac.observacao && ac.observacao.toLowerCase().includes('alta do paciente')) {
            totalAltas++;
        }
        
        // Agrupar por setor
        if (ac.setor) {
            if (!setoresMap[ac.setor]) {
                setoresMap[ac.setor] = { entradas: 0, saidas: 0, ativos: 0 };
            }
            setoresMap[ac.setor].entradas++;
            if (ac.status === 'saiu') setoresMap[ac.setor].saidas++;
            if (ac.status === 'presente') setoresMap[ac.setor].ativos++;
        }
    });
    
    // Ordenar dados por data
    dados.sort((a, b) => {
        const da = new Date(a.dataEntrada.split('-')[2], a.dataEntrada.split('-')[1] - 1, a.dataEntrada.split('-')[0]);
        const db = new Date(b.dataEntrada.split('-')[2], b.dataEntrada.split('-')[1] - 1, b.dataEntrada.split('-')[0]);
        return db - da || b.horaEntrada.localeCompare(a.horaEntrada);
    });
    
    // Tentar carregar a logo
    db.ref('configuracoes/logoHospital').once('value').then(snapLogo => {
        if (snapLogo.val()) {
            try { 
                doc.addImage(snapLogo.val(), 'PNG', 10, 8, 22, 22); 
            } catch (e) {
                console.warn('Não foi possível adicionar a logo ao PDF');
            }
        }
        
        // Cabeçalho
        doc.setFontSize(16);
        doc.setTextColor(26, 107, 122);
        doc.setFont('helvetica', 'bold');
        doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS', 148, 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistema de Controle de Recepção - Relatório ' + titulo, 148, 22, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Período: ${strInicio} a ${strFim}`, 148, 28, { align: 'center' });
        
        // Linha separadora
        doc.setDrawColor(26, 107, 122);
        doc.setLineWidth(0.5);
        doc.line(14, 31, 283, 31);
        
        // ============================================
        // RESUMO COM INDICADORES
        // ============================================
        let yAtual = 38;
        
        doc.setFontSize(12);
        doc.setTextColor(26, 107, 122);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO DO PERÍODO', 14, yAtual);
        
        yAtual += 8;
        doc.setFontSize(9);
        doc.setTextColor(50);
        doc.setFont('helvetica', 'normal');
        
        // Linha 1
        doc.text(`Total de Registros: ${totalEntradas}`, 14, yAtual);
        doc.text(`Acompanhantes: ${totalAcompanhantes}`, 80, yAtual);
        doc.text(`Visitas: ${totalVisitas}`, 150, yAtual);
        doc.text(`Ativos no Momento: ${acompanhantesAtivos + visitasAtivas}`, 220, yAtual);
        
        yAtual += 7;
        
        // Linha 2
        doc.text(`Saídas Totais: ${totalSaidas}`, 14, yAtual);
        doc.text(`Altas de Pacientes: ${totalAltas}`, 80, yAtual);
        doc.text(`Trocas de Acompanhante: ${totalTrocas}`, 150, yAtual);
        doc.text(`Acomp. Ativos: ${acompanhantesAtivos} | Visitas Ativas: ${visitasAtivas}`, 220, yAtual);
        
        yAtual += 10;
        
        // ============================================
        // RESUMO POR SETOR
        // ============================================
        if (Object.keys(setoresMap).length > 0) {
            doc.setFontSize(11);
            doc.setTextColor(26, 107, 122);
            doc.setFont('helvetica', 'bold');
            doc.text('MOVIMENTAÇÃO POR SETOR', 14, yAtual);
            
            yAtual += 7;
            
            // Cabeçalho da tabela de setores
            doc.setFillColor(26, 107, 122);
            doc.setTextColor(255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.rect(14, yAtual, 70, 6, 'F');
            doc.rect(84, yAtual, 40, 6, 'F');
            doc.rect(124, yAtual, 40, 6, 'F');
            doc.rect(164, yAtual, 40, 6, 'F');
            
            doc.setTextColor(255);
            doc.text('Setor', 16, yAtual + 4);
            doc.text('Entradas', 86, yAtual + 4);
            doc.text('Saídas', 126, yAtual + 4);
            doc.text('Ativos', 166, yAtual + 4);
            
            yAtual += 7;
            
            // Dados dos setores
            Object.entries(setoresMap).sort().forEach(([setor, dados], index) => {
                if (index % 2 === 0) {
                    doc.setFillColor(245, 250, 252);
                    doc.rect(14, yAtual, 70, 5, 'F');
                    doc.rect(84, yAtual, 40, 5, 'F');
                    doc.rect(124, yAtual, 40, 5, 'F');
                    doc.rect(164, yAtual, 40, 5, 'F');
                }
                
                doc.setTextColor(50);
                doc.setFont('helvetica', 'normal');
                doc.text(setor, 16, yAtual + 3.5);
                doc.text(String(dados.entradas), 95, yAtual + 3.5, { align: 'center' });
                doc.text(String(dados.saidas), 135, yAtual + 3.5, { align: 'center' });
                doc.text(String(dados.ativos), 175, yAtual + 3.5, { align: 'center' });
                
                yAtual += 6;
            });
            
            yAtual += 8;
        }
        
        // ============================================
        // TABELA DETALHADA
        // ============================================
        doc.setFontSize(11);
        doc.setTextColor(26, 107, 122);
        doc.setFont('helvetica', 'bold');
        doc.text('REGISTROS DETALHADOS', 14, yAtual);
        
        yAtual += 2;
        
        doc.autoTable({
            startY: yAtual,
            head: [['Tipo', 'Nome', 'Documento', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Entrada', 'Saída', 'Status']],
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
        
        // Rodapé
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.setFont('helvetica', 'italic');
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, finalY);
        doc.text(`Total de registros: ${totalEntradas} | Gerado por: ${usuarioLogado?.nome || 'Sistema'}`, 148, finalY, { align: 'center' });
        doc.text('Hospital Regional de Palmeira dos Índios', 283, finalY, { align: 'right' });
        
        // Salvar
        doc.save(`HRPI_Relatorio_${titulo}_${formatar(agora)}.pdf`);
        toast('PDF gerado com sucesso!');
    }).catch(err => {
        console.error('Erro ao gerar PDF:', err);
        toast('Erro ao gerar relatório PDF.', 'error');
    });
}

// ============================================
// EXPORTAR CSV
// ============================================
function exportarExcel() {
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
            const [d, m, y] = a.dataEntrada.split('-');
            return new Date(y, m - 1, d) >= new Date(inicio + 'T00:00:00');
        });
    }
    if (fim) {
        registros = registros.filter(a => {
            const [d, m, y] = a.dataEntrada.split('-');
            return new Date(y, m - 1, d) <= new Date(fim + 'T23:59:59');
        });
    }
    if (texto) {
        registros = registros.filter(a => {
            const campos = ['nomeAcompanhante', 'documento', 'nomePaciente', 'setor', 'leito', 'parentesco', 'observacao'];
            return campos.some(c => a[c] && a[c].toLowerCase().includes(texto));
        });
    }
    
    // Ordenar
    registros.sort((a, b) => (b.dataEntrada + b.horaEntrada).localeCompare(a.dataEntrada + a.horaEntrada));
    
    // Criar CSV
    let csv = '\uFEFFTipo;Nome;Documento;Parentesco;Paciente;Setor;Leito;Data Entrada;Hora Entrada;Data Saída;Hora Saída;Status;Observação\n';
    registros.forEach(ac => {
        csv += [
            ac.tipo,
            `"${ac.nomeAcompanhante || ''}"`,
            `"${ac.documento || ''}"`,
            `"${ac.parentesco || ''}"`,
            `"${ac.nomePaciente || ''}"`,
            `"${ac.setor || ''}"`,
            `"${ac.leito || ''}"`,
            ac.dataEntrada || '',
            ac.horaEntrada || '',
            ac.dataSaida || '',
            ac.horaSaida || '',
            ac.status || '',
            `"${(ac.observacao || '').replace(/"/g, '""')}"`
        ].join(';') + '\n';
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HRPI_Registros_${dataHoje()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast(`${registros.length} registro(s) exportado(s) com sucesso!`);
}

// ============================================
// LOGS DE AUDITORIA
// ============================================
function carregarLogs() {
    if (!usuarioLogado || (usuarioLogado.cargo !== 'Administrador' && usuarioLogado.cargo !== 'Supervisor')) {
        return;
    }
    
    db.ref('logs').once('value').then(snap => {
        const logs = Object.values(snap.val() || {});
        logs.sort((a, b) => b.dataHora.localeCompare(a.dataHora));
        renderizarTabelaLogs(logs);
    }).catch(err => {
        console.error('Erro ao carregar logs:', err);
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
                const [d] = log.dataHora.split(' ');
                const [dd, mm, aa] = d.split('-');
                return new Date(aa, mm - 1, dd) >= new Date(inicio + 'T00:00:00');
            });
        }
        if (fim) {
            logs = logs.filter(log => {
                const [d] = log.dataHora.split(' ');
                const [dd, mm, aa] = d.split('-');
                return new Date(aa, mm - 1, dd) <= new Date(fim + 'T23:59:59');
            });
        }
        if (usuario) logs = logs.filter(log => log.usuarioId === usuario);
        if (acao) logs = logs.filter(log => log.acao === acao);
        
        logs.sort((a, b) => b.dataHora.localeCompare(a.dataHora));
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
        'login': '#1a6b7a',
        'logout': '#7d8c97',
        'criar': '#2d8b4e',
        'editar': '#2c9aaf',
        'excluir': '#c0392b',
        'troca': '#c7841a',
        'saida': '#e8913a',
        'usuario': '#8e44ad',
        'config': '#3498db',
        'bloqueio': '#e74c3c'
    };
    
    tbody.innerHTML = logs.map(log => {
        const cor = coresAcao[log.acao] || '#2980b9';
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

// ============================================
// AUTO-ENCERRAR VISITAS EXPIRADAS
// ============================================
function encerrarVisitasExpiradas() {
    const agora = new Date();
    let encerradas = 0;
    
    Object.values(acompanhantes).forEach(ac => {
        if (ac.status === 'presente' && ac.tipo === 'visita' && ac.duracaoVisita) {
            const [h, m, s] = ac.horaEntrada.split(':');
            const [d, mm, aa] = ac.dataEntrada.split('-');
            const entrada = new Date(parseInt(aa), parseInt(mm) - 1, parseInt(d), parseInt(h), parseInt(m), parseInt(s));
            
            const minutosPassados = Math.floor((agora - entrada) / 60000);
            if (minutosPassados >= ac.duracaoVisita) {
                db.ref('acompanhantes/' + ac.id).update({
                    status: 'saiu',
                    dataSaida: dataHoje(),
                    horaSaida: horaAgora(),
                    observacao: (ac.observacao ? ac.observacao + ' | ' : '') + 'Saída automática por expiração do tempo de visita.'
                });
                encerradas++;
            }
        }
    });
    
    if (encerradas > 0) {
        console.log(`⏰ ${encerradas} visita(s) encerrada(s) automaticamente.`);
    }
}

// Executar a cada 30 segundos
setInterval(encerrarVisitasExpiradas, 30000);

// ============================================
// LIMPEZA DE REGISTROS ANTIGOS (OPCIONAL)
// ============================================
function limparRegistrosEncerrados(dias = 60) {
    const corte = new Date();
    corte.setDate(corte.getDate() - dias);
    
    db.ref('acompanhantes').once('value').then(snap => {
        const registros = snap.val() || {};
        let removidos = 0;
        
        Object.entries(registros).forEach(([key, ac]) => {
            if (ac.status === 'saiu' && ac.dataSaida) {
                const [d, m, a] = ac.dataSaida.split('-');
                const dataSaida = new Date(parseInt(a), parseInt(m) - 1, parseInt(d));
                if (dataSaida < corte) {
                    db.ref('acompanhantes/' + key).remove();
                    removidos++;
                }
            }
        });
        
        if (removidos > 0) {
            console.log(`🧹 ${removidos} registros antigos removidos.`);
        }
    });
}

// Executar limpeza a cada 7 dias
setInterval(() => limparRegistrosEncerrados(60), 7 * 24 * 60 * 60 * 1000);

// ============================================
// INICIALIZAÇÃO FINAL
// ============================================
console.log('✅ HRPI - Sistema de Controle de Recepção carregado com sucesso!');
console.log('🔑 Funcionalidades:');
console.log('   ✅ Primeiro acesso com troca de senha obrigatória');
console.log('   ✅ Múltiplos cargos: Admin, Supervisor, Serviço Social, Recepcionista');
console.log('   ✅ Controle de permissões por cargo');
console.log('   ✅ Busca global com autocomplete');
console.log('   ✅ Gráficos e indicadores para gestores');
console.log('   ✅ Relatórios em PDF e exportação CSV');
console.log('   ✅ Logs de auditoria completos');
console.log('   ✅ Bloqueio de visitas por paciente');
console.log('   ✅ Encerramento automático de visitas expiradas');
console.log('   ✅ Sistema de crachá para impressão');
console.log('   ✅ Temas claro e escuro');
console.log('   ✅ Responsivo para mobile');
