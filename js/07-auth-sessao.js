// ============================================
// 07-auth-sessao.js
// Login, logout, controle de sessão e navegação entre páginas do sistema.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

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

