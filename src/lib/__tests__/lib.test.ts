import { describe, expect, it } from 'vitest';
import { limparLegado, limpar, mascararDocumento, mesmoNome, normalizar } from '../text';
import { forcaSenha, gerarSenhaTemporaria, validarSenha } from '../senha';
import { historicoDoPaciente, normalizarRegistro } from '../stats';
import type { Registro } from '@/types';

const reg = (o: Partial<Registro>): Registro => normalizarRegistro({
  id: 'x', tipo: 'acompanhante', nomeAcompanhante: 'Maria', nomePaciente: 'João', setor: 'UTI', dataEntrada: '10-11-2026', horaEntrada: '10:00:00', status: 'presente', ...o,
});

describe('text', () => {
  it('decodifica HTML legado', () => expect(limparLegado('D&#39;Ávila &amp; Filhos')).toBe("D'Ávila & Filhos"));
  it('normaliza acentos e caixa', () => { expect(normalizar('  JOÃO  ')).toBe('joao'); expect(mesmoNome('José', 'jose')).toBe(true); });
  it('remove caracteres de controle', () => expect(limpar('a\u0000b\n c')).toBe('a b c'));
  it('mascara CPF e documentos curtos', () => {
    expect(mascararDocumento('123.456.789-09')).toBe('•••.•••.789-••');
    expect(mascararDocumento('12')).toBe('•••');
    expect(mascararDocumento('')).toBe('—');
  });
});

describe('senha', () => {
  it('rejeita senhas fracas', () => {
    expect(validarSenha('curta1A').length).toBeGreaterThan(0);
    expect(validarSenha('senha123ABCdef').length).toBeGreaterThan(0);
    expect(validarSenha('maria.silva9X!ok', 'maria.silva@x.br').length).toBeGreaterThan(0);
  });
  it('aceita senha forte', () => expect(validarSenha('Tr0ca-Cadeira-Azul', 'a@b.c')).toEqual([]));
  it('mede força', () => { expect(forcaSenha('a')).toBe(0); expect(forcaSenha('Abcdefghij1!xyzw')).toBe(4); });
  it('gera senha temporária válida e aleatória', () => {
    const a = gerarSenhaTemporaria(); const b = gerarSenhaTemporaria();
    expect(a).not.toBe(b); expect(a).toHaveLength(16); expect(validarSenha(a)).toEqual([]);
  });
});

describe('histórico do paciente', () => {
  it('agrupa acompanhantes, visitas e trocas ignorando acentos', () => {
    const todos = [
      reg({ id: '1', nomePaciente: 'João', status: 'trocado', dataSaida: '10-11-2026', horaSaida: '14:00:00', documento: '111' }),
      reg({ id: '2', nomePaciente: 'JOAO', nomeAcompanhante: 'Pedro', dataEntrada: '10-11-2026', horaEntrada: '14:05:00', documento: '222' }),
      reg({ id: '3', nomePaciente: 'João', tipo: 'visita', dataSaida: '11-11-2026', horaSaida: '11:00:00', dataEntrada: '11-11-2026', horaEntrada: '10:30:00', status: 'saiu' }),
      reg({ id: '4', nomePaciente: 'Outra' }),
    ];
    const h = historicoDoPaciente(todos, 'João');
    expect(h.registros).toHaveLength(3);
    expect(h.totalAcompanhantes).toBe(2);
    expect(h.totalVisitas).toBe(1);
    expect(h.totalTrocas).toBe(1);
    expect(h.acompanhantesDistintos).toBe(2);
    expect(h.atual?.id).toBe('2');
    expect(h.eventos[0].ts).toBeGreaterThanOrEqual(h.eventos[h.eventos.length - 1].ts);
  });
});
