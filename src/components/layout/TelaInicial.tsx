import { useEffect, useState } from 'react';
import { HeartPulse, RefreshCw } from 'lucide-react';
import { HOSPITAL_NOME } from '@/lib/constants';

/** Tela de abertura. Se a verificação de acesso demorar demais, oferece tentar de novo em vez de ficar "carregando" para sempre. */
export function TelaInicial() {
  const [demorou, setDemorou] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setDemorou(true), 12_000); return () => window.clearTimeout(t); }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sidebar text-white" role="status" aria-live="polite">
      <span className="flex h-14 w-14 animate-pulse-dot items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><HeartPulse className="h-7 w-7 text-teal-300" /></span>
      <p className="text-sm font-semibold tracking-wide">{HOSPITAL_NOME}</p>
      <p className="text-xs text-slate-300">{demorou ? 'Está demorando mais que o normal. Verifique a internet.' : 'Carregando…'}</p>
      {demorou && <button onClick={() => window.location.reload()} className="mt-1 inline-flex items-center gap-2 rounded-md bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25"><RefreshCw className="h-4 w-4" /> Tentar novamente</button>}
    </div>
  );
}
