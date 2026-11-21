import { useMemo, useState } from 'react';
import { CircleCheck, LogOut, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input } from '@/components/ui/form';
import { EmptyState, Table, THead, Td, Th, Tr } from '@/components/ui/table';
import { useConfirm } from '@/components/ui/confirm';
import { TipoBadge } from '@/components/shared/Badges';
import { useData } from '@/context/DataContext';
import { entradaTs, exibirDataHora, formatarDuracao } from '@/lib/datetime';
import { registrarSaidaLote } from '@/services/registros';

export default function Diagnostico() {
  const { presentes } = useData();
  const confirmar = useConfirm();
  const [limDias, setLimDias] = useState('15'); const [limHoras, setLimHoras] = useState('2');
  const [motivo, setMotivo] = useState('Correção de registro — saída não computada no sistema');
  const [rodou, setRodou] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);

  const suspeitos = useMemo(() => {
    if (!rodou) return [];
    const agora = Date.now();
    const d = parseFloat(limDias) || 15; const h = parseFloat(limHoras) || 2;
    return presentes.filter((r) => { const hs = (agora - entradaTs(r)) / 3.6e6; return r.tipo === 'acompanhante' ? hs > d * 24 : hs > h; }).sort((a, b) => entradaTs(a) - entradaTs(b));
  }, [rodou, presentes, limDias, limHoras]);

  async function baixa(ids: string[]) {
    const regs = presentes.filter((r) => ids.includes(r.id));
    if (!regs.length || !(await confirmar({ titulo: `Registrar saída de ${regs.length} registro(s)?`, descricao: `Motivo: “${motivo}”. Esta ação é registrada na auditoria.`, confirmar: 'Registrar saída', perigo: true }))) return;
    setOcupado(true);
    try { await registrarSaidaLote(regs, motivo.trim() || 'Correção de registro'); toast.success(`Saída registrada para ${regs.length} registro(s).`); setMarcados(new Set()); } catch { toast.error('Erro ao registrar saída.'); } finally { setOcupado(false); }
  }

  return (
    <>
      <PageHeader titulo="Diagnóstico de dados" descricao="Encontra registros ‘presente’ há tempo demais (provável saída esquecida)" icone={<Stethoscope className="h-5 w-5" />} />
      <Card className="mb-4"><CardBody className="flex flex-wrap items-end gap-4">
        <Field label="Acompanhante presente há mais de (dias)">{(id) => <Input id={id} type="number" min={1} className="w-40" value={limDias} onChange={(e) => setLimDias(e.target.value)} />}</Field>
        <Field label="Visitante presente há mais de (horas)">{(id) => <Input id={id} type="number" min={1} className="w-40" value={limHoras} onChange={(e) => setLimHoras(e.target.value)} />}</Field>
        <Button onClick={() => { setRodou(true); setMarcados(new Set()); }}><Stethoscope className="h-4 w-4" /> Analisar</Button>
      </CardBody></Card>
      {rodou && (
        <Card>
          {suspeitos.length === 0 ? <EmptyState icone={<CircleCheck className="h-5 w-5 text-success" />} titulo="Tudo certo!" descricao="Nenhum registro suspeito com estes limites." /> : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
                <div><p className="font-semibold"><Badge tone="danger">{suspeitos.length}</Badge> registro(s) suspeito(s)</p></div>
                <div className="flex flex-wrap items-end gap-3"><Field label="Motivo da saída em lote">{(id) => <Input id={id} className="w-80" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} />}</Field>
                  <Button variant="danger" disabled={!marcados.size} loading={ocupado} onClick={() => baixa([...marcados])}><LogOut className="h-4 w-4" /> Dar saída nos selecionados ({marcados.size})</Button></div>
              </div>
              <Table>
                <THead><tr><Th><input type="checkbox" aria-label="Selecionar todos" checked={marcados.size === suspeitos.length} onChange={(e) => setMarcados(e.target.checked ? new Set(suspeitos.map((r) => r.id)) : new Set())} /></Th><Th>Tipo</Th><Th>Nome</Th><Th>Paciente</Th><Th>Setor</Th><Th>Entrada</Th><Th>Tempo</Th><Th /></tr></THead>
                <tbody>{suspeitos.map((r) => (
                  <Tr key={r.id}><Td><input type="checkbox" aria-label={`Selecionar ${r.nomeAcompanhante}`} checked={marcados.has(r.id)} onChange={(e) => setMarcados((m) => { const n = new Set(m); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} /></Td>
                    <Td><TipoBadge tipo={r.tipo} /></Td><Td className="font-medium">{r.nomeAcompanhante}</Td><Td>{r.nomePaciente}</Td><Td>{r.setor}</Td><Td className="tabular whitespace-nowrap text-[13px]">{exibirDataHora(r.dataEntrada, r.horaEntrada)}</Td>
                    <Td><Badge tone="danger">{formatarDuracao(Date.now() - entradaTs(r))}</Badge></Td><Td className="text-right"><Button size="sm" variant="outline" onClick={() => baixa([r.id])}>Dar saída</Button></Td></Tr>))}</tbody>
              </Table>
            </>
          )}
        </Card>
      )}
    </>
  );
}
