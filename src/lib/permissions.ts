import type { Cargo } from '@/types';

export type Capacidade =
  | 'registrar' | 'ferramentas' | 'bloqueios' | 'relatorios' | 'exportar' | 'indicadores'
  | 'nutricao' | 'usuarios' | 'config' | 'logs' | 'diagnostico' | 'excluirRegistro' | 'privacidadeAdmin';

const GESTOR: Cargo[] = ['Administrador', 'Supervisor'];

export function podeFazer(cargo: Cargo | undefined, cap: Capacidade): boolean {
  if (!cargo) return false;
  switch (cap) {
    case 'nutricao':
      return true;
    case 'registrar': // recepção: entrada, saída, ativos, histórico, painel (o perfil Nutrição só vê a própria lista)
      return cargo !== 'Nutrição';
    case 'bloqueios':
    case 'relatorios':
    case 'exportar':
    case 'ferramentas':
      return GESTOR.includes(cargo) || cargo === 'Serviço Social';
    case 'indicadores':
    case 'usuarios':
    case 'logs':
    case 'diagnostico':
    case 'excluirRegistro':
      return GESTOR.includes(cargo);
    case 'config':
    case 'privacidadeAdmin':
      return cargo === 'Administrador';
  }
}
