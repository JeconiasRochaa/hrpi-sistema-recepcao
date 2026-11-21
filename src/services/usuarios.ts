import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut as signOutApp } from 'firebase/auth';
import { get, ref, update, serverTimestamp } from 'firebase/database';
import { auth, db, firebaseConfig, LOGIN_DOMAIN } from '@/lib/firebase';
import { SENHA_PADRAO } from '@/lib/constants';
import { limpar } from '@/lib/text';
import type { Cargo } from '@/types';
import { montarLog } from './logs';

export function emailDeLogin(entrada: string): string {
  const v = entrada.trim().toLowerCase();
  if (v.includes('@')) return v;
  return LOGIN_DOMAIN ? `${v}@${LOGIN_DOMAIN}` : v;
}

const vazioParaNulo = (v?: string, max = 120) => { const x = limpar(v, max); return x ? x : null; };

/** O acesso é só nome + login. E-mail e telefone são contatos opcionais. */
export interface DadosUsuario { nome: string; login: string; email?: string; telefone?: string; cargo: Cargo }

/**
 * Cria a conta no Firebase Authentication usando uma instância secundária do app
 * (assim o administrador continua logado) e grava o perfil/cargo no banco.
 * O login vira `login@domínio-interno` (não precisa ser e-mail real). A senha inicial é a padrão (SENHA_PADRAO),
 * mostrada UMA vez, e o usuário é obrigado a trocá-la no 1º acesso.
 * Se o acesso está sendo RECRIADO (conta apagada no Firebase Authentication), o perfil antigo órfão é removido.
 */
export async function criarUsuario(d: DadosUsuario): Promise<{ uid: string; senhaTemporaria: string; login: string }> {
  const senhaTemporaria = SENHA_PADRAO;
  const login = d.login.trim().toLowerCase();
  const emailAuth = emailDeLogin(login);
  const sec = initializeApp(firebaseConfig, `criacao-${Date.now()}`);
  try {
    const secAuth = getAuth(sec);
    const cred = await createUserWithEmailAndPassword(secAuth, emailAuth, senhaTemporaria);
    const uid = cred.user.uid;
    await signOutApp(secAuth);
    const up: Record<string, unknown> = {
      [`usuarios/${uid}`]: {
        nome: limpar(d.nome, 120), email: emailAuth, login, cargo: d.cargo, ativo: true, primeiroAcesso: true, criadoEm: serverTimestamp(),
        ...(vazioParaNulo(d.email) ? { contatoEmail: vazioParaNulo(d.email) } : {}), ...(vazioParaNulo(d.telefone, 30) ? { telefone: vazioParaNulo(d.telefone, 30) } : {}),
      },
      ...montarLog('usuario', `Usuário criado (${d.cargo}).`, uid),
    };
    try {
      const todos = (await get(ref(db, 'usuarios'))).val() as Record<string, { email?: string }> | null;
      for (const [outro, p] of Object.entries(todos ?? {})) if (outro !== uid && p?.email === emailAuth) up[`usuarios/${outro}`] = null;
    } catch { /* sem leitura da lista: segue sem limpar */ }
    await update(ref(db), up);
    return { uid, senhaTemporaria, login };
  } finally {
    await deleteApp(sec).catch(() => undefined);
  }
}

export async function atualizarUsuario(uid: string, c: { nome: string; cargo: Cargo; ativo: boolean; email?: string; telefone?: string }) {
  await update(ref(db), {
    [`usuarios/${uid}/nome`]: limpar(c.nome, 120),
    [`usuarios/${uid}/cargo`]: c.cargo,
    [`usuarios/${uid}/ativo`]: c.ativo,
    [`usuarios/${uid}/contatoEmail`]: vazioParaNulo(c.email),
    [`usuarios/${uid}/telefone`]: vazioParaNulo(c.telefone, 30),
    ...montarLog('usuario', `Usuário atualizado (${c.cargo}, ${c.ativo ? 'ativo' : 'inativo'}).`, uid),
  });
}

export async function exigirNovaSenha(uid: string) {
  await update(ref(db), { [`usuarios/${uid}/primeiroAcesso`]: true, ...montarLog('usuario', 'Troca de senha exigida no próximo acesso.', uid) });
}

export async function enviarRedefinicaoSenha(email: string, uid?: string) {
  await sendPasswordResetEmail(auth, email);
  if (uid) await update(ref(db), montarLog('usuario', 'E-mail de redefinição de senha enviado.', uid));
}

/** O e-mail de redefinição só funciona quando o acesso foi criado com um e-mail real (login com @). */
export const temEmailReal = (emailAuth: string) => !emailAuth.toLowerCase().endsWith(`@${LOGIN_DOMAIN}`);

/** Ativa/desativa o acesso (reversível). Quem está logado perde o acesso na hora. */
export async function definirAtivo(uid: string, ativo: boolean) {
  await update(ref(db), { [`usuarios/${uid}/ativo`]: ativo, ...montarLog('usuario', ativo ? 'Usuário reativado.' : 'Usuário desativado.', uid) });
}

/**
 * Exclui o PERFIL (cargo/acesso) do usuário: ele não consegue mais entrar. A conta de login em si só pode ser
 * apagada no Firebase Console → Authentication (o navegador não tem permissão para apagar a conta de outra pessoa).
 */
export async function excluirUsuario(uid: string) {
  await update(ref(db), { [`usuarios/${uid}`]: null, ...montarLog('usuario', 'Usuário excluído.', uid) });
}

/** Vincula uma conta que JÁ existe no Firebase Authentication (pelo UID) a um cargo, sem recriar a conta. */
export async function vincularConta(d: { uid: string; nome: string; login?: string; cargo: Cargo }) {
  const login = d.login?.trim().toLowerCase();
  await update(ref(db), {
    [`usuarios/${d.uid.trim()}`]: {
      nome: limpar(d.nome, 120), ...(login ? { login, email: emailDeLogin(login) } : {}), cargo: d.cargo, ativo: true, primeiroAcesso: false, criadoEm: serverTimestamp(),
    },
    ...montarLog('usuario', `Conta existente vinculada (${d.cargo}).`, d.uid.trim()),
  });
}
