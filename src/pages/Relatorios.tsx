import { useState } from 'react';
import { CalendarDays, CalendarRange, FileBarChart, FileDown, Hospital, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody } from '@/components/ui/card';
import { DualStat, PageHeader, SectionTitle } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { useHistoricoCompleto } from '@/context/DataContext';
import { dataHoje, fimDoDia, inicioDoDia } from '@/lib/datetime';
import { fimDeHoje, filtrarPorEntrada, inicioHoje, inicioMes, ultimosNDias } from '@/lib/stats';
import { SETORES } from '@/lib/constants';
import { registrarLog } from '@/services/logs';

type Tipo = 'Diário' | 'Semanal' | 'Mensal' | 'Personalizado';

export default function Relatorios() {
  const { todos, historicoPronto, config } = useHistoricoCompleto();
  const { perfil } = useAuth();
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  const [setor, setSetor] = useState('');
  const [gerando, setGerando] = useState<string | null>(null);

  const sem = filtrarPorEntrada(todos, ultimosNDias(7), fimDeHoje());
  const mes = filtrarPorEntrada(todos, inicioMes(), fimDeHoje());
  const cont = (l: typeof todos, t: string) => (historicoPronto ? l.filter((r) => r.tipo === t).length : '…');

  async function gerar(chave: string, titulo: Tipo, a: Date, b: Date, s?: string) {
    if (!historicoPronto) return toast.info('Aguarde o carregamento completo dos dados.');
    setGerando(chave);
    try {
      let dados = filtrarPorEntrada(todos, a, b);
      if (s) dados = dados.filter((r) => r.setor === s);
      if (!dados.length) { toast.error('Nenhum registro no período selecionado.'); return; }
      const { gerarRelatorioPdf } = await import('@/lib/pdf/relatorio');
      const f = (d: Date) => dataHoje(d).replaceAll('-', '/');
      await gerarRelatorioPdf({ titulo, periodoTxt: `${f(a)} a ${f(b)}`, dados, presentes: todos.filter((r) => r.status === 'presente'), setor: s, usuario: perfil?.nome ?? '', logo: config.logoHospital });
      void registrarLog('exportar', `Relatório ${titulo}${s ? ` do setor ${s}` : ''} gerado (${dados.length} registros).`);
      toast.success('PDF gerado com sucesso!');
    } catch (e) { console.error(e); toast.error('Erro ao gerar o relatório.'); } finally { setGerando(null); }
  }
  const personalizado = (s?: string) => {
    if (!ini || !fim) return toast.error('Selecione as datas inicial e final.');
    if (ini > fim) return toast.error('A data inicial deve ser anterior à final.');
    void gerar(s ? 'setor' : 'pers', 'Personalizado', inicioDoDia(ini), fimDoDia(fim), s);
  };
  const hoje = inicioHoje();

  const Cartao = ({ icone, titulo, desc, children }: { icone: React.ReactNode; titulo: string; desc: string; children: React.ReactNode }) => (
    <Card><CardBody className="flex h-full flex-col gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">{icone}</span>
      <div><h3 className="font-semibold">{titulo}</h3><p className="text-[13px] text-muted-foreground">{desc}</p></div><div className="mt-auto space-y-2 pt-1">{children}</div></CardBody></Card>
  );

  return (
    <>
      <PageHeader titulo="Relatórios em PDF" descricao="Gerar relatórios para impressão e repasse" icone={<FileBarChart className="h-5 w-5" />} />
      <SectionTitle>Totais do período</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <DualStat titulo="Últimos 7 dias" icone={<CalendarDays className="h-[18px] w-[18px]" />} esquerda={{ rotulo: 'Acompanhantes', valor: cont(sem, 'acompanhante') }} direita={{ rotulo: 'Visitantes', valor: cont(sem, 'visita') }} />
        <DualStat titulo="Mês atual" icone={<CalendarRange className="h-[18px] w-[18px]" />} esquerda={{ rotulo: 'Acompanhantes', valor: cont(mes, 'acompanhante') }} direita={{ rotulo: 'Visitantes', valor: cont(mes, 'visita') }} />
      </div>
      <SectionTitle>Gerar PDF</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Cartao icone={<Calendar className="h-5 w-5" />} titulo="Relatório diário" desc="Registros do dia atual"><Button className="w-full" loading={gerando === 'd'} onClick={() => gerar('d', 'Diário', hoje, fimDeHoje())}><FileDown className="h-4 w-4" /> Gerar PDF</Button></Cartao>
        <Cartao icone={<CalendarDays className="h-5 w-5" />} titulo="Relatório semanal" desc="Últimos 7 dias"><Button className="w-full" loading={gerando === 's'} onClick={() => gerar('s', 'Semanal', ultimosNDias(7), fimDeHoje())}><FileDown className="h-4 w-4" /> Gerar PDF</Button></Cartao>
        <Cartao icone={<CalendarRange className="h-5 w-5" />} titulo="Relatório mensal" desc="Mês atual, do dia 1 até hoje"><Button className="w-full" loading={gerando === 'm'} onClick={() => gerar('m', 'Mensal', inicioMes(), fimDeHoje())}><FileDown className="h-4 w-4" /> Gerar PDF</Button></Cartao>
        <Cartao icone={<CalendarRange className="h-5 w-5" />} titulo="Período personalizado" desc="Escolha as datas">
          <div className="grid grid-cols-2 gap-2"><Input type="date" aria-label="Data inicial" value={ini} onChange={(e) => setIni(e.target.value)} /><Input type="date" aria-label="Data final" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          <Button className="w-full" loading={gerando === 'pers'} onClick={() => personalizado()}><FileDown className="h-4 w-4" /> Gerar PDF</Button></Cartao>
        <Cartao icone={<Hospital className="h-5 w-5" />} titulo="Relatório por setor" desc="Só os dados do setor escolhido (usa o período acima; sem datas = mês atual)">
          <Select value={setor} onChange={(e) => setSetor(e.target.value)} aria-label="Setor"><option value="">Selecione o setor…</option>{SETORES.map((s) => <option key={s}>{s}</option>)}</Select>
          <Button className="w-full" disabled={!setor} loading={gerando === 'setor'} onClick={() => (ini && fim ? personalizado(setor) : gerar('setor', 'Mensal', inicioMes(), fimDeHoje(), setor))}><FileDown className="h-4 w-4" /> Gerar PDF</Button></Cartao>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Os PDFs mascaram documentos e contêm aviso de confidencialidade (LGPD). Cada geração é registrada na auditoria.</p>
    </>
  );
}
