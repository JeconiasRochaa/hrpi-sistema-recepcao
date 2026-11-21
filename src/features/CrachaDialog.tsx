import { HeartPulse, Printer } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/DataContext';
import { HOSPITAL_NOME, SISTEMA_NOME } from '@/lib/constants';
import { exibirDataHora } from '@/lib/datetime';
import { registrarLog } from '@/services/logs';

export default function CrachaDialog({ registroId, onClose }: { registroId: string; onClose: () => void }) {
  const { porId, config } = useData();
  const r = porId(registroId);
  if (!r) return null;
  const visita = r.tipo === 'visita';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent tamanho="sm" titulo="Crachá de identificação" descricao="Confira os dados e imprima.">
        <DialogBody className="bg-muted/40">
          <div className="print-area mx-auto w-[320px] overflow-hidden rounded-xl border bg-white text-slate-900 shadow-card">
            <div className={`h-2 ${visita ? 'bg-violet-600' : 'bg-blue-700'}`} />
            <div className="flex flex-col items-center px-5 pb-5 pt-4 text-center">
              {config.logoHospital ? <img src={config.logoHospital} alt="" className="h-14 object-contain" /> : <HeartPulse className="h-12 w-12 text-blue-700" aria-hidden />}
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-blue-800">{HOSPITAL_NOME}</p>
              <p className="text-[10px] text-slate-500">{SISTEMA_NOME}</p>
              <p className="mt-4 text-xl font-extrabold leading-tight">{r.nomeAcompanhante}</p>
              <span className={`mt-2 rounded-full px-3 py-0.5 text-[11px] font-bold tracking-wider ${visita ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{visita ? 'VISITANTE' : 'ACOMPANHANTE'}</span>
              <dl className="mt-4 grid w-full grid-cols-2 gap-x-3 gap-y-2 text-left text-xs">
                <div className="col-span-2"><dt className="text-[10px] font-semibold uppercase text-slate-400">Paciente</dt><dd className="font-semibold">{r.nomePaciente}</dd></div>
                <div><dt className="text-[10px] font-semibold uppercase text-slate-400">Setor</dt><dd className="font-semibold">{r.setor}</dd></div>
                <div><dt className="text-[10px] font-semibold uppercase text-slate-400">Leito</dt><dd className="font-semibold">{r.leito || '—'}</dd></div>
                <div className="col-span-2"><dt className="text-[10px] font-semibold uppercase text-slate-400">Entrada</dt><dd className="font-semibold">{exibirDataHora(r.dataEntrada, r.horaEntrada)}</dd></div>
              </dl>
              <p className="mt-4 font-mono text-[9px] text-slate-400">ID {r.id.slice(-10).toUpperCase()}</p>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => { window.print(); void registrarLog('exportar', 'Crachá impresso.', r.id); }}><Printer className="h-4 w-4" /> Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
