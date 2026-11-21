import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from './dialog';

interface Opcoes {
  titulo: string;
  descricao?: ReactNode;
  confirmar?: string;
  cancelar?: string;
  perigo?: boolean;
}
type Fn = (o: Opcoes) => Promise<boolean>;
const Ctx = createContext<Fn | null>(null);

/** Substitui o `confirm()` nativo por um modal acessível: `if (await confirmar({...})) ...` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [op, setOp] = useState<Opcoes | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback<Fn>((o) => new Promise((res) => { resolver.current = res; setOp(o); }), []);
  const fechar = (v: boolean) => { resolver.current?.(v); resolver.current = null; setOp(null); };

  return (
    <Ctx.Provider value={confirmar}>
      {children}
      <Dialog open={!!op} onOpenChange={(a) => { if (!a) fechar(false); }}>
        {op && (
          <DialogContent
            tamanho="sm"
            titulo={op.titulo}
            icone={op.perigo ? <AlertTriangle className="h-5 w-5 text-danger" /> : <HelpCircle className="h-5 w-5" />}
            semFechar
          >
            {op.descricao && <DialogBody className="text-sm text-muted-foreground">{op.descricao}</DialogBody>}
            <DialogFooter>
              <Button variant="outline" onClick={() => fechar(false)}>{op.cancelar ?? 'Cancelar'}</Button>
              <Button variant={op.perigo ? 'danger' : 'primary'} onClick={() => fechar(true)} autoFocus>{op.confirmar ?? 'Confirmar'}</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConfirm fora do ConfirmProvider');
  return c;
}
