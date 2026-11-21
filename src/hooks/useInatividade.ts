import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '@/lib/constants';

/**
 * Encerra a sessão após inatividade real (mouse, teclado, toque, rolagem) — LGPD/segurança.
 * Mostra um aviso com contagem regressiva antes de sair.
 */
export function useInatividade(ativo: boolean, aoExpirar: () => void) {
  const ultima = useRef(Date.now());
  const [restante, setRestante] = useState<number | null>(null);
  const expirar = useRef(aoExpirar);
  expirar.current = aoExpirar;

  useEffect(() => {
    if (!ativo) return;
    ultima.current = Date.now();
    const marcar = () => { if (restante === null) ultima.current = Date.now(); };
    const evs: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, marcar, { passive: true }));
    const id = window.setInterval(() => {
      const ocioso = Date.now() - ultima.current;
      const falta = CONFIG.SESSION_TIMEOUT_MS - ocioso;
      if (falta <= 0) { expirar.current(); setRestante(null); }
      else if (falta <= CONFIG.SESSION_WARNING_MS) setRestante(Math.ceil(falta / 1000));
      else setRestante(null);
    }, 1000);
    return () => { evs.forEach((e) => window.removeEventListener(e, marcar)); window.clearInterval(id); };
  }, [ativo, restante]);

  return {
    segundosRestantes: restante,
    continuar: () => { ultima.current = Date.now(); setRestante(null); },
  };
}
