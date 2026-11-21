import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tip } from '@/components/ui/tooltip';
import { mascararDocumento, limparLegado } from '@/lib/text';
import { registrarLog } from '@/services/logs';
import type { Registro } from '@/types';

export function TipoBadge({ tipo }: { tipo: Registro['tipo'] }) {
  return tipo === 'visita' ? <Badge tone="visit">Visita</Badge> : <Badge tone="primary">Acomp.</Badge>;
}

export function StatusBadge({ status }: { status: Registro['status'] }) {
  if (status === 'presente') return <Badge tone="success" dot>Presente</Badge>;
  if (status === 'trocado') return <Badge tone="warning" dot>Trocado</Badge>;
  return <Badge tone="neutral" dot>Saiu</Badge>;
}

/**
 * Documento mascarado por padrão (minimização de dados — LGPD).
 * Ao revelar, a ação é registrada na auditoria e o valor volta a ser ocultado após 20 s.
 */
export function Documento({ valor, registroId }: { valor?: string | null; registroId?: string }) {
  const [vis, setVis] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const v = limparLegado(valor);
  if (!v) return <span className="text-muted-foreground">—</span>;
  const alternar = () => {
    if (!vis) {
      void registrarLog('visualizacao', 'Documento de identificação exibido.', registroId);
      timer.current = window.setTimeout(() => setVis(false), 20_000);
    } else window.clearTimeout(timer.current);
    setVis((x) => !x);
  };
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="tabular font-mono text-[12.5px]">{vis ? v : mascararDocumento(v)}</span>
      <Tip texto={vis ? 'Ocultar documento' : 'Mostrar documento (registrado em auditoria)'}>
        <button onClick={alternar} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={vis ? 'Ocultar documento' : 'Mostrar documento'}>
          {vis ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </Tip>
    </span>
  );
}
