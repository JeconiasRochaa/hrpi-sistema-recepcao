import { useMemo } from 'react';
import { UserRoundSearch } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, THead, Th, Td, Tr, EmptyState } from '@/components/ui/table';
import { StatusBadge, TipoBadge } from '@/components/shared/Badges';
import { Skeleton } from '@/components/ui/skeleton';
import { useHistoricoCompleto } from '@/context/DataContext';
import { historicoDaPessoa } from '@/lib/stats';
import { exibirDataHora } from '@/lib/datetime';
import { useDialogs } from './DialogsProvider';

export default function HistoricoPessoaDialog({ registroId, onClose }: { registroId: string; onClose: () => void }) {
  const { todos, historicoPronto, porId } = useHistoricoCompleto();
  const dlg = useDialogs();
  const base = porId(registroId);
  const lista = useMemo(() => (base ? historicoDaPessoa(todos, base) : []), [todos, base]);
  const pacientes = new Set(lista.map((r) => r.nomePaciente)).size;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent tamanho="lg" icone={<UserRoundSearch className="h-5 w-5" />} titulo={`Histórico de ${base?.nomeAcompanhante ?? ''}`} descricao="Todas as passagens desta pessoa como acompanhante ou visitante.">
        <DialogBody className="space-y-4">
          {!base || (!historicoPronto && lista.length === 0) ? <Skeleton className="h-48 w-full" /> : (
            <>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{lista.length}</strong> registro(s) • <strong className="text-foreground">{pacientes}</strong> paciente(s) diferente(s) •{' '}
                {lista.filter((r) => r.tipo === 'acompanhante').length} como acompanhante • {lista.filter((r) => r.tipo === 'visita').length} como visitante
              </p>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <THead><tr><Th>Tipo</Th><Th>Paciente</Th><Th>Setor</Th><Th>Entrada</Th><Th>Saída</Th><Th>Situação</Th></tr></THead>
                  <tbody>
                    {lista.map((r) => (
                      <Tr key={r.id}>
                        <Td><TipoBadge tipo={r.tipo} /></Td>
                        <Td><button className="font-semibold text-primary hover:underline" onClick={() => { onClose(); dlg.historicoPaciente(r.nomePaciente); }}>{r.nomePaciente}</button></Td>
                        <Td>{r.setor}{r.leito ? ` / Leito ${r.leito}` : ''}</Td>
                        <Td className="tabular whitespace-nowrap">{exibirDataHora(r.dataEntrada, r.horaEntrada)}</Td>
                        <Td className="tabular whitespace-nowrap">{r.dataSaida ? exibirDataHora(r.dataSaida, r.horaSaida) : '—'}</Td>
                        <Td><StatusBadge status={r.status} /></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
                {lista.length === 0 && <EmptyState titulo="Nenhum registro encontrado" />}
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
