// ==================== DADOS INICIAIS ====================
function inicializarDados() {
    if (!localStorage.getItem('usuarios')) {
        const usuariosPadrao = [
            { id: 1, nome: 'Administrador', usuario: 'admin', senha: 'admin123', cargo: 'Administrador', ativo: true, primeiroAcesso: false },
            { id: 2, nome: 'Supervisor Recepção', usuario: 'supervisor', senha: '123456', cargo: 'Supervisor', ativo: true, primeiroAcesso: true },
            { id: 3, nome: 'Recepcionista João', usuario: 'recepcao', senha: '123456', cargo: 'Recepcionista', ativo: true, primeiroAcesso: true },
        ];
        localStorage.setItem('usuarios', JSON.stringify(usuariosPadrao));
    }
    
    if (!localStorage.getItem('acompanhantes')) {
        const agora = new Date();
        const exemplos = [
            {
                id: gerarId(),
                tipo: 'acompanhante',
                nomeAcompanhante: 'Carlos Eduardo Silva',
                documento: '123.456.789-00',
                telefone: '(82) 98765-4321',
                parentesco: 'Filho(a)',
                nomePaciente: 'Maria Helena Silva',
                setor: 'Apartamento',
                quarto: '302-A',
                dataEntrada: formatData(agora),
                horaEntrada: '08:30',
                dataSaida: null,
                horaSaida: null,
                status: 'presente',
                recepcionistaEntrada: 'Recepcionista João',
                recepcionistaSaida: null,
                trocas: [],
                observacao: '',
                duracaoVisita: null
            },
            {
                id: gerarId(),
                tipo: 'visita',
                nomeAcompanhante: 'Pedro Alves',
                documento: '111.222.333-44',
                telefone: '(82) 95555-7777',
                parentesco: 'Amigo(a)',
                nomePaciente: 'Roberto Costa',
                setor: 'UTI',
                quarto: 'UTI-5',
                dataEntrada: formatData(agora),
                horaEntrada: '14:00',
                dataSaida: formatData(agora),
                horaSaida: '14:45',
                status: 'saiu',
                recepcionistaEntrada: 'Maria Recepção',
                recepcionistaSaida: 'Maria Recepção',
                trocas: [],
                observacao: 'Visita rápida',
                duracaoVisita: 45
            }
        ];
        localStorage.setItem('acompanhantes', JSON.stringify(exemplos));
    }
    
    if (!localStorage.getItem('tema')) {
        localStorage.setItem('tema', 'light');
    }
    
    if (!localStorage.getItem('logoHospital')) {
        localStorage.setItem('logoHospital', '');
    }
}

function gerarId() {
    return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

function formatData(date) {
    const d = new Date(date);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function formatDataBR(dataStr) {
    if (!dataStr) return '-';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

function getAcompanhantes() {
    return JSON.parse(localStorage.getItem('acompanhantes') || '[]');
}

function salvarAcompanhantes(lista) {
    localStorage.setItem('acompanhantes', JSON.stringify(lista));
}

function getUsuarios() {
    return JSON.parse(localStorage.getItem('usuarios') || '[]');
}

function salvarUsuarios(lista) {
    localStorage.setItem('usuarios', JSON.stringify(lista));
}

function getUsuarioLogado() {
    return JSON.parse(sessionStorage.getItem('usuarioLogado') || 'null');
}

function podeVerIndicadores() {
    const usuario = getUsuarioLogado();
    return usuario && (usuario.cargo === 'Administrador' || usuario.cargo === 'Supervisor');
}

function podeGerenciarUsuarios() {
    const usuario = getUsuarioLogado();
    return usuario && (usuario.cargo === 'Administrador' || usuario.cargo === 'Supervisor');
}

function podeConfigurar() {
    const usuario = getUsuarioLogado();
    return usuario && (usuario.cargo === 'Administrador' || usuario.cargo === 'Supervisor');
}

// ==================== TOAST ====================
function showToast(mensagem, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.className = 'toast ' + tipo + ' show';
    toast.innerHTML = `<i class="fas fa-${tipo === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${mensagem}`;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// ==================== MODAL ====================
function showModal(conteudoHTML) {
    document.getElementById('modalContent').innerHTML = conteudoHTML;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// ==================== TEMA ====================
function toggleTema() {
    const temaAtual = localStorage.getItem('tema') || 'light';
    const novoTema = temaAtual === 'light' ? 'dark' : 'light';
    localStorage.setItem('tema', novoTema);
    aplicarTema(novoTema);
}

function aplicarTema(tema) {
    if (tema === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('themeIcon').className = 'fas fa-sun';
    } else {
        document.body.classList.remove('dark-theme');
        document.getElementById('themeIcon').className = 'fas fa-moon';
    }
}

function carregarTema() {
    const tema = localStorage.getItem('tema') || 'light';
    aplicarTema(tema);
}

// ==================== LOGO ====================
function carregarLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const logoData = e.target.result;
        localStorage.setItem('logoHospital', logoData);
        atualizarLogo();
        showToast('Logo atualizada com sucesso!');
    };
    reader.readAsDataURL(file);
}

function salvarLogoURL() {
    const url = document.getElementById('logoURL').value.trim();
    if (!url) {
        showToast('Informe a URL da imagem.', 'error');
        return;
    }
    localStorage.setItem('logoHospital', url);
    atualizarLogo();
    showToast('Logo atualizada com sucesso!');
}

function removerLogo() {
    localStorage.setItem('logoHospital', '');
    atualizarLogo();
    showToast('Logo removida!');
}

function atualizarLogo() {
    const logoData = localStorage.getItem('logoHospital') || '';
    const loginLogo = document.getElementById('loginLogo');
    const sidebarLogo = document.getElementById('sidebarLogo');
    const logoPreview = document.getElementById('logoPreview');
    
    if (logoData) {
        const imgHTML = `<img src="${logoData}" alt="Logo HRPI" style="max-width:100%;max-height:60px;object-fit:contain;">`;
        if (loginLogo) loginLogo.innerHTML = imgHTML;
        if (sidebarLogo) sidebarLogo.innerHTML = imgHTML;
        if (logoPreview) logoPreview.innerHTML = imgHTML;
    } else {
        if (loginLogo) loginLogo.innerHTML = '<i class="fas fa-hospital-alt default-logo"></i>';
        if (sidebarLogo) sidebarLogo.innerHTML = '<i class="fas fa-hospital-alt default-logo"></i>';
        if (logoPreview) logoPreview.innerHTML = '<i class="fas fa-hospital-alt" style="font-size:48px;color:var(--primary);"></i>';
    }
}

// Atualizar também o fundo do login quando a logo for carregada
function atualizarFundoLogin() {
    const logoData = localStorage.getItem('logoHospital') || '';
    const loginOverlay = document.getElementById('loginOverlay');
    
    if (logoData && loginOverlay) {
        loginOverlay.style.setProperty('--login-bg-image', `url(${logoData})`);
    } else {
        loginOverlay.style.setProperty('--login-bg-image', 'none');
    }
}

// Modifique a função atualizarLogo para incluir a chamada:
function atualizarLogo() {
    const logoData = localStorage.getItem('logoHospital') || '';
    const loginLogo = document.getElementById('loginLogo');
    const sidebarLogo = document.getElementById('sidebarLogo');
    const logoPreview = document.getElementById('logoPreview');
    
    if (logoData) {
        const imgHTML = `<img src="${logoData}" alt="Logo HRPI" style="max-width:100%;max-height:60px;object-fit:contain;">`;
        if (loginLogo) loginLogo.innerHTML = imgHTML;
        if (sidebarLogo) sidebarLogo.innerHTML = imgHTML;
        if (logoPreview) logoPreview.innerHTML = imgHTML;
    } else {
        if (loginLogo) loginLogo.innerHTML = '<i class="fas fa-hospital-alt default-logo"></i>';
        if (sidebarLogo) sidebarLogo.innerHTML = '<i class="fas fa-hospital-alt default-logo"></i>';
        if (logoPreview) logoPreview.innerHTML = '<i class="fas fa-hospital-alt" style="font-size:48px;color:var(--primary);"></i>';
    }
    
    // Atualizar fundo do login
    atualizarFundoLogin();
}

// Adicione no init() para carregar o fundo inicialmente:
function init() {
    inicializarDados();
    carregarTema();
    atualizarLogo();
    atualizarFundoLogin(); // <- Adicionar esta linha
    
    // ... resto do código
}
function carregarFundoLogin(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imagemData = e.target.result;
        localStorage.setItem('fundoLogin', imagemData);
        atualizarFundoLogin();
        showToast('Fundo da tela de login atualizado!');
    };
    reader.readAsDataURL(file);
}

function salvarFundoLoginURL() {
    const url = document.getElementById('fundoLoginURL').value.trim();
    if (!url) {
        showToast('Informe a URL da imagem.', 'error');
        return;
    }
    localStorage.setItem('fundoLogin', url);
    atualizarFundoLogin();
    showToast('Fundo da tela de login atualizado!');
}

function removerFundoLogin() {
    localStorage.setItem('fundoLogin', '');
    atualizarFundoLogin();
    showToast('Fundo removido!');
}

function atualizarFundoLogin() {
    const fundoData = localStorage.getItem('fundoLogin') || localStorage.getItem('logoHospital') || '';
    const loginOverlay = document.getElementById('loginOverlay');
    
    if (fundoData && loginOverlay) {
        loginOverlay.style.setProperty('--login-bg-image', `url(${fundoData})`);
    } else {
        loginOverlay.style.setProperty('--login-bg-image', 'none');
    }
}
// ==================== LOGIN ====================
function fazerLogin() {
    const usuario = document.getElementById('loginUsuario').value.trim();
    const senha = document.getElementById('loginSenha').value.trim();
    const errorEl = document.getElementById('loginError');
    
    if (!usuario || !senha) {
        errorEl.textContent = 'Preencha usuário e senha.';
        return;
    }
    
    const usuarios = getUsuarios();
    const encontrado = usuarios.find(u => u.usuario === usuario && u.senha === senha && u.ativo);
    
    if (!encontrado) {
        errorEl.textContent = 'Usuário ou senha inválidos.';
        return;
    }
    
    if (encontrado.primeiroAcesso) {
        sessionStorage.setItem('usuarioLogado', JSON.stringify(encontrado));
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('trocaSenhaOverlay').classList.add('active');
        return;
    }
    
    completarLogin(encontrado);
}

// Permitir login com Enter em qualquer campo
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const loginOverlay = document.getElementById('loginOverlay');
        const trocaSenhaOverlay = document.getElementById('trocaSenhaOverlay');
        
        if (!loginOverlay.classList.contains('hidden')) {
            fazerLogin();
        } else if (trocaSenhaOverlay.classList.contains('active')) {
            alterarSenhaPrimeiroAcesso();
        }
    }
});

function completarLogin(usuario) {
    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuario));
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('trocaSenhaOverlay').classList.remove('active');
    document.getElementById('appContainer').classList.add('active');
    document.getElementById('sidebarUserName').textContent = usuario.nome;
    document.getElementById('loginError').textContent = '';
    document.getElementById('loginSenha').value = '';
    
    atualizarMenuPorPermissao();
    inicializarSistema();
    showToast(`Bem-vindo(a), ${usuario.nome}!`);
}

function alterarSenhaPrimeiroAcesso() {
    const novaSenha = document.getElementById('novaSenha').value.trim();
    const confirmarSenha = document.getElementById('confirmarNovaSenha').value.trim();
    const errorEl = document.getElementById('trocaSenhaError');
    
    if (!novaSenha || novaSenha.length < 6) {
        errorEl.textContent = 'A senha deve ter no mínimo 6 caracteres.';
        return;
    }
    
    if (novaSenha !== confirmarSenha) {
        errorEl.textContent = 'As senhas não conferem.';
        return;
    }
    
    const usuario = getUsuarioLogado();
    const usuarios = getUsuarios();
    const idx = usuarios.findIndex(u => u.id === usuario.id);
    
    if (idx !== -1) {
        usuarios[idx].senha = novaSenha;
        usuarios[idx].primeiroAcesso = false;
        salvarUsuarios(usuarios);
        
        completarLogin(usuarios[idx]);
        showToast('Senha alterada com sucesso!');
    }
}

function logout() {
    if (confirm('Deseja realmente sair do sistema?')) {
        sessionStorage.removeItem('usuarioLogado');
        document.getElementById('appContainer').classList.remove('active');
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('trocaSenhaOverlay').classList.remove('active');
        document.getElementById('loginUsuario').value = '';
        document.getElementById('loginSenha').value = '';
        document.getElementById('loginError').textContent = '';
    }
}

function atualizarMenuPorPermissao() {
    const usuario = getUsuarioLogado();
    if (!usuario) return;
    
    const navAdmin = document.getElementById('navAdmin');
    const linkUsuarios = document.getElementById('linkUsuarios');
    const linkRelatorios = document.getElementById('linkRelatorios');
    const linkConfiguracoes = document.getElementById('linkConfiguracoes');
    
    if (podeGerenciarUsuarios()) {
        if (navAdmin) navAdmin.style.display = 'block';
        if (linkUsuarios) linkUsuarios.style.display = 'flex';
    } else {
        if (navAdmin) navAdmin.style.display = 'none';
        if (linkUsuarios) linkUsuarios.style.display = 'none';
    }
    
    if (podeVerIndicadores()) {
        if (linkRelatorios) linkRelatorios.style.display = 'flex';
    } else {
        if (linkRelatorios) linkRelatorios.style.display = 'none';
    }
    
    if (podeConfigurar()) {
        if (linkConfiguracoes) linkConfiguracoes.style.display = 'flex';
    } else {
        if (linkConfiguracoes) linkConfiguracoes.style.display = 'none';
    }
}

// ==================== NAVEGAÇÃO ====================
function navegarPara(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    
    const pageEl = document.getElementById('page-' + pageName);
    if (pageEl) pageEl.classList.add('active');
    
    const navLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
    if (navLink) navLink.classList.add('active');
    
    document.getElementById('sidebar').classList.remove('open');
    
    if (pageName === 'dashboard') carregarDashboard();
    if (pageName === 'troca') carregarSelectTroca();
    if (pageName === 'saida') carregarSelectSaida();
    if (pageName === 'ativos') carregarAtivos();
    if (pageName === 'historico') carregarHistorico();
    if (pageName === 'usuarios') carregarUsuarios();
    if (pageName === 'relatorios') {
        document.getElementById('relDataDiaria').value = formatData(new Date());
        document.getElementById('relDataInicio').value = formatData(new Date());
        document.getElementById('relDataFim').value = formatData(new Date());
    }
    if (pageName === 'configuracoes') carregarConfiguracoes();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

window.addEventListener('hashchange', () => {
    const page = location.hash.replace('#', '') || 'dashboard';
    navegarPara(page);
});

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const page = this.getAttribute('data-page');
        location.hash = page;
        navegarPara(page);
    });
});

// ==================== DASHBOARD ====================
function carregarDashboard() {
    const acompanhantes = getAcompanhantes();
    const hoje = formatData(new Date());
    const agora = new Date();
    
    const diaSemana = agora.getDay();
    const diffSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicioSemana = new Date(agora);
    inicioSemana.setDate(agora.getDate() - diffSegunda);
    inicioSemana.setHours(0, 0, 0, 0);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);
    
    const inicioSemanaStr = formatData(inicioSemana);
    const fimSemanaStr = formatData(fimSemana);
    
    const inicioMes = formatData(new Date(agora.getFullYear(), agora.getMonth(), 1));
    const fimMes = formatData(new Date(agora.getFullYear(), agora.getMonth() + 1, 0));
    
    const presentes = acompanhantes.filter(a => a.status === 'presente' && a.tipo !== 'visita').length;
    const visitasAtivas = acompanhantes.filter(a => a.status === 'presente' && a.tipo === 'visita').length;
    const entradasHoje = acompanhantes.filter(a => a.dataEntrada === hoje).length;
    const saidasHoje = acompanhantes.filter(a => a.dataSaida === hoje && a.status === 'saiu').length;
    const trocasHoje = acompanhantes.filter(a => a.dataSaida === hoje && a.status === 'trocado').length;
    
    const entradasSemana = acompanhantes.filter(a => a.dataEntrada >= inicioSemanaStr && a.dataEntrada <= fimSemanaStr).length;
    const saidasSemana = acompanhantes.filter(a => a.dataSaida >= inicioSemanaStr && a.dataSaida <= fimSemanaStr && a.status === 'saiu').length;
    const trocasSemana = acompanhantes.filter(a => a.dataSaida >= inicioSemanaStr && a.dataSaida <= fimSemanaStr && a.status === 'trocado').length;
    const visitasSemana = acompanhantes.filter(a => a.dataEntrada >= inicioSemanaStr && a.dataEntrada <= fimSemanaStr && a.tipo === 'visita').length;
    
    const entradasMes = acompanhantes.filter(a => a.dataEntrada >= inicioMes && a.dataEntrada <= fimMes).length;
    const saidasMes = acompanhantes.filter(a => a.dataSaida >= inicioMes && a.dataSaida <= fimMes && a.status === 'saiu').length;
    const trocasMes = acompanhantes.filter(a => a.dataSaida >= inicioMes && a.dataSaida <= fimMes && a.status === 'trocado').length;
    const visitasMes = acompanhantes.filter(a => a.dataEntrada >= inicioMes && a.dataEntrada <= fimMes && a.tipo === 'visita').length;
    
    const cardsHTML = `
        <div class="stat-card presente">
            <div class="icon-circle"><i class="fas fa-user-check"></i></div>
            <div class="info"><div class="number">${presentes}</div><div class="label">Acompanhantes Presentes</div></div>
        </div>
        <div class="stat-card visita">
            <div class="icon-circle"><i class="fas fa-clock"></i></div>
            <div class="info"><div class="number">${visitasAtivas}</div><div class="label">Visitas Ativas</div></div>
        </div>
        <div class="stat-card entrada">
            <div class="icon-circle"><i class="fas fa-sign-in-alt"></i></div>
            <div class="info"><div class="number">${entradasHoje}</div><div class="label">Entradas Hoje</div></div>
        </div>
        <div class="stat-card troca">
            <div class="icon-circle"><i class="fas fa-exchange-alt"></i></div>
            <div class="info"><div class="number">${trocasHoje}</div><div class="label">Trocas Hoje</div></div>
        </div>
        <div class="stat-card saida">
            <div class="icon-circle"><i class="fas fa-sign-out-alt"></i></div>
            <div class="info"><div class="number">${saidasHoje}</div><div class="label">Saídas Hoje</div></div>
        </div>
    `;
    document.getElementById('dashboardCards').innerHTML = cardsHTML;
    
    if (podeVerIndicadores()) {
        const indicadoresHTML = `
            <div class="card" style="grid-column: span 2;">
                <h3 style="margin-bottom:12px;"><i class="fas fa-chart-bar"></i> Indicadores da Semana Atual</h3>
                <div style="display:flex;gap:20px;flex-wrap:wrap;">
                    <div><strong style="color:#2d8b4e;">${entradasSemana}</strong> Entradas</div>
                    <div><strong style="color:#c7841a;">${trocasSemana}</strong> Trocas</div>
                    <div><strong style="color:#c0392b;">${saidasSemana}</strong> Saídas</div>
                    <div><strong style="color:#8e44ad;">${visitasSemana}</strong> Visitas</div>
                    <div style="color:#7d8c97;font-size:12px;">${formatDataBR(inicioSemanaStr)} a ${formatDataBR(fimSemanaStr)}</div>
                </div>
            </div>
            <div class="card" style="grid-column: span 2;">
                <h3 style="margin-bottom:12px;"><i class="fas fa-chart-pie"></i> Indicadores do Mês Atual</h3>
                <div style="display:flex;gap:20px;flex-wrap:wrap;">
                    <div><strong style="color:#2d8b4e;">${entradasMes}</strong> Entradas</div>
                    <div><strong style="color:#c7841a;">${trocasMes}</strong> Trocas</div>
                    <div><strong style="color:#c0392b;">${saidasMes}</strong> Saídas</div>
                    <div><strong style="color:#8e44ad;">${visitasMes}</strong> Visitas</div>
                    <div style="color:#7d8c97;font-size:12px;">${formatDataBR(inicioMes)} a ${formatDataBR(fimMes)}</div>
                </div>
            </div>
        `;
        document.getElementById('dashboardIndicadores').innerHTML = indicadoresHTML;
        document.getElementById('dashboardIndicadores').style.display = '';
    } else {
        document.getElementById('dashboardIndicadores').innerHTML = '';
        document.getElementById('dashboardIndicadores').style.display = 'none';
    }
    
    const ultimos = [...acompanhantes].sort((a, b) => {
        const da = a.dataEntrada + (a.horaEntrada || '00:00');
        const db = b.dataEntrada + (b.horaEntrada || '00:00');
        return db.localeCompare(da);
    }).slice(0, 8);
    
    const tbody = document.getElementById('tabelaUltimosRegistros');
    if (ultimos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#aaa;">Nenhum registro.</td></tr>';
    } else {
        tbody.innerHTML = ultimos.map(a => {
            let statusBadge = '';
            if (a.status === 'presente') statusBadge = `<span class="badge ${a.tipo === 'visita' ? 'badge-visita' : 'badge-success'}">${a.tipo === 'visita' ? 'Visita' : 'Presente'}</span>`;
            else if (a.status === 'trocado') statusBadge = '<span class="badge badge-warning">Trocado</span>';
            else statusBadge = '<span class="badge badge-danger">Saiu</span>';
            return `
                <tr>
                    <td><span class="badge ${a.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${a.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                    <td><strong>${a.nomeAcompanhante}</strong></td>
                    <td>${a.nomePaciente}</td>
                    <td>${a.setor}${a.quarto ? ' - ' + a.quarto : ''}</td>
                    <td>${formatDataBR(a.dataEntrada)} ${a.horaEntrada || ''}</td>
                    <td>${statusBadge}</td>
                </tr>`;
        }).join('');
    }
}

// ==================== ENTRADA ====================
function registrarEntrada(event) {
    event.preventDefault();
    const usuarioLogado = getUsuarioLogado();
    if (!usuarioLogado) { showToast('Sessão expirada.', 'error'); logout(); return; }
    
    const agora = new Date();
    const novo = {
        id: gerarId(),
        tipo: 'acompanhante',
        nomeAcompanhante: document.getElementById('entNomeAcompanhante').value.trim(),
        documento: document.getElementById('entDocumento').value.trim(),
        telefone: document.getElementById('entTelefone').value.trim(),
        parentesco: document.getElementById('entParentesco').value,
        nomePaciente: document.getElementById('entNomePaciente').value.trim(),
        setor: document.getElementById('entSetor').value,
        quarto: document.getElementById('entQuarto').value.trim(),
        dataEntrada: formatData(agora),
        horaEntrada: String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0'),
        dataSaida: null,
        horaSaida: null,
        status: 'presente',
        recepcionistaEntrada: usuarioLogado.nome,
        recepcionistaSaida: null,
        trocas: [],
        observacao: document.getElementById('entObservacao').value.trim(),
        duracaoVisita: null
    };
    
    const acompanhantes = getAcompanhantes();
    acompanhantes.push(novo);
    salvarAcompanhantes(acompanhantes);
    document.getElementById('formEntrada').reset();
    showToast('Entrada registrada com sucesso!');
    carregarDashboard();
}

// ==================== VISITA ====================
function registrarVisita(event) {
    event.preventDefault();
    const usuarioLogado = getUsuarioLogado();
    if (!usuarioLogado) { showToast('Sessão expirada.', 'error'); logout(); return; }
    
    const agora = new Date();
    const duracao = parseInt(document.getElementById('visDuracao').value) || 30;
    const horaSaida = new Date(agora.getTime() + duracao * 60000);
    
    const novo = {
        id: gerarId(),
        tipo: 'visita',
        nomeAcompanhante: document.getElementById('visNomeVisitante').value.trim(),
        documento: document.getElementById('visDocumento').value.trim(),
        telefone: document.getElementById('visTelefone').value.trim(),
        parentesco: document.getElementById('visParentesco').value,
        nomePaciente: document.getElementById('visNomePaciente').value.trim(),
        setor: document.getElementById('visSetor').value,
        quarto: document.getElementById('visQuarto').value.trim(),
        dataEntrada: formatData(agora),
        horaEntrada: String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0'),
        dataSaida: formatData(horaSaida),
        horaSaida: String(horaSaida.getHours()).padStart(2, '0') + ':' + String(horaSaida.getMinutes()).padStart(2, '0'),
        status: 'presente',
        recepcionistaEntrada: usuarioLogado.nome,
        recepcionistaSaida: usuarioLogado.nome,
        trocas: [],
        observacao: document.getElementById('visObservacao').value.trim(),
        duracaoVisita: duracao
    };
    
    const acompanhantes = getAcompanhantes();
    acompanhantes.push(novo);
    salvarAcompanhantes(acompanhantes);
    document.getElementById('formVisita').reset();
    showToast('Visita registrada com sucesso!');
    carregarDashboard();
}

// ==================== TROCA ====================
function carregarSelectTroca() {
    const acompanhantes = getAcompanhantes().filter(a => a.status === 'presente' && a.tipo !== 'visita');
    const select = document.getElementById('trocaAcompanhanteSaindo');
    select.innerHTML = '<option value="">Selecione o acompanhante presente...</option>' +
        acompanhantes.map(a => `<option value="${a.id}" data-paciente="${a.nomePaciente}" data-setor="${a.setor}" data-quarto="${a.quarto || ''}">${a.nomeAcompanhante} - ${a.nomePaciente} (${a.setor})</option>`).join('');
}

function preencherDadosTroca() {
    const select = document.getElementById('trocaAcompanhanteSaindo');
    const option = select.options[select.selectedIndex];
    document.getElementById('trocaPaciente').value = option.getAttribute('data-paciente') || '';
    document.getElementById('trocaSetor').value = option.getAttribute('data-setor') || '';
    document.getElementById('trocaQuarto').value = option.getAttribute('data-quarto') || '';
}

function registrarTroca(event) {
    event.preventDefault();
    const usuarioLogado = getUsuarioLogado();
    if (!usuarioLogado) { showToast('Sessão expirada.', 'error'); logout(); return; }
    
    const select = document.getElementById('trocaAcompanhanteSaindo');
    const idSaindo = select.value;
    if (!idSaindo) { showToast('Selecione o acompanhante.', 'error'); return; }
    
    const novoNome = document.getElementById('trocaNovoNome').value.trim();
    if (!novoNome) { showToast('Informe o nome do novo acompanhante.', 'error'); return; }
    
    const acompanhantes = getAcompanhantes();
    const idxSaindo = acompanhantes.findIndex(a => a.id === idSaindo);
    if (idxSaindo === -1) { showToast('Registro não encontrado.', 'error'); return; }
    
    const agora = new Date();
    const dataHoraStr = formatData(agora) + ' ' + String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
    
    const saindo = acompanhantes[idxSaindo];
    saindo.status = 'trocado';
    saindo.dataSaida = formatData(agora);
    saindo.horaSaida = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
    saindo.recepcionistaSaida = usuarioLogado.nome;
    saindo.trocas.push({
        dataHora: dataHoraStr,
        acompanhanteAntigo: saindo.nomeAcompanhante,
        acompanhanteNovo: novoNome,
        recepcionista: usuarioLogado.nome
    });
    
    const novo = {
        id: gerarId(),
        tipo: 'acompanhante',
        nomeAcompanhante: novoNome,
        documento: document.getElementById('trocaNovoDocumento').value.trim(),
        telefone: document.getElementById('trocaNovoTelefone').value.trim(),
        parentesco: document.getElementById('trocaNovoParentesco').value,
        nomePaciente: saindo.nomePaciente,
        setor: saindo.setor,
        quarto: saindo.quarto,
        dataEntrada: formatData(agora),
        horaEntrada: String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0'),
        dataSaida: null,
        horaSaida: null,
        status: 'presente',
        recepcionistaEntrada: usuarioLogado.nome,
        recepcionistaSaida: null,
        trocas: [],
        observacao: 'Entrou em substituição a ' + saindo.nomeAcompanhante,
        duracaoVisita: null
    };
    
    acompanhantes[idxSaindo] = saindo;
    acompanhantes.push(novo);
    salvarAcompanhantes(acompanhantes);
    document.getElementById('formTroca').reset();
    document.getElementById('trocaPaciente').value = '';
    document.getElementById('trocaSetor').value = '';
    document.getElementById('trocaQuarto').value = '';
    carregarSelectTroca();
    showToast('Troca registrada com sucesso!');
    carregarDashboard();
}

// ==================== SAÍDA ====================
function carregarSelectSaida() {
    const acompanhantes = getAcompanhantes().filter(a => a.status === 'presente');
    const select = document.getElementById('saidaAcompanhante');
    select.innerHTML = '<option value="">Selecione o acompanhante presente...</option>' +
        acompanhantes.map(a => `<option value="${a.id}" data-paciente="${a.nomePaciente}" data-setor="${a.setor}" data-entrada="${formatDataBR(a.dataEntrada)} ${a.horaEntrada || ''}" data-tipo="${a.tipo}">${a.tipo === 'visita' ? '[VISITA] ' : ''}${a.nomeAcompanhante} - ${a.nomePaciente}</option>`).join('');
}

function preencherDadosSaida() {
    const select = document.getElementById('saidaAcompanhante');
    const option = select.options[select.selectedIndex];
    document.getElementById('saidaPaciente').value = option.getAttribute('data-paciente') || '';
    document.getElementById('saidaSetor').value = option.getAttribute('data-setor') || '';
    document.getElementById('saidaEntrada').value = option.getAttribute('data-entrada') || '';
}

function registrarSaida(event) {
    event.preventDefault();
    const usuarioLogado = getUsuarioLogado();
    if (!usuarioLogado) { showToast('Sessão expirada.', 'error'); logout(); return; }
    
    const idSaindo = document.getElementById('saidaAcompanhante').value;
    if (!idSaindo) { showToast('Selecione o acompanhante.', 'error'); return; }
    
    const acompanhantes = getAcompanhantes();
    const idx = acompanhantes.findIndex(a => a.id === idSaindo);
    if (idx === -1) { showToast('Registro não encontrado.', 'error'); return; }
    
    const agora = new Date();
    acompanhantes[idx].status = 'saiu';
    acompanhantes[idx].dataSaida = formatData(agora);
    acompanhantes[idx].horaSaida = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
    acompanhantes[idx].recepcionistaSaida = usuarioLogado.nome;
    acompanhantes[idx].observacao = (acompanhantes[idx].observacao || '') + ' | Motivo: ' + (document.getElementById('saidaMotivo').value || 'Não informado');
    
    salvarAcompanhantes(acompanhantes);
    document.getElementById('formSaida').reset();
    document.getElementById('saidaPaciente').value = '';
    document.getElementById('saidaSetor').value = '';
    document.getElementById('saidaEntrada').value = '';
    carregarSelectSaida();
    showToast('Saída registrada com sucesso!');
    carregarDashboard();
}

// ==================== ATIVOS ====================
function carregarAtivos() {
    const ativos = getAcompanhantes().filter(a => a.status === 'presente');
    document.getElementById('contadorAtivos').textContent = ativos.length + ' presente(s)';
    const tbody = document.getElementById('tabelaAtivos');
    if (ativos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#aaa;">Nenhum acompanhante presente.</td></tr>';
    } else {
        tbody.innerHTML = ativos.map(a => `
            <tr>
                <td><span class="badge ${a.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${a.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                <td><strong>${a.nomeAcompanhante}</strong></td>
                <td>${a.documento || '-'}</td>
                <td>${a.parentesco || '-'}</td>
                <td>${a.nomePaciente}</td>
                <td>${a.setor}</td>
                <td>${a.quarto || '-'}</td>
                <td>${formatDataBR(a.dataEntrada)} ${a.horaEntrada || ''}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="editarRegistro('${a.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="excluirRegistro('${a.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
    }
}

// ==================== HISTÓRICO ====================
function carregarHistorico(filtroDataInicio = '', filtroDataFim = '', filtroStatus = 'todos', filtroTipo = 'todos') {
    let lista = getAcompanhantes();
    if (filtroDataInicio) lista = lista.filter(a => a.dataEntrada >= filtroDataInicio);
    if (filtroDataFim) lista = lista.filter(a => a.dataEntrada <= filtroDataFim);
    if (filtroStatus !== 'todos') lista = lista.filter(a => a.status === filtroStatus);
    if (filtroTipo !== 'todos') lista = lista.filter(a => a.tipo === filtroTipo);
    
    lista.sort((a, b) => {
        const da = a.dataEntrada + (a.horaEntrada || '00:00');
        const db = b.dataEntrada + (b.horaEntrada || '00:00');
        return db.localeCompare(da);
    });
    
    const tbody = document.getElementById('tabelaHistorico');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#aaa;">Nenhum registro encontrado.</td></tr>';
    } else {
        tbody.innerHTML = lista.map(a => {
            let statusBadge = '';
            if (a.status === 'presente') statusBadge = `<span class="badge ${a.tipo === 'visita' ? 'badge-visita' : 'badge-success'}">${a.tipo === 'visita' ? 'Visita' : 'Presente'}</span>`;
            else if (a.status === 'trocado') statusBadge = '<span class="badge badge-warning">Trocado</span>';
            else statusBadge = '<span class="badge badge-danger">Saiu</span>';
            return `
                <tr>
                    <td><span class="badge ${a.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${a.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                    <td><strong>${a.nomeAcompanhante}</strong></td>
                    <td>${a.nomePaciente}</td>
                    <td>${a.setor}${a.quarto ? ' - ' + a.quarto : ''}</td>
                    <td>${formatDataBR(a.dataEntrada)} ${a.horaEntrada || ''}</td>
                    <td>${a.dataSaida ? formatDataBR(a.dataSaida) + ' ' + (a.horaSaida || '') : '-'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="editarRegistro('${a.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="excluirRegistro('${a.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        }).join('');
    }
}

function filtrarHistorico() {
    const inicio = document.getElementById('filtroDataInicio').value;
    const fim = document.getElementById('filtroDataFim').value;
    const status = document.getElementById('filtroStatus').value;
    const tipo = document.getElementById('filtroTipo').value;
    carregarHistorico(inicio, fim, status, tipo);
}

function limparFiltrosHistorico() {
    document.getElementById('filtroDataInicio').value = '';
    document.getElementById('filtroDataFim').value = '';
    document.getElementById('filtroStatus').value = 'todos';
    document.getElementById('filtroTipo').value = 'todos';
    carregarHistorico();
}

// ==================== EDITAR / EXCLUIR ====================
function editarRegistro(id) {
    const acompanhantes = getAcompanhantes();
    const registro = acompanhantes.find(a => a.id === id);
    if (!registro) return;
    
    const modalHTML = `
        <h3><i class="fas fa-edit"></i> Editar Registro</h3>
        <form onsubmit="salvarEdicao(event, '${id}')">
            <div class="form-grid">
                <div class="form-group">
                    <label>Nome do Acompanhante *</label>
                    <input type="text" id="editNome" value="${registro.nomeAcompanhante}" required>
                </div>
                <div class="form-group">
                    <label>Documento</label>
                    <input type="text" id="editDocumento" value="${registro.documento || ''}">
                </div>
                <div class="form-group">
                    <label>Telefone</label>
                    <input type="text" id="editTelefone" value="${registro.telefone || ''}">
                </div>
                <div class="form-group">
                    <label>Parentesco</label>
                    <select id="editParentesco">
                        <option ${registro.parentesco === 'Filho(a)' ? 'selected' : ''}>Filho(a)</option>
                        <option ${registro.parentesco === 'Pai/Mãe' ? 'selected' : ''}>Pai/Mãe</option>
                        <option ${registro.parentesco === 'Cônjuge' ? 'selected' : ''}>Cônjuge</option>
                        <option ${registro.parentesco === 'Irmão/Irmã' ? 'selected' : ''}>Irmão/Irmã</option>
                        <option ${registro.parentesco === 'Amigo(a)' ? 'selected' : ''}>Amigo(a)</option>
                        <option ${registro.parentesco === 'Cuidador(a)' ? 'selected' : ''}>Cuidador(a)</option>
                        <option ${registro.parentesco === 'Outro' ? 'selected' : ''}>Outro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Nome do Paciente</label>
                    <input type="text" id="editPaciente" value="${registro.nomePaciente}">
                </div>
                <div class="form-group">
                    <label>Setor</label>
                    <select id="editSetor">
                        <option ${registro.setor === 'Enfermaria' ? 'selected' : ''}>Enfermaria</option>
                        <option ${registro.setor === 'UTI' ? 'selected' : ''}>UTI</option>
                        <option ${registro.setor === 'Apartamento' ? 'selected' : ''}>Apartamento</option>
                        <option ${registro.setor === 'Pronto-Socorro' ? 'selected' : ''}>Pronto-Socorro</option>
                        <option ${registro.setor === 'Pediatria' ? 'selected' : ''}>Pediatria</option>
                        <option ${registro.setor === 'Maternidade' ? 'selected' : ''}>Maternidade</option>
                        <option ${registro.setor === 'Oncologia' ? 'selected' : ''}>Oncologia</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Quarto/Leito</label>
                    <input type="text" id="editQuarto" value="${registro.quarto || ''}">
                </div>
                <div class="form-group">
                    <label>Observação</label>
                    <input type="text" id="editObservacao" value="${registro.observacao || ''}">
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button>
                <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
            </div>
        </form>
    `;
    
    showModal(modalHTML);
}

function salvarEdicao(event, id) {
    event.preventDefault();
    const acompanhantes = getAcompanhantes();
    const idx = acompanhantes.findIndex(a => a.id === id);
    if (idx === -1) return;
    
    acompanhantes[idx].nomeAcompanhante = document.getElementById('editNome').value.trim();
    acompanhantes[idx].documento = document.getElementById('editDocumento').value.trim();
    acompanhantes[idx].telefone = document.getElementById('editTelefone').value.trim();
    acompanhantes[idx].parentesco = document.getElementById('editParentesco').value;
    acompanhantes[idx].nomePaciente = document.getElementById('editPaciente').value.trim();
    acompanhantes[idx].setor = document.getElementById('editSetor').value;
    acompanhantes[idx].quarto = document.getElementById('editQuarto').value.trim();
    acompanhantes[idx].observacao = document.getElementById('editObservacao').value.trim();
    
    salvarAcompanhantes(acompanhantes);
    closeModal();
    showToast('Registro atualizado com sucesso!');
    carregarDashboard();
    carregarAtivos();
}

function excluirRegistro(id) {
    if (!confirm('Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.')) return;
    
    const acompanhantes = getAcompanhantes();
    const novaLista = acompanhantes.filter(a => a.id !== id);
    salvarAcompanhantes(novaLista);
    showToast('Registro excluído com sucesso!');
    carregarDashboard();
    carregarAtivos();
    carregarHistorico();
}

// ==================== USUÁRIOS ====================
function carregarUsuarios() {
    if (!podeGerenciarUsuarios()) {
        navegarPara('dashboard');
        return;
    }
    
    const usuarios = getUsuarios();
    const tbody = document.getElementById('tabelaUsuarios');
    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td><strong>${u.nome}</strong></td>
            <td>${u.usuario}</td>
            <td>${u.cargo}</td>
            <td>${u.primeiroAcesso ? '<span class="badge badge-warning">Pendente</span>' : '<span class="badge badge-success">OK</span>'}</td>
            <td>${u.ativo ? '<span class="badge badge-success">Sim</span>' : '<span class="badge badge-danger">Não</span>'}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editarUsuario(${u.id})" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-warning" onclick="resetarSenha(${u.id})" title="Resetar Senha"><i class="fas fa-key"></i></button>
                <button class="btn btn-sm btn-danger" onclick="excluirUsuario(${u.id})" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function salvarUsuario(event) {
    event.preventDefault();
    if (!podeGerenciarUsuarios()) return;
    
    const id = document.getElementById('userId').value;
    const nome = document.getElementById('userNome').value.trim();
    const usuario = document.getElementById('userUsuario').value.trim();
    const cargo = document.getElementById('userCargo').value;
    const ativo = document.getElementById('userAtivo').value === 'true';
    
    if (!nome || !usuario) {
        showToast('Preencha todos os campos obrigatórios.', 'error');
        return;
    }
    
    const usuarios = getUsuarios();
    
    if (id) {
        const idx = usuarios.findIndex(u => u.id === parseInt(id));
        if (idx !== -1) {
            usuarios[idx].nome = nome;
            usuarios[idx].usuario = usuario;
            usuarios[idx].cargo = cargo;
            usuarios[idx].ativo = ativo;
        }
    } else {
        const novoUsuario = {
            id: Date.now(),
            nome,
            usuario,
            senha: '12345',
            cargo,
            ativo,
            primeiroAcesso: true
        };
        usuarios.push(novoUsuario);
    }
    
    salvarUsuarios(usuarios);
    limparFormUsuario();
    carregarUsuarios();
    showToast('Usuário salvo com sucesso!');
}

function editarUsuario(id) {
    if (!podeGerenciarUsuarios()) return;
    
    const usuarios = getUsuarios();
    const usuario = usuarios.find(u => u.id === id);
    if (!usuario) return;
    
    document.getElementById('userId').value = usuario.id;
    document.getElementById('userNome').value = usuario.nome;
    document.getElementById('userUsuario').value = usuario.usuario;
    document.getElementById('userCargo').value = usuario.cargo;
    document.getElementById('userAtivo').value = usuario.ativo.toString();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limparFormUsuario() {
    document.getElementById('userId').value = '';
    document.getElementById('userNome').value = '';
    document.getElementById('userUsuario').value = '';
    document.getElementById('userCargo').value = 'Recepcionista';
    document.getElementById('userAtivo').value = 'true';
}

function resetarSenha(id) {
    if (!confirm('Deseja resetar a senha deste usuário para "12345"?')) return;
    
    const usuarios = getUsuarios();
    const idx = usuarios.findIndex(u => u.id === id);
    if (idx !== -1) {
        usuarios[idx].senha = '12345';
        usuarios[idx].primeiroAcesso = true;
        salvarUsuarios(usuarios);
        carregarUsuarios();
        showToast('Senha resetada com sucesso!');
    }
}

function excluirUsuario(id) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    
    const usuarios = getUsuarios();
    const novaLista = usuarios.filter(u => u.id !== id);
    salvarUsuarios(novaLista);
    carregarUsuarios();
    showToast('Usuário excluído com sucesso!');
}

// ==================== RELATÓRIOS PDF ====================
function getDadosFiltrados(dataInicio, dataFim) {
    let lista = getAcompanhantes();
    if (dataInicio) lista = lista.filter(a => a.dataEntrada >= dataInicio);
    if (dataFim) lista = lista.filter(a => a.dataEntrada <= dataFim);
    lista.sort((a, b) => {
        const da = a.dataEntrada + (a.horaEntrada || '00:00');
        const db = b.dataEntrada + (b.horaEntrada || '00:00');
        return db.localeCompare(da);
    });
    return lista;
}

function gerarPDF(titulo, dataInicio, dataFim) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const usuarioLogado = getUsuarioLogado();
    const lista = getDadosFiltrados(dataInicio, dataFim);
    const logoData = localStorage.getItem('logoHospital') || '';
    
    const entradas = lista.length;
    const saidas = lista.filter(a => a.status === 'saiu').length;
    const trocas = lista.filter(a => a.status === 'trocado').length;
    const presentes = lista.filter(a => a.status === 'presente').length;
    const visitas = lista.filter(a => a.tipo === 'visita').length;
    
    // Cabeçalho com logo
    doc.setFillColor(26, 107, 122);
    doc.rect(0, 0, 297, 32, 'F');
    
    // Logo no canto superior esquerdo
    if (logoData) {
        try {
            doc.addImage(logoData, 'PNG', 10, 3, 24, 24);
        } catch(e) {
            // Se não conseguir carregar a logo, ignora
        }
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS - HRPI', logoData ? 38 : 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Controle de Acompanhantes - Recepção', logoData ? 38 : 14, 23);
    doc.text('Relatório: ' + titulo, logoData ? 38 : 14, 30);
    
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    const yInfo = 40;
    doc.text(`Gerado por: ${usuarioLogado ? usuarioLogado.nome : 'Sistema'}`, 14, yInfo);
    doc.text(`Data: ${formatDataBR(formatData(new Date()))}`, 14, yInfo + 5);
    doc.text(`Período: ${dataInicio ? formatDataBR(dataInicio) : 'Início'} a ${dataFim ? formatDataBR(dataFim) : 'Fim'}`, 14, yInfo + 10);
    
    doc.setFillColor(240, 244, 246);
    doc.rect(14, yInfo + 16, 269, 16, 'F');
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Registros: ${entradas} | Entradas: ${entradas} | Saídas: ${saidas} | Trocas: ${trocas} | Presentes: ${presentes} | Visitas: ${visitas}`, 16, yInfo + 27);
    
    const body = lista.map(a => [
        a.tipo === 'visita' ? 'Visita' : 'Acomp.',
        a.nomeAcompanhante,
        a.documento || '-',
        a.parentesco || '-',
        a.nomePaciente,
        a.setor + (a.quarto ? ' - ' + a.quarto : ''),
        formatDataBR(a.dataEntrada) + ' ' + (a.horaEntrada || ''),
        a.dataSaida ? formatDataBR(a.dataSaida) + ' ' + (a.horaSaida || '') : '-',
        a.status === 'presente' ? 'Presente' : a.status === 'trocado' ? 'Trocado' : 'Saiu',
        a.recepcionistaEntrada || '-',
        a.recepcionistaSaida || '-'
    ]);
    
    doc.autoTable({
        startY: yInfo + 36,
        head: [['Tipo', 'Acompanhante', 'Documento', 'Parentesco', 'Paciente', 'Setor/Quarto', 'Entrada', 'Saída', 'Status', 'Rec. Entrada', 'Rec. Saída']],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [26, 107, 122], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 7.5, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [248, 250, 251] },
        margin: { left: 14, right: 14 },
        styles: { overflow: 'linebreak', cellPadding: 2.5 }
    });
    
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount} - HRPI - Sistema de Controle de Acompanhantes - Gerado em ${formatDataBR(formatData(new Date()))}`, 14, 200);
    }
    
    doc.save(`HRPI_relatorio_${titulo.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    showToast('PDF gerado com sucesso!');
}

function gerarPDFDiario() {
    const data = document.getElementById('relDataDiaria').value || formatData(new Date());
    gerarPDF('Diário - ' + formatDataBR(data), data, data);
}

function gerarPDFSemanal() {
    const agora = new Date();
    const diaSemana = agora.getDay();
    const diffSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicioSemana = new Date(agora);
    inicioSemana.setDate(agora.getDate() - diffSegunda);
    inicioSemana.setHours(0, 0, 0, 0);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);
    gerarPDF('Semanal', formatData(inicioSemana), formatData(fimSemana));
}

function gerarPDFMensal() {
    const agora = new Date();
    const inicioMes = formatData(new Date(agora.getFullYear(), agora.getMonth(), 1));
    const fimMes = formatData(new Date(agora.getFullYear(), agora.getMonth() + 1, 0));
    gerarPDF('Mensal', inicioMes, fimMes);
}

function gerarPDFPersonalizado() {
    const inicio = document.getElementById('relDataInicio').value;
    const fim = document.getElementById('relDataFim').value;
    if (!inicio || !fim) {
        showToast('Selecione as datas.', 'error');
        return;
    }
    gerarPDF('Personalizado', inicio, fim);
}

// ==================== CONFIGURAÇÕES ====================
function carregarConfiguracoes() {
    if (!podeConfigurar()) {
        navegarPara('dashboard');
        return;
    }
    atualizarLogo();
    carregarSelectResetSenha();
}

function carregarSelectResetSenha() {
    const select = document.getElementById('resetSenhaUsuario');
    if (!select) return;
    
    const usuarios = getUsuarios();
    select.innerHTML = '<option value="">Selecione o usuário...</option>' +
        usuarios.map(u => `<option value="${u.id}">${u.nome} (${u.usuario}) - ${u.cargo}</option>`).join('');
}

function resetarSenhaUsuario() {
    if (!podeConfigurar()) {
        showToast('Permissão negada.', 'error');
        return;
    }
    
    const select = document.getElementById('resetSenhaUsuario');
    const id = parseInt(select.value);
    
    if (!id) {
        showToast('Selecione um usuário.', 'error');
        return;
    }
    
    if (!confirm('Tem certeza que deseja resetar a senha deste usuário para "12345"?')) return;
    
    const usuarios = getUsuarios();
    const idx = usuarios.findIndex(u => u.id === id);
    if (idx !== -1) {
        usuarios[idx].senha = '12345';
        usuarios[idx].primeiroAcesso = true;
        salvarUsuarios(usuarios);
        showToast('Senha resetada com sucesso! A nova senha é 12345');
    }
}

// ==================== INICIALIZAÇÃO ====================
function inicializarSistema() {
    const page = location.hash.replace('#', '') || 'dashboard';
    navegarPara(page);
    carregarDashboard();
    atualizarMenuPorPermissao();
}

function init() {
    inicializarDados();
    carregarTema();
    atualizarLogo();
    
    const usuarioLogado = getUsuarioLogado();
    if (usuarioLogado) {
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appContainer').classList.add('active');
        document.getElementById('sidebarUserName').textContent = usuarioLogado.nome;
        atualizarMenuPorPermissao();
        inicializarSistema();
    }
    
    // Configurar datas padrão
    const relDataDiaria = document.getElementById('relDataDiaria');
    const relDataInicio = document.getElementById('relDataInicio');
    const relDataFim = document.getElementById('relDataFim');
    
    if (relDataDiaria) relDataDiaria.value = formatData(new Date());
    if (relDataInicio) relDataInicio.value = formatData(new Date());
    if (relDataFim) relDataFim.value = formatData(new Date());
}

// Iniciar o sistema
init();

console.log('✅ HRPI - Sistema de Controle de Acompanhantes carregado!');
console.log('🏥 Hospital Regional de Palmeira dos Índios');
console.log('👤 Teste: admin/admin123 | supervisor/123456 | recepcao/123456');
console.log('💡 Use Enter para fazer login e confirmar ações');