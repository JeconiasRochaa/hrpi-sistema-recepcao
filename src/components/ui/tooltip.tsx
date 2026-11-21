import * as T from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <T.Provider delayDuration={250} skipDelayDuration={150}>{children}</T.Provider>
);

/** Tooltip moderno: <Tip texto="Ver histórico"><Button/></Tip> */
export function Tip({ texto, atalho, children, lado = 'top' }: { texto: ReactNode; atalho?: string; children: ReactNode; lado?: 'top' | 'right' | 'bottom' | 'left' }) {
  if (!texto) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={lado}
          sideOffset={6}
          className="z-[60] flex max-w-xs animate-fade-in items-center gap-2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-50 shadow-pop dark:bg-slate-100 dark:text-slate-900"
        >
          {texto}
          {atalho && <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-900/15">{atalho}</kbd>}
          <T.Arrow className="fill-slate-900 dark:fill-slate-100" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
