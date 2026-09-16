// ============================================
// 04-dom-init.js
// Ponto de entrada: tudo que roda no DOMContentLoaded — liga os formulários, botões e listeners da tela.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// INICIALIZAÇÃO DO DOM
// ------------------------------------------
// Antes rodava direto no evento "DOMContentLoaded". Agora é uma função
// nomeada, chamada manualmente por js/00-partials-loader.js DEPOIS que
// o conteúdo das páginas (partials/*.html) já foi injetado no DOM — a
// maioria dos elementos abaixo (formulários, botões de cada tela, os
// modais) só existe a partir desse momento.
// ============================================
function iniciarAplicacao() {
    console.log('🟢 Partials carregados - Inicializando sistema...');
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

    const relSetorPeriodo = document.getElementById('relSetorPeriodo');
    if (relSetorPeriodo) relSetorPeriodo.addEventListener('change', function () {
        const bloco = document.getElementById('relSetorDatasPersonalizado');
        if (bloco) bloco.style.display = this.value === 'personalizado' ? 'flex' : 'none';
    });

    // Buscas das telas de Saída e Troca (ver js/04 e js/05 — precisavam
    // dos elementos das páginas correspondentes, agora carregadas via partial)
    inicializarBuscaSaida();
    inicializarBuscaTroca();

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
    // MELHORIA: tecla Esc fecha modais abertos (crachá e modal genérico).
    // O modal de primeiro acesso fica de fora de propósito — trocar a
    // senha ali é obrigatório, não deve dar pra pular com Esc.
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        const badge = document.getElementById('badgeModal');
        if (badge && badge.style.display !== 'none') { badge.style.display = 'none'; badge.classList.remove('active'); return; }
        const generic = document.getElementById('genericModal');
        if (generic && generic.classList.contains('active')) fecharModal();
    });

    console.log('✅ Sistema inicializado com sucesso!');
}

