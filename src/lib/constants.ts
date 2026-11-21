import type { Cargo } from '@/types';

export const HOSPITAL_NOME = 'Hospital Regional de Palmeira dos Índios';
export const SISTEMA_NOME = 'Controle de Recepção';
export const VERSAO = 'v3.3';

/**
 * Senha inicial de todo usuário novo (ele é OBRIGADO a trocá-la no primeiro acesso).
 * O Firebase exige no mínimo 6 caracteres, então "12345" não é aceita. Pode ser trocada pela variável VITE_SENHA_PADRAO.
 */
const senhaEnv = (import.meta.env.VITE_SENHA_PADRAO as string | undefined)?.trim();
export const SENHA_PADRAO = senhaEnv && senhaEnv.length >= 6 ? senhaEnv : 'hrpi12345';

export const CARGOS: Cargo[] = ['Administrador', 'Supervisor', 'Recepcionista', 'Serviço Social', 'Nutrição'];

export const PARENTESCOS = [
  'Filho(a)', 'Pai/Mãe', 'Cônjuge', 'Irmão/Irmã', 'Neto(a)', 'Sobrinho(a)', 'Amigo(a)', 'Cuidador(a)', 'Outro',
] as const;

export const SETORES = [
  'Oncologia I', 'Oncologia II', 'UTI I', 'UTI II', 'Clínica Médica I', 'Clínica Médica II',
  'Clínica Cirúrgica', 'Pediatria', 'Saúde Mental',
] as const;

/** Setores onde só é permitida visita (não pode ter acompanhante fixo). */
export const SETORES_SOMENTE_VISITA: readonly string[] = ['UTI I', 'UTI II'];
export const SETORES_ACOMPANHANTE = SETORES.filter((s) => !SETORES_SOMENTE_VISITA.includes(s));

export const MOTIVOS_SAIDA = ['Alta do paciente', 'Desistência', 'Outro'] as const;

export const CONFIG = {
  /** Encerra a sessão após este tempo sem interação. */
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,
  /** Aviso (contagem regressiva) antes de encerrar. */
  SESSION_WARNING_MS: 60 * 1000,
  /** Dias sem confirmação de presença até o acompanhante ser sinalizado. */
  DIAS_ALERTA_PRESENCA: 2,
  /** Duração fixa das visitas (minutos). */
  DURACAO_VISITA_MIN: 60,
  RETENCAO_REGISTROS_DIAS_PADRAO: 60,
  RETENCAO_LOGS_DIAS_PADRAO: 180,
  /** Mínimo de dias que as regras do banco exigem antes de permitir apagar um log. */
  RETENCAO_LOGS_DIAS_MIN: 30,
  SENHA_MIN: 10,
} as const;
