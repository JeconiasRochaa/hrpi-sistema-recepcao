// ============================================
// Módulo: Configuração do Firebase
// ============================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref, 
    set, 
    update, 
    remove, 
    onValue, 
    get,
    push 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Configuração do Firebase - HRPI Sistema de Recepção
const firebaseConfig = {
    apiKey: "AIzaSyDcUK7ZwpxX7voL5vGr71ltW0WclRm8NJ8",
    authDomain: "hrpi-sistema-recepcao.firebaseapp.com",
    databaseURL: "https://hrpi-sistema-recepcao-default-rtdb.firebaseio.com",
    projectId: "hrpi-sistema-recepcao",
    storageBucket: "hrpi-sistema-recepcao.firebasestorage.app",
    messagingSenderId: "233408674656",
    appId: "1:233408674656:web:45805b396a7cd7d6e1bc05"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ============================================
// Módulo: Gerenciamento de Estado Global
// ============================================
const AppState = {
    currentUser: null,
    currentSection: 'dashboard',
    acompanhantes: [],
    usuarios: [],
    config: {
        tema: 'light',
        logoHospital: null,
        fundoLogin: null
    }
};

// ============================================
// Módulo: Utilitários
// ============================================
class Utils {
    static formatarData(data) {
        const d = new Date(data);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${dia}-${mes}-${ano}`;
    }

    static formatarHora(data) {
        const d = new Date(data);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    static getDataAtual() {
        return this.formatarData(new Date());
    }

    static getHoraAtual() {
        return this.formatarHora(new Date());
    }

    static gerarId() {
        return 'ac_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static converterDataBR(dataStr) {
        // Converte DD-MM-YYYY para objeto Date
        const [dia, mes, ano] = dataStr.split('-');
        return new Date(ano, mes - 1, dia);
    }

    static getInicioSemana() {
        const hoje = new Date();
        const diaSemana = hoje.getDay();
        const inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - diaSemana);
        inicio.setHours(0, 0, 0, 0);
        return inicio;
    }

    static getInicioMes() {
        const inicio = new Date();
        inicio.setDate(1);
        inicio.setHours(0, 0, 0, 0);
        return inicio;
    }
}

// ============================================
// Módulo: Gerenciamento de Toast
// ============================================
class ToastManager {
    static show(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const icon = toast.querySelector('i');
        
        toast.classList.remove('error', 'show');
        toastMessage.textContent = message;
        
        if (type === 'error') {
            toast.classList.add('error');
            icon.className = 'fas fa-exclamation-circle';
        } else {
            icon.className = 'fas fa-check-circle';
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// ============================================
// Módulo: Gerenciamento de Interface
// ============================================
class UIManager {
    static navigateTo(section) {
        // Esconde todas as seções
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        
        // Mostra a seção selecionada
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.classList.add('active');
            AppState.currentSection = section;
        }
        
        // Atualiza título
        const titles = {
            'dashboard': 'Dashboard',
            'entradaAcompanhante': 'Entrada de Acompanhante',
            'registroVisita': 'Registro de Visita',
            'registroTroca': 'Troca de Acompanhante',
            'registroSaida': 'Registro de Saída',
            'acompanhantesAtivos': 'Acompanhantes Ativos',
            'historico': 'Histórico Completo',
            'relatorios': 'Relatórios em PDF',
            'usuarios': 'Gerenciamento de Usuários',
            'configuracoes': 'Configurações'
        };
        
        document.getElementById('sectionTitle').textContent = titles[section] || '';
        
        // Atualiza menu ativo
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-section') === section) {
                item.classList.add('active');
            }
        });
        
        // Carrega dados da seção
        switch(section) {
            case 'dashboard':
                DashboardManager.carregarDashboard();
                break;
            case 'acompanhantesAtivos':
                AcompanhantesManager.carregarAtivos();
                break;
            case 'historico':
                HistoricoManager.carregarHistorico();
                break;
            case 'usuarios':
                UsuariosManager.carregarUsuarios();
                break;
            case 'configuracoes':
                ConfigManager.carregarConfiguracoes();
                break;
        }
    }

    static toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('mobile-open');
    }

    static showModal(title, content, size = '') {
        const modal = document.getElementById('genericModal');
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = content;
        
        const modalCard = modal.querySelector('.modal-card');
        modalCard.className = 'modal-card';
        if (size === 'lg') modalCard.classList.add('modal-lg');
        
        modal.style.display = 'flex';
        
        // Fechar ao clicar no X
        modal.querySelector('.modal-close').onclick = () => {
            modal.style.display = 'none';
        };
        
        // Fechar ao clicar fora
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    static hideModal() {
        document.getElementById('genericModal').style.display = 'none';
    }

    static toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        
        // Salvar no Firebase
        update(ref(db, 'configuracoes'), { tema: newTheme });
    }

    static aplicarTema(tema) {
        document.documentElement.setAttribute('data-theme', tema || 'light');
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = tema === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    static mostrarElementosAdmin(cargo) {
        const isAdmin = cargo === 'Administrador' || cargo === 'Supervisor';
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = isAdmin ? '' : 'none';
        });
        
        if (isAdmin) {
            document.getElementById('indicadoresAvancados').style.display = 'block';
        }
    }
}

// ============================================
// Módulo: Autenticação
// ============================================
class AuthManager {
    static async login(username, password) {
        try {
            const snapshot = await get(ref(db, 'usuarios'));
            if (!snapshot.exists()) {
                throw new Error('Nenhum usuário cadastrado');
            }
            
            const usuarios = snapshot.val();
            const usuario = Object.values(usuarios).find(u => 
                u.usuario === username && u.senha === password && u.ativo !== false
            );
            
            if (!usuario) {
                throw new Error('Usuário ou senha inválidos');
            }
            
            if (usuario.primeiroAcesso) {
                // Forçar troca de senha
                AppState.currentUser = usuario;
                document.getElementById('firstAccessModal').style.display = 'flex';
                return false;
            }
            
            // Login bem-sucedido
            this.setSession(usuario);
            return true;
        } catch (error) {
            throw error;
        }
    }

    static async changePassword(newPassword) {
        try {
            if (!AppState.currentUser) throw new Error('Usuário não encontrado');
            
            await update(ref(db, `usuarios/${AppState.currentUser.id}`), {
                senha: newPassword,
                primeiroAcesso: false
            });
            
            AppState.currentUser.senha = newPassword;
            AppState.currentUser.primeiroAcesso = false;
            this.setSession(AppState.currentUser);
            
            document.getElementById('firstAccessModal').style.display = 'none';
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainSystem').style.display = 'flex';
            
            this.inicializarSistema();
            ToastManager.show('Senha alterada com sucesso!');
        } catch (error) {
            throw error;
        }
    }

    static setSession(usuario) {
        const sessionData = {
            id: usuario.id,
            nome: usuario.nome,
            cargo: usuario.cargo
        };
        sessionStorage.setItem('hrpi_user', JSON.stringify(sessionData));
    }

    static getSession() {
        const data = sessionStorage.getItem('hrpi_user');
        return data ? JSON.parse(data) : null;
    }

    static logout() {
        sessionStorage.removeItem('hrpi_user');
        AppState.currentUser = null;
        document.getElementById('mainSystem').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginForm').reset();
    }

    static verificarSessao() {
        const session = this.getSession();
        if (session) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainSystem').style.display = 'flex';
            this.inicializarSistema();
        }
    }

    static async inicializarSistema() {
        const session = this.getSession();
        if (!session) return;
        
        document.getElementById('userName').textContent = session.nome;
        document.getElementById('userRole').textContent = session.cargo;
        
        UIManager.mostrarElementosAdmin(session.cargo);
        
        // Carregar configurações do Firebase
        await ConfigManager.carregarConfiguracoes();
        
        // Iniciar listeners
        AcompanhantesManager.iniciarListener();
        DashboardManager.carregarDashboard();
        
        // Atualizar data atual
        document.getElementById('currentDate').textContent = 
            new Date().toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
    }
}

// ============================================
// Módulo: Dashboard
// ============================================
class DashboardManager {
    static async carregarDashboard() {
        const hoje = Utils.getDataAtual();
        let totalPresentes = 0;
        let visitasAtivas = 0;
        let entradasHoje = 0;
        let trocasHoje = 0;
        let saidasHoje = 0;
        
        // Últimos registros
        const ultimosRegistros = [];
        
        Object.values(AppState.acompanhantes).forEach(ac => {
            if (ac.status === 'presente') {
                totalPresentes++;
                if (ac.tipo === 'visita') visitasAtivas++;
            }
            
            if (ac.dataEntrada === hoje) {
                entradasHoje++;
            }
            
            if (ac.dataSaida === hoje) {
                saidasHoje++;
            }
            
            // Contar trocas hoje
            if (ac.trocas && ac.trocas.length > 0) {
                ac.trocas.forEach(troca => {
                    if (troca.dataHora && troca.dataHora.includes(hoje)) {
                        trocasHoje++;
                    }
                });
            }
            
            ultimosRegistros.push(ac);
        });
        
        // Ordenar por data/hora entrada (mais recentes primeiro)
        ultimosRegistros.sort((a, b) => {
            const dateA = Utils.converterDataBR(a.dataEntrada);
            const dateB = Utils.converterDataBR(b.dataEntrada);
            // Comparar também horas
            if (dateA.getTime() === dateB.getTime()) {
                return b.horaEntrada.localeCompare(a.horaEntrada);
            }
            return dateB - dateA;
        });
        
        // Atualizar cards
        document.getElementById('countAcompanhantesPresentes').textContent = totalPresentes;
        document.getElementById('countVisitasAtivas').textContent = visitasAtivas;
        document.getElementById('countEntradasHoje').textContent = entradasHoje;
        document.getElementById('countTrocasHoje').textContent = trocasHoje;
        document.getElementById('countSaidasHoje').textContent = saidasHoje;
        
        // Atualizar indicadores avançados (admin/supervisor)
        const session = AuthManager.getSession();
        if (session && (session.cargo === 'Administrador' || session.cargo === 'Supervisor')) {
            this.carregarIndicadoresAvancados();
        }
        
        // Atualizar tabela de últimos registros
        const tbody = document.querySelector('#tabelaUltimosRegistros tbody');
        tbody.innerHTML = '';
        
        ultimosRegistros.slice(0, 8).forEach(ac => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-${ac.tipo}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                <td>${ac.nomeAcompanhante}</td>
                <td>${ac.nomePaciente}</td>
                <td>${ac.setor}${ac.leito ? ' / ' + ac.leito : ''}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td><span class="status-badge status-${ac.status}">${ac.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    static carregarIndicadoresAvancados() {
        const inicioSemana = Utils.getInicioSemana();
        const inicioMes = Utils.getInicioMes();
        const hoje = new Date();
        
        let entradasSemana = 0;
        let saidasSemana = 0;
        let entradasMes = 0;
        let saidasMes = 0;
        
        Object.values(AppState.acompanhantes).forEach(ac => {
            const dataEntrada = Utils.converterDataBR(ac.dataEntrada);
            
            if (dataEntrada >= inicioSemana && dataEntrada <= hoje) {
                entradasSemana++;
            }
            
            if (ac.dataSaida) {
                const dataSaida = Utils.converterDataBR(ac.dataSaida);
                if (dataSaida >= inicioSemana && dataSaida <= hoje) {
                    saidasSemana++;
                }
            }
            
            if (dataEntrada >= inicioMes && dataEntrada <= hoje) {
                entradasMes++;
            }
            
            if (ac.dataSaida) {
                const dataSaida = Utils.converterDataBR(ac.dataSaida);
                if (dataSaida >= inicioMes && dataSaida <= hoje) {
                    saidasMes++;
                }
            }
        });
        
        document.getElementById('countEntradasSemana').textContent = entradasSemana;
        document.getElementById('countSaidasSemana').textContent = saidasSemana;
        document.getElementById('countEntradasMes').textContent = entradasMes;
        document.getElementById('countSaidasMes').textContent = saidasMes;
    }
}

// ============================================
// Módulo: Gerenciamento de Acompanhantes
// ============================================
class AcompanhantesManager {
    static iniciarListener() {
        onValue(ref(db, 'acompanhantes'), (snapshot) => {
            const data = snapshot.val() || {};
            AppState.acompanhantes = data;
            
            // Atualizar interfaces abertas
            if (AppState.currentSection === 'dashboard') {
                DashboardManager.carregarDashboard();
            } else if (AppState.currentSection === 'acompanhantesAtivos') {
                this.carregarAtivos();
            } else if (AppState.currentSection === 'historico') {
                HistoricoManager.carregarHistorico();
            }
            
            // Atualizar combos
            this.atualizarComboTroca();
            this.atualizarComboSaida();
        });
    }

    static async salvarEntrada(dados) {
        try {
            const id = Utils.gerarId();
            const session = AuthManager.getSession();
            
            const registro = {
                id,
                tipo: 'acompanhante',
                nomeAcompanhante: dados.nome,
                documento: dados.documento || '',
                telefone: dados.telefone || '',
                parentesco: dados.parentesco,
                nomePaciente: dados.paciente,
                setor: dados.setor,
                leito: dados.leito || '',
                dataEntrada: Utils.getDataAtual(),
                horaEntrada: Utils.getHoraAtual(),
                dataSaida: null,
                horaSaida: null,
                status: 'presente',
                recepcionistaEntrada: session.nome,
                recepcionistaSaida: null,
                trocas: [],
                observacao: dados.observacao || '',
                duracaoVisita: null
            };
            
            await set(ref(db, `acompanhantes/${id}`), registro);
            ToastManager.show('Acompanhante registrado com sucesso!');
            return true;
        } catch (error) {
            ToastManager.show('Erro ao registrar: ' + error.message, 'error');
            return false;
        }
    }

    static async salvarVisita(dados) {
        try {
            const id = Utils.gerarId();
            const session = AuthManager.getSession();
            const duracao = parseInt(dados.duracao);
            
            // Calcular hora de saída
            const entrada = new Date();
            const saida = new Date(entrada.getTime() + duracao * 60000);
            
            const registro = {
                id,
                tipo: 'visita',
                nomeAcompanhante: dados.nome,
                documento: dados.documento || '',
                telefone: dados.telefone || '',
                parentesco: dados.parentesco,
                nomePaciente: dados.paciente,
                setor: dados.setor,
                leito: dados.leito || '',
                dataEntrada: Utils.getDataAtual(),
                horaEntrada: Utils.getHoraAtual(),
                dataSaida: Utils.formatarData(saida),
                horaSaida: Utils.formatarHora(saida),
                status: 'saiu',
                recepcionistaEntrada: session.nome,
                recepcionistaSaida: session.nome,
                trocas: [],
                observacao: dados.observacao || '',
                duracaoVisita: duracao
            };
            
            await set(ref(db, `acompanhantes/${id}`), registro);
            ToastManager.show('Visita registrada com sucesso!');
            return true;
        } catch (error) {
            ToastManager.show('Erro ao registrar: ' + error.message, 'error');
            return false;
        }
    }

    static async registrarTroca(dados) {
        try {
            const session = AuthManager.getSession();
            const acompanhanteAntigo = AppState.acompanhantes[dados.idAntigo];
            
            if (!acompanhanteAntigo) throw new Error('Acompanhante não encontrado');
            
            const novoTrocas = [...(acompanhanteAntigo.trocas || []), {
                dataHora: `${Utils.getDataAtual()} ${Utils.getHoraAtual()}`,
                acompanhanteAntigo: acompanhanteAntigo.nomeAcompanhante,
                acompanhanteNovo: dados.novoNome,
                recepcionista: session.nome
            }];
            
            // Atualizar acompanhante antigo
            await update(ref(db, `acompanhantes/${dados.idAntigo}`), {
                status: 'trocado',
                dataSaida: Utils.getDataAtual(),
                horaSaida: Utils.getHoraAtual(),
                recepcionistaSaida: session.nome,
                trocas: novoTrocas
            });
            
            // Criar novo acompanhante
            const novoId = Utils.gerarId();
            const novoRegistro = {
                id: novoId,
                tipo: 'acompanhante',
                nomeAcompanhante: dados.novoNome,
                documento: dados.novoDocumento || '',
                telefone: dados.novoTelefone || '',
                parentesco: dados.novoParentesco,
                nomePaciente: acompanhanteAntigo.nomePaciente,
                setor: acompanhanteAntigo.setor,
                leito: acompanhanteAntigo.leito,
                dataEntrada: Utils.getDataAtual(),
                horaEntrada: Utils.getHoraAtual(),
                dataSaida: null,
                horaSaida: null,
                status: 'presente',
                recepcionistaEntrada: session.nome,
                recepcionistaSaida: null,
                trocas: [],
                observacao: '',
                duracaoVisita: null
            };
            
            await set(ref(db, `acompanhantes/${novoId}`), novoRegistro);
            ToastManager.show('Troca registrada com sucesso!');
            return true;
        } catch (error) {
            ToastManager.show('Erro na troca: ' + error.message, 'error');
            return false;
        }
    }

    static async registrarSaida(dados) {
        try {
            const session = AuthManager.getSession();
            
            const updateData = {
                status: 'saiu',
                dataSaida: Utils.getDataAtual(),
                horaSaida: Utils.getHoraAtual(),
                recepcionistaSaida: session.nome
            };
            
            // Adicionar motivo à observação
            const atual = AppState.acompanhantes[dados.id];
            const observacaoAtual = atual.observacao || '';
            const motivo = dados.motivo;
            updateData.observacao = observacaoAtual 
                ? `${observacaoAtual} | Saída: ${motivo}`
                : `Saída: ${motivo}`;
            
            await update(ref(db, `acompanhantes/${dados.id}`), updateData);
            ToastManager.show('Saída registrada com sucesso!');
            return true;
        } catch (error) {
            ToastManager.show('Erro na saída: ' + error.message, 'error');
            return false;
        }
    }

    static async atualizarAcompanhante(id, dados) {
        try {
            await update(ref(db, `acompanhantes/${id}`), dados);
            ToastManager.show('Registro atualizado com sucesso!');
            return true;
        } catch (error) {
            ToastManager.show('Erro ao atualizar: ' + error.message, 'error');
            return false;
        }
    }

    static async excluirAcompanhante(id) {
        try {
            if (!confirm('Tem certeza que deseja excluir este registro?')) return false;
            await remove(ref(db, `acompanhantes/${id}`));
            ToastManager.show('Registro excluído com sucesso!');
            return true;
        } catch (error) {
            ToastManager.show('Erro ao excluir: ' + error.message, 'error');
            return false;
        }
    }

    static carregarAtivos() {
        const tbody = document.querySelector('#tabelaAtivos tbody');
        tbody.innerHTML = '';
        
        const ativos = Object.values(AppState.acompanhantes).filter(ac => ac.status === 'presente');
        
        if (ativos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum acompanhante ativo</td></tr>';
            return;
        }
        
        ativos.forEach(ac => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-${ac.tipo}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                <td>${ac.nomeAcompanhante}</td>
                <td>${ac.documento || '-'}</td>
                <td>${ac.parentesco}</td>
                <td>${ac.nomePaciente}</td>
                <td>${ac.setor}</td>
                <td>${ac.leito || '-'}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td>
                    <button class="btn-icon btn-edit" onclick="window.editarAcompanhante('${ac.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="window.excluirAcompanhante('${ac.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    static atualizarComboTroca() {
        const select = document.getElementById('trocaAcompanhanteAtual');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione...</option>';
        
        const presentes = Object.values(AppState.acompanhantes)
            .filter(ac => ac.status === 'presente' && ac.tipo === 'acompanhante');
        
        presentes.forEach(ac => {
            const option = document.createElement('option');
            option.value = ac.id;
            option.textContent = `${ac.nomeAcompanhante} - ${ac.nomePaciente} - ${ac.setor}`;
            select.appendChild(option);
        });
    }

    static atualizarComboSaida() {
        const select = document.getElementById('saidaAcompanhante');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione...</option>';
        
        const presentes = Object.values(AppState.acompanhantes)
            .filter(ac => ac.status === 'presente');
        
        presentes.forEach(ac => {
            const option = document.createElement('option');
            option.value = ac.id;
            const prefixo = ac.tipo === 'visita' ? '[VISITA] ' : '';
            option.textContent = `${prefixo}${ac.nomeAcompanhante} - ${ac.nomePaciente}`;
            select.appendChild(option);
        });
    }
}

// ============================================
// Módulo: Histórico
// ============================================
class HistoricoManager {
    static carregarHistorico(filtros = {}) {
        const tbody = document.querySelector('#tabelaHistorico tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        let registros = Object.values(AppState.acompanhantes);
        
        // Aplicar filtros
        if (filtros.status) {
            registros = registros.filter(ac => ac.status === filtros.status);
        }
        if (filtros.tipo) {
            registros = registros.filter(ac => ac.tipo === filtros.tipo);
        }
        if (filtros.dataInicio) {
            registros = registros.filter(ac => {
                const acData = Utils.converterDataBR(ac.dataEntrada);
                const filtroData = new Date(filtros.dataInicio + 'T00:00:00');
                return acData >= filtroData;
            });
        }
        if (filtros.dataFim) {
            registros = registros.filter(ac => {
                const acData = Utils.converterDataBR(ac.dataEntrada);
                const filtroData = new Date(filtros.dataFim + 'T23:59:59');
                return acData <= filtroData;
            });
        }
        
        // Ordenar por data/hora entrada decrescente
        registros.sort((a, b) => {
            const dateA = Utils.converterDataBR(a.dataEntrada);
            const dateB = Utils.converterDataBR(b.dataEntrada);
            return dateB - dateA || b.horaEntrada.localeCompare(a.horaEntrada);
        });
        
        if (registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">Nenhum registro encontrado</td></tr>';
            return;
        }
        
        registros.forEach(ac => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-${ac.tipo}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span></td>
                <td>${ac.nomeAcompanhante}</td>
                <td>${ac.documento || '-'}</td>
                <td>${ac.parentesco}</td>
                <td>${ac.nomePaciente}</td>
                <td>${ac.setor}</td>
                <td>${ac.leito || '-'}</td>
                <td>${ac.dataEntrada} ${ac.horaEntrada}</td>
                <td>${ac.dataSaida ? ac.dataSaida + ' ' + ac.horaSaida : '-'}</td>
                <td><span class="status-badge status-${ac.status}">${ac.status}</span></td>
                <td>
                    <button class="btn-icon btn-edit" onclick="window.editarAcompanhante('${ac.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="window.excluirAcompanhante('${ac.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ============================================
// Módulo: Usuários
// ============================================
class UsuariosManager {
    static async carregarUsuarios() {
        try {
            const snapshot = await get(ref(db, 'usuarios'));
            const data = snapshot.val() || {};
            AppState.usuarios = data;
            
            const tbody = document.querySelector('#tabelaUsuarios tbody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            Object.values(data).forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.nome}</td>
                    <td>${user.usuario}</td>
                    <td>${user.cargo}</td>
                    <td><span class="status-badge ${user.ativo !== false ? 'status-presente' : 'status-saiu'}">${user.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                    <td><span class="status-badge ${user.primeiroAcesso ? 'status-trocado' : 'status-presente'}">${user.primeiroAcesso ? 'Pendente' : 'Concluído'}</span></td>
                    <td>
                        <button class="btn-icon btn-edit" onclick="window.editarUsuario('${user.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-key" onclick="window.resetarSenhaUsuario('${user.id}')" title="Resetar Senha">
                            <i class="fas fa-key"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="window.excluirUsuario('${user.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            ToastManager.show('Erro ao carregar usuários: ' + error.message, 'error');
        }
    }

    static async salvarUsuario(dados, editId = null) {
        try {
            if (editId) {
                // Editar usuário existente
                await update(ref(db, `usuarios/${editId}`), {
                    nome: dados.nome,
                    usuario: dados.usuario,
                    cargo: dados.cargo,
                    ativo: dados.ativo !== false
                });
                ToastManager.show('Usuário atualizado com sucesso!');
            } else {
                // Criar novo usuário
                const id = 'user_' + Date.now();
                await set(ref(db, `usuarios/${id}`), {
                    id,
                    nome: dados.nome,
                    usuario: dados.usuario,
                    senha: '12345',
                    cargo: dados.cargo,
                    ativo: dados.ativo !== false,
                    primeiroAcesso: true
                });
                ToastManager.show('Usuário criado com sucesso! Senha padrão: 12345');
            }
            
            this.carregarUsuarios();
            return true;
        } catch (error) {
            ToastManager.show('Erro ao salvar: ' + error.message, 'error');
            return false;
        }
    }

    static async resetarSenha(id) {
        try {
            await update(ref(db, `usuarios/${id}`), {
                senha: '12345',
                primeiroAcesso: true
            });
            ToastManager.show('Senha resetada para 12345');
            this.carregarUsuarios();
        } catch (error) {
            ToastManager.show('Erro ao resetar senha: ' + error.message, 'error');
        }
    }

    static async excluirUsuario(id) {
        try {
            if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
            await remove(ref(db, `usuarios/${id}`));
            ToastManager.show('Usuário excluído com sucesso!');
            this.carregarUsuarios();
        } catch (error) {
            ToastManager.show('Erro ao excluir: ' + error.message, 'error');
        }
    }
}

// ============================================
// Módulo: Configurações
// ============================================
class ConfigManager {
    static async carregarConfiguracoes() {
        try {
            const snapshot = await get(ref(db, 'configuracoes'));
            if (snapshot.exists()) {
                AppState.config = snapshot.val();
                
                // Aplicar tema
                if (AppState.config.tema) {
                    UIManager.aplicarTema(AppState.config.tema);
                }
                
                // Aplicar logo
                if (AppState.config.logoHospital) {
                    const sidebarLogo = document.getElementById('sidebarLogo');
                    const loginLogo = document.getElementById('loginLogo');
                    if (sidebarLogo) {
                        sidebarLogo.innerHTML = `<img src="${AppState.config.logoHospital}" alt="Logo HRPI" style="max-width:50px; max-height:50px;">`;
                    }
                    if (loginLogo) {
                        loginLogo.innerHTML = `<img src="${AppState.config.logoHospital}" alt="Logo HRPI" style="max-width:100px;">`;
                    }
                }
                
                // Aplicar fundo de login
                if (AppState.config.fundoLogin) {
                    const loginScreen = document.getElementById('loginScreen');
                    if (loginScreen) {
                        loginScreen.style.backgroundImage = `url(${AppState.config.fundoLogin})`;
                        loginScreen.style.backgroundSize = 'cover';
                        loginScreen.style.backgroundPosition = 'center';
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }

    static async uploadLogo(file) {
        try {
            const base64 = await this.fileToBase64(file);
            await update(ref(db, 'configuracoes'), { logoHospital: base64 });
            ToastManager.show('Logo atualizada com sucesso!');
            this.carregarConfiguracoes();
        } catch (error) {
            ToastManager.show('Erro ao fazer upload: ' + error.message, 'error');
        }
    }

    static async uploadFundo(file) {
        try {
            const base64 = await this.fileToBase64(file);
            await update(ref(db, 'configuracoes'), { fundoLogin: base64 });
            ToastManager.show('Fundo atualizado com sucesso!');
            this.carregarConfiguracoes();
        } catch (error) {
            ToastManager.show('Erro ao fazer upload: ' + error.message, 'error');
        }
    }

    static async removerLogo() {
        try {
            await update(ref(db, 'configuracoes'), { logoHospital: null });
            ToastManager.show('Logo removida!');
            this.carregarConfiguracoes();
        } catch (error) {
            ToastManager.show('Erro ao remover: ' + error.message, 'error');
        }
    }

    static async removerFundo() {
        try {
            await update(ref(db, 'configuracoes'), { fundoLogin: null });
            ToastManager.show('Fundo removido!');
            this.carregarConfiguracoes();
        } catch (error) {
            ToastManager.show('Erro ao remover: ' + error.message, 'error');
        }
    }

    static fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// ============================================
// Módulo: Relatórios PDF
// ============================================
class RelatoriosManager {
    static async gerarPDF(tipo) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');
            
            // Título e Logo
            const logoHospital = AppState.config.logoHospital;
            if (logoHospital) {
                doc.addImage(logoHospital, 'PNG', 14, 10, 25, 25);
            }
            
            doc.setFontSize(16);
            doc.setTextColor(0, 105, 92);
            doc.text('HOSPITAL REGIONAL DE PALMEIRA DOS ÍNDIOS - HRPI', 140, 20, { align: 'center' });
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text('Sistema de Controle de Recepção', 140, 28, { align: 'center' });
            
            // Definir período
            let dataInicio, dataFim, tituloRelatorio;
            const hoje = new Date();
            
            switch(tipo) {
                case 'diario':
                    dataInicio = Utils.getDataAtual();
                    dataFim = Utils.getDataAtual();
                    tituloRelatorio = 'Relatório Diário';
                    break;
                case 'semanal':
                    dataInicio = Utils.formatarData(Utils.getInicioSemana());
                    dataFim = Utils.getDataAtual();
                    tituloRelatorio = 'Relatório Semanal';
                    break;
                case 'mensal':
                    dataInicio = Utils.formatarData(Utils.getInicioMes());
                    dataFim = Utils.getDataAtual();
                    tituloRelatorio = 'Relatório Mensal';
                    break;
                case 'personalizado':
                    const dataInicioInput = document.getElementById('dataInicioPersonalizado').value;
                    const dataFimInput = document.getElementById('dataFimPersonalizado').value;
                    
                    if (!dataInicioInput || !dataFimInput) {
                        ToastManager.show('Selecione as datas inicial e final', 'error');
                        return;
                    }
                    
                    dataInicio = dataInicioInput.split('-').reverse().join('-');
                    dataFim = dataFimInput.split('-').reverse().join('-');
                    tituloRelatorio = 'Relatório Personalizado';
                    break;
            }
            
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(`${tituloRelatorio} - Período: ${dataInicio} a ${dataFim}`, 140, 38, { align: 'center' });
            
            // Filtrar dados
            let dados = Object.values(AppState.acompanhantes);
            if (dataInicio) {
                const dataInicioDate = Utils.converterDataBR(dataInicio);
                dados = dados.filter(ac => {
                    const acData = Utils.converterDataBR(ac.dataEntrada);
                    return acData >= dataInicioDate;
                });
            }
            if (dataFim) {
                const dataFimDate = Utils.converterDataBR(dataFim);
                dataFimDate.setHours(23, 59, 59);
                dados = dados.filter(ac => {
                    const acData = Utils.converterDataBR(ac.dataEntrada);
                    return acData <= dataFimDate;
                });
            }
            
            // Ordenar
            dados.sort((a, b) => {
                const dateA = Utils.converterDataBR(a.dataEntrada);
                const dateB = Utils.converterDataBR(b.dataEntrada);
                return dateB - dateA;
            });
            
            // Resumo
            const totalRegistros = dados.length;
            const totalPresentes = dados.filter(ac => ac.status === 'presente').length;
            const totalSaidas = dados.filter(ac => ac.status === 'saiu').length;
            const totalTrocas = dados.filter(ac => ac.status === 'trocado').length;
            
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(`Total de Registros: ${totalRegistros} | Presentes: ${totalPresentes} | Saídas: ${totalSaidas} | Trocas: ${totalTrocas}`, 14, 48);
            
            // Tabela
            const tableData = dados.map(ac => [
                ac.tipo === 'visita' ? 'Visita' : 'Acomp.',
                ac.nomeAcompanhante,
                ac.documento || '-',
                ac.parentesco,
                ac.nomePaciente,
                ac.setor,
                ac.leito || '-',
                `${ac.dataEntrada} ${ac.horaEntrada}`,
                ac.dataSaida ? `${ac.dataSaida} ${ac.horaSaida}` : '-',
                ac.status,
                ac.recepcionistaEntrada || '-'
            ]);
            
            doc.autoTable({
                startY: 52,
                head: [['Tipo', 'Nome', 'Documento', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Entrada', 'Saída', 'Status', 'Recepcionista']],
                body: tableData,
                styles: {
                    fontSize: 8,
                    cellPadding: 2
                },
                headStyles: {
                    fillColor: [0, 105, 92],
                    textColor: 255,
                    fontStyle: 'bold'
                },
                alternateRowStyles: {
                    fillColor: [240, 244, 245]
                }
            });
            
            // Rodapé
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(128, 128, 128);
                doc.text(
                    `Página ${i} de ${pageCount} - Gerado em: ${new Date().toLocaleString('pt-BR')} - HRPI`,
                    140,
                    doc.internal.pageSize.height - 10,
                    { align: 'center' }
                );
            }
            
            doc.save(`Relatorio_${tipo}_${Utils.getDataAtual()}.pdf`);
            ToastManager.show('Relatório gerado com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            ToastManager.show('Erro ao gerar relatório: ' + error.message, 'error');
        }
    }
}

// ============================================
// Funções Globais (para chamadas onclick)
// ============================================
window.gerarRelatorio = (tipo) => RelatoriosManager.gerarPDF(tipo);

window.editarAcompanhante = (id) => {
    const ac = AppState.acompanhantes[id];
    if (!ac) return;
    
    const content = `
        <form id="formEditarAcompanhante" class="modern-form">
            <div class="form-row">
                <div class="form-group">
                    <label>Nome *</label>
                    <input type="text" id="editNome" value="${ac.nomeAcompanhante}" required>
                </div>
                <div class="form-group">
                    <label>Documento</label>
                    <input type="text" id="editDocumento" value="${ac.documento || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Telefone</label>
                    <input type="tel" id="editTelefone" value="${ac.telefone || ''}">
                </div>
                <div class="form-group">
                    <label>Parentesco *</label>
                    <input type="text" id="editParentesco" value="${ac.parentesco}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Paciente *</label>
                    <input type="text" id="editPaciente" value="${ac.nomePaciente}" required>
                </div>
                <div class="form-group">
                    <label>Setor *</label>
                    <select id="editSetor" required>
                        <option>Oncologia I</option>
                        <option>Oncologia II</option>
                        <option>UTI I</option>
                        <option>UTI II</option>
                        <option>Clínica Médica I</option>
                        <option>Clínica Médica II</option>
                        <option>Clínica Cirúrgica</option>
                        <option>Pediatria</option>
                        <option>Saúde Mental</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Leito</label>
                    <input type="text" id="editLeito" value="${ac.leito || ''}">
                </div>
                <div class="form-group">
                    <label>Observação</label>
                    <textarea id="editObservacao" rows="2">${ac.observacao || ''}</textarea>
                </div>
            </div>
            <button type="submit" class="btn-primary">
                <i class="fas fa-save"></i> Salvar Alterações
            </button>
        </form>
    `;
    
    UIManager.showModal('Editar Registro', content, 'lg');
    
    setTimeout(() => {
        const setorSelect = document.getElementById('editSetor');
        if (setorSelect) {
            setorSelect.value = ac.setor;
        }
        
        const form = document.getElementById('formEditarAcompanhante');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const dados = {
                    nomeAcompanhante: document.getElementById('editNome').value,
                    documento: document.getElementById('editDocumento').value,
                    telefone: document.getElementById('editTelefone').value,
                    parentesco: document.getElementById('editParentesco').value,
                    nomePaciente: document.getElementById('editPaciente').value,
                    setor: document.getElementById('editSetor').value,
                    leito: document.getElementById('editLeito').value,
                    observacao: document.getElementById('editObservacao').value
                };
                
                const success = await AcompanhantesManager.atualizarAcompanhante(id, dados);
                if (success) UIManager.hideModal();
            };
        }
    }, 100);
};

window.excluirAcompanhante = (id) => {
    AcompanhantesManager.excluirAcompanhante(id);
};

window.editarUsuario = (id) => {
    const user = AppState.usuarios[id];
    if (!user) return;
    
    const content = `
        <form id="formUsuario" class="modern-form">
            <div class="form-group">
                <label>Nome Completo *</label>
                <input type="text" id="userNome" value="${user.nome}" required>
            </div>
            <div class="form-group">
                <label>Usuário *</label>
                <input type="text" id="userUsername" value="${user.usuario}" required>
            </div>
            <div class="form-group">
                <label>Cargo *</label>
                <select id="userCargo" required>
                    <option value="Administrador" ${user.cargo === 'Administrador' ? 'selected' : ''}>Administrador</option>
                    <option value="Supervisor" ${user.cargo === 'Supervisor' ? 'selected' : ''}>Supervisor</option>
                    <option value="Recepcionista" ${user.cargo === 'Recepcionista' ? 'selected' : ''}>Recepcionista</option>
                </select>
            </div>
            <div class="form-group">
                <label>Ativo</label>
                <select id="userAtivo">
                    <option value="true" ${user.ativo !== false ? 'selected' : ''}>Sim</option>
                    <option value="false" ${user.ativo === false ? 'selected' : ''}>Não</option>
                </select>
            </div>
            <button type="submit" class="btn-primary">
                <i class="fas fa-save"></i> Salvar
            </button>
        </form>
    `;
    
    UIManager.showModal('Editar Usuário', content);
    
    document.getElementById('formUsuario').onsubmit = async (e) => {
        e.preventDefault();
        const dados = {
            nome: document.getElementById('userNome').value,
            usuario: document.getElementById('userUsername').value,
            cargo: document.getElementById('userCargo').value,
            ativo: document.getElementById('userAtivo').value === 'true'
        };
        
        const success = await UsuariosManager.salvarUsuario(dados, id);
        if (success) UIManager.hideModal();
    };
};

window.resetarSenhaUsuario = (id) => {
    if (confirm('Tem certeza que deseja resetar a senha deste usuário? A senha será alterada para 12345.')) {
        UsuariosManager.resetarSenha(id);
    }
};

window.excluirUsuario = (id) => {
    UsuariosManager.excluirUsuario(id);
};

// ============================================
// Inicialização da Aplicação
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 HRPI - Sistema de Controle de Recepção iniciado');
    console.log('📦 Firebase configurado:', firebaseConfig.projectId);
    
    // Verificar sessão existente
    AuthManager.verificarSessao();
    
    // Login Form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        
        try {
            errorDiv.style.display = 'none';
            const loggedIn = await AuthManager.login(username, password);
            
            if (loggedIn) {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainSystem').style.display = 'flex';
                AuthManager.inicializarSistema();
            }
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    });
    
    // First Access Password Change
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('passwordError');
        
        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'As senhas não conferem';
            errorDiv.style.display = 'block';
            return;
        }
        
        if (newPassword.length < 4) {
            errorDiv.textContent = 'A senha deve ter no mínimo 4 caracteres';
            errorDiv.style.display = 'block';
            return;
        }
        
        try {
            errorDiv.style.display = 'none';
            await AuthManager.changePassword(newPassword);
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    });
    
    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            UIManager.navigateTo(section);
            
            // Fechar sidebar mobile
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('mobile-open');
            }
        });
    });
    
    // Mobile Menu Toggle
    document.getElementById('mobileMenuToggle').addEventListener('click', () => {
        UIManager.toggleSidebar();
    });
    
    // Theme Toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        UIManager.toggleTheme();
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Deseja realmente sair do sistema?')) {
            AuthManager.logout();
        }
    });
    
    // Entrada de Acompanhante
    document.getElementById('formEntradaAcompanhante').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dados = {
            nome: document.getElementById('acNome').value,
            documento: document.getElementById('acDocumento').value,
            telefone: document.getElementById('acTelefone').value,
            parentesco: document.getElementById('acParentesco').value,
            paciente: document.getElementById('acPaciente').value,
            setor: document.getElementById('acSetor').value,
            leito: document.getElementById('acLeito').value,
            observacao: document.getElementById('acObservacao').value
        };
        
        const success = await AcompanhantesManager.salvarEntrada(dados);
        if (success) {
            document.getElementById('formEntradaAcompanhante').reset();
        }
    });
    
    // Registro de Visita
    document.getElementById('formVisita').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dados = {
            nome: document.getElementById('visNome').value,
            documento: document.getElementById('visDocumento').value,
            telefone: document.getElementById('visTelefone').value,
            parentesco: document.getElementById('visParentesco').value,
            paciente: document.getElementById('visPaciente').value,
            setor: document.getElementById('visSetor').value,
            leito: document.getElementById('visLeito').value,
            duracao: document.getElementById('visDuracao').value,
            observacao: document.getElementById('visObservacao').value
        };
        
        const success = await AcompanhantesManager.salvarVisita(dados);
        if (success) {
            document.getElementById('formVisita').reset();
        }
    });
    
    // Troca de Acompanhante - Mostrar informações ao selecionar
    document.getElementById('trocaAcompanhanteAtual').addEventListener('change', function() {
        const id = this.value;
        const infoDiv = document.getElementById('trocaInfoAtual');
        
        if (id && AppState.acompanhantes[id]) {
            const ac = AppState.acompanhantes[id];
            document.getElementById('trocaPaciente').textContent = ac.nomePaciente;
            document.getElementById('trocaSetor').textContent = ac.setor;
            document.getElementById('trocaLeito').textContent = ac.leito || '-';
            infoDiv.style.display = 'block';
        } else {
            infoDiv.style.display = 'none';
        }
    });
    
    // Formulário de Troca
    document.getElementById('formTroca').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dados = {
            idAntigo: document.getElementById('trocaAcompanhanteAtual').value,
            novoNome: document.getElementById('trocaNovoNome').value,
            novoDocumento: document.getElementById('trocaNovoDocumento').value,
            novoTelefone: document.getElementById('trocaNovoTelefone').value,
            novoParentesco: document.getElementById('trocaNovoParentesco').value
        };
        
        const success = await AcompanhantesManager.registrarTroca(dados);
        if (success) {
            document.getElementById('formTroca').reset();
            document.getElementById('trocaInfoAtual').style.display = 'none';
        }
    });
    
    // Saída - Mostrar informações ao selecionar
    document.getElementById('saidaAcompanhante').addEventListener('change', function() {
        const id = this.value;
        const infoDiv = document.getElementById('saidaInfo');
        
        if (id && AppState.acompanhantes[id]) {
            const ac = AppState.acompanhantes[id];
            document.getElementById('saidaPaciente').textContent = ac.nomePaciente;
            document.getElementById('saidaSetor').textContent = ac.setor;
            document.getElementById('saidaEntrada').textContent = `${ac.dataEntrada} ${ac.horaEntrada}`;
            infoDiv.style.display = 'block';
        } else {
            infoDiv.style.display = 'none';
        }
    });
    
    // Formulário de Saída
    document.getElementById('formSaida').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dados = {
            id: document.getElementById('saidaAcompanhante').value,
            motivo: document.getElementById('saidaMotivo').value
        };
        
        const success = await AcompanhantesManager.registrarSaida(dados);
        if (success) {
            document.getElementById('formSaida').reset();
            document.getElementById('saidaInfo').style.display = 'none';
        }
    });
    
    // Filtros de Histórico
    document.getElementById('btnFiltrar').addEventListener('click', () => {
        const filtros = {
            dataInicio: document.getElementById('filtroDataInicio').value,
            dataFim: document.getElementById('filtroDataFim').value,
            status: document.getElementById('filtroStatus').value,
            tipo: document.getElementById('filtroTipo').value
        };
        HistoricoManager.carregarHistorico(filtros);
    });
    
    // Novo Usuário
    document.getElementById('btnNovoUsuario').addEventListener('click', () => {
        const content = `
            <form id="formNovoUsuario" class="modern-form">
                <div class="form-group">
                    <label>Nome Completo *</label>
                    <input type="text" id="newUserNome" required>
                </div>
                <div class="form-group">
                    <label>Usuário *</label>
                    <input type="text" id="newUserUsername" required>
                </div>
                <div class="form-group">
                    <label>Cargo *</label>
                    <select id="newUserCargo" required>
                        <option value="">Selecione...</option>
                        <option value="Administrador">Administrador</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Recepcionista">Recepcionista</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Ativo</label>
                    <select id="newUserAtivo">
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Criar Usuário
                </button>
            </form>
        `;
        
        UIManager.showModal('Novo Usuário', content);
        
        document.getElementById('formNovoUsuario').onsubmit = async (e) => {
            e.preventDefault();
            const dados = {
                nome: document.getElementById('newUserNome').value,
                usuario: document.getElementById('newUserUsername').value,
                cargo: document.getElementById('newUserCargo').value,
                ativo: document.getElementById('newUserAtivo').value === 'true'
            };
            
            const success = await UsuariosManager.salvarUsuario(dados);
            if (success) UIManager.hideModal();
        };
    });
    
    // Configurações
    document.getElementById('uploadLogo').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            ConfigManager.uploadLogo(e.target.files[0]);
        }
    });
    
    document.getElementById('uploadFundo').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            ConfigManager.uploadFundo(e.target.files[0]);
        }
    });
    
    document.getElementById('btnRemoverLogo').addEventListener('click', () => {
        if (confirm('Remover a logo do hospital?')) {
            ConfigManager.removerLogo();
        }
    });
    
    document.getElementById('btnRemoverFundo').addEventListener('click', () => {
        if (confirm('Remover o fundo de login?')) {
            ConfigManager.removerFundo();
        }
    });
    
    // Preencher select de reset de senha nas configurações
    const selectReset = document.getElementById('selectUsuarioReset');
    onValue(ref(db, 'usuarios'), (snapshot) => {
        if (!selectReset) return;
        selectReset.innerHTML = '<option value="">Selecione um usuário...</option>';
        const usuarios = snapshot.val() || {};
        Object.values(usuarios).forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.nome} (${user.usuario})`;
            selectReset.appendChild(option);
        });
    });
    
    document.getElementById('btnResetSenha').addEventListener('click', () => {
        const userId = document.getElementById('selectUsuarioReset').value;
        if (!userId) {
            ToastManager.show('Selecione um usuário', 'error');
            return;
        }
        UsuariosManager.resetarSenha(userId);
    });
    
    // Iniciar na dashboard
    UIManager.navigateTo('dashboard');
});

console.log('✅ Sistema HRPI carregado com sucesso!');
console.log('🏥 Hospital Regional de Palmeira dos Índios');
