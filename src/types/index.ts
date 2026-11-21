export type Cargo = 'Administrador' | 'Supervisor' | 'Recepcionista' | 'Serviço Social' | 'Nutrição';
export type TipoRegistro = 'acompanhante' | 'visita';
export type StatusRegistro = 'presente' | 'saiu' | 'trocado';

export interface TrocaEvento {
  dataHora: string;
  acompanhanteAntigo: string;
  acompanhanteNovo: string;
  recepcionista: string;
}

/** Registro de acompanhante/visitante. Mantém o mesmo esquema do sistema anterior (datas DD-MM-AAAA). */
export interface Registro {
  id: string;
  tipo: TipoRegistro;
  nomeAcompanhante: string;
  documento?: string;
  telefone?: string;
  parentesco?: string;
  nomePaciente: string;
  setor: string;
  leito?: string;
  dataEntrada: string; // DD-MM-AAAA
  horaEntrada: string; // HH:MM:SS
  dataSaida?: string | null;
  horaSaida?: string | null;
  status: StatusRegistro;
  recepcionistaEntrada?: string;
  recepcionistaSaida?: string | null;
  trocas?: TrocaEvento[];
  observacao?: string;
  duracaoVisita?: number | null;
  ultimaConfirmacao?: string;
  /** Epoch ms da entrada (registros novos). Registros antigos são calculados a partir de dataEntrada/horaEntrada. */
  entradaTs?: number;
  /** UID de quem criou o registro (auditoria). */
  criadoPor?: string;
}

export interface Perfil {
  uid: string;
  nome: string;
  /** E-mail de autenticação (interno: login@domínio). Não precisa ser um e-mail real. */
  email: string;
  /** Nome de usuário usado no login. */
  login?: string;
  /** Contatos opcionais (não usados para entrar no sistema). */
  contatoEmail?: string;
  telefone?: string;
  cargo: Cargo;
  ativo: boolean;
  primeiroAcesso?: boolean;
  criadoEm?: number;
}

export interface Bloqueio {
  id: string;
  paciente: string;
  setor?: string;
  leito?: string;
  motivo: string;
  solicitante: string;
  dataBloqueio: string;
  ativo: boolean;
}

export type AcaoLog =
  | 'login' | 'logout' | 'criar' | 'editar' | 'excluir' | 'saida' | 'troca'
  | 'bloqueio' | 'usuario' | 'config' | 'exportar' | 'privacidade' | 'visualizacao';

export interface LogAuditoria {
  id: string;
  timestamp: number;
  usuario: string;
  usuarioId: string;
  acao: AcaoLog;
  descricao: string;
  registroId?: string;
}


export interface Configuracoes {
  logoHospital?: string | null;
  tema?: 'light' | 'dark';
  retencaoRegistrosDias?: number;
  retencaoLogsDias?: number;
  controlador?: string;
  encarregadoNome?: string;
  encarregadoEmail?: string;
  ultimaLimpeza?: number;
}
