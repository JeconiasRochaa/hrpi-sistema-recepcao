import {
  Activity, BarChart3, Home, Ban, ClipboardList, FileBarChart, History, LayoutDashboard, LogIn, Repeat, LogOut, Settings, ShieldCheck,
  Soup, Stethoscope, Timer, UserCog, Users, UsersRound, type LucideIcon,
} from 'lucide-react';
import type { Cargo } from '@/types';
import { podeFazer, type Capacidade } from './permissions';

export interface NavItem { to: string; rotulo: string; icone: LucideIcon; cap?: Capacidade; badge?: 'alertas' }
export interface NavGrupo { id: string; rotulo: string; icone: LucideIcon; itens: NavItem[] }

export const NAV_INICIO: NavItem = { to: '/', rotulo: 'Início', icone: Home };
export const NAV_TOPO: NavItem = { to: '/painel', rotulo: 'Painel gerencial', icone: LayoutDashboard, badge: 'alertas', cap: 'registrar' };

export const NAV_GRUPOS: NavGrupo[] = [
  {
    id: 'registros', rotulo: 'Registros', icone: ClipboardList,
    itens: [
      { to: '/entrada', rotulo: 'Entrada de acompanhante', icone: LogIn, cap: 'registrar' },
      { to: '/visita', rotulo: 'Registro de visita', icone: Timer, cap: 'registrar' },
      { to: '/troca', rotulo: 'Troca de acompanhante', icone: Repeat, cap: 'registrar' },
      { to: '/saida', rotulo: 'Registro de saída', icone: LogOut, cap: 'registrar' },
    ],
  },
  {
    id: 'acompanhamento', rotulo: 'Acompanhamento', icone: UsersRound,
    itens: [
      { to: '/ativos', rotulo: 'Acompanhantes ativos', icone: Users, cap: 'registrar' },
      { to: '/nutricao', rotulo: 'Lista para nutrição', icone: Soup, cap: 'nutricao' },
      { to: '/historico', rotulo: 'Histórico', icone: History, cap: 'registrar' },
    ],
  },
  {
    id: 'ferramentas', rotulo: 'Ferramentas', icone: BarChart3,
    itens: [
      { to: '/bloqueios', rotulo: 'Bloqueios de visita', icone: Ban, cap: 'bloqueios' },
      { to: '/relatorios', rotulo: 'Relatórios', icone: FileBarChart, cap: 'relatorios' },
    ],
  },
  {
    id: 'administracao', rotulo: 'Administração', icone: Settings,
    itens: [
      { to: '/usuarios', rotulo: 'Usuários', icone: UserCog, cap: 'usuarios' },
      { to: '/logs', rotulo: 'Logs de auditoria', icone: Activity, cap: 'logs' },
      { to: '/diagnostico', rotulo: 'Diagnóstico de dados', icone: Stethoscope, cap: 'diagnostico' },
      { to: '/configuracoes', rotulo: 'Configurações', icone: Settings, cap: 'config' },
    ],
  },
  {
    id: 'privacidade', rotulo: 'Privacidade', icone: ShieldCheck,
    itens: [{ to: '/privacidade', rotulo: 'LGPD e privacidade', icone: ShieldCheck }],
  },
];

export function gruposVisiveis(cargo: Cargo | undefined): NavGrupo[] {
  return NAV_GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => !i.cap || podeFazer(cargo, i.cap)) })).filter((g) => g.itens.length > 0);
}

export function tituloDaRota(path: string): string {
  if (path === '/') return NAV_INICIO.rotulo;
  if (path === NAV_TOPO.to) return NAV_TOPO.rotulo;
  for (const g of NAV_GRUPOS) for (const i of g.itens) if (i.to === path) return i.rotulo;
  return '';
}
