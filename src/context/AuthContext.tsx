import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  EmailAuthProvider, browserSessionPersistence, onAuthStateChanged, reauthenticateWithCredential,
  setPersistence, signInWithEmailAndPassword, signOut, updatePassword,
} from 'firebase/auth';
import { get, onValue, ref, update, serverTimestamp } from 'firebase/database';
import { auth, db, LOGIN_DOMAIN } from '@/lib/firebase';
import { emailDeLogin } from '@/services/usuarios';
import { registrarLog } from '@/services/logs';
import { setPerfilAtual } from '@/services/sessao';
import type { Perfil } from '@/types';

/** Parte "usuário" do e-mail interno (admin@recepcao.hrpi.local -> admin). */
const loginDe = (email: string) => { const [l, d] = email.toLowerCase().split('@'); return d === LOGIN_DOMAIN && l.length >= 3 ? l : undefined; };

export type EstadoAuth = 'carregando' | 'deslogado' | 'configuracao' | 'logado';

interface AuthCtx {
  estado: EstadoAuth;
  perfil: Perfil | null;
  erroAcesso: string | null;
  login: (usuario: string, senha: string) => Promise<void>;
  logout: (motivo?: string) => Promise<void>;
  configurarPrimeiroAdmin: (nome: string) => Promise<void>;
  definirNovaSenha: (senhaAtual: string, novaSenha: string) => Promise<void>;
  limparErro: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

/** Mensagens genéricas: não revelam se o usuário existe (evita enumeração de contas). */
function mensagemErro(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (code === 'auth/network-request-failed') return 'Sem conexão com o servidor. Verifique a internet.';
  if (code === 'auth/user-disabled') return 'Esta conta foi desativada. Procure o administrador.';
  if (code === 'auth/weak-password') return 'Senha fraca. Use uma senha mais forte.';
  if (code === 'auth/requires-recent-login') return 'Por segurança, entre novamente para trocar a senha.';
  return 'Usuário ou senha inválidos.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>('carregando');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const tentativas = useRef({ n: 0, ate: 0 });
  const loginRegistrado = useRef<string | null>(null);

  useEffect(() => {
    let unsubPerfil: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubPerfil?.();
      unsubPerfil = undefined;
      if (!user) {
        setPerfilAtual(null);
        setPerfil(null);
        setEstado('deslogado');
        loginRegistrado.current = null;
        return;
      }
      unsubPerfil = onValue(
        ref(db, `usuarios/${user.uid}`),
        (snap) => {
          const v = snap.val() as Omit<Perfil, 'uid'> | null;
          if (!v) {
            // Sem perfil: se o sistema ainda não foi configurado, oferece a configuração inicial; senão, nega.
            setPerfilAtual(null);
            setPerfil(null);
            get(ref(db, 'sistema/inicializado'))
              .then((m) => {
                if (!m.exists()) { setErroAcesso(null); setEstado('configuracao'); return; }
                setErroAcesso('Sua conta ainda não foi liberada. Procure o administrador do sistema.');
                void signOut(auth);
              })
              .catch(() => {
                setErroAcesso('Sua conta ainda não foi liberada. Procure o administrador do sistema. (Se isto for a primeira instalação, publique as regras do banco em database.rules.json e tente novamente.)');
                void signOut(auth);
              });
            return;
          }
          if (v.ativo !== true) {
            setErroAcesso('Sua conta está inativa. Procure o administrador do sistema.');
            setPerfilAtual(null);
            setPerfil(null);
            void signOut(auth);
            return;
          }
          const p: Perfil = { ...v, uid: user.uid };
          setPerfilAtual(p);
          setPerfil(p);
          setEstado('logado');
          if (loginRegistrado.current !== user.uid) {
            loginRegistrado.current = user.uid;
            void registrarLog('login', 'Login realizado.');
          }
        },
        () => {
          setErroAcesso('Não foi possível validar seu acesso. Tente novamente.');
          void signOut(auth);
        },
      );
    });
    return () => { unsubAuth(); unsubPerfil?.(); };
  }, []);

  const login = useCallback(async (usuario: string, senha: string) => {
    const t = tentativas.current;
    if (Date.now() < t.ate) {
      const min = Math.ceil((t.ate - Date.now()) / 60000);
      throw new Error(`Acesso temporariamente bloqueado. Tente novamente em ${min} minuto(s).`);
    }
    setErroAcesso(null);
    try {
      await setPersistence(auth, browserSessionPersistence); // sessão vale só para esta aba
      await signInWithEmailAndPassword(auth, emailDeLogin(usuario), senha);
      t.n = 0;
    } catch (e) {
      t.n++;
      if (t.n >= MAX_TENTATIVAS) { t.ate = Date.now() + BLOQUEIO_MS; t.n = 0; throw new Error('Muitas tentativas incorretas. Acesso bloqueado por 15 minutos.'); }
      throw new Error(mensagemErro(e));
    }
  }, []);

  const logout = useCallback(async (motivo?: string) => {
    const p = auth.currentUser;
    if (p) await registrarLog('logout', motivo ?? 'Logout realizado.').catch(() => undefined);
    await signOut(auth);
  }, []);

  const configurarPrimeiroAdmin = useCallback(async (nome: string) => {
    const user = auth.currentUser;
    const n = nome.trim().replace(/\s+/g, ' ');
    if (!user?.email) throw new Error('Sessão inválida. Entre novamente.');
    if (n.length < 3) throw new Error('Informe seu nome completo.');
    try {
      // Gravação atômica: perfil de administrador + marcador de sistema configurado
      await update(ref(db), {
        [`usuarios/${user.uid}`]: { nome: n.slice(0, 120), email: user.email.toLowerCase(), ...(loginDe(user.email) ? { login: loginDe(user.email) } : {}), cargo: 'Administrador', ativo: true, primeiroAcesso: false, criadoEm: serverTimestamp() },
        'sistema/inicializado': true,
      });
    } catch {
      throw new Error('Não foi possível concluir. Confirme que as regras do banco (database.rules.json) estão publicadas e que o sistema ainda não foi configurado.');
    }
  }, []);

  const definirNovaSenha = useCallback(async (senhaAtual: string, novaSenha: string) => {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('Sessão inválida. Entre novamente.');
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, senhaAtual));
      await updatePassword(user, novaSenha);
      await update(ref(db), { [`usuarios/${user.uid}/primeiroAcesso`]: false });
      void registrarLog('usuario', 'Senha pessoal definida/alterada pelo próprio usuário.');
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') throw new Error('A senha atual está incorreta.');
      throw new Error(mensagemErro(e));
    }
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ estado, perfil, erroAcesso, login, logout, configurarPrimeiroAdmin, definirNovaSenha, limparErro: () => setErroAcesso(null) }),
    [estado, perfil, erroAcesso, login, logout, configurarPrimeiroAdmin, definirNovaSenha],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
