// ============================================
// HRPI - SISTEMA DE CONTROLE DE RECEPÇÃO v2.0
// CONFIGURAÇÃO FIREBASE SEGURA
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

// Inicialização segura do Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
    alert('Erro ao conectar com o servidor. Verifique sua conexão.');
}

const db = firebase.database();

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let usuarioLogado = null;
let acompanhantes = {};
let sessaoExpirada = false;

// ============================================
// CONFIGURAÇÕES DE SEGURANÇA
// ============================================
const CONFIG = {
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutos
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutos
    MIN_PASSWORD_LENGTH: 6,
    TOAST_DURATION: 4000
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
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `hrpi_${timestamp}_${random}`;
}

function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const message = document.getElementById('toastMessage');
    
    message.textContent = msg;
    icon.className = tipo === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
    t.className = `toast show ${tipo}`;
    
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), CONFIG.TOAST_DURATION);
}

function sanitizar(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function validarDocumento(doc) {
    if (!doc) return true;
    return /^[0-9.\-/]+$/.test(doc) || /^[a-zA-Z0-9]+$/.test(doc);
}

function validarTelefone(tel) {
    if (!tel) return true;
    return /^[0-9()\-\s+]+$/.test(tel);
}

// ============================================
// GERENCIAMENTO DE SESSÃO
// ============================================
function iniciarTimerSessao() {
    limparTimerSessao();
    window._sessionTimer = setTimeout(() => {
        sessaoExpirada = true;
        logout();
        toast('Sessão expirada por inatividade. Faça login novamente.', 'error');
    }, CONFIG.SESSION_TIMEOUT);
}

function limparTimerSessao() {
    if (window._sessionTimer) {
        clearTimeout(window._sessionTimer);
        window._sessionTimer = null;
    }
}

function resetarTimerSessao() {
    if (usuarioLogado && !sessaoExpirada) {
        iniciarTimerSessao();
    }
}

// Monitorar atividade do usuário
['click', 'keypress', 'scroll', 'mousemove'].forEach(evento => {
    document.addEventListener(evento, resetarTimerSessao, { passive: true });
});

// ============================================
// LOGIN SEGURO
// ============================================
let loginAttempts = 0;
let lockoutUntil = null;

function fazerLoginEvento(e) {
    e.preventDefault();
    
    // Verificar lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const minutosRestantes = Math.ceil((lockoutUntil - Date.now()) / 60000);
        document.getElementById('loginError').textContent = 
            `Conta temporariamente bloqueada. Tente novamente em ${minutosRestantes} minuto(s).`;
        document.getElementById('loginError').style.display = 'block';
        return;
    }
    
    const usuario = document.getElementById('username').value.trim();
    const senha = document.getElementById('password').value;
    const erroDiv = document.getElementById('loginError');
    
    if (!usuario || !senha) {
        erroDiv.textContent = 'Preencha todos os campos.';
        erroDiv.style.display = 'block';
        return;
    }
    
    // Desabilitar botão durante a requisição
    const btnLogin = document.querySelector('.btn-login');
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner"></span> Entrando...';
    
    db.ref('usuarios').once('value').then(snapshot => {
        const usuarios = snapshot.val();
        
        if (!usuarios) {
            erroDiv.textContent = 'Sistema não configurado. Contate o administrador.';
            erroDiv.style.display = 'block';
            resetarBotaoLogin();
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
                erroDiv.textContent = 'Muitas tentativas. Conta bloqueada por 15 minutos.';
                loginAttempts = 0;
            }
            
            erroDiv.style.display = 'block';
            resetarBotaoLogin();
            return;
        }
        
        // Login bem-sucedido
        loginAttempts = 0;
        lockoutUntil = null;
        
        if (user.primeiroAcesso) {
            usuarioLogado = user;
            document.getElementById('firstAccessModal').style.display = 'flex';
            resetarBotaoLogin();
            return;
        }
        
        completarLogin(user);
        resetarBotaoLogin();
    }).catch(erro => {
        erroDiv.textContent = 'Erro de conexão. Verifique sua internet.';
        erroDiv.style.display = 'block';
        resetarBotaoLogin();
        console.error('Erro login:', erro);
    });
}

function resetarBotaoLogin() {
    const btnLogin = document.querySelector('.btn-login');
    btnLogin.disabled = false;
    btnLogin.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
}

function completarLogin(user) {
    usuarioLogado = user;
    sessaoExpirada = false;
    
    // Salvar sessão de forma segura (apenas dados não sensíveis)
    const sessaoSegura = {
        id: user.id,
        nome: user.nome,
        cargo: user.cargo,
        timestamp: Date.now()
    };
    sessionStorage.setItem('hrpi_session', JSON.stringify(sessaoSegura));
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('firstAccessModal').style.display = 'none';
    document.getElementById('mainSystem').style.display = 'flex';
    
    document.getElementById('userName').textContent = user.nome;
    document.getElementById('userRole').textContent = user.cargo;
    
    const isAdmin = user.cargo === 'Administrador' || user.cargo === 'Supervisor';
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
    
    iniciarTimerSessao();
    iniciarSistema();
    toast(`Bem-vindo(a), ${user.nome}!`);
}

function logout() {
    limparTimerSessao();
    sessionStorage.removeItem('hrpi_session');
    usuarioLogado = null;
    sessaoExpirada = true;
    
    document.getElementById('mainSystem').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
    
    // Fechar sidebar mobile se aberta
    document.getElementById('sidebar').classList.remove('mobile-open');
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Configurar logo e fundo do login
    db.ref('configuracoes').once('value').then(snapshot => {
        const config = snapshot.val();
        if (config) {
            if (config.logoHospital) {
                document.getElementById('loginLogo').innerHTML = 
                    `<img src="${sanitizar(config.logoHospital)}" alt="HRPI Logo">`;
            }
            if (config.fundoLogin) {
                const loginContainer = document.getElementById('loginScreen');
                loginContainer.style.backgroundImage = `url(${sanitizar(config.fundoLogin)})`;
                loginContainer.classList.add('has-background');
            }
            if (config.tema) {
                document.documentElement.setAttribute('data-theme', config.tema);
                const icon = document.querySelector('#themeToggle i');
                if (icon) icon.className = config.tema === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    });
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', fazerLoginEvento);
    
    // Troca de senha no primeiro acesso
    document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
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
            erroDiv.textContent = `A senha deve ter no mínimo ${CONFIG.MIN_PASSWORD_LENGTH} caracteres.`;
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
            erroDiv.textContent = 'Erro ao alterar senha. Tente novamente.';
            erroDiv.style.display = 'block';
        });
    });
    
    // Verificar sessão existente
    const sessaoData = sessionStorage.getItem('hrpi_session');
    if (sessaoData) {
        try {
            const sessao = JSON.parse(sessaoData);
            // Verificar se a sessão não expirou (30 minutos)
            if (Date.now() - sessao.timestamp < CONFIG.SESSION_TIMEOUT) {
                db.ref('usuarios/' + sessao.id).once('value').then(snapshot => {
                    const user = snapshot.val();
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
    
    // Data atual formatada
    atualizarDataAtual();
    
    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            if (section) navegarPara(section);
        });
    });
    
    // Mobile menu
    document.getElementById('mobileMenuToggle').addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('mobile-open');
    });
    
    // Fechar sidebar ao clicar em um link (mobile)
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('mobile-open');
            }
        });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        if (confirm('Deseja realmente sair do sistema?')) {
            logout();
        }
    });
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', function() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        this.querySelector('i').className = next === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        db.ref('configuracoes').update({ tema: next }).catch(() => {});
    });
    
    // Modal close
    document.querySelector('.modal-close').addEventListener('click', fecharModal);
    document.getElementById('genericModal').addEventListener('click', function(e) {
        if (e.target === this) fecharModal();
    });
    
    // Configurações - Upload Logo
    document.getElementById('uploadLogo').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast('Selecione um arquivo de imagem válido.', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast('A imagem deve ter no máximo 2MB.', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const base64 = event.target.result;
            db.ref('configuracoes').update({ logoHospital: base64 }).then(() => {
                document.getElementById('sidebarLogo').innerHTML = 
                    `<img src="${base64}" alt="Logo">`;
                document.getElementById('loginLogo').innerHTML = 
                    `<img src="${base64}" alt="HRPI Logo">`;
                toast('Logo atualizada com sucesso!');
            }).catch(() => toast('Erro ao salvar logo.', 'error'));
        };
        reader.readAsDataURL(file);
    });
    
    // Configurações - Upload Fundo
    document.getElementById('uploadFundo').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast('Selecione um arquivo de imagem válido.', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast('A imagem deve ter no máximo 5MB.', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const base64 = event.target.result;
            db.ref('configuracoes').update({ fundoLogin: base64 }).then(() => {
                const loginScreen = document.getElementById('loginScreen');
                loginScreen.style.backgroundImage = `url(${base64})`;
                loginScreen.classList.add('has-background');
                toast('Fundo de login atualizado!');
            }).catch(() => toast('Erro ao salvar fundo.', 'error'));
        };
        reader.readAsDataURL(file);
    });
    
    // Remover Logo
    document.getElementById('btnRemoverLogo').addEventListener('click', function() {
        if (confirm('Remover a logo do hospital?')) {
            db.ref('configuracoes').update({ logoHospital: null }).then(() => {
                document.getElementById('sidebarLogo').innerHTML = '<i class="fas fa-hospital-alt"></i>';
                document.getElementById('loginLogo').innerHTML = '<i class="fas fa-hospital-alt"></i>';
                toast('Logo removida.');
            });
        }
    });
    
    // Remover Fundo
    document.getElementById('btnRemoverFundo').addEventListener('click', function() {
        if (confirm('Remover a imagem de fundo do login?')) {
            db.ref('configuracoes').update({ fundoLogin: null }).then(() => {
                const loginScreen = document.getElementById('loginScreen');
                loginScreen.style.backgroundImage = '';
                loginScreen.classList.remove('has-background');
                toast('Fundo removido.');
            });
        }
    });
    
    // Resetar Senha
    document.getElementById('btnResetSenha').addEventListener('click', function() {
        const userId = document.getElementById('selectUsuarioReset').value;
        if (!userId) {
            toast('Selecione um usuário.', 'error');
            return;
        }
        if (confirm('Resetar a senha deste usuário para "123456"?')) {
            db.ref('usuarios/' + userId).update({
                senha: '123456',
                primeiroAcesso: true
            }).then(() => {
                toast('Senha resetada com sucesso! Nova senha: 123456');
            }).catch(() => toast('Erro ao resetar senha.', 'error'));
        }
    });
    
    // Novo Usuário
    document.getElementById('btnNovoUsuario').addEventListener('click', abrirModalNovoUsuario);
    
    // Formulários
    document.getElementById('formEntradaAcompanhante').addEventListener('submit', registrarEntrada);
    document.getElementById('formVisita').addEventListener('submit', registrarVisita);
    document.getElementById('formTroca').addEventListener('submit', registrarTroca);
    document.getElementById('formSaida').addEventListener('submit', registrarSaida);
    
    // Eventos dos selects
    document.getElementById('saidaAcompanhante').addEventListener('change', atualizarInfoSaida);
    document.getElementById('trocaAcompanhanteAtual').addEventListener('change', atualizarInfoTroca);
    
    // Filtro histórico
    document.getElementById('btnFiltrar').addEventListener('click', filtrarHistorico);
    
    // Carregar usuários para o select de reset
    carregarSelectUsuarios();
    
    console.log('✅ HRPI - Sistema de Controle de Recepção v2.0 inicializado');
});

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function atualizarDataAtual() {
    const dataEl = document.getElementById('currentDate');
    if (dataEl) {
        const agora = new Date();
        dataEl.textContent = agora.toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

function fecharModal() {
    document.getElementById('genericModal').style.display = 'none';
}

function abrirModalNovoUsuario() {
    document.getElementById('modalTitle').textContent = 'Novo Usuário';
    document.getElementById('modalBody').innerHTML = `
        <form id="formNovoUsuario" class="modern-form">
            <div class="form-row">
                <div class="form-group">
                    <label>Nome Completo <span class="required">*</span></label>
                    <input type="text" id="newUserNome" required placeholder="Nome do usuário">
                </div>
                <div class="form-group">
                    <label>Nome de Usuário <span class="required">*</span></label>
                    <input type="text" id="newUserUsername" required placeholder="Login">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Cargo <span class="required">*</span></label>
                    <select id="newUserCargo" required>
                        <option value="">Selecione...</option>
                        <option>Administrador</option>
                        <option>Supervisor</option>
                        <option>Recepcionista</option>
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
            <button type="submit" class="btn-primary">
                <i class="fas fa-save"></i> Criar Usuário
            </button>
        </form>
    `;
    
    document.getElementById('genericModal').style.display = 'flex';
    
    document.getElementById('formNovoUsuario').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = 'user_' + Date.now();
        db.ref('usuarios/' + id).set({
            id: id,
            nome: sanitizar(document.getElementById('newUserNome').value.trim()),
            usuario: sanitizar(document.getElementById('newUserUsername').value.trim().toLowerCase()),
            senha: '123456',
            cargo: document.getElementById('newUserCargo').value,
            ativo: document.getElementById('newUserAtivo').value === 'true',
            primeiroAcesso: true
        }).then(() => {
            toast('Usuário criado com sucesso! Senha inicial: 123456');
            fecharModal();
            if (document.getElementById('usuarios').classList.contains('active')) {
                carregarUsuarios();
            }
            carregarSelectUsuarios();
        }).catch(erro => {
            toast('Erro ao criar usuário.', 'error');
            console.error(erro);
        });
    });
}

// ============================================
// REGISTRO DE ENTRADA
// ============================================
function registrarEntrada(e) {
    e.preventDefault();
    
    const nome = document.getElementById('acNome').value.trim();
    const documento = document.getElementById('acDocumento').value.trim();
    const telefone = document.getElementById('acTelefone').value.trim();
    
    if (!validarDocumento(documento)) {
        toast('Documento inválido.', 'error');
        return;
    }
    if (!validarTelefone(telefone)) {
        toast('Telefone inválido.', 'error');
        return;
    }
    
    const dados = {
        id: gerarId(),
        tipo: 'acompanhante',
        nomeAcompanhante: sanitizar(nome),
        documento: sanitizar(documento),
        telefone: sanitizar(telefone),
        parentesco: document.getElementById('acParentesco').value,
        nomePaciente: sanitizar(document.getElementById('acPaciente').value.trim()),
        setor: document.getElementById('acSetor').value,
        leito: sanitizar(document.getElementById('acLeito').value.trim()),
        dataEntrada: dataHoje(),
        horaEntrada: horaAgora(),
        dataSaida: null,
        horaSaida: null,
        status: 'presente',
        recepcionistaEntrada: usuarioLogado.nome,
        recepcionistaSaida: null,
        trocas: [],
        observacao: sanitizar(document.getElementById('acObservacao').value.trim()),
        duracaoVisita: null
    };
    
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('Entrada registrada com sucesso!');
        e.target.reset();
    }).catch(erro => {
        toast('Erro ao registrar entrada.', 'error');
        console.error(erro);
    });
}

// ============================================
// REGISTRO DE VISITA
// ============================================
function registrarVisita(e) {
    e.preventDefault();
    
    const duracao = parseInt(document.getElementById('visDuracao').value);
    if (duracao < 1 || duracao > 480) {
        toast('Duração deve ser entre 1 e 480 minutos.', 'error');
        return;
    }
    
    const dados = {
        id: gerarId(),
        tipo: 'visita',
        nomeAcompanhante: sanitizar(document.getElementById('visNome').value.trim()),
        documento: sanitizar(document.getElementById('visDocumento').value.trim()),
        telefone: sanitizar(document.getElementById('visTelefone').value.trim()),
        parentesco: document.getElementById('visParentesco').value,
        nomePaciente: sanitizar(document.getElementById('visPaciente').value.trim()),
        setor: document.getElementById('visSetor').value,
        leito: sanitizar(document.getElementById('visLeito').value.trim()),
        dataEntrada: dataHoje(),
        horaEntrada: horaAgora(),
        dataSaida: dataHoje(),
        horaSaida: calcularHoraSaida(duracao),
        status: 'saiu',
        recepcionistaEntrada: usuarioLogado.nome,
        recepcionistaSaida: usuarioLogado.nome,
        trocas: [],
        observacao: '',
        duracaoVisita: duracao
    };
    
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('Visita registrada com sucesso!');
        e.target.reset();
    }).catch(erro => {
        toast('Erro ao registrar visita.', 'error');
        console.error(erro);
    });
}

function calcularHoraSaida(duracaoMinutos) {
    const agora = new Date();
    agora.setMinutes(agora.getMinutes() + duracaoMinutos);
    return `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}:${String(agora.getSeconds()).padStart(2,'0')}`;
}

// ============================================
// REGISTRO DE SAÍDA
// ============================================
function registrarSaida(e) {
    e.preventDefault();
    const id = document.getElementById('saidaAcompanhante').value;
    const motivo = document.getElementById('saidaMotivo').value;
    
    if (!id || !motivo) {
        toast('Selecione o acompanhante e o motivo.', 'error');
        return;
    }
    
    const atual = acompanhantes[id];
    if (!atual) {
        toast('Acompanhante não encontrado.', 'error');
        return;
    }
    
    const obs = atual.observacao 
        ? `${atual.observacao} | Saída: ${motivo}` 
        : `Saída: ${motivo}`;
    
    db.ref('acompanhantes/' + id).update({
        status: 'saiu',
        dataSaida: dataHoje(),
        horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado.nome,
        observacao: obs
    }).then(() => {
        toast('Saída registrada com sucesso!');
        e.target.reset();
        document.getElementById('saidaInfo').style.display = 'none';
    }).catch(erro => {
        toast('Erro ao registrar saída.', 'error');
        console.error(erro);
    });
}

// ============================================
// REGISTRO DE TROCA
// ============================================
function registrarTroca(e) {
    e.preventDefault();
    const idAntigo = document.getElementById('trocaAcompanhanteAtual').value;
    const antigo = acompanhantes[idAntigo];
    
    if (!antigo) {
        toast('Selecione um acompanhante.', 'error');
        return;
    }
    
    const trocas = antigo.trocas || [];
    trocas.push({
        dataHora: `${dataHoje()} ${horaAgora()}`,
        acompanhanteAntigo: antigo.nomeAcompanhante,
        acompanhanteNovo: sanitizar(document.getElementById('trocaNovoNome').value.trim()),
        recepcionista: usuarioLogado.nome
    });
    
    db.ref('acompanhantes/' + idAntigo).update({
        status: 'trocado',
        dataSaida: dataHoje(),
        horaSaida: horaAgora(),
        recepcionistaSaida: usuarioLogado.nome,
        trocas: trocas
    });
    
    const novoId = gerarId();
    db.ref('acompanhantes/' + novoId).set({
        id: novoId,
        tipo: 'acompanhante',
        nomeAcompanhante: sanitizar(document.getElementById('trocaNovoNome').value.trim()),
        documento: sanitizar(document.getElementById('trocaNovoDocumento').value.trim()),
        telefone: sanitizar(document.getElementById('trocaNovoTelefone').value.trim()),
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
        observacao: `Substituiu: ${antigo.nomeAcompanhante}`,
        duracaoVisita: null
    }).then(() => {
        toast('Troca registrada com sucesso!');
        e.target.reset();
        document.getElementById('trocaInfoAtual').style.display = 'none';
    }).catch(erro => {
        toast('Erro ao registrar troca.', 'error');
        console.error(erro);
    });
}

// ============================================
// ATUALIZAR INFORMAÇÕES DOS SELECTS
// ============================================
function atualizarInfoSaida() {
    const id = this.value;
    const info = document.getElementById('saidaInfo');
    if (id && acompanhantes[id]) {
        const ac = acompanhantes[id];
        document.getElementById('saidaPaciente').textContent = ac.nomePaciente;
        document.getElementById('saidaSetor').textContent = ac.setor;
        document.getElementById('saidaEntrada').textContent = `${ac.dataEntrada} ${ac.horaEntrada}`;
        info.style.display = 'block';
    } else {
        info.style.display = 'none';
    }
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
    } else {
        info.style.display = 'none';
    }
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
    
    const titulos = {
        'dashboard': 'Dashboard',
        'entradaAcompanhante': 'Entrada de Acompanhante',
        'registroVisita': 'Registro de Visita',
        'registroTroca': 'Troca de Acompanhante',
        'registroSaida': 'Registro de Saída',
        'acompanhantesAtivos': 'Acompanhantes Ativos',
        'historico': 'Histórico Completo',
        'relatorios': 'Relatórios em PDF',
        'usuarios': 'Gerenciamento de Usuários',
        'configuracoes': 'Configurações do Sistema'
    };
    
    document.getElementById('sectionTitle').textContent = titulos[section] || '';
    
    if (section === 'usuarios') carregarUsuarios();
    if (section === 'acompanhantesAtivos') atualizarAtivos();
    if (section === 'historico') atualizarHistorico();
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
    
    carregarConfiguracoes();
    navegarPara('dashboard');
}

// ============================================
// DASHBOARD
// ============================================
function atualizarDashboard() {
    const hoje = dataHoje();
    let presentes = 0, visitas = 0, entradas = 0, trocas = 0, saidas = 0;
    let entradasSemana = 0, saidasSemana = 0, entradasMes = 0, saidasMes = 0;
    const ultimos = [];
    
    const agora = new Date();
    const inicioSemana = new Date(agora);
    inicioSemana.setDate(agora.getDate() - agora.getDay());
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    
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
        
        // Cálculos semanais e mensais
        const [d, m, a] = ac.dataEntrada.split('-');
        const dataEntrada = new Date(a, m - 1, d);
        
        if (dataEntrada >= inicioSemana) entradasSemana++;
        if (dataEntrada >= inicioMes) entradasMes++;
        
        if (ac.dataSaida) {
            const [ds, ms, as] = ac.dataSaida.split('-');
            const dataSaida = new Date(as, ms - 1, ds);
            if (dataSaida >= inicioSemana) saidasSemana++;
            if (dataSaida >= inicioMes) saidasMes++;
        }
        
        ultimos.push(ac);
    });
    
    document.getElementById('countAcompanhantesPresentes').textContent = presentes;
    document.getElementById('countVisitasAtivas').textContent = visitas;
    document.getElementById('countEntradasHoje').textContent = entradas;
    document.getElementById('countTrocasHoje').textContent = trocas;
    document.getElementById('countSaidasHoje').textContent = saidas;
    
    // Atualizar indicadores avançados
    const elEntradasSemana = document.getElementById('countEntradasSemana');
    const elSaidasSemana = document.getElementById('countSaidasSemana');
    const elEntradasMes = document.getElementById('countEntradasMes');
    const elSaidasMes = document.getElementById('countSaidasMes');
    
    if (elEntradasSemana) elEntradasSemana.textContent = entradasSemana;
    if (elSaidasSemana) elSaidasSemana.textContent = saidasSemana;
    if (elEntradasMes) elEntradasMes.textContent = entradasMes;
    if (elSaidasMes) elSaidasMes.textContent = saidasMes;
    
    // Últimos registros
    ultimos.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-');
        const [db, mb, ab] = b.dataEntrada.split('-');
        const cmpData = new Date(ab, mb-1, db) - new Date(aa, ma-1, da);
        if (cmpData !== 0) return cmpData;
        return b.horaEntrada.localeCompare(a.horaEntrada);
    });
    
    const tbody = document.querySelector('#tabelaUltimosRegistros tbody');
    if (tbody) {
        tbody.innerHTML = ultimos.slice(0, 8).map(ac => `
            <tr>
                <td><span class="badge ${ac.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                <td>${sanitizar(ac.nomeAcompanhante)}</td>
                <td>${sanitizar(ac.nomePaciente)}</td>
                <td>${sanitizar(ac.setor)}${ac.leito ? ' / ' + sanitizar(ac.leito) : ''}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td><span class="status-badge status-${ac.status}">${ac.status}</span></td>
            </tr>
        `).join('');
    }
}

// ============================================
// ATUALIZAR TABELAS
// ============================================
function atualizarAtivos() {
    const ativos = Object.values(acompanhantes).filter(a => a.status === 'presente');
    const tbody = document.querySelector('#tabelaAtivos tbody');
    if (!tbody) return;
    
    if (ativos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 32px; color: var(--text-muted);">Nenhum acompanhante ativo no momento.</td></tr>';
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
        const cmpData = new Date(ab, mb-1, db) - new Date(aa, ma-1, da);
        if (cmpData !== 0) return cmpData;
        return b.horaEntrada.localeCompare(a.horaEntrada);
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
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 32px; color: var(--text-muted);">Nenhum registro encontrado.</td></tr>';
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
                <td><span class="status-badge status-${ac.status}">${ac.status}</span></td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarRegistro('${ac.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirRegistro('${ac.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }
}

// ============================================
// ATUALIZAR SELECTS
// ============================================
function atualizarSelects() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente');
    
    const selectSaida = document.getElementById('saidaAcompanhante');
    if (selectSaida) {
        selectSaida.innerHTML = '<option value="">Selecione o acompanhante/visitante...</option>' +
            presentes.map(ac => {
                const prefixo = ac.tipo === 'visita' ? '[VISITA] ' : '[ACOMP.] ';
                return `<option value="${ac.id}">${prefixo}${sanitizar(ac.nomeAcompanhante)} - ${sanitizar(ac.nomePaciente)}</option>`;
            }).join('');
    }
    
    const selectTroca = document.getElementById('trocaAcompanhanteAtual');
    if (selectTroca) {
        const acompanhantesAtivos = presentes.filter(a => a.tipo === 'acompanhante');
        selectTroca.innerHTML = '<option value="">Selecione o acompanhante atual...</option>' +
            acompanhantesAtivos.map(ac =>
                `<option value="${ac.id}">${sanitizar(ac.nomeAcompanhante)} - ${sanitizar(ac.nomePaciente)} - ${sanitizar(ac.setor)}</option>`
            ).join('');
    }
}

// ============================================
// EDITAR / EXCLUIR REGISTROS
// ============================================
function editarRegistro(id) {
    const ac = acompanhantes[id];
    if (!ac) return;
    
    document.getElementById('modalTitle').textContent = 'Editar Registro';
    document.getElementById('modalBody').innerHTML = `
        <form id="formEditar" class="modern-form">
            <div class="form-row">
                <div class="form-group">
                    <label>Nome <span class="required">*</span></label>
                    <input type="text" id="editNome" value="${sanitizar(ac.nomeAcompanhante)}" required>
                </div>
                <div class="form-group">
                    <label>Documento</label>
                    <input type="text" id="editDoc" value="${sanitizar(ac.documento || '')}">
                </div>
            </div>
            <div class="form-row">
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
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Paciente</label>
                    <input type="text" id="editPaciente" value="${sanitizar(ac.nomePaciente)}">
                </div>
                <div class="form-group">
                    <label>Setor</label>
                    <select id="editSetor">
                        <option>Oncologia I</option><option>Oncologia II</option>
                        <option>UTI I</option><option>UTI II</option>
                        <option>Clínica Médica I</option><option>Clínica Médica II</option>
                        <option>Clínica Cirúrgica</option><option>Pediatria</option><option>Saúde Mental</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Leito</label>
                    <input type="text" id="editLeito" value="${sanitizar(ac.leito || '')}">
                </div>
                <div class="form-group">
                    <label>Observação</label>
                    <input type="text" id="editObs" value="${sanitizar(ac.observacao || '')}">
                </div>
            </div>
            <button type="submit" class="btn-primary">
                <i class="fas fa-save"></i> Salvar Alterações
            </button>
        </form>
    `;
    
    document.getElementById('genericModal').style.display = 'flex';
    
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
                toast('Registro atualizado com sucesso!');
                fecharModal();
            }).catch(erro => {
                toast('Erro ao atualizar registro.', 'error');
                console.error(erro);
            });
        });
    }, 100);
}

function excluirRegistro(id) {
    if (confirm('Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.')) {
        db.ref('acompanhantes/' + id).remove()
            .then(() => toast('Registro excluído com sucesso!'))
            .catch(erro => {
                toast('Erro ao excluir registro.', 'error');
                console.error(erro);
            });
    }
}

// ============================================
// CONFIGURAÇÕES
// ============================================
function carregarConfiguracoes() {
    db.ref('configuracoes').once('value').then(snapshot => {
        const config = snapshot.val();
        if (config) {
            if (config.logoHospital) {
                document.getElementById('sidebarLogo').innerHTML = 
                    `<img src="${sanitizar(config.logoHospital)}" alt="Logo">`;
                document.getElementById('loginLogo').innerHTML = 
                    `<img src="${sanitizar(config.logoHospital)}" alt="HRPI Logo">`;
            }
            if (config.fundoLogin) {
                const loginScreen = document.getElementById('loginScreen');
                loginScreen.style.backgroundImage = `url(${sanitizar(config.fundoLogin)})`;
                loginScreen.classList.add('has-background');
            }
            if (config.tema) {
                document.documentElement.setAttribute('data-theme', config.tema);
                const icon = document.querySelector('#themeToggle i');
                if (icon) icon.className = config.tema === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    });
}

// ============================================
// USUÁRIOS
// ============================================
function carregarSelectUsuarios() {
    db.ref('usuarios').on('value', snapshot => {
        const select = document.getElementById('selectUsuarioReset');
        if (!select) return;
        const usuarios = snapshot.val() || {};
        select.innerHTML = '<option value="">Selecione um usuário...</option>' +
            Object.values(usuarios).map(user => 
                `<option value="${user.id}">${sanitizar(user.nome)} (${sanitizar(user.usuario)})</option>`
            ).join('');
    });
}

function carregarUsuarios() {
    db.ref('usuarios').once('value').then(snapshot => {
        const usuarios = snapshot.val() || {};
        const tbody = document.querySelector('#tabelaUsuarios tbody');
        if (!tbody) return;
        
        tbody.innerHTML = Object.values(usuarios).map(user => `
            <tr>
                <td>${sanitizar(user.nome)}</td>
                <td>${sanitizar(user.usuario)}</td>
                <td>${sanitizar(user.cargo)}</td>
                <td><span class="status-badge ${user.ativo !== false ? 'status-presente' : 'status-saiu'}">${user.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                <td><span class="status-badge ${user.primeiroAcesso ? 'status-trocado' : 'status-presente'}">${user.primeiroAcesso ? 'Pendente' : 'OK'}</span></td>
                <td>
                    <button class="btn-icon btn-edit" onclick="editarUsuario('${user.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-key" onclick="resetSenhaUsuario('${user.id}')" title="Resetar Senha"><i class="fas fa-key"></i></button>
                    <button class="btn-icon btn-delete" onclick="excluirUsuario('${user.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    });
}

function editarUsuario(id) {
    db.ref('usuarios/' + id).once('value').then(snapshot => {
        const user = snapshot.val();
        if (!user) {
            toast('Usuário não encontrado.', 'error');
            return;
        }
        
        document.getElementById('modalTitle').textContent = 'Editar Usuário';
        document.getElementById('modalBody').innerHTML = `
            <form id="formEditarUsuario" class="modern-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Nome <span class="required">*</span></label>
                        <input type="text" id="editUserNome" value="${sanitizar(user.nome)}" required>
                    </div>
                    <div class="form-group">
                        <label>Usuário <span class="required">*</span></label>
                        <input type="text" id="editUserUsername" value="${sanitizar(user.usuario)}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Cargo <span class="required">*</span></label>
                        <select id="editUserCargo" required>
                            <option value="Administrador" ${user.cargo === 'Administrador' ? 'selected' : ''}>Administrador</option>
                            <option value="Supervisor" ${user.cargo === 'Supervisor' ? 'selected' : ''}>Supervisor</option>
                            <option value="Recepcionista" ${user.cargo === 'Recepcionista' ? 'selected' : ''}>Recepcionista</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="editUserAtivo">
                            <option value="true" ${user.ativo !== false ? 'selected' : ''}>Ativo</option>
                            <option value="false" ${user.ativo === false ? 'selected' : ''}>Inativo</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Salvar Alterações
                </button>
            </form>
        `;
        
        document.getElementById('genericModal').style.display = 'flex';
        
        document.getElementById('formEditarUsuario').addEventListener('submit', function(e) {
            e.preventDefault();
            db.ref('usuarios/' + id).update({
                nome: sanitizar(document.getElementById('editUserNome').value.trim()),
                usuario: sanitizar(document.getElementById('editUserUsername').value.trim().toLowerCase()),
                cargo: document.getElementById('editUserCargo').value,
                ativo: document.getElementById('editUserAtivo').value === 'true'
            }).then(() => {
                toast('Usuário atualizado com sucesso!');
                fecharModal();
                carregarUsuarios();
                carregarSelectUsuarios();
            }).catch(erro => {
                toast('Erro ao atualizar usuário.', 'error');
                console.error(erro);
            });
        });
    });
}

function resetSenhaUsuario(id) {
    if (confirm('Resetar a senha deste usuário para "123456"?')) {
        db.ref('usuarios/' + id).update({
            senha: '123456',
            primeiroAcesso: true
        }).then(() => {
            toast('Senha resetada! Nova senha: 123456');
            carregarUsuarios();
        }).catch(erro => {
            toast('Erro ao resetar senha.', 'error');
            console.error(erro);
        });
    }
}

function excluirUsuario(id) {
    if (confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
        db.ref('usuarios/' + id).remove().then(() => {
            toast('Usuário excluído com sucesso!');
            carregarUsuarios();
            carregarSelectUsuarios();
        }).catch(erro => {
            toast('Erro ao excluir usuário.', 'error');
            console.error(erro);
        });
    }
}

// ============================================
// RELATÓRIOS PDF
// ============================================
function gerarRelatorio(tipo) {
    if (typeof window.jspdf === 'undefined') {
        toast('Carregando gerador de PDF...', 'error');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
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
            const inicio = document.getElementById('dataInicioPersonalizado').value;
            const fim = document.getElementById('dataFimPersonalizado').value;
            if (!inicio || !fim) {
                toast('Selecione as datas inicial e final.', 'error');
                return;
            }
            dataInicio = inicio.split('-').reverse().join('-');
            dataFim = fim.split('-').reverse().join('-');
            titulo = 'Relatório Personalizado';
            break;
    }
    
    // Carregar logo para o relatório
    db.ref('configuracoes/logoHospital').once('value').then(snapLogo => {
        const logoBase64 = snapLogo.val();
        
        // Adicionar logo se existir
        if (logoBase64) {
            try {
                doc.addImage(logoBase64, 'PNG', 10, 8, 22, 22);
            } catch (e) {
                // Logo inválida, ignorar
            }
        }
        
        // Cabeçalho
        doc.setFontSize(16);
        doc.setTextColor(0, 105, 92);
        doc.setFont('helvetica', 'bold');
        doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS', 148, 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistema de Controle de Recepção - HRPI', 148, 22, { align: 'center' });
        
        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text(`${titulo}: ${dataInicio} a ${dataFim}`, 148, 30, { align: 'center' });
        
        doc.setDrawColor(0, 105, 92);
        doc.setLineWidth(0.5);
        doc.line(14, 34, 283, 34);
        
        // Filtrar dados
        let dados = Object.values(acompanhantes);
        if (dataInicio) {
            const [di, mi, ai] = dataInicio.split('-');
            dados = dados.filter(ac => {
                const [d, m, a] = ac.dataEntrada.split('-');
                return new Date(a, m-1, d) >= new Date(ai, mi-1, di);
            });
        }
        if (dataFim) {
            const [df, mf, af] = dataFim.split('-');
            dados = dados.filter(ac => {
                const [d, m, a] = ac.dataEntrada.split('-');
                return new Date(a, m-1, d) <= new Date(af, mf-1, df, 23, 59, 59);
            });
        }
        
        // Tabela
        doc.autoTable({
            startY: 38,
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
            styles: {
                fontSize: 7.5,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [0, 105, 92],
                textColor: 255,
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: [240, 250, 249],
            },
            margin: { left: 14, right: 14 },
        });
        
        // Rodapé
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Gerado em: ${dataHoje()} ${horaAgora()} | Por: ${usuarioLogado.nome}`, 148, finalY, { align: 'center' });
        
        // Salvar
        doc.save(`HRPI_Relatorio_${tipo}_${dataHoje()}.pdf`);
        toast('PDF gerado com sucesso!');
    }).catch(() => {
        toast('Erro ao gerar PDF.', 'error');
    });
}

console.log('✅ HRPI - Sistema de Controle de Recepção v2.0 carregado com sucesso!');
