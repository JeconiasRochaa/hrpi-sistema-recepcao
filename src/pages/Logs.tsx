import { useEffect, useMemo, useState } from 'react';
import { Activity, Search } from 'lucide-react';
import { get, limitToLast, orderByChild, query, ref } from 'firebase/database';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/form';
import { EmptyState, Paginacao, Table, THead, Td, Th, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { fimDoDia, formatarDataHoraTs, inicioDoDia } from '@/lib/datetime';
import { normalizar } from '@/lib/text';
import type { LogAuditoria } from '@/types';

const tom: Record<string, 'success' | 'neutral' | 'primary' | 'warning' | 'danger' | 'info' | 'visit'> = {
  login: 'success', logout: 'neutral', criar: 'primary', editar: 'info', excluir: 'danger', saida: 'warning', troca: 'warning', bloqueio: 'danger', usuario: 'visit', config: 'neutral', exportar: 'info', privacidade: 'visit', visualizacao: 'neutral',
};
const POR_PAGINA = 30;

export default function Logs() {
  const [logs, setLogs] = useState<LogAuditoria[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState(''); const [acao, setAcao] = useState(''); const [ini, setIni] = useState(''); const [fim, setFim] = useState(''); const [pag, setPag] = useState(0);

  useEffect(() => {
    get(query(ref(db, 'logs'), orderByChild('timestamp'), limitToLast(1500))).then((s) => {
      const v = (s.val() ?? {}) as Record<string, LogAuditoria>;
      setLogs(Object.values(v).sort((a, b) => b.timestamp - a.timestamp));
    }).catch((e) => { setErro((e as { code?: string }).code ?? (e as Error).message ?? 'erro'); setLogs([]); });
  }, []);

  const lista = useMemo(() => {
    const t = normalizar(q);
    return (logs ?? []).filter((l) => (!acao || l.acao === acao) && (!ini || l.timestamp >= inicioDoDia(ini).getTime()) && (!fim || l.timestamp <= fimDoDia(fim).getTime()) && (!t || normalizar(`${l.usuario} ${l.descricao}`).includes(t)));
  }, [logs, q, acao, ini, fim]);
  useEffect(() => setPag(0), [q, acao, ini, fim]);

  return (
    <>
      <PageHeader titulo="Logs de auditoria" descricao="Registro imutável das ações no sistema (últimos 1.500 eventos)" icone={<Activity className="h-5 w-5" />} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b p-4">
          <Input type="date" className="w-40" value={ini} onChange={(e) => setIni(e.target.value)} aria-label="De" />
          <Input type="date" className="w-40" value={fim} onChange={(e) => setFim(e.target.value)} aria-label="Até" />
          <div className="w-44"><Select value={acao} onChange={(e) => setAcao(e.target.value)} aria-label="Ação"><option value="">Todas as ações</option>{Object.keys(tom).map((a) => <option key={a}>{a}</option>)}</Select></div>
          <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Usuário ou descrição…" aria-label="Buscar" /></div>
        </div>
        {logs === null ? <TableSkeleton colunas={4} linhas={10} /> : lista.length === 0 ? <EmptyState titulo={erro ? 'Não foi possível ler os logs' : 'Nenhum log encontrado'} descricao={erro ? `Erro do banco: ${erro}. Publique as regras do arquivo database.rules.json (Realtime Database → Regras) e entre novamente.` : logs.length === 0 ? 'Ainda não há ações registradas. Elas aparecem aqui assim que alguém usar o sistema.' : 'Nada encontrado com esses filtros.'} /> : (
          <>
            <Table>
              <THead><tr><Th>Data / hora</Th><Th>Usuário</Th><Th>Ação</Th><Th>Descrição</Th><Th>Registro</Th></tr></THead>
              <tbody>{lista.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA).map((l) => (
                <Tr key={l.id}><Td className="tabular whitespace-nowrap text-[13px]">{formatarDataHoraTs(l.timestamp)}</Td><Td className="font-medium">{l.usuario}</Td><Td><Badge tone={tom[l.acao] ?? 'neutral'}>{l.acao}</Badge></Td><Td className="max-w-md text-[13px]">{l.descricao}</Td><Td className="font-mono text-[11px] text-muted-foreground">{l.registroId ? l.registroId.slice(-8) : '—'}</Td></Tr>))}</tbody>
            </Table>
            <Paginacao pagina={pag} total={lista.length} porPagina={POR_PAGINA} onChange={setPag} />
          </>
        )}
      </Card>
    </>
  );
}
