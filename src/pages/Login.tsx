import { useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, HeartHandshake, Lock, Mail, Moon, ShieldCheck, Sun, Users } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useTema } from '@/context/ThemeContext';
import { auth } from '@/lib/firebase';
import { emailDeLogin } from '@/services/usuarios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { HOSPITAL_NOME } from '@/lib/constants';
// Foto embutida no código (base64 no build): não depende de internet nem do banco para aparecer.
import FOTO from '@/assets/login-recepcao.jpg?inline';

export default function Login() {
  const { login, erroAcesso, limparErro } = useAuth();
  const { tema, alternar } = useTema();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); limparErro();
    if (!usuario.trim() || !senha) { setErro('Preencha usuário e senha.'); return; }
    setCarregando(true);
    try { await login(usuario, senha); } catch (err) { setErro((err as Error).message); } finally { setCarregando(false); }
  }

  async function esqueci() {
    if (!usuario.includes('@')) { setErro('Informe seu e-mail no campo acima para receber o link de redefinição.'); return; }
    try { await sendPasswordResetEmail(auth, emailDeLogin(usuario)); } catch { /* resposta genérica de propósito */ }
    toast.success('Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.');
  }

  const msg = erro || erroAcesso;
  return (
    <div className="grid min-h-screen bg-card lg:grid-cols-[minmax(0,1.9fr)_minmax(25rem,1fr)]">
      {/* Foto: ocupa a maior parte da tela; o texto de boas-vindas fica sobre a base escurecida da imagem */}
      <section className="relative hidden overflow-hidden bg-sidebar lg:block">
        <img src={FOTO} alt="Recepcionista atendendo uma paciente no balcão da recepção do hospital" className="absolute inset-0 h-full w-full object-cover object-[72%_50%]" decoding="async" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#07243a]/95 via-[#07243a]/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
          <h2 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Recepção organizada,<br />cuidado mais próximo.</h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/80">Entradas, trocas de acompanhante e visitas em um só lugar, com rastreabilidade e proteção de dados.</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {([[Users, 'Atendimento integrado'], [HeartHandshake, 'Cuidado com as pessoas'], [ShieldCheck, 'Conforme LGPD']] as const).map(([Icon, t]) => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur"><Icon size={14} className="text-teal-300" /> {t}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-14">
        <div className="flex items-start justify-between">
          <div className="leading-tight">
            <div className="text-xl font-extrabold tracking-tight text-primary">HRPI</div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Controle de Recepção</div>
          </div>
          <button type="button" onClick={alternar} className="rounded-md border p-2 text-muted-foreground hover:bg-muted" aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>{tema === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 animate-slide-up flex-col justify-center py-10">
          <p className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary"><Lock className="h-3 w-3" /> Acesso restrito</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Entrar no sistema</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use suas credenciais institucionais para acessar a recepção.</p>

          <form onSubmit={enviar} className="mt-7 space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="usuario" className="text-[13px] font-medium">E-mail ou usuário</label>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="usuario" className="h-11 pl-9" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoFocus spellCheck={false} autoCapitalize="none" /></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between"><label htmlFor="senha" className="text-[13px] font-medium">Senha</label>
                <button type="button" onClick={esqueci} className="text-xs font-medium text-primary hover:underline">Esqueci minha senha</button></div>
              <div className="relative"><Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="senha" className="h-11 pl-9 pr-10" type={ver ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
                <button type="button" onClick={() => setVer((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground" aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}>{ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
            </div>
            {msg && <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{msg}</div>}
            <Button type="submit" size="lg" className="w-full" loading={carregando}>Entrar <ArrowRight className="h-4 w-4" /></Button>
          </form>
        </div>

        <p className="flex items-start justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{HOSPITAL_NOME}. Sistema exclusivo para funcionários autorizados; os acessos e ações são registrados (LGPD).</span></p>
      </section>
    </div>
  );
}
