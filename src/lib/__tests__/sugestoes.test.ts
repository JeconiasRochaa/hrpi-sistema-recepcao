import { describe, expect, it } from 'vitest';
import { buscarPacientes, buscarPessoas, destacar, indicePacientes, indicePessoas, leitosDoSetor, pacientesRecentes, pontuar } from '../sugestoes';
import { normalizarRegistro } from '../stats';
import type { Registro } from '@/types';

const reg = (o: Partial<Registro>): Registro => normalizarRegistro({
  id: Math.random().toString(36).slice(2), tipo: 'acompanhante', nomeAcompanhante: 'Maria Silva', nomePaciente: 'João Pereira', setor: 'Pediatria', leito: '3',
  dataEntrada: '10-11-2026', horaEntrada: '10:00:00', status: 'saiu', ...o,
});

describe('sugestões', () => {
  it('pontua prefixo > início de palavra > contém, ignorando acentos', () => {
    expect(pontuar('João Pereira', 'joa')).toBeGreaterThan(pontuar('Maria João', 'joa'));
    expect(pontuar('Maria João', 'joa')).toBeGreaterThan(pontuar('Banjoao', 'joa'));
    expect(pontuar('João Pereira', 'xyz')).toBe(0);
    expect(pontuar('João Pereira', 'joao per')).toBeGreaterThan(0);
  });

  it('agrupa pacientes por nome e usa setor/leito do registro mais recente', () => {
    const idx = indicePacientes([
      reg({ nomePaciente: 'JOÃO PEREIRA', setor: 'Pediatria', leito: '3', dataEntrada: '01-11-2026' }),
      reg({ nomePaciente: 'João Pereira', setor: 'Clínica Médica I', leito: '12', dataEntrada: '10-11-2026' }),
    ]);
    expect(idx).toHaveLength(1);
    expect(idx[0]).toMatchObject({ setor: 'Clínica Médica I', leito: '12', usos: 2 });
  });

  it('marca paciente que já tem acompanhante presente', () => {
    const idx = indicePacientes([reg({ status: 'presente', nomeAcompanhante: 'Ana' })]);
    expect(idx[0].presente).toBe(true);
    expect(idx[0].acompanhante).toBe('Ana');
  });

  it('busca exige 2 letras e não repete o nome já digitado por completo', () => {
    const idx = indicePacientes([reg({ nomePaciente: 'Carlos Souza' })]);
    expect(buscarPacientes(idx, 'c')).toEqual([]);
    expect(buscarPacientes(idx, 'car')).toHaveLength(1);
    expect(buscarPacientes(idx, 'Carlos Souza')).toHaveLength(0);
  });

  it('pacientes recentes: ordena do mais novo para o mais antigo', () => {
    const idx = indicePacientes([reg({ nomePaciente: 'A A', dataEntrada: '01-11-2026' }), reg({ nomePaciente: 'B B', dataEntrada: '09-11-2026' })]);
    expect(pacientesRecentes(idx, 1)[0].nome).toBe('B B');
  });

  it('pessoas: reaproveita documento/telefone/parentesco do último registro', () => {
    const idx = indicePessoas([
      reg({ nomeAcompanhante: 'Maria Silva', documento: '123', telefone: '', parentesco: 'Filho(a)', dataEntrada: '01-11-2026' }),
      reg({ nomeAcompanhante: 'maria silva', documento: '', telefone: '(82) 99999-0000', parentesco: 'Cônjuge', dataEntrada: '10-11-2026' }),
    ]);
    expect(idx).toHaveLength(1);
    expect(idx[0]).toMatchObject({ documento: '123', telefone: '(82) 99999-0000', parentesco: 'Cônjuge', usos: 2 });
    expect(buscarPessoas(idx, 'ma')).toEqual([]); // mínimo de 3 letras
    expect(buscarPessoas(idx, 'mar')).toHaveLength(1);
  });

  it('leitos do setor em ordem natural e sem repetição', () => {
    const l = leitosDoSetor([reg({ leito: '10' }), reg({ leito: '2' }), reg({ leito: '2' }), reg({ setor: 'UTI I', leito: '1' })], 'Pediatria');
    expect(l).toEqual(['2', '10']);
  });

  it('destaque devolve partes sem HTML', () => {
    expect(destacar('João Pereira', 'per')).toEqual(['João ', 'Per', 'eira']);
    expect(destacar('João', '')).toEqual(['João', '', '']);
  });
});

import { agruparNutricao, totalNutricao } from '../nutricao';
describe('nutrição', () => {
  it('só acompanhantes presentes, por setor, leitos em ordem natural', () => {
    const g = agruparNutricao([
      reg({ id: 'a', setor: 'Pediatria', leito: '10', status: 'presente' }),
      reg({ id: 'b', setor: 'Pediatria', leito: '2', status: 'presente' }),
      reg({ id: 'c', setor: 'Pediatria', leito: '1', status: 'presente', tipo: 'visita' }),
      reg({ id: 'd', setor: 'Pediatria', leito: '3', status: 'saiu' }),
      reg({ id: 'e', setor: 'Oncologia I', leito: '5', status: 'presente' }),
    ]);
    expect(g.map((x) => x.setor)).toEqual(['Oncologia I', 'Pediatria']);
    expect(g[1].itens.map((r) => r.leito)).toEqual(['2', '10']);
    expect(totalNutricao(g)).toBe(3);
  });
  it('filtra por texto e por setor', () => {
    const lista = [reg({ id: 'a', nomePaciente: 'Carlos', status: 'presente' }), reg({ id: 'b', nomePaciente: 'Ana', setor: 'UTI I', status: 'presente' })];
    expect(totalNutricao(agruparNutricao(lista, 'carl'))).toBe(1);
    expect(totalNutricao(agruparNutricao(lista, '', 'UTI I'))).toBe(1);
  });
});
