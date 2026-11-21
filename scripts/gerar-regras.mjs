// Gera database.rules.json a partir de expressões reutilizáveis (as Regras do RTDB não têm funções).
// Uso: node scripts/gerar-regras.mjs
import { writeFileSync } from 'node:fs';

const ATIVO = "root.child('usuarios').child(auth.uid).child('ativo').val() === true";
const CARGO = "root.child('usuarios').child(auth.uid).child('cargo').val()";
const STAFF = `auth != null && ${ATIVO}`;
const ADMIN = `${STAFF} && ${CARGO} === 'Administrador'`;
// Ninguém exclui a própria conta
const NAO_AUTOEXCLUI = '(newData.exists() || auth.uid !== $uid)';
const GESTOR = `${STAFF} && (${CARGO} === 'Administrador' || ${CARGO} === 'Supervisor')`;
const SOCIAL = `${STAFF} && (${CARGO} === 'Administrador' || ${CARGO} === 'Supervisor' || ${CARGO} === 'Serviço Social')`;
// Recepção/gestão: qualquer perfil ativo, exceto Nutrição (que só enxerga a lista de presentes)
const RECEPCAO = `${STAFF} && ${CARGO} !== 'Nutrição'`;
const NUTRI_LE_PRESENTES = "query.orderByChild === 'status' && query.equalTo === 'presente'";
const SUPERVISOR_GERE = `${STAFF} && ${CARGO} === 'Supervisor' && newData.child('cargo').val() !== 'Administrador' && data.child('cargo').val() !== 'Administrador'`;

// Configuração inicial: enquanto "sistema/inicializado" não existir, a PRIMEIRA conta autenticada
// pode criar o próprio perfil de Administrador (e o marcador, na mesma gravação). Depois disso, a porta se fecha.
const INICIAL = "auth != null && auth.uid === $uid && !root.child('sistema/inicializado').exists() && newData.child('cargo').val() === 'Administrador' && newData.child('ativo').val() === true && newData.parent().parent().child('sistema/inicializado').val() === true";

const str = (max, min = 0) => ({ '.validate': `newData.isString() && newData.val().length >= ${min} && newData.val().length <= ${max}` });
const data = { '.validate': "newData.isString() && newData.val().matches(/^[0-9]{2}-[0-9]{2}-[0-9]{4}$/)" };
const hora = { '.validate': "newData.isString() && newData.val().matches(/^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$/)" };
const num = (min, max) => ({ '.validate': `newData.isNumber() && newData.val() >= ${min} && newData.val() <= ${max}` });
const bool = { '.validate': 'newData.isBoolean()' };
const CARGOS = "newData.val() === 'Administrador' || newData.val() === 'Supervisor' || newData.val() === 'Recepcionista' || newData.val() === 'Serviço Social' || newData.val() === 'Nutrição'";
const DIA30 = 30 * 24 * 3600 * 1000;

const regras = {
  rules: {
    '.read': false,
    '.write': false,

    // Perfis de acesso (o UID é o mesmo do Firebase Authentication)
    usuarios: {
      '.read': GESTOR,
      $uid: {
        '.read': 'auth != null && auth.uid === $uid',
        '.write': `((${ADMIN}) && ${NAO_AUTOEXCLUI}) || ((${SUPERVISOR_GERE}) && ${NAO_AUTOEXCLUI}) || (${INICIAL})`,
        '.validate': "newData.hasChildren(['nome', 'cargo', 'ativo'])",
        nome: str(120, 2),
        email: str(120, 3),
        login: str(40, 3),
        contatoEmail: str(120),
        telefone: str(30),
        cargo: { '.validate': `newData.isString() && (${CARGOS})` },
        ativo: bool,
        // O próprio usuário só pode MARCAR o primeiro acesso como concluído
        primeiroAcesso: { '.write': 'auth != null && auth.uid === $uid && newData.val() === false', '.validate': 'newData.isBoolean()' },
        criadoEm: { '.validate': 'newData.isNumber()' },
        $other: { '.validate': false },
      },
    },

    // Marcador de que o sistema já foi configurado (sem dados pessoais)
    sistema: {
      '.read': 'auth != null',
      inicializado: {
        '.write': "auth != null && !data.exists() && newData.val() === true && newData.parent().parent().child('usuarios').child(auth.uid).child('cargo').val() === 'Administrador'",
        '.validate': 'newData.isBoolean()',
      },
      $other: { '.validate': false },
    },

    acompanhantes: {
      // Nutrição só consegue consultar quem está PRESENTE (consulta filtrada por status); o resto é recusado pelo banco
      '.read': `${STAFF} && (${CARGO} !== 'Nutrição' || (${NUTRI_LE_PRESENTES}))`,
      '.indexOn': ['status', 'entradaTs', 'nomePaciente'],
      $id: {
        // Qualquer funcionário ativo cria/edita; apagar só Supervisor/Administrador
        '.write': `(${RECEPCAO}) && (newData.exists() || (${CARGO} === 'Administrador' || ${CARGO} === 'Supervisor'))`,
        '.validate': "newData.hasChildren(['id', 'tipo', 'nomeAcompanhante', 'nomePaciente', 'setor', 'dataEntrada', 'horaEntrada', 'status'])",
        id: { '.validate': 'newData.val() === $id' },
        tipo: { '.validate': "newData.val() === 'acompanhante' || newData.val() === 'visita'" },
        status: { '.validate': "newData.val() === 'presente' || newData.val() === 'saiu' || newData.val() === 'trocado'" },
        nomeAcompanhante: str(250),
        nomePaciente: str(250, 1),
        documento: str(250),
        telefone: str(80),
        parentesco: str(80),
        setor: str(100, 1),
        leito: str(60),
        observacao: str(1200),
        recepcionistaEntrada: str(250),
        recepcionistaSaida: str(250),
        dataEntrada: data,
        dataSaida: data,
        ultimaConfirmacao: data,
        horaEntrada: hora,
        horaSaida: hora,
        entradaTs: { '.validate': 'newData.isNumber()' },
        duracaoVisita: { '.validate': 'newData.isNumber()' },
        criadoPor: str(128),
        trocas: { '.validate': 'true' },
      },
    },

    bloqueios: {
      '.read': RECEPCAO,
      $id: {
        '.write': SOCIAL,
        '.validate': "newData.hasChildren(['id', 'paciente', 'motivo', 'ativo'])",
        id: { '.validate': 'newData.val() === $id' },
        paciente: str(250, 1), setor: str(100), leito: str(60), motivo: str(800, 1), solicitante: str(250), dataBloqueio: str(40), ativo: bool,
        $other: { '.validate': false },
      },
    },

    // Trilha de auditoria IMUTÁVEL: só cria; só o Administrador apaga e apenas logs com mais de 30 dias
    logs: {
      '.read': GESTOR,
      '.indexOn': ['timestamp'],
      $id: {
        '.write': `(${STAFF} && !data.exists() && newData.child('usuarioId').val() === auth.uid) || (${ADMIN} && !newData.exists() && data.child('timestamp').val() < now - ${DIA30})`,
        '.validate': "newData.hasChildren(['id', 'timestamp', 'usuario', 'usuarioId', 'acao', 'descricao'])",
        id: { '.validate': 'newData.val() === $id' },
        timestamp: { '.validate': 'newData.val() === now' },
        usuario: str(250), usuarioId: str(128), descricao: str(600), registroId: str(128),
        acao: { '.validate': "newData.isString() && newData.val().matches(/^(login|logout|criar|editar|excluir|saida|troca|bloqueio|usuario|config|exportar|privacidade|visualizacao)$/)" },
        $other: { '.validate': false },
      },
    },

    configuracoes: {
      '.read': STAFF,
      '.write': ADMIN,
      logoHospital: { '.validate': 'newData.isString() && newData.val().length < 700000' },
      retencaoRegistrosDias: num(7, 3650),
      retencaoLogsDias: num(30, 3650),
      controlador: str(200), encarregadoNome: str(150), encarregadoEmail: str(150),
      // A rotina diária de retenção pode ser disparada por Supervisor
      ultimaLimpeza: { '.write': GESTOR, '.validate': 'newData.isNumber()' },
      tema: { '.validate': "newData.val() === 'light' || newData.val() === 'dark'" },
      fundoLogin: { '.validate': 'newData.isString()' },
      $other: { '.validate': false },
    },
  },
};

writeFileSync(new URL('../database.rules.json', import.meta.url), JSON.stringify(regras, null, 2) + '\n');
console.log('database.rules.json gerado.');
