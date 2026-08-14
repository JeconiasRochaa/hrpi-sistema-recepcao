// ============================================
// HRPI - SISTEMA DE CONTROLE DE RECEPÇÃO
// script.js
// ============================================
//
// ÍNDICE (busque pelo texto entre aspas para pular direto à seção):
//   "SEGURANÇA DE SENHAS"          → hash de senha, migração de contas antigas
//   "FUNÇÕES UTILITÁRIAS"          → formatação de data/hora, sanitização, toast
//   "INICIALIZAÇÃO DO DOM"         → listeners de formulários e botões
//   "REGISTRO DE SAÍDA"            → busca + confirmação de saída (fluxo único)
//   "LOGIN / LOGOUT / SESSÃO"      → autenticação e controle de sessão
//   "INICIALIZAÇÃO DO SISTEMA"     → carga inicial dos dados do Firebase
//   "PAINEL GERENCIAL"             → dashboard, cartões, gráficos, insights
//   "FORMULÁRIOS DE REGISTRO"      → entrada de acompanhante/visitante, troca
//   "EDITAR / EXCLUIR REGISTROS"   → ações da tabela de histórico
//   "BLOQUEIOS DE VISITA"          → pacientes com visita restrita
//   "GERENCIAMENTO DE USUÁRIOS"    → CRUD de usuários (só Admin/Supervisor)
//   "CONFIGURAÇÕES DO SISTEMA"     → preferências gerais, tema, backup
//   "BUSCA GLOBAL E AUTOCOMPLETE"  → busca de pacientes/acompanhantes
//   "CRACHÁ"                       → geração de crachá de identificação
//   "RELATÓRIOS EM PDF"            → exportação de relatórios (jsPDF)
//   "EXPORTAR CSV"                 → exportação de planilha
//   "LOGS DE AUDITORIA"            → histórico de ações do sistema
//   "AUTO-ENCERRAR VISITAS"        → rotina que expira visitas automaticamente
//   "LIMPEZA DE REGISTROS ANTIGOS" → rotina de manutenção do banco
//
// Cores e tema visual: editar variáveis em style.css (bloco :root no topo).
// ============================================

try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado com sucesso!');
} catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
}

const db = firebase.database();

// Autenticação anônima: necessária para que as regras de segurança do
// Realtime Database (que exigem "auth != null") aceitem as requisições.
// Isso NÃO substitui um controle de acesso real por usuário — apenas
// impede que o banco fique acessível a qualquer cliente não autenticado
// na internet. Ver README-MELHORIAS.md para o plano de evolução
// (Firebase Authentication completo + regras por papel de usuário).
let authProntoResolve;
const authPronto = new Promise(resolve => { authProntoResolve = resolve; });
firebase.auth().onAuthStateChanged(user => {
    if (user) { authProntoResolve(); }
});
firebase.auth().signInAnonymously().catch(error => {
    console.error('❌ Erro na autenticação anônima:', error);
    authProntoResolve(); // libera mesmo assim; chamadas ao DB vão falhar e serão tratadas nos catches
});

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let usuarioLogado = null;
let ultimaAtividade = Date.now();
let monitorSessaoId = null;
let acompanhantes = {};
let bloqueios = {};
let logoHospitalCache = null;
let fundoCarregado = false;
// (Bloqueio de acompanhante duplicado por paciente é regra fixa do sistema — ver verificarLimiteAcompanhante)

// O Painel Gerencial mostra sempre o mês corrente por completo — sem filtro
// manual de período/setor/recepcionista (ver função atualizarLabelPeriodo).
let filtrosDashboard = {
    periodo: 'mes',
    dataInicio: null,
    dataFim: null,
    setor: '',
    recepcionista: ''
};
let graficos = {};

// ============================================
// CONFIGURAÇÕES
// ============================================
const CONFIG = {
    SESSION_TIMEOUT: 30 * 60 * 1000,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000,
    MIN_PASSWORD_LENGTH: 6,
    INACTIVITY_CHECK_INTERVAL: 60 * 1000,
    // Confirmação de presença de acompanhantes (ver seção "CONFIRMAÇÃO DE
    // PRESENÇA" abaixo). Depois desse número de dias sem confirmação, o
    // acompanhante é sinalizado para a recepção verificar se ele ainda
    // está mesmo no hospital — a nutrição usa esse dado para as refeições.
    DIAS_ALERTA_PRESENCA: 2
};

// ============================================
// SEGURANÇA DE SENHAS (HASH + SALT)
// ------------------------------------------
// As senhas nunca são mais gravadas em texto puro.
// Usamos SHA-256 (Web Crypto API) com um "salt" aleatório
// por usuário. Contas antigas (criadas na versão anterior,
// com campo "senha" em texto puro) são migradas
// automaticamente para hash no primeiro login com sucesso.
// ============================================
function gerarSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashSenha(senha, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + ':' + senha);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function criarCredenciais(senhaPlana) {
    const salt = gerarSalt();
    const senhaHash = await hashSenha(senhaPlana, salt);
    return { salt, senhaHash };
}
// Confere a senha digitada contra o registro do usuário.
// Retorna true/false. Se o usuário ainda estiver no formato
// antigo (senha em texto puro), migra para hash automaticamente
// quando a senha confere.
async function conferirSenha(user, senhaDigitada) {
    if (user.senhaHash && user.salt) {
        const hashDigitado = await hashSenha(senhaDigitada, user.salt);
        return hashDigitado === user.senhaHash;
    }
    // Compatibilidade com contas antigas (texto puro)
    if (user.senha && user.senha === senhaDigitada) {
        return true; // sinaliza para o chamador migrar este usuário
    }
    return false;
}
async function migrarSenhaLegado(userId, senhaPlana) {
    try {
        const { salt, senhaHash } = await criarCredenciais(senhaPlana);
        await db.ref('usuarios/' + userId).update({ senhaHash, salt, senha: null });
        console.log('🔐 Conta migrada para armazenamento de senha com hash.');
    } catch (e) {
        console.error('Erro ao migrar senha legada:', e);
    }
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================
function dataHoje() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
function horaAgora() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
function gerarId() {
    return 'hrpi_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}
function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const message = document.getElementById('toastMessage');
    if (!t || !icon || !message) { alert(msg); return; }
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
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
}
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
function registrarLog(acao, descricao, registroId = null) {
    if (!usuarioLogado) return;
    const log = {
        id: gerarId(),
        timestamp: Date.now(),
        dataHora: `${dataHoje()} ${horaAgora()}`,
        usuario: usuarioLogado.nome,
        usuarioId: usuarioLogado.id,
        acao: acao,
        descricao: descricao,
        registroId: registroId || ''
    };
    db.ref('logs/' + log.id).set(log).catch(err => console.error('Erro ao registrar log:', err));
}
// Converte "DD-MM-AAAA HH:MM:SS" em um Date válido para ordenação/filtro.
// Usa o campo "timestamp" (numérico) quando disponível — mais rápido e
// imune a formatos futuros — e cai para o parse da string em logs antigos.
function dataHoraLog(log) {
    if (log.timestamp) return new Date(log.timestamp);
    const [dataParte, horaParte] = (log.dataHora || '').split(' ');
    const [d, m, a] = (dataParte || '').split('-').map(Number);
    const [h = 0, mi = 0, s = 0] = (horaParte || '').split(':').map(Number);
    return new Date(a, (m || 1) - 1, d || 1, h, mi, s);
}
function formatarData(date) {
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

// ============================================
// INICIALIZAÇÃO DO DOM
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('🟢 DOM Carregado - Inicializando sistema...');
    atualizarDataAtual();
    inicializarMascarasTelefone();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', fazerLogin);
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) changePasswordForm.addEventListener('submit', trocarSenhaPrimeiroAcesso);

    const btnTogglePassword = document.getElementById('btnTogglePassword');
    if (btnTogglePassword) {
        btnTogglePassword.addEventListener('click', function () {
            const campo = document.getElementById('password');
            const mostrando = campo.type === 'text';
            campo.type = mostrando ? 'password' : 'text';
            this.innerHTML = mostrando ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
            this.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
        });
    }

    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
        link.addEventListener('click', function () {
            navegarPara(this.getAttribute('data-page'));
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
                document.getElementById('sidebarOverlay').classList.remove('active');
            }
        });
    });

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => { 
        document.getElementById('sidebar').classList.add('open'); 
        document.getElementById('sidebarOverlay').classList.add('active'); 
    });
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', function () { 
        document.getElementById('sidebar').classList.remove('open'); 
        this.classList.remove('active'); 
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => { if (confirm('Deseja sair?')) logout(); });
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTema);

    const genericModal = document.getElementById('genericModal');
    if (genericModal) genericModal.addEventListener('click', function (e) { if (e.target === this) fecharModal(); });
    const firstAccessModal = document.getElementById('firstAccessModal');
    if (firstAccessModal) firstAccessModal.addEventListener('click', function (e) { 
        if (e.target === this) { 
            this.style.display = 'none'; 
            document.getElementById('loginScreen').classList.remove('hidden'); 
            usuarioLogado = null; 
        } 
    });
    const badgeModal = document.getElementById('badgeModal');
    if (badgeModal) badgeModal.addEventListener('click', function (e) { 
        if (e.target === this) { 
            this.style.display = 'none'; 
            this.classList.remove('active'); 
        } 
    });

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

    const formEntrada = document.getElementById('formEntradaAcompanhante');
    if (formEntrada) formEntrada.addEventListener('submit', registrarEntrada);
    const formVisita = document.getElementById('formVisita');
    if (formVisita) formVisita.addEventListener('submit', registrarVisita);
    const formTroca = document.getElementById('formTroca');
    if (formTroca) formTroca.addEventListener('submit', registrarTroca);
    const formSaida = document.getElementById('formSaida');
    if (formSaida) formSaida.addEventListener('submit', registrarSaida);

    const btnFiltrar = document.getElementById('btnFiltrar');
    if (btnFiltrar) btnFiltrar.addEventListener('click', filtrarHistorico);
    const btnFiltrarLogs = document.getElementById('btnFiltrarLogs');
    if (btnFiltrarLogs) btnFiltrarLogs.addEventListener('click', filtrarLogs);
    const btnExportarExcel = document.getElementById('btnExportarExcel');
    if (btnExportarExcel) btnExportarExcel.addEventListener('click', exportarExcel);

    // Aguarda a autenticação anônima do Firebase antes de liberar o login
    // e verificar sessão existente (necessário pois as regras do banco
    // exigem "auth != null").
    const btnLoginInicial = document.querySelector('.btn-login');
    if (btnLoginInicial) { btnLoginInicial.disabled = true; btnLoginInicial.innerHTML = '<span class="spinner"></span> Conectando...'; }
    authPronto.then(() => {
        if (btnLoginInicial) { btnLoginInicial.disabled = false; btnLoginInicial.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar'; }
        carregarConfiguracoes();
        verificarSessao();
    });
    carregarSelectUsuarios();
    inicializarBuscaGlobal();
    console.log('✅ Sistema inicializado com sucesso!');
});

// ============================================
// ============================================
// REGISTRO DE SAÍDA — busca + confirmação (fluxo único)
// ============================================
const inputBuscaSaida = document.getElementById('buscaSaidaRapida');
const resultadosBuscaSaida = document.getElementById('resultadosBuscaSaida');
const btnSaidaRapida = document.getElementById('btnSaidaRapida');

if (inputBuscaSaida) {
    // Digitação no campo de busca
    inputBuscaSaida.addEventListener('input', function () {
        const termo = this.value.trim().toLowerCase();
        limparSelecaoSaida(false);
        if (termo.length < 2) {
            resultadosBuscaSaida.style.display = 'none';
            return;
        }

        const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente' && a.tipo === 'acompanhante');
        const filtrados = presentes.filter(a =>
            a.nomeAcompanhante.toLowerCase().includes(termo) ||
            a.nomePaciente.toLowerCase().includes(termo) ||
            (a.documento && a.documento.toLowerCase().includes(termo))
        );

        if (filtrados.length === 0) {
            resultadosBuscaSaida.innerHTML = '<div class="search-result-item" style="justify-content:center;color:var(--text-muted)">Nenhum resultado</div>';
            resultadosBuscaSaida.style.display = 'block';
            return;
        }

        resultadosBuscaSaida.innerHTML = filtrados.slice(0, 8).map(ac => `
            <div class="search-result-item" data-id="${ac.id}" style="cursor:pointer;">
                <div class="info">
                    <span class="name">${sanitizar(ac.nomeAcompanhante)}</span>
                    <span class="detail">${sanitizar(ac.nomePaciente)} • ${sanitizar(ac.setor)} ${ac.leito ? '• Leito ' + sanitizar(ac.leito) : ''}</span>
                </div>
                <span class="badge ${ac.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span>
            </div>
        `).join('');

        resultadosBuscaSaida.style.display = 'block';

        // Evento de clique nos resultados
        resultadosBuscaSaida.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function () {
                const id = this.getAttribute('data-id');
                selecionarAcompanhanteSaidaRapida(id);
            });
        });
    });

    // Fechar sugestões ao clicar fora
    document.addEventListener('click', function (e) {
        if (!inputBuscaSaida.contains(e.target) && !resultadosBuscaSaida.contains(e.target)) {
            resultadosBuscaSaida.style.display = 'none';
        }
    });
}

function selecionarAcompanhanteSaidaRapida(id) {
    const ac = acompanhantes[id];
    if (!ac || ac.status !== 'presente') {
        toast('Acompanhante/visitante não está mais presente.', 'error');
        return;
    }

    document.getElementById('saidaAcompanhante').value = id;
    document.getElementById('saidaInfo').style.display = 'block';
    setText('saidaPaciente', ac.nomePaciente);
    setText('saidaSetor', ac.setor);
    setText('saidaEntrada', `${ac.dataEntrada} ${ac.horaEntrada}`);

    btnSaidaRapida.disabled = false;

    // Fechar sugestões e refletir a seleção no campo de busca
    resultadosBuscaSaida.style.display = 'none';
    inputBuscaSaida.value = ac.nomeAcompanhante;
}

function limparSelecaoSaida(limparBusca = true) {
    document.getElementById('saidaAcompanhante').value = '';
    document.getElementById('saidaInfo').style.display = 'none';
    btnSaidaRapida.disabled = true;
    if (limparBusca && inputBuscaSaida) inputBuscaSaida.value = '';
}

// ============================================
// TROCA DE ACOMPANHANTE — busca (mesmo padrão da tela de Saída)
// ============================================
const inputBuscaTroca = document.getElementById('buscaTrocaAtual');
const resultadosBuscaTroca = document.getElementById('resultadosBuscaTroca');
const btnRegistrarTroca = document.getElementById('btnRegistrarTroca');

if (inputBuscaTroca) {
    inputBuscaTroca.addEventListener('input', function () {
        const termo = this.value.trim().toLowerCase();
        limparSelecaoTroca(false);
        if (termo.length < 2) {
            resultadosBuscaTroca.style.display = 'none';
            return;
        }

        const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente' && a.tipo === 'acompanhante');
        const filtrados = presentes.filter(a =>
            a.nomeAcompanhante.toLowerCase().includes(termo) ||
            a.nomePaciente.toLowerCase().includes(termo) ||
            (a.documento && a.documento.toLowerCase().includes(termo))
        );

        if (filtrados.length === 0) {
            resultadosBuscaTroca.innerHTML = '<div class="search-result-item" style="justify-content:center;color:var(--text-muted)">Nenhum resultado</div>';
            resultadosBuscaTroca.style.display = 'block';
            return;
        }

        resultadosBuscaTroca.innerHTML = filtrados.slice(0, 8).map(ac => `
            <div class="search-result-item" data-id="${ac.id}" style="cursor:pointer;">
                <div class="info">
                    <span class="name">${sanitizar(ac.nomeAcompanhante)}</span>
                    <span class="detail">${sanitizar(ac.nomePaciente)} • ${sanitizar(ac.setor)} ${ac.leito ? '• Leito ' + sanitizar(ac.leito) : ''}</span>
                </div>
                <span class="badge badge-info">Acomp.</span>
            </div>
        `).join('');

        resultadosBuscaTroca.style.display = 'block';
        resultadosBuscaTroca.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function () {
                selecionarAcompanhanteTroca(this.getAttribute('data-id'));
            });
        });
    });

    document.addEventListener('click', function (e) {
        if (!inputBuscaTroca.contains(e.target) && !resultadosBuscaTroca.contains(e.target)) {
            resultadosBuscaTroca.style.display = 'none';
        }
    });
}

function selecionarAcompanhanteTroca(id) {
    const ac = acompanhantes[id];
    if (!ac || ac.status !== 'presente') {
        toast('Acompanhante não está mais presente.', 'error');
        return;
    }
    document.getElementById('trocaAcompanhanteAtual').value = id;
    document.getElementById('trocaInfoAtual').style.display = 'block';
    setText('trocaPaciente', ac.nomePaciente);
    setText('trocaSetor', ac.setor);
    setText('trocaLeito', ac.leito || '-');
    if (btnRegistrarTroca) btnRegistrarTroca.disabled = false;
    resultadosBuscaTroca.style.display = 'none';
    inputBuscaTroca.value = ac.nomeAcompanhante;
}

function limparSelecaoTroca(limparBusca = true) {
    document.getElementById('trocaAcompanhanteAtual').value = '';
    document.getElementById('trocaInfoAtual').style.display = 'none';
    if (btnRegistrarTroca) btnRegistrarTroca.disabled = true;
    if (limparBusca && inputBuscaTroca) inputBuscaTroca.value = '';
}

// ============================================
// LOGIN / LOGOUT / SESSÃO / NAVEGAÇÃO
// ============================================
let loginAttempts = 0;
let lockoutUntil = null;

async function fazerLogin(e) {
    e.preventDefault();
    await authPronto;
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const min = Math.ceil((lockoutUntil - Date.now()) / 60000);
        const erroDiv = document.getElementById('loginError');
        if (erroDiv) { erroDiv.textContent = `Conta bloqueada. Tente novamente em ${min} minuto(s).`; erroDiv.style.display = 'block'; }
        return;
    }
    const usuario = document.getElementById('username').value.trim().toLowerCase();
    const senha = document.getElementById('password').value;
    const erroDiv = document.getElementById('loginError');
    const btnLogin = document.querySelector('.btn-login');
    if (erroDiv) { erroDiv.textContent = ''; erroDiv.style.display = 'none'; }
    if (!usuario || !senha) { if (erroDiv) { erroDiv.textContent = 'Preencha todos os campos.'; erroDiv.style.display = 'block'; } return; }
    if (btnLogin) { btnLogin.disabled = true; btnLogin.innerHTML = '<span class="spinner"></span> Entrando...'; }
    try {
        let snapshot = await db.ref('usuarios').orderByChild('usuario').equalTo(usuario).once('value');
        let usuarios = snapshot.val();
        if (!usuarios) {
            // Fallback: procura o usuário ignorando maiúsculas/minúsculas,
            // para o caso de ter sido cadastrado direto no banco (fora do
            // formulário do sistema) com letras diferentes.
            const todosSnapshot = await db.ref('usuarios').once('value');
            const todos = todosSnapshot.val() || {};
            const encontrado = Object.entries(todos).find(([, u]) => (u.usuario || '').toLowerCase() === usuario);
            if (encontrado) usuarios = { [encontrado[0]]: encontrado[1] };
        }
        if (!usuarios) {
            loginAttempts++;
            if (erroDiv) { erroDiv.textContent = 'Usuário ou senha inválidos.'; erroDiv.style.display = 'block'; }
            resetarBtnLogin(); return;
        }
        const [key, user] = Object.entries(usuarios)[0];
        let userEncontrado = null;
        if (user.ativo !== false && await conferirSenha(user, senha)) {
            userEncontrado = { ...user, id: key };
            // Migra silenciosamente contas antigas com senha em texto puro
            if (!user.senhaHash) migrarSenhaLegado(key, senha);
        }
        if (!userEncontrado) {
            loginAttempts++;
            if (erroDiv) { erroDiv.textContent = 'Usuário ou senha inválidos.'; erroDiv.style.display = 'block'; }
            if (loginAttempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
                lockoutUntil = Date.now() + CONFIG.LOCKOUT_TIME;
                if (erroDiv) { erroDiv.textContent = 'Conta bloqueada por 15 minutos.'; erroDiv.style.display = 'block'; }
                loginAttempts = 0;
            }
            resetarBtnLogin(); return;
        }
        loginAttempts = 0;
        if (userEncontrado.primeiroAcesso === true) {
            usuarioLogado = userEncontrado;
            document.getElementById('loginScreen').classList.add('hidden');
            const modal = document.getElementById('firstAccessModal');
            if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
            resetarBtnLogin(); return;
        }
        completarLogin(userEncontrado);
        resetarBtnLogin();
    } catch (error) {
        console.error('Erro no Firebase:', error);
        if (erroDiv) { erroDiv.textContent = 'Erro de conexão.'; erroDiv.style.display = 'block'; }
        resetarBtnLogin();
    }
}
function resetarBtnLogin() {
    const btn = document.querySelector('.btn-login');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar'; }
}
async function trocarSenhaPrimeiroAcesso(e) {
    e.preventDefault();
    const novaSenha = document.getElementById('newPassword').value;
    const confirma = document.getElementById('confirmPassword').value;
    const erroDiv = document.getElementById('passwordError');
    if (erroDiv) erroDiv.style.display = 'none';
    if (!novaSenha || !confirma) { if (erroDiv) { erroDiv.textContent = 'Preencha todos os campos.'; erroDiv.style.display = 'block'; } return; }
    if (novaSenha !== confirma) { if (erroDiv) { erroDiv.textContent = 'As senhas não conferem.'; erroDiv.style.display = 'block'; } return; }
    if (novaSenha.length < CONFIG.MIN_PASSWORD_LENGTH) { if (erroDiv) { erroDiv.textContent = `Mínimo ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`; erroDiv.style.display = 'block'; } return; }
    if (!usuarioLogado || !usuarioLogado.id) { if (erroDiv) { erroDiv.textContent = 'Erro de sessão.'; erroDiv.style.display = 'block'; } return; }
    const btn = document.querySelector('#changePasswordForm button[type="submit"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Salvando...'; }
    try {
        const { salt, senhaHash } = await criarCredenciais(novaSenha);
        await db.ref('usuarios/' + usuarioLogado.id).update({ senhaHash, salt, senha: null, primeiroAcesso: false });
        delete usuarioLogado.senha;
        usuarioLogado.senhaHash = senhaHash;
        usuarioLogado.salt = salt;
        usuarioLogado.primeiroAcesso = false;
        document.getElementById('firstAccessModal').style.display = 'none';
        document.getElementById('firstAccessModal').classList.remove('active');
        document.getElementById('mainSystem').classList.add('active');
        completarLogin(usuarioLogado);
        toast('Senha criada com sucesso!');
        registrarLog('usuario', `Usuário "${usuarioLogado.nome}" criou nova senha.`);
    } catch (error) {
        console.error('Erro:', error);
        if (erroDiv) { erroDiv.textContent = 'Erro ao salvar.'; erroDiv.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar e Acessar'; }
    }
}
function completarLogin(user) {
    usuarioLogado = user;
    sessionStorage.setItem('hrpi_session', JSON.stringify({ id: user.id, nome: user.nome, cargo: user.cargo, timestamp: Date.now() }));
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainSystem').classList.add('active');
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = user.nome;
    const cargo = user.cargo;
    const isAdmin = (cargo === 'Administrador' || cargo === 'Supervisor');
    const isServicoSocial = (cargo === 'Serviço Social');
    document.querySelectorAll('.social-admin, .admin-exclusive').forEach(el => el.style.display = 'none');
    if (isAdmin) { document.querySelectorAll('.social-admin, .admin-exclusive').forEach(el => el.style.display = ''); }
    else if (isServicoSocial) { document.querySelectorAll('.social-admin').forEach(el => el.style.display = ''); }
    iniciarSistema();
    iniciarMonitorSessao();
    navegarPara('dashboard');
    toast(`Bem-vindo(a), ${user.nome}!`);
    registrarLog('login', `Usuário "${user.nome}" (${user.cargo}) fez login.`);
}
function iniciarMonitorSessao() {
    ultimaAtividade = Date.now();
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(evt => {
        document.addEventListener(evt, () => { ultimaAtividade = Date.now(); }, { passive: true });
    });
    if (monitorSessaoId) clearInterval(monitorSessaoId);
    monitorSessaoId = setInterval(() => {
        if (!usuarioLogado) return;
        if (Date.now() - ultimaAtividade > CONFIG.SESSION_TIMEOUT) {
            toast('Sessão encerrada por inatividade.', 'error');
            logout();
            return;
        }
        // Renova o timestamp da sessão salva enquanto o usuário estiver ativo,
        // para que um recarregamento de página não derrube uma sessão em uso.
        const data = sessionStorage.getItem('hrpi_session');
        if (data) {
            try {
                const sessao = JSON.parse(data);
                sessao.timestamp = Date.now();
                sessionStorage.setItem('hrpi_session', JSON.stringify(sessao));
            } catch (e) { /* ignora */ }
        }
    }, CONFIG.INACTIVITY_CHECK_INTERVAL);
}
function pararMonitorSessao() {
    if (monitorSessaoId) { clearInterval(monitorSessaoId); monitorSessaoId = null; }
}
function logout() {
    if (usuarioLogado) registrarLog('logout', `Usuário "${usuarioLogado.nome}" saiu.`);
    sessionStorage.removeItem('hrpi_session');
    usuarioLogado = null;
    pararMonitorSessao();
    document.getElementById('mainSystem').classList.remove('active');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('firstAccessModal').style.display = 'none';
    document.getElementById('firstAccessModal').classList.remove('active');
    document.getElementById('loginForm').reset();
    const erroDiv = document.getElementById('loginError');
    if (erroDiv) { erroDiv.textContent = ''; erroDiv.style.display = 'none'; }
    document.getElementById('newPassword') && (document.getElementById('newPassword').value = '');
    document.getElementById('confirmPassword') && (document.getElementById('confirmPassword').value = '');
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
                        if (user.primeiroAcesso === true) {
                            usuarioLogado = { ...user, id: sessao.id };
                            document.getElementById('loginScreen').classList.add('hidden');
                            document.getElementById('firstAccessModal').style.display = 'flex';
                            document.getElementById('firstAccessModal').classList.add('active');
                        } else { completarLogin({ ...user, id: sessao.id }); }
                    } else { sessionStorage.removeItem('hrpi_session'); }
                }).catch(() => { sessionStorage.removeItem('hrpi_session'); });
            } else { sessionStorage.removeItem('hrpi_session'); }
        } catch (e) { sessionStorage.removeItem('hrpi_session'); }
    }
}
function navegarPara(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const page = document.getElementById(pageName);
    if (page) page.classList.add('active');
    const navLink = document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`);
    if (navLink) navLink.classList.add('active');
    switch (pageName) {
        case 'usuarios': carregarUsuarios(); break;
        case 'acompanhantesAtivos': atualizarAtivos(); break;
        case 'historico': atualizarHistorico(); break;
        case 'bloqueios': carregarBloqueios(); break;
        case 'logs': carregarLogs(); carregarUsuariosFiltroLogs(); break;
        case 'configuracoes': carregarSelectUsuarios(); break;
        case 'diagnostico': limparResultadoDiagnostico(); break;
        case 'dashboard': atualizarDashboardGerencial(); break;
    }
}

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================
function iniciarSistema() {
    db.ref('acompanhantes').on('value', snapshot => {
        acompanhantes = snapshot.val() || {};
        encerrarVisitasExpiradas(); // checa na hora, não espera o intervalo de 30s
        atualizarDashboardGerencial();
        atualizarAtivos();
        atualizarHistorico();
        atualizarSelects();
        atualizarListaPacientes();
        atualizarUltimosRegistros();
    });
    db.ref('bloqueios').on('value', snapshot => { bloqueios = snapshot.val() || {}; });
    inicializarAutocompletePacientes();
    // Se a aba ficou em segundo plano (navegador pode pausar o setInterval)
    // e volta a ficar visível, checa visitas expiradas na hora.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && usuarioLogado) encerrarVisitasExpiradas();
    });
}
function atualizarDataAtual() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Aplica máscara de telefone brasileiro ((00) 00000-0000 / (00) 0000-0000)
// enquanto o usuário digita, sem travar colar/apagar.
function aplicarMascaraTelefone(input) {
    input.addEventListener('input', () => {
        let v = input.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 10) {
            v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
        } else if (v.length > 5) {
            v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        } else if (v.length > 2) {
            v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        } else if (v.length > 0) {
            v = v.replace(/(\d{0,2})/, '($1');
        }
        input.value = v.trim().replace(/-$/, '').replace(/\)\s*$/, ') ');
    });
}
function inicializarMascarasTelefone() {
    document.querySelectorAll('input[type="tel"]').forEach(aplicarMascaraTelefone);
}

// ============================================
// PAINEL GERENCIAL REFORMULADO
// ============================================

function atualizarDashboardGerencial() {
    const dados = Object.values(acompanhantes);
    atualizarCards(dados);
    atualizarLabelPeriodo();
    atualizarAlertaPresenca();
    atualizarAlertaDuplicidade();

    const isAdmin = usuarioLogado && (usuarioLogado.cargo === 'Administrador' || usuarioLogado.cargo === 'Supervisor');
    const chartsRows = document.querySelectorAll('.charts-row');
    const painelInsights = document.querySelector('.painel-insights');
    const cardsRow = document.getElementById('cardsGerenciais');

    if (isAdmin) {
        chartsRows.forEach(row => row.style.display = '');
        if (painelInsights) painelInsights.style.display = '';
        atualizarGraficosGerenciais(dados);
        gerarInsights(dados);
    } else {
        chartsRows.forEach(row => row.style.display = 'none');
        if (painelInsights) painelInsights.style.display = 'none';
    }
}

// Mostra "Dados completos de [Mês] de [Ano]" no cabeçalho do painel.
function atualizarLabelPeriodo() {
    const el = document.getElementById('dashboardPeriodoLabel');
    if (!el) return;
    const nomesMeses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const agora = new Date();
    el.textContent = `Dados completos de ${nomesMeses[agora.getMonth()]} de ${agora.getFullYear()}`;
}

// Retorna os registros do mês corrente (do dia 1 até hoje). O Painel
// Gerencial sempre exibe o mês atual por completo — sem filtro manual.
function obterDadosFiltrados() {
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
    return Object.values(acompanhantes).filter(ac => {
        const [d, m, a] = ac.dataEntrada.split('-');
        const data = new Date(a, m - 1, d);
        return data >= inicio && data <= fim;
    });
}

function atualizarCards(dados) {
    const hoje = dataHoje();
    const todos = Object.values(acompanhantes);

    // Presentes agora, contados separadamente por tipo — este é o número
    // que a nutrição usa para calcular as refeições, então precisa estar
    // bem visível e nunca somado (acompanhante + visitante são coisas
    // muito diferentes em termos de tempo de permanência e refeições).
    const acompanhantesPresentes = todos.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante').length;
    const visitantesPresentes = todos.filter(ac => ac.status === 'presente' && ac.tipo === 'visita').length;

    // Pacientes Internados com Acompanhante (únicos, status presente)
    const acompPresentes = todos.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante');
    const pacientesUnicos = new Set(acompPresentes.map(ac => ac.nomePaciente)).size;

    // Entradas Hoje — contadas separadamente por tipo (acompanhante x visitante),
    // em vez de somadas num único número (que escondia a proporção de cada um).
    const entradasAcompanhantesHoje = todos.filter(ac => ac.dataEntrada === hoje && ac.tipo === 'acompanhante').length;
    const entradasVisitantesHoje = todos.filter(ac => ac.dataEntrada === hoje && ac.tipo === 'visita').length;

    // Saídas Hoje — mesma lógica, separadas por tipo.
    const saidasAcompanhantesHoje = todos.filter(ac => ac.dataSaida === hoje && ac.status === 'saiu' && ac.tipo === 'acompanhante').length;
    const saidasVisitantesHoje = todos.filter(ac => ac.dataSaida === hoje && ac.status === 'saiu' && ac.tipo === 'visita').length;

    // Trocas Hoje
    const trocasHoje = todos.filter(ac => ac.dataSaida === hoje && ac.status === 'trocado').length;

    // Altas de Pacientes (apenas acompanhantes que saíram por alta)
    const altasHoje = todos.filter(ac =>
        ac.dataSaida === hoje &&
        ac.status === 'saiu' &&
        ac.tipo === 'acompanhante' &&
        ac.observacao &&
        ac.observacao.toLowerCase().includes('alta do paciente')
    ).length;

    // Média Diária de Visitas no mês corrente (dia 1 até hoje)
    const dadosFiltrados = obterDadosFiltrados();
    const visitasFiltradas = dadosFiltrados.filter(ac => ac.tipo === 'visita');
    const agoraCard = new Date();
    const totalDias = agoraCard.getDate(); // dias corridos do mês até hoje
    const mediaVisitas = (visitasFiltradas.length / totalDias).toFixed(1);

    // Totais do Período — Acompanhantes e Visitantes, na semana (últimos 7
    // dias corridos, incluindo hoje) e no mês corrente (dia 1 até hoje).
    const inicioSemana7d = new Date(agoraCard);
    inicioSemana7d.setHours(0, 0, 0, 0);
    inicioSemana7d.setDate(inicioSemana7d.getDate() - 6);
    const fimHoje = new Date(agoraCard);
    fimHoje.setHours(23, 59, 59, 999);
    const dadosSemana = todos.filter(ac => {
        const [d, m, a] = ac.dataEntrada.split('-');
        const data = new Date(a, m - 1, d);
        return data >= inicioSemana7d && data <= fimHoje;
    });
    const acompanhantesSemana = dadosSemana.filter(ac => ac.tipo === 'acompanhante').length;
    const visitantesSemana = dadosSemana.filter(ac => ac.tipo === 'visita').length;
    const acompanhantesMes = dadosFiltrados.filter(ac => ac.tipo === 'acompanhante').length;
    const visitantesMes = visitasFiltradas.length;

    // Permanência Média dos Acompanhantes (baseado nos dados filtrados)
    const acompComSaida = dadosFiltrados.filter(ac => ac.tipo === 'acompanhante' && ac.status === 'saiu' && ac.dataSaida && ac.horaSaida);
    let permanenciaTotal = 0;
    acompComSaida.forEach(ac => {
        const entrada = new Date(ac.dataEntrada.split('-')[2], ac.dataEntrada.split('-')[1] - 1, ac.dataEntrada.split('-')[0], ...ac.horaEntrada.split(':').map(Number));
        const saida = new Date(ac.dataSaida.split('-')[2], ac.dataSaida.split('-')[1] - 1, ac.dataSaida.split('-')[0], ...ac.horaSaida.split(':').map(Number));
        permanenciaTotal += (saida - entrada) / (1000 * 3600);
    });
    const permanenciaMedia = acompComSaida.length ? (permanenciaTotal / acompComSaida.length).toFixed(1) : 0;

    // Atualiza o HTML
    document.getElementById('cardAcompanhantesPresentes').textContent = acompanhantesPresentes;
    document.getElementById('cardVisitantesPresentes').textContent = visitantesPresentes;

    // Subtexto do card "Acompanhantes Presentes": mostra para quantos
    // pacientes diferentes são, e alerta se o número de acompanhantes for
    // maior que o de pacientes (sinal de possível duplicidade — ver
    // detectarAcompanhantesDuplicados / alerta no topo do painel).
    const subPacientes = document.getElementById('cardPacientesAcompanhadosSub');
    if (subPacientes) {
        if (acompanhantesPresentes > pacientesUnicos) {
            subPacientes.textContent = `para ${pacientesUnicos} pacientes (${acompanhantesPresentes - pacientesUnicos} duplicado${acompanhantesPresentes - pacientesUnicos > 1 ? 's' : ''} — ver alerta acima)`;
            subPacientes.classList.add('alerta');
        } else {
            subPacientes.textContent = `para ${pacientesUnicos} paciente${pacientesUnicos !== 1 ? 's' : ''}`;
            subPacientes.classList.remove('alerta');
        }
    }

    document.getElementById('cardEntradasAcompanhantesHoje').textContent = entradasAcompanhantesHoje;
    document.getElementById('cardEntradasVisitantesHoje').textContent = entradasVisitantesHoje;
    document.getElementById('cardSaidasAcompanhantesHoje').textContent = saidasAcompanhantesHoje;
    document.getElementById('cardSaidasVisitantesHoje').textContent = saidasVisitantesHoje;
    document.getElementById('cardTrocasHoje').textContent = trocasHoje;
    document.getElementById('cardAltasHoje').textContent = altasHoje;
    document.getElementById('cardMediaVisitas').textContent = mediaVisitas;
    document.getElementById('cardPermanenciaMedia').textContent = permanenciaMedia + 'h';
    document.getElementById('cardAcompanhantesSemana').textContent = acompanhantesSemana;
    document.getElementById('cardVisitantesSemana').textContent = visitantesSemana;
    document.getElementById('cardAcompanhantesMes').textContent = acompanhantesMes;
    document.getElementById('cardVisitantesMes').textContent = visitantesMes;

    // Mesmos totais, espelhados na página de Relatórios.
    const elAcSemRel = document.getElementById('cardAcompanhantesSemanaRel');
    const elViSemRel = document.getElementById('cardVisitantesSemanaRel');
    const elAcMesRel = document.getElementById('cardAcompanhantesMesRel');
    const elViMesRel = document.getElementById('cardVisitantesMesRel');
    if (elAcSemRel) elAcSemRel.textContent = acompanhantesSemana;
    if (elViSemRel) elViSemRel.textContent = visitantesSemana;
    if (elAcMesRel) elAcMesRel.textContent = acompanhantesMes;
    if (elViMesRel) elViMesRel.textContent = visitantesMes;
}

function atualizarGraficosGerenciais(dados) {
    Object.values(graficos).forEach(g => g.destroy());
    graficos = {};
    if (document.getElementById('graficoSemanal')) graficoSemanal(dados);
    if (document.getElementById('graficoSetores')) graficoSetores(dados);
    if (document.getElementById('graficoTendencia')) graficoTendencia(dados);
    if (document.getElementById('graficoTrocasDiarias')) graficoTrocasDiarias(dados);
    if (document.getElementById('graficoHorarioMovimento')) graficoHorarioMovimento(dados);
    if (document.getElementById('graficoRankingSetores')) graficoRankingSetores(dados);
    if (document.getElementById('graficoPermanenciaSetor')) graficoPermanenciaSetor(dados);
    if (document.getElementById('graficoFluxoDiario')) graficoFluxoDiario(dados);
}

function graficoSemanal(dados) {
    const canvas = document.getElementById('graficoSemanal');
    if (!canvas) return;
    const dias = [], entradasAcomp = [], entradasVisit = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dataStr = formatarData(d);
        dias.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
        entradasAcomp.push(dados.filter(ac => ac.dataEntrada === dataStr && ac.tipo === 'acompanhante').length);
        entradasVisit.push(dados.filter(ac => ac.dataEntrada === dataStr && ac.tipo === 'visita').length);
    }
    graficos.semanal = new Chart(canvas, {
        type: 'bar',
        data: { labels: dias, datasets: [
            { label: 'Entradas de Acompanhantes', data: entradasAcomp, backgroundColor: '#16697a', borderRadius: 6 },
            { label: 'Entradas de Visitantes', data: entradasVisit, backgroundColor: '#6a4c93', borderRadius: 6 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function graficoSetores(dados) {
    const canvas = document.getElementById('graficoSetores');
    if (!canvas) return;
    const setores = {};
    dados.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante').forEach(ac => setores[ac.setor] = (setores[ac.setor] || 0) + 1);
    const labels = Object.keys(setores), values = Object.values(setores);
    const total = values.reduce((a, b) => a + b, 0);
    let html = '<table><tr><th>Setor</th><th>Qtd</th><th>%</th></tr>';
    labels.forEach((l, i) => { const pct = total ? ((values[i] / total) * 100).toFixed(1) : 0; html += `<tr><td>${l}</td><td>${values[i]}</td><td>${pct}%</td></tr>`; });
    document.getElementById('tabelaSetores').innerHTML = html;
    graficos.setores = new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: ['#1a6b7a','#2d8b4e','#c7841a','#8e44ad','#c0392b','#2c9aaf','#e8913a','#3498db'] }] },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            layout: { padding: 10 }
        }
    });
}

function graficoTendencia(dados) {
    const canvas = document.getElementById('graficoTendencia');
    if (!canvas) return;
    const dias = [], visitas = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dataStr = formatarData(d);
        dias.push(dataStr.substring(0, 5));
        visitas.push(dados.filter(ac => ac.dataEntrada === dataStr && ac.tipo === 'visita').length);
    }
    graficos.tendencia = new Chart(canvas, {
        type: 'line',
        data: { labels: dias, datasets: [{ data: visitas, borderColor: '#8e44ad', backgroundColor: 'rgba(142,68,173,0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function graficoTrocasDiarias(dados) {
    const canvas = document.getElementById('graficoTrocasDiarias');
    if (!canvas) return;
    const dias = [], trocas = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dataStr = formatarData(d);
        dias.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
        trocas.push(dados.filter(ac => ac.dataSaida === dataStr && ac.status === 'trocado').length);
    }
    graficos.trocas = new Chart(canvas, {
        type: 'bar',
        data: { labels: dias, datasets: [{ data: trocas, backgroundColor: '#e67e22', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function graficoHorarioMovimento(dados) {
    const canvas = document.getElementById('graficoHorarioMovimento');
    if (!canvas) return;
    const horas = Array.from({length: 16}, (_, i) => `${String(i + 7).padStart(2, '0')}h`);
    const entradas = Array(16).fill(0), saidas = Array(16).fill(0), trocas = Array(16).fill(0);
    dados.forEach(ac => {
        const h = parseInt(ac.horaEntrada.split(':')[0]);
        if (h >= 7 && h < 23) entradas[h - 7]++;
        if (ac.horaSaida) { 
            const hs = parseInt(ac.horaSaida.split(':')[0]); 
            if (hs >= 7 && hs < 23) saidas[hs - 7]++; 
            if (ac.status === 'trocado') trocas[hs - 7]++; 
        }
    });
    graficos.horario = new Chart(canvas, {
        type: 'bar',
        data: { labels: horas, datasets: [
            { label: 'Entradas', data: entradas, backgroundColor: '#2980b9' },
            { label: 'Saídas', data: saidas, backgroundColor: '#c0392b' },
            { label: 'Trocas', data: trocas, backgroundColor: '#e67e22' }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
    });
}

function graficoRankingSetores(dados) {
    const canvas = document.getElementById('graficoRankingSetores');
    if (!canvas) return;
    const setores = {};
    dados.forEach(ac => {
        if (!ac.setor) return;
        if (!setores[ac.setor]) setores[ac.setor] = { acompanhantes: 0, visitas: 0, trocas: 0 };
        if (ac.tipo === 'acompanhante') setores[ac.setor].acompanhantes++;
        if (ac.tipo === 'visita') setores[ac.setor].visitas++;
        if (ac.status === 'trocado') setores[ac.setor].trocas++;
    });
    const labels = Object.keys(setores).sort((a, b) => (setores[b].acompanhantes + setores[b].visitas) - (setores[a].acompanhantes + setores[a].visitas));
    graficos.ranking = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Acompanhantes', data: labels.map(l => setores[l].acompanhantes), backgroundColor: '#1a6b7a' },
            { label: 'Visitas', data: labels.map(l => setores[l].visitas), backgroundColor: '#8e44ad' },
            { label: 'Trocas', data: labels.map(l => setores[l].trocas), backgroundColor: '#e67e22' }
        ]},
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { beginAtZero: true } } }
    });
}

function graficoPermanenciaSetor(dados) {
    const canvas = document.getElementById('graficoPermanenciaSetor');
    if (!canvas) return;
    const permanencia = {};
    dados.filter(ac => ac.tipo === 'acompanhante' && ac.status === 'saiu').forEach(ac => {
        const entrada = new Date(ac.dataEntrada.split('-')[2], ac.dataEntrada.split('-')[1] - 1, ac.dataEntrada.split('-')[0], ...ac.horaEntrada.split(':').map(Number));
        const saida = new Date(ac.dataSaida.split('-')[2], ac.dataSaida.split('-')[1] - 1, ac.dataSaida.split('-')[0], ...ac.horaSaida.split(':').map(Number));
        const horas = (saida - entrada) / (1000 * 3600);
        if (!permanencia[ac.setor]) permanencia[ac.setor] = { total: 0, count: 0 };
        permanencia[ac.setor].total += horas;
        permanencia[ac.setor].count++;
    });
    const labels = Object.keys(permanencia).sort((a, b) => (permanencia[b].total / permanencia[b].count) - (permanencia[a].total / permanencia[a].count));
    const medias = labels.map(l => (permanencia[l].total / permanencia[l].count).toFixed(1));
    graficos.permanencia = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ data: medias, backgroundColor: '#16a085', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function graficoFluxoDiario(dados) {
    const canvas = document.getElementById('graficoFluxoDiario');
    if (!canvas) return;
    const horas = Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}h`);
    const entradas = Array(24).fill(0), saidas = Array(24).fill(0), trocas = Array(24).fill(0);
    dados.forEach(ac => {
        const h = parseInt(ac.horaEntrada.split(':')[0]);
        entradas[h]++;
        if (ac.horaSaida) { 
            const hs = parseInt(ac.horaSaida.split(':')[0]); 
            saidas[hs]++; 
            if (ac.status === 'trocado') trocas[hs]++; 
        }
    });
    graficos.fluxo = new Chart(canvas, {
        type: 'line',
        data: { labels: horas, datasets: [
            { label: 'Entradas', data: entradas, borderColor: '#2980b9', tension: 0.3 },
            { label: 'Saídas', data: saidas, borderColor: '#c0392b', tension: 0.3 },
            { label: 'Trocas', data: trocas, borderColor: '#e67e22', tension: 0.3 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
    });
}

function gerarInsights(dados) {
    const insights = [];
    const hoje = dataHoje();
    
    // 1. Setor com maior concentração de acompanhantes
    const setores = {};
    dados.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante').forEach(ac => {
        setores[ac.setor] = (setores[ac.setor] || 0) + 1;
    });
    const totalAcomp = Object.values(setores).reduce((a, b) => a + b, 0);
    const setorPrincipal = Object.entries(setores).sort((a, b) => b[1] - a[1])[0];
    if (setorPrincipal) {
        const pct = ((setorPrincipal[1] / totalAcomp) * 100).toFixed(1);
        insights.push(`O setor <strong>${setorPrincipal[0]}</strong> concentra ${pct}% dos acompanhantes.`);
    }

    // 2. Trocas hoje
    const trocasHoje = dados.filter(ac => ac.dataSaida === hoje && ac.status === 'trocado').length;
    if (trocasHoje > 0) {
        insights.push(`Hoje ocorreram <strong>${trocasHoje} trocas</strong> de acompanhantes.`);
    }

    // 3. Horário de maior movimento
    const horas = Array(24).fill(0);
    dados.forEach(ac => horas[parseInt(ac.horaEntrada.split(':')[0])]++);
    const pico = horas.indexOf(Math.max(...horas));
    insights.push(`O horário de maior movimento é por volta das <strong>${String(pico).padStart(2, '0')}h</strong>.`);

    // 4. Permanência média
    const acompComSaida = dados.filter(ac => ac.tipo === 'acompanhante' && ac.status === 'saiu' && ac.dataSaida && ac.horaSaida);
    let permanenciaTotal = 0;
    acompComSaida.forEach(ac => {
        const entrada = new Date(ac.dataEntrada.split('-')[2], ac.dataEntrada.split('-')[1] - 1, ac.dataEntrada.split('-')[0], ...ac.horaEntrada.split(':').map(Number));
        const saida = new Date(ac.dataSaida.split('-')[2], ac.dataSaida.split('-')[1] - 1, ac.dataSaida.split('-')[0], ...ac.horaSaida.split(':').map(Number));
        permanenciaTotal += (saida - entrada) / (1000 * 3600);
    });
    const permanenciaMedia = acompComSaida.length ? Math.round(permanenciaTotal / acompComSaida.length) : 0;
    if (permanenciaMedia > 0) {
        insights.push(`A permanência média dos acompanhantes é de <strong>${permanenciaMedia} horas</strong>.`);
    }

    // 5. Visitas por setor (setor com mais visitas na semana)
    const semanaInicio = new Date(); semanaInicio.setDate(semanaInicio.getDate() - 6);
    const visitasSetorSemana = {};
    dados.filter(ac => ac.tipo === 'visita' && new Date(ac.dataEntrada.split('-')[2], ac.dataEntrada.split('-')[1] - 1, ac.dataEntrada.split('-')[0]) >= semanaInicio)
        .forEach(ac => visitasSetorSemana[ac.setor] = (visitasSetorSemana[ac.setor] || 0) + 1);
    const setorMaisVisitas = Object.entries(visitasSetorSemana).sort((a, b) => b[1] - a[1])[0];
    if (setorMaisVisitas) {
        insights.push(`O setor <strong>${setorMaisVisitas[0]}</strong> teve o maior número de visitas nesta semana (${setorMaisVisitas[1]}).`);
    }

    // 6. Média diária de visitas
    const visitas = dados.filter(ac => ac.tipo === 'visita');
    const dataInicio = dados.length > 0 ? dados.reduce((min, ac) => ac.dataEntrada < min ? ac.dataEntrada : min, dados[0].dataEntrada) : hoje;
    const inicio = new Date(dataInicio.split('-')[2], dataInicio.split('-')[1] - 1, dataInicio.split('-')[0]);
    const totalDias = Math.max(1, Math.ceil((new Date() - inicio) / 86400000));
    const mediaDiaria = Math.round(visitas.length / totalDias);
    if (mediaDiaria > 0) {
        insights.push(`A média diária de visitas é de <strong>${mediaDiaria}</strong> por dia.`);
    }

    // 7. Variação de trocas (comparação com semana anterior)
    const estaSemana = dados.filter(ac => {
        const d = new Date(ac.dataSaida?.split('-')[2], ac.dataSaida?.split('-')[1] - 1, ac.dataSaida?.split('-')[0]);
        const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - 6);
        return ac.status === 'trocado' && d >= inicioSemana;
    }).length;
    const semanaPassada = dados.filter(ac => {
        const d = new Date(ac.dataSaida?.split('-')[2], ac.dataSaida?.split('-')[1] - 1, ac.dataSaida?.split('-')[0]);
        const inicio = new Date(); inicio.setDate(inicio.getDate() - 13);
        const fim = new Date(); fim.setDate(fim.getDate() - 7);
        return ac.status === 'trocado' && d >= inicio && d <= fim;
    }).length;
    if (semanaPassada > 0) {
        const variacao = (((estaSemana - semanaPassada) / semanaPassada) * 100).toFixed(0);
        const sinal = variacao > 0 ? '+' : '';
        insights.push(`O número de trocas variou <strong>${sinal}${variacao}%</strong> em relação à semana anterior.`);
    }

    const container = document.getElementById('insightsContainer');
    if (container) container.innerHTML = insights.map(i => `<div class="insight-item"><i class="fas fa-lightbulb"></i> ${i}</div>`).join('');
}

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
            else situacao = '<span style="color:#c0392b;font-weight:600;">Expirado</span>';
        } else if (ac.tipo === 'acompanhante') {
            // Confirmação de presença: sinaliza quem está há dias sem
            // confirmação, para a recepção verificar se realmente ainda
            // está no hospital (dado usado pela nutrição para as refeições).
            const dias = diasDesde(ac.ultimaConfirmacao || ac.dataEntrada);
            if (dias >= CONFIG.DIAS_ALERTA_PRESENCA) {
                situacao = `<button class="btn-alerta-presenca" onclick="confirmarPresenca('${ac.id}')" title="Confirmar que ainda está presente no hospital"><i class="fas fa-exclamation-triangle"></i> Confirmar (${dias}d)</button>`;
            } else {
                situacao = `<span style="color:var(--text-muted);font-size:12px;white-space:nowrap;"><i class="fas fa-check-circle" style="color:#2d8b4e"></i> OK (${dias === 0 ? 'hoje' : dias + 'd'})</span>`;
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
                <button class="btn-icon" onclick="abrirCracha('${ac.id}')" style="color:#1a6b7a" title="Crachá"><i class="fas fa-id-card"></i></button>
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
    if (!banner) return;
    const pendentes = Object.values(acompanhantes).filter(ac =>
        ac.status === 'presente' && ac.tipo === 'acompanhante' &&
        diasDesde(ac.ultimaConfirmacao || ac.dataEntrada) >= CONFIG.DIAS_ALERTA_PRESENCA
    );
    if (pendentes.length === 0) { banner.style.display = 'none'; return; }
    const texto = pendentes.length === 1
        ? `1 acompanhante está há ${CONFIG.DIAS_ALERTA_PRESENCA}+ dias sem confirmação de presença — pode ter saído sem que a saída fosse registrada. Isso afeta a contagem de refeições da nutrição.`
        : `${pendentes.length} acompanhantes estão há ${CONFIG.DIAS_ALERTA_PRESENCA}+ dias sem confirmação de presença — podem ter saído sem que a saída fosse registrada. Isso afeta a contagem de refeições da nutrição.`;
    document.getElementById('alertaPresencaTexto').textContent = texto;
    banner.style.display = 'flex';
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
    if (!banner) return;
    const duplicados = detectarAcompanhantesDuplicados();
    if (duplicados.length === 0) { banner.style.display = 'none'; return; }
    const totalExtras = duplicados.reduce((soma, g) => soma + (g.length - 1), 0);
    const texto = duplicados.length === 1
        ? `1 paciente está com mais de um acompanhante ativo ao mesmo tempo (${totalExtras} registro extra) — provavelmente uma saída que não foi dada baixa antes de um novo acompanhante entrar.`
        : `${duplicados.length} pacientes estão com mais de um acompanhante ativo ao mesmo tempo (${totalExtras} registros extras no total) — provavelmente saídas que não foram dadas baixa antes de um novo acompanhante entrar.`;
    document.getElementById('alertaDuplicidadeTexto').textContent = texto;
    banner.style.display = 'flex';
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
                <button class="btn-icon" onclick="verDetalhesPaciente('${ac.id}')" style="color:#1a6b7a" title="Histórico do paciente"><i class="fas fa-history"></i></button>
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

// ============================================
// DIAGNÓSTICO DE DADOS — encontra registros "presente" há tempo
// demais (provável esquecimento de saída pela recepção), que causam
// divergência entre o Painel (conta tudo que está "presente") e os
// Relatórios em PDF (contam movimentação dentro de um período).
// ============================================
function parseDataHora(dataStr, horaStr) {
    const [d, m, a] = dataStr.split('-');
    const [h, min] = (horaStr || '00:00').split(':').map(Number);
    return new Date(a, m - 1, d, h, min);
}

function formatarTempoDecorrido(ms) {
    const horas = ms / (1000 * 60 * 60);
    if (horas < 24) return `${horas.toFixed(1)}h`;
    const dias = Math.floor(horas / 24);
    const horasRestantes = Math.round(horas % 24);
    return `${dias}d ${horasRestantes}h`;
}

function limparResultadoDiagnostico() {
    const resultCard = document.getElementById('diagResultadoCard');
    const vazioCard = document.getElementById('diagVazioCard');
    if (resultCard) resultCard.style.display = 'none';
    if (vazioCard) vazioCard.style.display = 'none';
    const tbody = document.getElementById('diagTbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty-table-message"><i class="fas fa-inbox"></i> Nenhum registro analisado ainda</td></tr>';
}

function rodarDiagnostico() {
    const limiteDias = parseFloat(document.getElementById('diagLimiteAcompanhanteDias')?.value) || 15;
    const limiteHoras = parseFloat(document.getElementById('diagLimiteVisitanteHoras')?.value) || 2;
    const agora = new Date();

    const suspeitos = Object.values(acompanhantes).filter(ac => {
        if (ac.status !== 'presente') return false;
        const entrada = parseDataHora(ac.dataEntrada, ac.horaEntrada);
        const horasPresente = (agora - entrada) / (1000 * 60 * 60);
        if (ac.tipo === 'acompanhante') return horasPresente > limiteDias * 24;
        return horasPresente > limiteHoras;
    }).sort((a, b) => parseDataHora(a.dataEntrada, a.horaEntrada) - parseDataHora(b.dataEntrada, b.horaEntrada));

    const resultCard = document.getElementById('diagResultadoCard');
    const vazioCard = document.getElementById('diagVazioCard');
    const tbody = document.getElementById('diagTbody');
    const contador = document.getElementById('diagContador');

    if (suspeitos.length === 0) {
        resultCard.style.display = 'none';
        vazioCard.style.display = '';
        return;
    }

    vazioCard.style.display = 'none';
    resultCard.style.display = '';
    contador.textContent = suspeitos.length;

    tbody.innerHTML = suspeitos.map(ac => {
        const entrada = parseDataHora(ac.dataEntrada, ac.horaEntrada);
        const tempo = formatarTempoDecorrido(agora - entrada);
        const tipoBadge = ac.tipo === 'visita' ? 'badge-visita' : 'badge-info';
        const tipoLabel = ac.tipo === 'visita' ? 'Visitante' : 'Acompanhante';
        return `<tr>
            <td><input type="checkbox" class="diag-check" data-id="${ac.id}" onclick="atualizarBotaoLoteDiagnostico()"></td>
            <td><span class="badge ${tipoBadge}">${tipoLabel}</span></td>
            <td>${ac.nomeAcompanhante || '-'}</td>
            <td>${ac.nomePaciente || '-'}</td>
            <td>${ac.setor || '-'}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td><span class="badge badge-danger">${tempo}</span></td>
            <td><button class="btn-icon" title="Registrar saída deste registro" onclick="darSaidaSingleDiagnostico('${ac.id}')"><i class="fas fa-sign-out-alt"></i></button></td>
        </tr>`;
    }).join('');

    const selTodos = document.getElementById('diagSelecionarTodos');
    if (selTodos) selTodos.checked = false;
    atualizarBotaoLoteDiagnostico();
}

function toggleSelecionarTodosDiagnostico(origem) {
    document.querySelectorAll('.diag-check').forEach(chk => chk.checked = origem.checked);
    atualizarBotaoLoteDiagnostico();
}

function atualizarBotaoLoteDiagnostico() {
    const marcados = document.querySelectorAll('.diag-check:checked').length;
    const btn = document.getElementById('btnDarSaidaLote');
    if (btn) {
        btn.disabled = marcados === 0;
        btn.innerHTML = marcados > 0
            ? `<i class="fas fa-sign-out-alt"></i> Registrar Saída dos Selecionados (${marcados})`
            : `<i class="fas fa-sign-out-alt"></i> Registrar Saída dos Selecionados`;
    }
}

function darSaidaLoteDiagnostico() {
    const ids = Array.from(document.querySelectorAll('.diag-check:checked')).map(chk => chk.dataset.id);
    if (ids.length === 0) return;
    const motivo = document.getElementById('diagMotivoLote')?.value?.trim() || 'Correção de registro — saída não computada no sistema';
    if (!confirm(`Registrar saída de ${ids.length} registro(s) agora, com motivo:\n"${motivo}"?\n\nEsta ação atualiza o banco de dados e não pode ser desfeita automaticamente.`)) return;

    const btn = document.getElementById('btnDarSaidaLote');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Registrando...'; }

    const atualizacoes = {};
    ids.forEach(id => {
        const atual = acompanhantes[id];
        if (!atual) return;
        const obs = atual.observacao ? `${atual.observacao} | Saída: ${motivo}` : `Saída: ${motivo}`;
        atualizacoes[id] = { ...atual, status: 'saiu', dataSaida: dataHoje(), horaSaida: horaAgora(), recepcionistaSaida: usuarioLogado?.nome || 'Sistema', observacao: obs };
    });

    const promessas = Object.keys(atualizacoes).map(id => db.ref('acompanhantes/' + id).update(atualizacoes[id]));
    Promise.all(promessas).then(() => {
        toast(`Saída registrada para ${ids.length} registro(s).`);
        registrarLog('saida', `Diagnóstico de dados: correção em lote de ${ids.length} registro(s) esquecido(s). Motivo: ${motivo}.`);
        rodarDiagnostico();
    }).catch(err => {
        console.error(err);
        toast('Erro ao registrar saída em lote.', 'error');
    }).finally(() => {
        if (btn) btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Registrar Saída dos Selecionados';
    });
}

function darSaidaSingleDiagnostico(id) {
    const atual = acompanhantes[id];
    if (!atual) { toast('Registro não encontrado.', 'error'); return; }
    const motivo = document.getElementById('diagMotivoLote')?.value?.trim() || 'Correção de registro — saída não computada no sistema';
    if (!confirm(`Registrar saída de "${atual.nomeAcompanhante}" agora, com motivo:\n"${motivo}"?`)) return;
    const obs = atual.observacao ? `${atual.observacao} | Saída: ${motivo}` : `Saída: ${motivo}`;
    db.ref('acompanhantes/' + id).update({ status: 'saiu', dataSaida: dataHoje(), horaSaida: horaAgora(), recepcionistaSaida: usuarioLogado?.nome || 'Sistema', observacao: obs })
    .then(() => {
        toast(`Saída de "${atual.nomeAcompanhante}" registrada com sucesso!`);
        registrarLog('saida', `Diagnóstico de dados: correção individual - "${atual.nomeAcompanhante}". Motivo: ${motivo}.`, id);
        rodarDiagnostico();
    }).catch(err => {
        console.error(err);
        toast('Erro ao registrar saída.', 'error');
    });
}

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
    // Fechar a lista de resultados
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('globalSearchInput').value = '';

    const ac = acompanhantes[id];
    if (!ac) return;

    // Se for um acompanhante presente, leva para a troca já com ele selecionado
    if (ac.status === 'presente' && ac.tipo === 'acompanhante') {
        navegarPara('registroTroca');
        // Pequeno delay para garantir que a página esteja pronta
        setTimeout(() => selecionarAcompanhanteTroca(id), 300);
        return;
    }

    // Para visitantes ou acompanhantes que já saíram, vai para o histórico
    navegarPara('historico');
    setTimeout(() => {
        const campoTexto = document.getElementById('filtroTexto');
        if (campoTexto) {
            campoTexto.value = ac.nomeAcompanhante;
            filtrarHistorico();
        }
    }, 300);
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
// RELATÓRIOS EM PDF
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
    
    // Filtrar dados (movimentação do período: entradas, saídas, trocas)
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
    let saidasAcompanhantes = 0;
    let saidasVisitantes = 0;
    let totalAltas = 0;
    let totalTrocas = 0;

    // "Presentes agora" é uma contagem do momento atual, não do período do
    // relatório — por isso usa a base completa (todosAcompanhantes), igual
    // ao Painel Gerencial. Se usasse "dados" (filtrado pelo período), quem
    // entrou antes do período e ainda não teve saída registrada sumiria da
    // contagem, gerando divergência com o número mostrado no Painel.
    const todosAcompanhantes = Object.values(acompanhantes);
    let acompanhantesAtivos = todosAcompanhantes.filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante').length;
    let visitasAtivas = todosAcompanhantes.filter(ac => ac.status === 'presente' && ac.tipo === 'visita').length;
    
    // Agrupar por setor (acompanhantes e visitantes contados separadamente)
    const setoresMap = {};
    // "Ativos" por setor também usa a base completa, pelo mesmo motivo acima.
    todosAcompanhantes.forEach(ac => {
        if (ac.status === 'presente' && ac.setor) {
            if (!setoresMap[ac.setor]) setoresMap[ac.setor] = { entradasAcomp: 0, entradasVisit: 0, ativosAcomp: 0, ativosVisit: 0 };
            if (ac.tipo === 'acompanhante') setoresMap[ac.setor].ativosAcomp++;
            else setoresMap[ac.setor].ativosVisit++;
        }
    });
    
    dados.forEach(ac => {
        // Contagem por tipo
        if (ac.tipo === 'acompanhante') totalAcompanhantes++;
        if (ac.tipo === 'visita') totalVisitas++;
        
        // Status (saídas e trocas continuam contadas dentro do período — isso
        // está correto, pois representam eventos que aconteceram no período)
        if (ac.status === 'saiu' && ac.tipo === 'acompanhante') saidasAcompanhantes++;
        if (ac.status === 'saiu' && ac.tipo === 'visita') saidasVisitantes++;
        if (ac.status === 'trocado') totalTrocas++;
        
        // Alta de paciente = saída de acompanhante cujo motivo registrado foi "alta do paciente"
        // (exclui saída automática de visita, fim de horário e desistência)
        if (ac.status === 'saiu' && 
            ac.observacao && 
            ac.observacao.toLowerCase().includes('alta do paciente') &&
            !ac.observacao.toLowerCase().includes('saída automática') &&
            !ac.observacao.toLowerCase().includes('fim do horário') &&
            !ac.observacao.toLowerCase().includes('desistência')) {
            totalAltas++;
        }
        
        // Agrupar por setor — entradas do período (ativos já foi calculado acima, com a base completa)
        if (ac.setor) {
            if (!setoresMap[ac.setor]) setoresMap[ac.setor] = { entradasAcomp: 0, entradasVisit: 0, ativosAcomp: 0, ativosVisit: 0 };
            if (ac.tipo === 'acompanhante') setoresMap[ac.setor].entradasAcomp++;
            else setoresMap[ac.setor].entradasVisit++;
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
        // RESUMO COM INDICADORES — em dois blocos separados
        // (Acompanhantes x Visitantes), para não misturar números
        // que representam coisas diferentes.
        // ============================================
        let yAtual = 38;
        
        doc.setFontSize(12);
        doc.setTextColor(26, 107, 122);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO DO PERÍODO', 14, yAtual);
        yAtual += 6;

        const larguraBloco = 133;
        const xAcomp = 14, xVisit = 14 + larguraBloco + 3;
        const alturaBloco = 30;

        // Bloco Acompanhantes
        doc.setFillColor(227, 241, 244); // --stat-presentes-acomp-bg
        doc.roundedRect(xAcomp, yAtual, larguraBloco, alturaBloco, 2, 2, 'F');
        doc.setDrawColor(22, 105, 122);
        doc.setLineWidth(0.3);
        doc.roundedRect(xAcomp, yAtual, larguraBloco, alturaBloco, 2, 2, 'S');
        doc.setFontSize(10);
        doc.setTextColor(22, 105, 122);
        doc.setFont('helvetica', 'bold');
        doc.text('ACOMPANHANTES', xAcomp + 5, yAtual + 7);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        doc.text(`Entradas no período: ${totalAcompanhantes}`, xAcomp + 5, yAtual + 15);
        doc.text(`Saídas registradas: ${saidasAcompanhantes}`, xAcomp + 5, yAtual + 21);
        doc.text(`Trocas de acompanhante: ${totalTrocas}`, xAcomp + 5, yAtual + 27);
        doc.setFont('helvetica', 'bold');
        doc.text(`Presentes agora: ${acompanhantesAtivos}`, xAcomp + 75, yAtual + 15);
        doc.text(`Altas de pacientes: ${totalAltas}`, xAcomp + 75, yAtual + 21);

        // Bloco Visitantes
        doc.setFillColor(237, 230, 245); // --stat-presentes-visit-bg
        doc.roundedRect(xVisit, yAtual, larguraBloco, alturaBloco, 2, 2, 'F');
        doc.setDrawColor(106, 76, 147);
        doc.roundedRect(xVisit, yAtual, larguraBloco, alturaBloco, 2, 2, 'S');
        doc.setFontSize(10);
        doc.setTextColor(106, 76, 147);
        doc.setFont('helvetica', 'bold');
        doc.text('VISITANTES', xVisit + 5, yAtual + 7);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        doc.text(`Entradas no período: ${totalVisitas}`, xVisit + 5, yAtual + 15);
        doc.text(`Saídas automáticas (1h): ${saidasVisitantes}`, xVisit + 5, yAtual + 21);
        doc.setFont('helvetica', 'bold');
        doc.text(`Presentes agora: ${visitasAtivas}`, xVisit + 75, yAtual + 15);

        yAtual += alturaBloco + 8;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.setFont('helvetica', 'italic');
        doc.text(`Total de registros no período: ${totalEntradas}  (${totalAcompanhantes} acompanhantes + ${totalVisitas} visitantes)`, 14, yAtual);
        yAtual += 8;
        
        // ============================================
        // RESUMO POR SETOR (acompanhantes e visitantes em colunas separadas)
        // ============================================
        if (Object.keys(setoresMap).length > 0) {
            doc.setFontSize(11);
            doc.setTextColor(26, 107, 122);
            doc.setFont('helvetica', 'bold');
            doc.text('MOVIMENTAÇÃO POR SETOR', 14, yAtual);
            
            yAtual += 7;
            
            // Cabeçalho da tabela de setores
            const colSetor = 14, wSetor = 68;
            const colEntAc = colSetor + wSetor, wCol = 43;
            const colAtAc = colEntAc + wCol;
            const colEntVi = colAtAc + wCol;
            const colAtVi = colEntVi + wCol;

            doc.setFillColor(26, 107, 122);
            doc.setTextColor(255);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.rect(colSetor, yAtual, wSetor, 10, 'F');
            doc.rect(colEntAc, yAtual, wCol, 5, 'F');
            doc.rect(colAtAc, yAtual, wCol, 5, 'F');
            doc.rect(colEntVi, yAtual, wCol, 5, 'F');
            doc.rect(colAtVi, yAtual, wCol, 5, 'F');
            doc.text('Acompanhantes', colEntAc + wCol, yAtual + 3.5, { align: 'center' });
            doc.rect(colEntAc, yAtual + 5, wCol, 5, 'F');
            doc.rect(colAtAc, yAtual + 5, wCol, 5, 'F');
            doc.text('Visitantes', colEntVi + wCol, yAtual + 3.5, { align: 'center' });
            doc.rect(colEntVi, yAtual + 5, wCol, 5, 'F');
            doc.rect(colAtVi, yAtual + 5, wCol, 5, 'F');

            doc.setFontSize(7);
            doc.text('Setor', colSetor + 2, yAtual + 6.5);
            doc.text('Entradas', colEntAc + wCol / 2, yAtual + 8.5, { align: 'center' });
            doc.text('Ativos', colAtAc + wCol / 2, yAtual + 8.5, { align: 'center' });
            doc.text('Entradas', colEntVi + wCol / 2, yAtual + 8.5, { align: 'center' });
            doc.text('Ativos', colAtVi + wCol / 2, yAtual + 8.5, { align: 'center' });
            
            yAtual += 10;
            
            // Dados dos setores
            Object.entries(setoresMap).sort().forEach(([setor, d], index) => {
                if (index % 2 === 0) {
                    doc.setFillColor(245, 250, 252);
                    doc.rect(colSetor, yAtual, wSetor, 5, 'F');
                    doc.rect(colEntAc, yAtual, wCol, 5, 'F');
                    doc.rect(colAtAc, yAtual, wCol, 5, 'F');
                    doc.rect(colEntVi, yAtual, wCol, 5, 'F');
                    doc.rect(colAtVi, yAtual, wCol, 5, 'F');
                }
                
                doc.setTextColor(50);
                doc.setFont('helvetica', 'normal');
                doc.text(setor, colSetor + 2, yAtual + 3.5);
                doc.text(String(d.entradasAcomp), colEntAc + wCol / 2, yAtual + 3.5, { align: 'center' });
                doc.text(String(d.ativosAcomp), colAtAc + wCol / 2, yAtual + 3.5, { align: 'center' });
                doc.text(String(d.entradasVisit), colEntVi + wCol / 2, yAtual + 3.5, { align: 'center' });
                doc.text(String(d.ativosVisit), colAtVi + wCol / 2, yAtual + 3.5, { align: 'center' });
                
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
            head: [['Tipo', 'Nome', 'Documento', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Entrada', 'Saída', 'Situação']],
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
                { presente: 'Presente', saiu: 'Saiu', trocado: 'Trocado' }[ac.status] || ac.status
            ]),
            styles: { fontSize: 7 },
            headStyles: { fillColor: [26, 107, 122], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [232, 244, 247] },
            margin: { left: 14, right: 14 },
            didParseCell: function (data) {
                // Colore a coluna "Situação" para leitura rápida do status
                if (data.section === 'body' && data.column.index === 9) {
                    const valor = data.cell.raw;
                    if (valor === 'Presente') { data.cell.styles.textColor = [39, 122, 79]; data.cell.styles.fontStyle = 'bold'; }
                    else if (valor === 'Saiu') { data.cell.styles.textColor = [140, 30, 30]; }
                    else if (valor === 'Trocado') { data.cell.styles.textColor = [150, 90, 10]; }
                }
            }
        });
        
        // Rodapé
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.setFont('helvetica', 'italic');
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, finalY);
        doc.text(`${totalAcompanhantes} acompanhantes + ${totalVisitas} visitantes = ${totalEntradas} registros no período | Gerado por: ${usuarioLogado?.nome || 'Sistema'}`, 148, finalY, { align: 'center' });
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

// Lista simples e direta de quem está presente agora como acompanhante,
// organizada por setor — para a nutrição usar na hora de montar as
// refeições, sem precisar filtrar a planilha completa de registros.
function exportarListaNutricao() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente' && a.tipo === 'acompanhante');
    if (presentes.length === 0) { toast('Nenhum acompanhante presente no momento.', 'error'); return; }

    presentes.sort((a, b) => a.setor.localeCompare(b.setor) || a.leito?.localeCompare(b.leito || '') || 0);

    let csv = '\uFEFFSetor;Leito;Paciente;Acompanhante;Desde\n';
    presentes.forEach(ac => {
        csv += [
            `"${ac.setor || ''}"`,
            `"${ac.leito || '-'}"`,
            `"${ac.nomePaciente || ''}"`,
            `"${ac.nomeAcompanhante || ''}"`,
            `${ac.dataEntrada} ${ac.horaEntrada}`
        ].join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HRPI_Lista_Nutricao_${dataHoje()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast(`Lista com ${presentes.length} acompanhante(s) exportada!`);
    registrarLog('config', `Lista de acompanhantes presentes exportada para a nutrição (${presentes.length} registros).`);
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
        // Ordena por data/hora real (não por comparação de texto — ver
        // dataHoraLog() para o motivo: comparar "31-07-2026" e "01-08-2026"
        // como texto simples colocava agosto "antes" de julho).
        logs.sort((a, b) => dataHoraLog(b) - dataHoraLog(a));
        renderizarTabelaLogs(logs);
    }).catch(err => {
        console.error('Erro ao carregar logs:', err);
    });
}

// Apaga o histórico de logs. Por padrão remove tudo; se um número de dias
// for informado, mantém os logs mais recentes que esse período.
function limparLogs() {
    if (!usuarioLogado || (usuarioLogado.cargo !== 'Administrador' && usuarioLogado.cargo !== 'Supervisor')) {
        toast('Apenas Administradores/Supervisores podem limpar os logs.', 'error');
        return;
    }
    const dias = prompt('Manter logs dos últimos quantos dias? Deixe em branco para apagar TODOS os logs.', '');
    if (dias === null) return; // cancelou

    const diasNum = dias.trim() === '' ? null : parseInt(dias, 10);
    if (dias.trim() !== '' && (isNaN(diasNum) || diasNum < 0)) {
        toast('Informe um número de dias válido.', 'error');
        return;
    }

    const mensagemConfirm = diasNum === null
        ? 'Isso vai apagar TODOS os logs de auditoria permanentemente. Esta ação não pode ser desfeita. Deseja continuar?'
        : `Isso vai apagar todos os logs com mais de ${diasNum} dia(s), permanentemente. Deseja continuar?`;
    if (!confirm(mensagemConfirm)) return;

    db.ref('logs').once('value').then(snap => {
        const logs = snap.val() || {};
        const entradas = Object.entries(logs);

        if (diasNum === null) {
            return db.ref('logs').remove().then(() => entradas.length);
        }

        const corte = new Date();
        corte.setDate(corte.getDate() - diasNum);
        const paraRemover = entradas.filter(([, log]) => dataHoraLog(log) < corte);
        const updates = {};
        paraRemover.forEach(([key]) => { updates[key] = null; });
        return db.ref('logs').update(updates).then(() => paraRemover.length);
    }).then((quantidade) => {
        toast(`${quantidade} log(s) removido(s) com sucesso.`);
        carregarLogs();
        // O próprio ato de limpar os logs também gera um log (autoexplicativo).
        registrarLog('config', `Logs de auditoria limpos (${diasNum === null ? 'todos' : 'mantidos últimos ' + diasNum + ' dias'}).`);
    }).catch(err => {
        console.error('Erro ao limpar logs:', err);
        toast('Erro ao limpar logs.', 'error');
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
            const dataInicio = new Date(inicio + 'T00:00:00');
            logs = logs.filter(log => dataHoraLog(log) >= dataInicio);
        }
        if (fim) {
            const dataFim = new Date(fim + 'T23:59:59');
            logs = logs.filter(log => dataHoraLog(log) <= dataFim);
        }
        if (usuario) logs = logs.filter(log => log.usuarioId === usuario);
        if (acao) logs = logs.filter(log => log.acao === acao);
        
        logs.sort((a, b) => dataHoraLog(b) - dataHoraLog(a));
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
// LIMPEZA DE REGISTROS ANTIGOS
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
