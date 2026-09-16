// ============================================
// 01-config.js
// Configuração do Firebase, variáveis globais de estado e o objeto CONFIG (parâmetros ajustáveis do sistema).
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

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

