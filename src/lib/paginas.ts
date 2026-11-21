import { lazy } from 'react';

/** Páginas carregadas sob demanda. Também são pré-carregadas em segundo plano após o login, para o clique ser instantâneo. */
const imports = {
  Historico: () => import('@/pages/Historico'),
  Bloqueios: () => import('@/pages/Bloqueios'),
  Relatorios: () => import('@/pages/Relatorios'),
  Usuarios: () => import('@/pages/Usuarios'),
  Configuracoes: () => import('@/pages/Configuracoes'),
  Logs: () => import('@/pages/Logs'),
  Diagnostico: () => import('@/pages/Diagnostico'),
  Privacidade: () => import('@/pages/Privacidade'),
} as const;

export const Historico = lazy(imports.Historico);
export const Bloqueios = lazy(imports.Bloqueios);
export const Relatorios = lazy(imports.Relatorios);
export const Usuarios = lazy(imports.Usuarios);
export const Configuracoes = lazy(imports.Configuracoes);
export const Logs = lazy(imports.Logs);
export const Diagnostico = lazy(imports.Diagnostico);
export const Privacidade = lazy(imports.Privacidade);

/** Baixa os pacotes das demais telas quando o navegador está ocioso (falhas são ignoradas: o clique tentará de novo). */
export function preCarregarPaginas() {
  const rodar = () => { for (const f of Object.values(imports)) void f().catch(() => undefined); };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(rodar, { timeout: 4000 }); else window.setTimeout(rodar, 1500);
}
