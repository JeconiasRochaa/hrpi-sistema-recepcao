import { useMemo, useState } from 'react';
import { FileDown, History, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, THead, Th, Td, Tr, EmptyState } from '@/components/ui/table';
import { useHistoricoCompleto } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { historicoDoPaciente } from '@/lib/stats';
import { exibirData, exibirDataHora } from '@/lib/datetime';
import { iniciais } from '@/lib/text';
import { registrarLog } from '@/services/logs';

const tomEvento = { Entrada: 'success', Saída: 'neutral', Troca: 'warning', 'Troca de acompanhante': 'warning' } as const;

export default function HistoricoPacienteDialog({ nomePaciente, onClose }: { nomePaciente: string; onClose: () => void }) {
  const { todos, historicoPronto, config } = useHistoricoCompleto();
  const { perfil } = useAuth();
  const [gerando, setGerando] = useState(false);
  const h = useMemo(() => historicoDoPaciente(todos, nomePaciente), [todos, nomePaciente]);

  async function gerarPdf() {
    setGerando(true);
    try {
      const { gerarPdfHistoricoPacientes } = await import('@/lib/pdf/historicoPaciente');
      await gerarPdfHistoricoPacientes([h], { usuario: perfil?.nome ?? '', logo: config.logoHospital });
      void registrarLog('exportar', `PDF de histórico do paciente ${iniciais(nomePaciente)} gerado.`);
      toast.success('PDF do histórico gerado.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível gerar o PDF.');
    } finally { setGerando(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent tamanho="xl" icone={<History className="h-5 w-5" />} titulo={`Histórico de ${nomePaciente}`} descricao="Acompanhantes, visitas e trocas registradas para este paciente.">
        <DialogBody className="space-y-5">
          {!historicoPronto && todos.length === 0 ? (
            <div className="space-y-3" role="status" aria-label="Carregando histórico"><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" /></div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ['Acompanhantes', h.totalAcompanhantes, 'text-primary'],
                  ['Visitas', h.totalVisitas, 'text-visit'],
                  ['Trocas', h.totalTrocas, 'text-warning'],
                  ['Acomp. diferentes', h.acompanhantesDistintos, ''],
                ].map(([r, v, c]) => (
                  <div key={r as string} className="rounded-lg border bg-muted/40 px-4 py-3">
                    <p className={`tabular text-2xl font-bold ${c}`}>{v}</p>
                    <p className="text-xs text-muted-foreground">{r}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-primary-soft/50 px-4 py-3 text-sm">
                <Users className="h-4 w-4 text-primary" aria-hidden />
                {h.atual ? <span>Acompanhado(a) por <strong>{h.atual.nomeAcompanhante}</strong> desde {exibirData(h.atual.dataEntrada)}.</span> : <span className="text-muted-foreground">Sem acompanhante presente no momento.</span>}
              </div>
              {!historicoPronto && <p className="text-xs text-muted-foreground">Carregando o restante do histórico…</p>}
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <THead><tr><Th>Data / hora</Th><Th>Tipo</Th><Th>Evento</Th><Th>Pessoa</Th><Th>Detalhes</Th></tr></THead>
                  <tbody>
                    {h.eventos.map((e, i) => (
                      <Tr key={`${e.registroId}-${i}`}>
                        <Td className="tabular whitespace-nowrap">{exibirDataHora(e.dataHora.split(' ')[0], e.dataHora.split(' ')[1])}</Td>
                        <Td>{e.tipo}</Td>
                        <Td><Badge tone={tomEvento[e.evento]}>{e.evento}</Badge></Td>
                        <Td className="font-medium">{e.pessoa}</Td>
                        <Td className="max-w-[320px] text-[13px] text-muted-foreground">{e.detalhe}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
                {h.eventos.length === 0 && <EmptyState titulo="Nenhum evento encontrado" />}
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={gerarPdf} loading={gerando} disabled={h.eventos.length === 0}><FileDown className="h-4 w-4" /> Gerar PDF do histórico</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
