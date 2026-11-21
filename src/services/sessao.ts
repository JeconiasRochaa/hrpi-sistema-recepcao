import type { Perfil } from '@/types';

/** Perfil do usuário logado, acessível fora do React (serviços, logs). */
let atual: Perfil | null = null;
export const setPerfilAtual = (p: Perfil | null) => { atual = p; };
export const getPerfilAtual = () => atual;
export const nomeAtual = () => atual?.nome ?? 'Sistema';
