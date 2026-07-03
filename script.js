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
// FUNÇÕES UTILITÁRIAS
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
    t.textContent = msg;
    t.className = 'toast mostrar' + (erro ? ' erro' : '');
    setTimeout(() => t.classList.remove('mostrar'), 3000);
}

// ============================================
// LOGIN
// ============================================
function login() {
    const usuario = document.getElementById('usuarioInput').value.trim();
    const senha = document.getElementById('senhaInput').value.trim();
    const erroDiv = document.getElementById('loginErro');
    
    if (!usuario || !senha) {
        erroDiv.textContent = 'Preencha usuário e senha';
        erroDiv.style.display = 'block';
        return;
    }
    
    db.ref('usuarios').once('value').then(snapshot => {
        const usuarios = snapshot.val();
        
        if (!usuarios) {
            erroDiv.textContent = 'Nenhum usuário cadastrado';
            erroDiv.style.display = 'block';
            return;
        }
        
        const user = Object.values(usuarios).find(u => 
            u.usuario === usuario && u.senha === senha
        );
        
        if (!user) {
            erroDiv.textContent = 'Usuário ou senha inválidos';
            erroDiv.style.display = 'block';
            return;
        }
        
        // Login OK
        usuarioLogado = user;
        sessionStorage.setItem('hrpi_user', JSON.stringify(user));
        
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('sistemaPrincipal').style.display = 'flex';
        document.getElementById('nomeUsuario').textContent = user.nome;
        
        iniciarSistema();
        toast('Bem-vindo, ' + user.nome + '!');
    }).catch(erro => {
        erroDiv.textContent = 'Erro: ' + erro.message;
        erroDiv.style.display = 'block';
    });
}

function logout() {
    sessionStorage.removeItem('hrpi_user');
    usuarioLogado = null;
    document.getElementById('sistemaPrincipal').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('usuarioInput').value = '';
    document.getElementById('senhaInput').value = '';
}

// ============================================
// INICIALIZAÇÃO
// ============================================
function iniciarSistema() {
    // Listener em tempo real
    db.ref('acompanhantes').on('value', snapshot => {
        acompanhantes = snapshot.val() || {};
        atualizarDashboard();
        atualizarAtivos();
        atualizarHistorico();
        atualizarSelects();
    });
    
    mostrarSecao('dashboard');
}

function mostrarSecao(nome) {
    document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativo'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('ativo'));
    
    document.getElementById('secao-' + nome).classList.add('ativo');
    document.getElementById('nav-' + nome).classList.add('ativo');
    
    if (nome === 'dashboard') atualizarDashboard();
    if (nome === 'ativos') atualizarAtivos();
    if (nome === 'historico') atualizarHistorico();
    if (nome === 'saida') atualizarSelects();
    if (nome === 'troca') atualizarSelects();
}

// ============================================
// DASHBOARD
// ============================================
function atualizarDashboard() {
    const hoje = dataHoje();
    let presentes = 0, visitas = 0, entradas = 0, saidas = 0;
    const ultimos = [];
    
    Object.values(acompanhantes).forEach(ac => {
        if (ac.status === 'presente') {
            presentes++;
            if (ac.tipo === 'visita') visitas++;
        }
        if (ac.dataEntrada === hoje) entradas++;
        if (ac.dataSaida === hoje) saidas++;
        ultimos.push(ac);
    });
    
    document.getElementById('countPresentes').textContent = presentes;
    document.getElementById('countVisitas').textContent = visitas;
    document.getElementById('countEntradas').textContent = entradas;
    document.getElementById('countSaidas').textContent = saidas;
    
    // Ordenar últimos
    ultimos.sort((a, b) => {
        const [da, ma, aa] = a.dataEntrada.split('-');
        const [db, mb, ab] = b.dataEntrada.split('-');
        return new Date(ab, mb-1, db) - new Date(aa, ma-1, da);
    });
    
    const tbody = document.querySelector('#tabelaUltimos tbody');
    tbody.innerHTML = ultimos.slice(0, 8).map(ac => `
        <tr>
            <td>${ac.tipo === 'visita' ? '🏥 Visita' : '👤 Acomp.'}</td>
            <td>${ac.nomeAcompanhante}</td>
            <td>${ac.nomePaciente}</td>
            <td>${ac.setor}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td><span class="badge badge-${ac.status}">${ac.status}</span></td>
        </tr>
    `).join('');
}

// ============================================
// ENTRADA DE ACOMPANHANTE
// ============================================
function salvarEntrada(event) {
    event.preventDefault();
    
    const dados = {
        id: gerarId(),
        tipo: 'acompanhante',
        nomeAcompanhante: document.getElementById('entNome').value,
        documento: document.getElementById('entDocumento').value,
        telefone: document.getElementById('entTelefone').value,
        parentesco: document.getElementById('entParentesco').value,
        nomePaciente: document.getElementById('entPaciente').value,
        setor: document.getElementById('entSetor').value,
        leito: document.getElementById('entLeito').value,
        dataEntrada: dataHoje(),
        horaEntrada: horaAgora(),
        dataSaida: null,
        horaSaida: null,
        status: 'presente',
        recepcionista: usuarioLogado.nome,
        observacao: document.getElementById('entObs').value,
        duracaoVisita: null
    };
    
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('✅ Entrada registrada!');
        event.target.reset();
    }).catch(erro => {
        toast('❌ Erro: ' + erro.message, true);
    });
}

// ============================================
// SAÍDA
// ============================================
function salvarSaida(event) {
    event.preventDefault();
    
    const id = document.getElementById('saidaSelect').value;
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
        observacao: obs
    }).then(() => {
        toast('✅ Saída registrada!');
        event.target.reset();
        document.getElementById('infoSaida').style.display = 'none';
    }).catch(erro => {
        toast('❌ Erro: ' + erro.message, true);
    });
}

// ============================================
// TROCA
// ============================================
function salvarTroca(event) {
    event.preventDefault();
    
    const idAntigo = document.getElementById('trocaSelect').value;
    const novoNome = document.getElementById('trocaNovoNome').value;
    const novoDoc = document.getElementById('trocaNovoDoc').value;
    const novoTel = document.getElementById('trocaNovoTel').value;
    const novoParentesco = document.getElementById('trocaNovoParentesco').value;
    
    const antigo = acompanhantes[idAntigo];
    
    // Atualizar antigo
    db.ref('acompanhantes/' + idAntigo).update({
        status: 'trocado',
        dataSaida: dataHoje(),
        horaSaida: horaAgora()
    });
    
    // Criar novo
    const novoId = gerarId();
    db.ref('acompanhantes/' + novoId).set({
        id: novoId,
        tipo: 'acompanhante',
        nomeAcompanhante: novoNome,
        documento: novoDoc,
        telefone: novoTel,
        parentesco: novoParentesco,
        nomePaciente: antigo.nomePaciente,
        setor: antigo.setor,
        leito: antigo.leito,
        dataEntrada: dataHoje(),
        horaEntrada: horaAgora(),
        dataSaida: null,
        horaSaida: null,
        status: 'presente',
        recepcionista: usuarioLogado.nome,
        observacao: 'Substituiu: ' + antigo.nomeAcompanhante,
        duracaoVisita: null
    }).then(() => {
        toast('✅ Troca registrada!');
        event.target.reset();
        document.getElementById('infoTroca').style.display = 'none';
    });
}

// ============================================
// VISITA
// ============================================
function salvarVisita(event) {
    event.preventDefault();
    
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
        recepcionista: usuarioLogado.nome,
        observacao: '',
        duracaoVisita: duracao
    };
    
    db.ref('acompanhantes/' + dados.id).set(dados).then(() => {
        toast('✅ Visita registrada!');
        event.target.reset();
    });
}

// ============================================
// ATIVOS
// ============================================
function atualizarAtivos() {
    const tbody = document.querySelector('#tabelaAtivos tbody');
    const ativos = Object.values(acompanhantes).filter(a => a.status === 'presente');
    
    tbody.innerHTML = ativos.length === 0 
        ? '<tr><td colspan="8" style="text-align:center;">Nenhum ativo</td></tr>'
        : ativos.map(ac => `
            <tr>
                <td>${ac.nomeAcompanhante}</td>
                <td>${ac.documento || '-'}</td>
                <td>${ac.parentesco}</td>
                <td>${ac.nomePaciente}</td>
                <td>${ac.setor}</td>
                <td>${ac.leito || '-'}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td>
                    <button class="btn-acao excluir" onclick="excluirRegistro('${ac.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
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
            <td>${ac.nomeAcompanhante}</td>
            <td>${ac.nomePaciente}</td>
            <td>${ac.setor}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td>${ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-'}</td>
            <td><span class="badge badge-${ac.status}">${ac.status}</span></td>
            <td>
                <button class="btn-acao excluir" onclick="excluirRegistro('${ac.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filtrarHistorico() {
    const inicio = document.getElementById('filtroInicio').value;
    const fim = document.getElementById('filtroFim').value;
    
    let registros = Object.values(acompanhantes);
    
    if (inicio) {
        registros = registros.filter(ac => {
            const [d, m, a] = ac.dataEntrada.split('-');
            return new Date(a, m-1, d) >= new Date(inicio + 'T00:00:00');
        });
    }
    
    if (fim) {
        registros = registros.filter(ac => {
            const [d, m, a] = ac.dataEntrada.split('-');
            return new Date(a, m-1, d) <= new Date(fim + 'T23:59:59');
        });
    }
    
    const tbody = document.querySelector('#tabelaHistorico tbody');
    tbody.innerHTML = registros.map(ac => `
        <tr>
            <td>${ac.nomeAcompanhante}</td>
            <td>${ac.nomePaciente}</td>
            <td>${ac.setor}</td>
            <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
            <td>${ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-'}</td>
            <td><span class="badge badge-${ac.status}">${ac.status}</span></td>
            <td>
                <button class="btn-acao excluir" onclick="excluirRegistro('${ac.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// EXCLUIR
// ============================================
function excluirRegistro(id) {
    if (confirm('Excluir este registro?')) {
        db.ref('acompanhantes/' + id).remove().then(() => {
            toast('✅ Registro excluído!');
        });
    }
}

// ============================================
// ATUALIZAR SELECTS
// ============================================
function atualizarSelects() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente');
    
    // Select de saída
    const selectSaida = document.getElementById('saidaSelect');
    selectSaida.innerHTML = '<option value="">Selecione...</option>' +
        presentes.map(ac => {
            const prefixo = ac.tipo === 'visita' ? '[VISITA] ' : '';
            return `<option value="${ac.id}" data-paciente="${ac.nomePaciente}" data-setor="${ac.setor}" data-entrada="${ac.dataEntrada} ${ac.horaEntrada}">${prefixo}${ac.nomeAcompanhante} - ${ac.nomePaciente}</option>`;
        }).join('');
    
    // Select de troca
    const selectTroca = document.getElementById('trocaSelect');
    selectTroca.innerHTML = '<option value="">Selecione...</option>' +
        presentes.filter(a => a.tipo === 'acompanhante').map(ac =>
            `<option value="${ac.id}" data-paciente="${ac.nomePaciente}" data-setor="${ac.setor}" data-leito="${ac.leito || ''}">${ac.nomeAcompanhante} - ${ac.nomePaciente}</option>`
        ).join('');
}

function preencherSaida() {
    const select = document.getElementById('saidaSelect');
    const option = select.options[select.selectedIndex];
    document.getElementById('saidaPaciente').textContent = option.getAttribute('data-paciente') || '';
    document.getElementById('saidaSetor').textContent = option.getAttribute('data-setor') || '';
    document.getElementById('saidaEntrada').textContent = option.getAttribute('data-entrada') || '';
    document.getElementById('infoSaida').style.display = 'block';
}

function preencherTroca() {
    const select = document.getElementById('trocaSelect');
    const option = select.options[select.selectedIndex];
    document.getElementById('trocaPaciente').textContent = option.getAttribute('data-paciente') || '';
    document.getElementById('trocaSetor').textContent = option.getAttribute('data-setor') || '';
    document.getElementById('trocaLeito').textContent = option.getAttribute('data-leito') || '';
    document.getElementById('infoTroca').style.display = 'block';
}

// ============================================
// VERIFICAR SESSÃO AO CARREGAR
// ============================================
window.onload = function() {
    const userData = sessionStorage.getItem('hrpi_user');
    if (userData) {
        usuarioLogado = JSON.parse(userData);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('sistemaPrincipal').style.display = 'flex';
        document.getElementById('nomeUsuario').textContent = usuarioLogado.nome;
        iniciarSistema();
    }
    
    // Permitir login com Enter
    document.getElementById('senhaInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
};
