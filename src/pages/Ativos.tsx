import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Soup, History, IdCard, Pencil, Search, Trash2, UserRoundSearch, Users, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Tip } from '@/components/ui/tooltip';
import { useConfirm } from '@/components/ui/confirm';
import { EmptyState, Paginacao, Table, THead, Td, Th, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { TipoBadge, Documento } from '@/components/shared/Badges';
import { AlertasPresenca } from '@/components/shared/AlertasPresenca';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useDialogs } from '@/features/DialogsProvider';
import { CONFIG } from '@/lib/constants';
import { diasDesde, entradaTs, exibirDataHora, formatarDuracao } from '@/lib/datetime';
import { podeFazer } from '@/lib/permissions';
import { agruparDuplicados } from '@/lib/stats';
import { normalizar } from '@/lib/text';
import { confirmarPresencas, excluirRegistro } from '@/services/registros';
import type { Registro } from '@/types';

const POR_PAGINA = 25;

function Situacao({ r, agora }: { r: Registro; agora: number }) {
  if (r.tipo === 'visita' && r.duracaoVisita) {
    const rest = entradaTs(r) + r.duracaoVisita * 60_000 - agora;
    return rest > 0 ? <Badge tone="visit">{formatarDuracao(rest)} restantes</Badge> : <Badge tone="danger">Encerrando…</Badge>;
  }
  const dias = diasDesde(r.ultimaConfirmacao || r.dataEntrada);
  if (dias >= CONFIG.DIAS_ALERTA_PRESENCA)
    return (
      <Tip texto="Confirmar que ainda está no hospital">
        <button onClick={() => confirmarPresencas([r.id]).then(() => toast.success('Presença confirmada.'), () => toast.error('Erro ao confirmar.'))}
          className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning hover:brightness-95"><TriangleAlert className="h-3 w-3" /> Confirmar ({dias}d)</button>
      </Tip>
    );
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> OK ({dias === 0 ? 'hoje' : `${dias}d`})</span>;
}

export default function Ativos() {
  const { presentes, presentesPronto } = useData();
  const { perfil } = useAuth();
  const dlg = useDialogs();
  const confirmar = useConfirm();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [setor, setSetor] = useState('');
  const [pag, setPag] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setAgora(Date.now()), 15_000); return () => clearInterval(i); }, []);

  const dupPacientes = useMemo(() => new Set(agruparDuplicados(presentes).map((g) => normalizar(g[0].nomePaciente))), [presentes]);
  const setores = useMemo(() => [...new Set(presentes.map((r) => r.setor))].sort(), [presentes]);
  const lista = useMemo(() => {
    const t = normalizar(q);
    return presentes.filter((r) => (!tipo || r.tipo === tipo) && (!setor || r.setor === setor) && (!t || [r.nomeAcompanhante, r.nomePaciente, r.leito, r.documento].some((c) => normalizar(c).includes(t))));
  }, [presentes, q, tipo, setor]);
  useEffect(() => setPag(0), [q, tipo, setor]);
  const pagina = lista.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA);
  const pode = podeFazer(perfil?.cargo, 'excluirRegistro');

  async function excluir(r: Registro) {
    if (!(await confirmar({ titulo: 'Excluir registro?', descricao: `O registro de ${r.nomeAcompanhante} será removido permanentemente. Prefira registrar a saída quando a pessoa apenas saiu.`, confirmar: 'Excluir', perigo: true }))) return;
    try { await excluirRegistro(r.id); toast.success('Registro excluído.'); } catch { toast.error('Sem permissão para excluir.'); }
  }
  return (
    <>
      <PageHeader titulo="Acompanhantes ativos" descricao="Quem está no hospital agora" icone={<Users className="h-5 w-5" />}
        acoes={<Link to="/nutricao" className="inline-flex h-10 items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium shadow-sm hover:bg-muted"><Soup className="h-4 w-4" /> Lista para nutrição</Link>} />
      <div className="mb-4"><AlertasPresenca /></div>
      <Card>
        <div className="flex flex-wrap gap-3 border-b p-4">
          <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nome, paciente, leito…" aria-label="Filtrar" /></div>
          <div className="w-40"><Select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option><option value="acompanhante">Acompanhantes</option><option value="visita">Visitas</option></Select></div>
          <div className="w-48"><Select value={setor} onChange={(e) => setSetor(e.target.value)} aria-label="Setor"><option value="">Todos os setores</option>{setores.map((s) => <option key={s}>{s}</option>)}</Select></div>
        </div>
        {!presentesPronto ? <TableSkeleton colunas={7} /> : lista.length === 0 ? (
          <EmptyState titulo="Nenhum acompanhante ou visitante ativo" descricao={q || tipo || setor ? 'Ajuste os filtros para ver mais resultados.' : 'Quando houver entradas, elas aparecerão aqui em tempo real.'} />
        ) : (
          <>
            <Table>
              <THead><tr><Th>Tipo</Th><Th>Nome</Th><Th>Documento</Th><Th>Paciente</Th><Th>Setor / leito</Th><Th>Entrada</Th><Th>Situação</Th><Th className="text-right">Ações</Th></tr></THead>
              <tbody>
                {pagina.map((r) => {
                  const dup = r.tipo === 'acompanhante' && dupPacientes.has(normalizar(r.nomePaciente));
                  return (
                    <Tr key={r.id} className={dup ? 'bg-danger-soft/60' : ''}>
                      <Td><TipoBadge tipo={r.tipo} /></Td>
                      <Td><button className="text-left font-semibold hover:text-primary" onClick={() => dlg.historicoPessoa(r.id)}>{r.nomeAcompanhante}</button><p className="text-xs text-muted-foreground">{r.parentesco}</p></Td>
                      <Td><Documento valor={r.documento} registroId={r.id} /></Td>
                      <Td><button className="text-left font-medium text-primary hover:underline" onClick={() => dlg.historicoPaciente(r.nomePaciente)}>{r.nomePaciente}</button>{dup && <Badge tone="danger" className="ml-2">duplicado</Badge>}</Td>
                      <Td className="whitespace-nowrap">{r.setor}{r.leito ? <span className="text-muted-foreground"> · {r.leito}</span> : null}</Td>
                      <Td className="tabular whitespace-nowrap text-[13px]">{exibirDataHora(r.dataEntrada, r.horaEntrada)}</Td>
                      <Td><Situacao r={r} agora={agora} /></Td>
                      <Td>
                        <div className="flex justify-end gap-0.5">
                          <Tip texto="Histórico do paciente"><Button variant="ghost" size="icon" aria-label="Histórico do paciente" onClick={() => dlg.historicoPaciente(r.nomePaciente)}><History className="h-4 w-4" /></Button></Tip>
                          <Tip texto="Histórico da pessoa"><Button variant="ghost" size="icon" aria-label="Histórico da pessoa" onClick={() => dlg.historicoPessoa(r.id)}><UserRoundSearch className="h-4 w-4" /></Button></Tip>
                          <Tip texto="Editar"><Button variant="ghost" size="icon" aria-label="Editar" onClick={() => dlg.editar(r.id)}><Pencil className="h-4 w-4" /></Button></Tip>
                          <Tip texto="Crachá"><Button variant="ghost" size="icon" aria-label="Crachá" onClick={() => dlg.cracha(r.id)}><IdCard className="h-4 w-4" /></Button></Tip>
                          {pode && <Tip texto="Excluir"><Button variant="ghost" size="icon" aria-label="Excluir" className="text-danger hover:bg-danger-soft" onClick={() => excluir(r)}><Trash2 className="h-4 w-4" /></Button></Tip>}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <Paginacao pagina={pag} total={lista.length} porPagina={POR_PAGINA} onChange={setPag} />
          </>
        )}
      </Card>
    </>
  );
}
