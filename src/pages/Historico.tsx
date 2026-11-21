import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, History, Pencil, Search, Trash2, UserRoundSearch } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Tip } from '@/components/ui/tooltip';
import { useConfirm } from '@/components/ui/confirm';
import { EmptyState, Paginacao, Table, THead, Td, Th, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Documento, StatusBadge, TipoBadge } from '@/components/shared/Badges';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useHistoricoCompleto } from '@/context/DataContext';
import { useDialogs } from '@/features/DialogsProvider';
import { baixarCsv } from '@/lib/csv';
import { exibirData, exibirDataHora, fimDoDia, inicioDoDia } from '@/lib/datetime';
import { podeFazer } from '@/lib/permissions';
import { agruparPorPaciente, filtrarPorEntrada, montarHistorico } from '@/lib/stats';
import { iniciais, mascararDocumento, normalizar } from '@/lib/text';
import { excluirRegistro } from '@/services/registros';
import { registrarLog } from '@/services/logs';
import { cn } from '@/lib/utils';
import type { Registro } from '@/types';

const POR_PAGINA = 25;

function Abas({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const abas = [['registros', 'Todos os registros'], ['pacientes', 'Por paciente (PDF)']];
  return (
    <div role="tablist" className="inline-flex rounded-lg bg-muted p-1">
      {abas.map(([k, r]) => (
        <button key={k} role="tab" aria-selected={valor === k} onClick={() => onChange(k)}
          className={cn('rounded-md px-4 py-1.5 text-[13px] font-medium transition-all', valor === k ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground')}>{r}</button>
      ))}
    </div>
  );
}

export default function Historico() {
  const [aba, setAba] = useState('registros');
  const { historicoPronto } = useHistoricoCompleto();
  return (
    <>
      <PageHeader titulo="Histórico" descricao="Todos os registros de acompanhantes e visitas" icone={<History className="h-5 w-5" />} acoes={<Abas valor={aba} onChange={setAba} />} />
      {aba === 'registros' ? <TabRegistros pronto={historicoPronto} /> : <TabPacientes pronto={historicoPronto} />}
    </>
  );
}

function useFiltroPeriodo() {
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  return { ini, fim, setIni, setFim, aplicar: (l: Registro[]) => (ini || fim ? filtrarPorEntrada(l, ini ? inicioDoDia(ini) : new Date(0), fim ? fimDoDia(fim) : new Date(8.64e15)) : l) };
}

function TabRegistros({ pronto }: { pronto: boolean }) {
  const { todos } = useHistoricoCompleto();
  const { perfil } = useAuth();
  const dlg = useDialogs();
  const confirmar = useConfirm();
  const per = useFiltroPeriodo();
  const [status, setStatus] = useState('');
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [pag, setPag] = useState(0);
  const lista = useMemo(() => {
    const t = normalizar(q);
    return per.aplicar(todos).filter((r) => (!status || r.status === status) && (!tipo || r.tipo === tipo) &&
      (!t || [r.nomeAcompanhante, r.documento, r.nomePaciente, r.setor, r.leito, r.parentesco, r.observacao].some((c) => normalizar(c).includes(t))));
  }, [todos, per.ini, per.fim, status, tipo, q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPag(0), [per.ini, per.fim, status, tipo, q]);
  const pode = podeFazer(perfil?.cargo, 'excluirRegistro');
  const podeExportar = podeFazer(perfil?.cargo, 'exportar');

  function exportar() {
    baixarCsv(`HRPI_Registros_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Tipo', 'Nome', 'Documento (mascarado)', 'Parentesco', 'Paciente', 'Setor', 'Leito', 'Data entrada', 'Hora entrada', 'Data saída', 'Hora saída', 'Status', 'Observação'],
      lista.map((r) => [r.tipo, r.nomeAcompanhante, mascararDocumento(r.documento), r.parentesco, r.nomePaciente, r.setor, r.leito, r.dataEntrada, r.horaEntrada, r.dataSaida, r.horaSaida, r.status, r.observacao]));
    void registrarLog('exportar', `Exportação CSV do histórico (${lista.length} registros).`);
    toast.success(`${lista.length} registro(s) exportado(s).`);
  }
  async function excluir(r: Registro) {
    if (!(await confirmar({ titulo: 'Excluir registro?', descricao: `O registro de ${r.nomeAcompanhante} será removido permanentemente.`, confirmar: 'Excluir', perigo: true }))) return;
    try { await excluirRegistro(r.id); toast.success('Registro excluído.'); } catch { toast.error('Sem permissão para excluir.'); }
  }
  const pagina = lista.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA);

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">De<Input type="date" value={per.ini} onChange={(e) => per.setIni(e.target.value)} className="w-40" /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Até<Input type="date" value={per.fim} onChange={(e) => per.setFim(e.target.value)} className="w-40" /></label>
        <div className="w-40"><Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Todos os status</option><option value="presente">Presente</option><option value="saiu">Saiu</option><option value="trocado">Trocado</option></Select></div>
        <div className="w-40"><Select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option><option value="acompanhante">Acompanhante</option><option value="visita">Visita</option></Select></div>
        <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, paciente, setor…" aria-label="Buscar" /></div>
        {podeExportar && <Tip texto="Documentos saem mascarados"><Button variant="outline" onClick={exportar} disabled={!lista.length}><FileSpreadsheet className="h-4 w-4" /> Exportar CSV</Button></Tip>}
      </div>
      {!pronto && todos.length < 1 ? <TableSkeleton colunas={8} linhas={10} /> : lista.length === 0 ? <EmptyState titulo="Nenhum registro encontrado" descricao="Ajuste os filtros." /> : (
        <>
          <Table>
            <THead><tr><Th>Tipo</Th><Th>Nome</Th><Th>Documento</Th><Th>Paciente</Th><Th>Setor / leito</Th><Th>Entrada</Th><Th>Saída</Th><Th>Situação</Th><Th className="text-right">Ações</Th></tr></THead>
            <tbody>
              {pagina.map((r) => (
                <Tr key={r.id}>
                  <Td><TipoBadge tipo={r.tipo} /></Td>
                  <Td className="min-w-[150px]"><button className="text-left font-semibold hover:text-primary" onClick={() => dlg.historicoPessoa(r.id)}>{r.nomeAcompanhante}</button><p className="text-xs text-muted-foreground">{r.parentesco}</p></Td>
                  <Td><Documento valor={r.documento} registroId={r.id} /></Td>
                  <Td className="min-w-[140px]"><button className="text-left font-medium text-primary hover:underline" onClick={() => dlg.historicoPaciente(r.nomePaciente)}>{r.nomePaciente}</button></Td>
                  <Td className="whitespace-nowrap">{r.setor}{r.leito ? <span className="text-muted-foreground"> · {r.leito}</span> : null}</Td>
                  <Td className="tabular whitespace-nowrap text-[13px]">{exibirDataHora(r.dataEntrada, r.horaEntrada)}</Td>
                  <Td className="tabular whitespace-nowrap text-[13px]">{r.dataSaida ? exibirDataHora(r.dataSaida, r.horaSaida) : '—'}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td><div className="flex justify-end gap-0.5">
                    <Tip texto="Histórico do paciente / PDF"><Button variant="ghost" size="icon" aria-label="Histórico do paciente" onClick={() => dlg.historicoPaciente(r.nomePaciente)}><History className="h-4 w-4" /></Button></Tip>
                    <Tip texto="Histórico da pessoa"><Button variant="ghost" size="icon" aria-label="Histórico da pessoa" onClick={() => dlg.historicoPessoa(r.id)}><UserRoundSearch className="h-4 w-4" /></Button></Tip>
                    <Tip texto="Editar"><Button variant="ghost" size="icon" aria-label="Editar" onClick={() => dlg.editar(r.id)}><Pencil className="h-4 w-4" /></Button></Tip>
                    {pode && <Tip texto="Excluir"><Button variant="ghost" size="icon" aria-label="Excluir" className="text-danger hover:bg-danger-soft" onClick={() => excluir(r)}><Trash2 className="h-4 w-4" /></Button></Tip>}
                  </div></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Paginacao pagina={pag} total={lista.length} porPagina={POR_PAGINA} onChange={setPag} />
        </>
      )}
    </Card>
  );
}

type Recebeu = '' | 'visita' | 'troca' | 'ambos' | 'qualquer';

function TabPacientes({ pronto }: { pronto: boolean }) {
  const { todos, config } = useHistoricoCompleto();
  const { perfil } = useAuth();
  const dlg = useDialogs();
  const per = useFiltroPeriodo();
  const [q, setQ] = useState('');
  const [recebeu, setRecebeu] = useState<Recebeu>('qualquer');
  const [pag, setPag] = useState(0);
  const [gerando, setGerando] = useState<string | null>(null);

  // 1) Agrupamento por paciente: uma passada, refeita só quando os dados ou o período mudam
  const grupos = useMemo(() => {
    const m = agruparPorPaciente(per.aplicar(todos));
    return [...m.values()].map((regs) => montarHistorico(regs[0].nomePaciente, regs));
  }, [todos, per.ini, per.fim]); // eslint-disable-line react-hooks/exhaustive-deps
  // 2) Filtros de texto/tipo: leves, rodam a cada tecla (com o texto "adiado" para a digitação não travar)
  const qAdiado = useDeferredValue(q);
  const pacientes = useMemo(() => {
    const t = normalizar(qAdiado);
    return grupos
      .filter((h) => !t || normalizar(h.paciente).includes(t))
      .filter((h) => {
        const v = h.totalVisitas > 0; const tr = h.totalTrocas > 0;
        return recebeu === 'qualquer' ? v || tr : recebeu === 'visita' ? v : recebeu === 'troca' ? tr : recebeu === 'ambos' ? v && tr : true;
      })
      .sort((a, b) => (b.eventos[0]?.ts ?? 0) - (a.eventos[0]?.ts ?? 0));
  }, [grupos, qAdiado, recebeu]);
  useEffect(() => setPag(0), [per.ini, per.fim, q, recebeu]);
  const pagina = pacientes.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA);
  const periodoTxt = per.ini || per.fim ? `${per.ini ? exibirData(per.ini.split('-').reverse().join('-')) : 'início'} a ${per.fim ? exibirData(per.fim.split('-').reverse().join('-')) : 'hoje'}` : undefined;

  async function pdf(lista: typeof pacientes, chave: string) {
    if (!lista.length) return;
    setGerando(chave);
    await new Promise((r) => setTimeout(r, 30)); // deixa o indicador de carregamento aparecer antes do trabalho pesado
    try {
      const { gerarPdfHistoricoPacientes } = await import('@/lib/pdf/historicoPaciente');
      await gerarPdfHistoricoPacientes(lista, { usuario: perfil?.nome ?? '', logo: config.logoHospital, periodo: periodoTxt });
      void registrarLog('exportar', lista.length === 1 ? `PDF de histórico do paciente ${iniciais(lista[0].paciente)} gerado.` : `PDF consolidado de histórico gerado (${lista.length} pacientes).`);
      toast.success(lista.length === 1 ? 'PDF gerado.' : `PDF com ${lista.length} pacientes gerado.`);
    } catch (e) { console.error(e); toast.error('Não foi possível gerar o PDF.'); } finally { setGerando(null); }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">De<Input type="date" value={per.ini} onChange={(e) => per.setIni(e.target.value)} className="w-40" /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Até<Input type="date" value={per.fim} onChange={(e) => per.setFim(e.target.value)} className="w-40" /></label>
        <div className="w-60"><Select value={recebeu} onChange={(e) => setRecebeu(e.target.value as Recebeu)} aria-label="Recebeu"><option value="qualquer">Recebeu visita e/ou troca</option><option value="visita">Só quem recebeu visita</option><option value="troca">Só quem teve troca</option><option value="ambos">Visita e troca</option></Select></div>
        <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paciente…" aria-label="Buscar paciente" /></div>
        <Button variant="outline" onClick={() => pdf(pacientes.slice(0, 200), 'todos')} loading={gerando === 'todos'} disabled={!pacientes.length}><FileDown className="h-4 w-4" /> PDF de todos ({Math.min(pacientes.length, 200)})</Button>
      </div>
      {!pronto && todos.length < 1 ? <TableSkeleton colunas={6} linhas={10} /> : pacientes.length === 0 ? <EmptyState titulo="Nenhum paciente encontrado" descricao="Nenhum paciente com visita ou troca de acompanhante no filtro escolhido." /> : (
        <>
          <Table>
            <THead><tr><Th>Paciente</Th><Th>Setor / leito</Th><Th className="text-center">Acompanhantes</Th><Th className="text-center">Visitas</Th><Th className="text-center">Trocas</Th><Th>Último movimento</Th><Th className="text-right">Ações</Th></tr></THead>
            <tbody>
              {pagina.map((h) => {
                const u = h.registros[0];
                return (
                  <Tr key={h.paciente}>
                    <Td><button className="text-left font-semibold hover:text-primary" onClick={() => dlg.historicoPaciente(h.paciente)}>{h.paciente}</button>{h.atual && <Badge tone="success" className="ml-2">acompanhado</Badge>}</Td>
                    <Td className="whitespace-nowrap">{u?.setor}{u?.leito ? <span className="text-muted-foreground"> · {u.leito}</span> : null}</Td>
                    <Td className="tabular text-center">{h.totalAcompanhantes}</Td>
                    <Td className="tabular text-center"><span className="font-semibold text-visit">{h.totalVisitas}</span></Td>
                    <Td className="tabular text-center"><span className="font-semibold text-warning">{h.totalTrocas}</span></Td>
                    <Td className="tabular whitespace-nowrap text-[13px] text-muted-foreground">{u ? exibirDataHora(u.dataEntrada, u.horaEntrada) : '—'}</Td>
                    <Td><div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => dlg.historicoPaciente(h.paciente)}><History className="h-4 w-4" /> Ver</Button>
                      <Button size="sm" variant="soft" onClick={() => pdf([h], h.paciente)} loading={gerando === h.paciente}><FileDown className="h-4 w-4" /> PDF</Button>
                    </div></Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <Paginacao pagina={pag} total={pacientes.length} porPagina={POR_PAGINA} onChange={setPag} />
        </>
      )}
    </Card>
  );
}
