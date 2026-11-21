import { useState } from 'react';
import { ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';

/** Exibida uma única vez: a primeira conta autenticada de um sistema novo vira Administrador. */
export default function ConfiguracaoInicial() {
  const { configurarPrimeiroAdmin } = useAuth();
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try { await configurarPrimeiroAdmin(nome); toast.success('Sistema configurado. Bem-vindo(a)!'); }
    catch (err) { setErro((err as Error).message); }
    finally { setCarregando(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <form onSubmit={enviar} className="w-full max-w-md animate-slide-up rounded-xl border bg-card p-8 shadow-pop">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary"><UserCog className="h-6 w-6" /></span>
        <h1 className="text-xl font-bold tracking-tight">Configuração inicial</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Este sistema ainda não tem administrador. Ao continuar, a conta <strong className="text-foreground">{auth.currentUser?.email}</strong> será o primeiro Administrador. Esta etapa só aparece uma vez.</p>
        <label htmlFor="nome" className="mt-6 block text-[13px] font-medium">Seu nome completo</label>
        <Input id="nome" className="mt-1.5 h-11" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus maxLength={120} />
        {erro && <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">{erro}</p>}
        <Button type="submit" size="lg" className="mt-5 w-full" loading={carregando}>Tornar-me administrador</Button>
        <button type="button" onClick={() => void signOut(auth)} className="mt-3 w-full text-center text-xs text-muted-foreground hover:underline">Sair</button>
        <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Faça isto agora, logo após publicar as regras, para que ninguém mais ocupe essa vaga. Depois, crie os demais usuários em Usuários.</p>
      </form>
    </div>
  );
}
