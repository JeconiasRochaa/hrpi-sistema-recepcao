import { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Search, Soup, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { baixarCsv } from '@/lib/csv';
import { dataHoje, exibirDataHora } from '@/lib/datetime';
import { agruparNutricao, totalNutricao } from '@/lib/nutricao';
import { registrarLog } from '@/services/logs';
import { cn } from '@/lib/utils';

/** Lista para a nutrição: acompanhantes presentes por setor e leito, atualizada em tempo real. */
export default function Nutricao() {
  const { presentes, presentesPronto, config } = useData();
  const { perfil } = useAuth();
  const [q, setQ] = useState('');
  const [setor, setSetor] = useState('');
  const [gerando, setGerando] = useState(false);

  const todos = useMemo(() => agruparNutricao(presentes), [presentes]);
  const grupos = useMemo(() => agruparNutricao(presentes, q, setor), [presentes, q, setor]);
  const total = totalNutricao(todos);

  async function pdf() {
    if (!grupos.length) return toast.error('Nenhum acompanhante para listar.');
    setGerando(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const { gerarPdfNutricao } = await import('@/lib/pdf/nutricao');
      await gerarPdfNutricao(grupos, { usuario: perfil?.nome ?? '', logo: config.logoHospital });
      void registrarLog('exportar', `Lista para a nutrição exportada em PDF (${totalNutricao(grupos)} acompanhantes).`);
      toast.success('PDF gerado.');
    } catch (e) { console.error(e); toast.error('Não foi possível gerar o PDF.'); } finally { setGerando(false); }
  }
  function csv() {
    if (!grupos.length) return toast.error('Nenhum acompanhante para listar.');
    baixarCsv(`HRPI_Lista_Nutricao_${dataHoje()}.csv`, ['Setor', 'Leito', 'Paciente', 'Acompanhante', 'Parentesco', 'Desde'],
      grupos.flatMap((g) => g.itens.map((r) => [g.setor, r.leito || '-', r.nomePaciente, r.nomeAcompanhante, r.parentesco || '-', exibirDataHora(r.dataEntrada, r.horaEntrada)])));
    void registrarLog('exportar', `Lista para a nutrição exportada em CSV (${totalNutricao(grupos)} acompanhantes).`);
    toast.success('Planilha exportada.');
  }

  return (
    <>
      <PageHeader titulo="Lista para a nutrição" descricao="Acompanhantes presentes agora, por setor e leito" icone={<Soup className="h-5 w-5" />}
        acoes={<>
          <Button variant="outline" onClick={csv} disabled={!grupos.length}><FileSpreadsheet className="h-4 w-4" /> Planilha (CSV)</Button>
          <Button onClick={pdf} loading={gerando} disabled={!grupos.length}><FileDown className="h-4 w-4" /> Gerar PDF para imprimir</Button>
        </>} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 shadow-card"><Users className="h-5 w-5 text-primary" aria-hidden /><span className="tabular text-2xl font-bold">{presentesPronto ? total : '…'}</span><span className="text-sm text-muted-foreground">acompanhantes<br />em {todos.length} setor{todos.length === 1 ? '' : 'es'}</span></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por setor">
          <button onClick={() => setSetor('')} className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', !setor ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}>Todos</button>
          {todos.map((g) => (
            <button key={g.setor} onClick={() => setSetor(setor === g.setor ? '' : g.setor)} className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', setor === g.setor ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}>
              {g.setor} <span className={cn('ml-1 rounded-full px-1.5 text-xs font-bold', setor === g.setor ? 'bg-white/25' : 'bg-primary-soft text-primary')}>{g.itens.length}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full min-w-[220px] sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paciente, acompanhante, leito…" aria-label="Buscar" /></div>
      </div>

      {!presentesPronto ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
        : grupos.length === 0 ? <Card><EmptyState titulo="Nenhum acompanhante" descricao={q || setor ? 'Nada encontrado com esse filtro.' : 'Não há acompanhantes presentes no momento.'} /></Card>
        : (
          <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {grupos.map((g) => (
              <Card key={g.setor} className="overflow-hidden">
                <div className="flex items-center justify-between bg-primary px-5 py-3 text-primary-foreground">
                  <h2 className="text-[15px] font-bold">{g.setor}</h2>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{g.itens.length} acompanhante{g.itens.length === 1 ? '' : 's'}</span>
                </div>
                <ul className="divide-y">
                  {g.itens.map((r) => (
                    <li key={r.id} className="flex items-center gap-4 px-5 py-3">
                      <span className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-primary-soft px-2 text-base font-extrabold text-primary" title="Leito">{r.leito || '—'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{r.nomeAcompanhante}{r.parentesco && <span className="ml-2 text-xs font-medium text-muted-foreground">{r.parentesco}</span>}</p>
                        <p className="truncate text-sm text-muted-foreground">Paciente: <span className="font-medium text-foreground/80">{r.nomePaciente}</span></p>
                      </div>
                      <span className="shrink-0 text-right text-xs text-muted-foreground">desde<br /><span className="tabular font-medium text-foreground/80">{exibirDataHora(r.dataEntrada, r.horaEntrada)}</span></span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
    </>
  );
}
