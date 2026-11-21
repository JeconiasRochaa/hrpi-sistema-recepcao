import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const larguras = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

export function DialogContent({
  children, titulo, descricao, icone, tamanho = 'md', className, semFechar, onInteractOutside,
}: {
  children: ReactNode; titulo: ReactNode; descricao?: ReactNode; icone?: ReactNode; tamanho?: keyof typeof larguras; className?: string; semFechar?: boolean;
  onInteractOutside?: (e: Event) => void;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 animate-fade-in bg-slate-950/55 backdrop-blur-[3px]" />
      <D.Content
        onInteractOutside={onInteractOutside}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[min(90vh,820px)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-slide-up flex-col overflow-hidden rounded-xl border bg-popover shadow-pop focus:outline-none',
          larguras[tamanho], className,
        )}
      >
        <header className="flex items-start gap-3 border-b px-6 py-4">
          {icone && <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">{icone}</span>}
          <div className="min-w-0 flex-1">
            <D.Title className="text-base font-semibold leading-tight">{titulo}</D.Title>
            {descricao ? <D.Description className="mt-1 text-[13px] text-muted-foreground">{descricao}</D.Description> : <D.Description className="sr-only">{typeof titulo === 'string' ? titulo : 'Janela de diálogo'}</D.Description>}
          </div>
          {!semFechar && (
            <D.Close className="-mr-2 -mt-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Fechar">
              <X className="h-4 w-4" />
            </D.Close>
          )}
        </header>
        {children}
      </D.Content>
    </D.Portal>
  );
}

export const DialogBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)} {...p} />;
export const DialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <footer className={cn('flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-6 py-3.5', className)} {...p} />
);
