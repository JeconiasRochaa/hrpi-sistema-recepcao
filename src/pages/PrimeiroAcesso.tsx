import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { forcaSenha, validarSenha } from '@/lib/senha';
import { cn } from '@/lib/utils';

export default function PrimeiroAcesso() {
  const { perfil, definirNovaSenha, logout } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const forca = forcaSenha(nova);
  const problemas = nova ? validarSenha(nova, perfil?.email) : [];

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!atual) return setErro('Informe a senha inicial recebida.');
    if (problemas.length) return setErro(problemas[0]);
    if (nova !== conf) return setErro('As senhas não conferem.');
    if (nova === atual) return setErro('A nova senha deve ser diferente da senha inicial.');
    setSalvando(true);
    try { await definirNovaSenha(atual, nova); toast.success('Senha criada com sucesso!'); } catch (err) { setErro((err as Error).message); } finally { setSalvando(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-background to-background px-4">
      <form onSubmit={salvar} className="w-full max-w-md animate-slide-up space-y-5 rounded-xl border bg-card p-8 shadow-pop" noValidate>
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary"><KeyRound className="h-5 w-5" /></span>
          <div><h1 className="text-lg font-bold">Crie sua senha pessoal</h1><p className="text-[13px] text-muted-foreground">Olá, {perfil?.nome}. Por segurança, troque a senha inicial.</p></div></div>
        <Field label="Senha inicial (a que você recebeu)" required>{(id) => <Input id={id} type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" />}</Field>
        <Field label="Nova senha" required>{(id) => <Input id={id} type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" />}</Field>
        <div aria-hidden className="flex gap-1.5">{[0, 1, 2, 3].map((i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full bg-muted', nova && i < forca && ['bg-danger', 'bg-warning', 'bg-info', 'bg-success'][Math.max(0, forca - 1)])} />)}</div>
        {problemas.length > 0 && <ul className="space-y-0.5 text-xs text-warning">{problemas.map((p) => <li key={p}>• {p}</li>)}</ul>}
        <Field label="Confirmar nova senha" required>{(id) => <Input id={id} type="password" value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" />}</Field>
        {erro && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">{erro}</p>}
        <Button type="submit" className="w-full" size="lg" loading={salvando}><ShieldCheck className="h-4 w-4" /> Salvar e acessar</Button>
        <button type="button" onClick={() => void logout()} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">Sair</button>
      </form>
    </div>
  );
}
