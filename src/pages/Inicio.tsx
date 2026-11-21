import { HeartPulse } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { HOSPITAL_NOME, SISTEMA_NOME } from '@/lib/constants';
import { primeiroNome } from '@/lib/text';

/** Página inicial (logo do hospital ao centro), igual à do Centro Cirúrgico. */
export default function Inicio() {
  const { perfil } = useAuth();
  const { config } = useData();
  const h = new Date().getHours();
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col items-center justify-center gap-5 text-center">
      {config.logoHospital
        ? <img src={config.logoHospital} alt="Logo do hospital" className="max-h-56 max-w-[min(26rem,80vw)] object-contain" />
        : <span className="flex h-28 w-28 items-center justify-center rounded-3xl bg-primary-soft text-primary"><HeartPulse className="h-14 w-14" aria-hidden /></span>}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{HOSPITAL_NOME}</h1>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{SISTEMA_NOME}</p>
      </div>
      {perfil && <p className="text-muted-foreground">{saudacao}, <strong className="text-foreground">{primeiroNome(perfil.nome)}</strong>. Escolha uma opção no menu para começar.</p>}
    </div>
  );
}
