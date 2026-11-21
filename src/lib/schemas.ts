import { z } from 'zod';
import { SETORES } from './constants';

const texto = (min: number, max: number, msg: string) =>
  z.string().trim().min(min, msg).max(max, `Máximo de ${max} caracteres.`);

export const pessoaSchema = z.object({
  nome: texto(3, 120, 'Informe o nome completo.'),
  documento: z.string().trim().max(40, 'Máximo de 40 caracteres.').optional().or(z.literal('')),
  telefone: z.string().trim().max(30).optional().or(z.literal('')),
  parentesco: z.string().min(1, 'Selecione o parentesco.'),
});

export const entradaSchema = pessoaSchema.extend({
  nomePaciente: texto(3, 120, 'Informe o nome do paciente.'),
  setor: z.string().refine((s) => (SETORES as readonly string[]).includes(s), 'Selecione o setor.'),
  leito: z.string().trim().max(20).optional().or(z.literal('')),
  observacao: z.string().trim().max(500).optional().or(z.literal('')),
});

export const bloqueioSchema = z.object({
  paciente: texto(3, 120, 'Informe o nome do paciente.'),
  setor: z.string().optional(),
  leito: z.string().trim().max(20).optional(),
  motivo: texto(5, 400, 'Descreva o motivo (mín. 5 caracteres).'),
});

export const usuarioSchema = z.object({
  nome: texto(3, 120, 'Informe o nome completo.'),
  login: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, 'Use 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado (sem espaços e sem @).'),
  email: z.string().trim().max(120).refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'E-mail inválido.').optional(),
  telefone: z.string().trim().max(30).optional(),
  cargo: z.enum(['Administrador', 'Supervisor', 'Recepcionista', 'Serviço Social', 'Nutrição']),
});

export function erros<T>(r: z.ZodSafeParseResult<T>): Record<string, string> {
  if (r.success) return {};
  const out: Record<string, string> = {};
  for (const i of r.error.issues) { const k = String(i.path[0] ?? '_'); if (!out[k]) out[k] = i.message; }
  return out;
}
