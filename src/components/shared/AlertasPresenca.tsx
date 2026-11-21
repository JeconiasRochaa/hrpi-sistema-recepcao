import { CheckCheck, CopyX, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { useData } from '@/context/DataContext';
import { agruparDuplicados, pendentesPresenca } from '@/lib/stats';
import { CONFIG } from '@/lib/constants';
import { confirmarPresencas } from '@/services/registros';
import { useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { registrarSaida } from '@/services/registros';

export function AlertasPresenca({ compacto }: { compacto?: boolean }) {
  const { presentes } = useData();
  const confirmar = useConfirm();
  const [aberto, setAberto] = useState(false);
  const pend = pendentesPresenca(presentes);
  const dup = agruparDuplicados(presentes);

  async function confirmarTodos() {
    if (!(await confirmar({ titulo: `Confirmar presença de ${pend.length} acompanhante(s)?`, descricao: 'Use apenas se você verificou que eles ainda estão no hospital.', confirmar: 'Confirmar presença' }))) return;
    try { await confirmarPresencas(pend.map((r) => r.id)); toast.success('Presença confirmada.'); } catch { toast.error('Não foi possível confirmar.'); }
  }
  if (!pend.length && !dup.length) return null;
  return (
    <div className="space-y-3">
      {pend.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <TriangleAlert className="h-5 w-5 shrink-0 text-warning" aria-hidden />
          <p className="min-w-0 flex-1 text-foreground/90"><strong>{pend.length}</strong> acompanhante{pend.length > 1 ? 's' : ''} há {CONFIG.DIAS_ALERTA_PRESENCA}+ dias sem confirmação de presença{compacto ? '' : ' — podem ter saído sem registro, o que afeta a contagem de refeições da nutrição'}.</p>
          <Button size="sm" variant="outline" onClick={confirmarTodos}><CheckCheck className="h-4 w-4" /> Confirmar todos</Button>
        </div>
      )}
      {dup.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
          <CopyX className="h-5 w-5 shrink-0 text-danger" aria-hidden />
          <p className="min-w-0 flex-1 text-foreground/90"><strong>{dup.length}</strong> paciente{dup.length > 1 ? 's' : ''} com mais de um acompanhante ativo ao mesmo tempo.</p>
          <Button size="sm" variant="danger" onClick={() => setAberto(true)}>Resolver agora</Button>
        </div>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent tamanho="md" titulo="Acompanhantes duplicados" descricao="Confirme quem realmente está no hospital e dê saída nos demais.">
          <DialogBody className="space-y-3">
            {dup.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma duplicidade restante.</p>}
            {dup.map((g) => (
              <div key={g[0].nomePaciente} className="rounded-lg border p-3">
                <p className="text-sm font-semibold">{g[0].nomePaciente} <span className="font-normal text-muted-foreground">— {g[0].setor}{g[0].leito ? ` • Leito ${g[0].leito}` : ''}</span></p>
                {g.map((r) => (
                  <div key={r.id} className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-[13px]">
                    <span>{r.nomeAcompanhante} <span className="text-muted-foreground">desde {r.dataEntrada.replaceAll('-', '/')} {r.horaEntrada.slice(0, 5)}</span></span>
                    <Button size="sm" variant="danger" onClick={async () => { try { await registrarSaida(r, 'Correção de acompanhante duplicado'); toast.success('Saída registrada.'); } catch { toast.error('Erro ao registrar saída.'); } }}>Dar saída</Button>
                  </div>
                ))}
              </div>
            ))}
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setAberto(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
