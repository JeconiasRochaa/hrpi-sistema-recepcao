import { useState } from 'react';
import { Ban, Plus, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { EmptyState, Table, THead, Td, Th, Tr } from '@/components/ui/table';
import { useConfirm } from '@/components/ui/confirm';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { SETORES } from '@/lib/constants';
import { bloqueioSchema, erros as extrairErros } from '@/lib/schemas';
import { criarBloqueio, removerBloqueio } from '@/services/bloqueios';

export default function Bloqueios() {
  const { bloqueios } = useData();
  const confirmar = useConfirm();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const f = useForm({ paciente: '', setor: '', leito: '', motivo: '' });
  const ativos = bloqueios.filter((b) => b.ativo).sort((a, b) => b.dataBloqueio.localeCompare(a.dataBloqueio));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const er = extrairErros(bloqueioSchema.safeParse(f.valores));
    if (Object.keys(er).length) return f.setErros(er);
    setSalvando(true);
    try { await criarBloqueio(f.valores); toast.success('Bloqueio registrado.'); setAberto(false); f.reset(); } catch { toast.error('Não foi possível registrar.'); } finally { setSalvando(false); }
  }
  async function remover(id: string, nome: string) {
    if (!(await confirmar({ titulo: 'Remover bloqueio?', descricao: `As visitas para ${nome} voltarão a ser permitidas.`, confirmar: 'Remover bloqueio' }))) return;
    try { await removerBloqueio(id); toast.success('Bloqueio removido.'); } catch { toast.error('Erro ao remover.'); }
  }

  return (
    <>
      <PageHeader titulo="Bloqueios de visita" descricao="Pacientes com visitas restritas" icone={<Ban className="h-5 w-5" />} acoes={<Button onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Novo bloqueio</Button>} />
      <Card>
        {ativos.length === 0 ? <EmptyState titulo="Nenhum bloqueio ativo" descricao="Os bloqueios criados aparecem aqui e impedem o registro de visitas." /> : (
          <Table>
            <THead><tr><Th>Paciente</Th><Th>Setor / leito</Th><Th>Motivo</Th><Th>Solicitante</Th><Th>Data</Th><Th className="text-right">Ações</Th></tr></THead>
            <tbody>{ativos.map((b) => (
              <Tr key={b.id}>
                <Td className="font-semibold">{b.paciente} <Badge tone="danger" className="ml-1">Bloqueado</Badge></Td>
                <Td>{b.setor || '—'}{b.leito ? ` · ${b.leito}` : ''}</Td>
                <Td className="max-w-xs text-[13px]">{b.motivo}</Td><Td>{b.solicitante}</Td><Td className="tabular whitespace-nowrap text-[13px]">{b.dataBloqueio.replaceAll('-', '/')}</Td>
                <Td className="text-right"><Button size="sm" variant="outline" onClick={() => remover(b.id, b.paciente)}><Unlock className="h-4 w-4" /> Remover</Button></Td>
              </Tr>))}</tbody>
          </Table>
        )}
      </Card>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent tamanho="md" titulo="Novo bloqueio de visita" icone={<Ban className="h-5 w-5" />}>
          <form onSubmit={salvar} className="flex min-h-0 flex-1 flex-col" noValidate>
            <DialogBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Paciente" required error={f.erros.paciente} className="sm:col-span-2">{(id) => <Input id={id} value={f.valores.paciente} onChange={(e) => f.set('paciente', e.target.value)} autoComplete="off" aria-invalid={!!f.erros.paciente} />}</Field>
              <Field label="Setor">{(id) => <Select id={id} value={f.valores.setor} onChange={(e) => f.set('setor', e.target.value)}><option value="">Selecione…</option>{SETORES.map((s) => <option key={s}>{s}</option>)}</Select>}</Field>
              <Field label="Leito">{(id) => <Input id={id} value={f.valores.leito} onChange={(e) => f.set('leito', e.target.value)} autoComplete="off" />}</Field>
              <Field label="Motivo" required error={f.erros.motivo} className="sm:col-span-2">{(id) => <Textarea id={id} value={f.valores.motivo} onChange={(e) => f.set('motivo', e.target.value)} maxLength={400} aria-invalid={!!f.erros.motivo} />}</Field>
            </DialogBody>
            <DialogFooter><Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button><Button type="submit" variant="danger" loading={salvando}>Bloquear visitas</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
