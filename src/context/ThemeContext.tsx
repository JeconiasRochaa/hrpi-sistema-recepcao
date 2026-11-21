import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Tema = 'light' | 'dark';
const Ctx = createContext<{ tema: Tema; alternar: () => void } | null>(null);

function lerTema(): Tema {
  try {
    const v = localStorage.getItem('hrpi-tema');
    if (v === 'light' || v === 'dark') return v;
  } catch { /* storage indisponível */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(lerTema);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark');
    try { localStorage.setItem('hrpi-tema', tema); } catch { /* ignora */ }
  }, [tema]);
  const value = useMemo(() => ({ tema, alternar: () => setTema((t) => (t === 'dark' ? 'light' : 'dark')) }), [tema]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useTema = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTema fora do ThemeProvider');
  return c;
};
