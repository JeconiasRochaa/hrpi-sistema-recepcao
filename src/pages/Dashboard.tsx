import { useMemo, type ReactNode } from 'react';
import { Activity, CalendarCheck, Clock3, DoorClosed, DoorOpen, HeartHandshake, Lightbulb, Repeat, TrendingUp, UserCheck, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader } from '@/components/ui/card';
import { DualStat, PageHeader, SectionTitle, StatCard } from '@/components/ui/page';
import { ChartSkeleton, StatSkeleton } from '@/components/ui/skeleton';
import { AlertasPresenca } from '@/components/shared/AlertasPresenca';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { podeFazer } from '@/lib/permissions';
import { dataHoje, nomeDoMes } from '@/lib/datetime';
import { fimDeHoje, filtrarPorEntrada, gerarInsights, inicioMes, permanenciaMediaHoras, permanenciaPorSetor, porHora, presentesPorSetor, rankingSetores, resumoHoje, serieDiaria } from '@/lib/stats';

const C = { acomp: 'hsl(var(--primary))', visit: 'hsl(var(--visit))', warn: 'hsl(var(--warning))', danger: 'hsl(var(--danger))', ok: 'hsl(var(--success))', info: 'hsl(var(--info))' };
const PALETA = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--visit))', 'hsl(var(--danger))', 'hsl(var(--info))', '#a16207', '#475569', '#be185d'];
const eixo = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

const Dica = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) =>
  active && payload?.length ? (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => <p key={p.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}: <strong className="tabular">{p.value}</strong></p>)}
    </div>
  ) : null;

function ChartCard({ titulo, descricao, pronto, children, className }: { titulo: string; descricao?: string; pronto: boolean; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={titulo} description={descricao} />
      {pronto ? <div className="h-[270px] px-3 pb-3 pt-4">{children}</div> : <ChartSkeleton />}
    </Card>
  );
}

export default function Dashboard() {
  const { perfil } = useAuth();
  const { presentes, presentesPronto, todos, historicoPronto } = useData();
  const gestor = podeFazer(perfil?.cargo, 'indicadores');
  const hoje = useMemo(() => resumoHoje(todos, presentes, dataHoje()), [todos, presentes]);
  const mes = useMemo(() => (historicoPronto ? filtrarPorEntrada(todos, inicioMes(), fimDeHoje()) : []), [todos, historicoPronto]);

  const g = useMemo(() => {
    if (!historicoPronto || !gestor) return null;
    return {
      semanal: (() => {
        const a = serieDiaria(todos, 7, (r, d) => r.dataEntrada === d && r.tipo === 'acompanhante');
        const v = serieDiaria(todos, 7, (r, d) => r.dataEntrada === d && r.tipo === 'visita');
        return a.map((x, i) => ({ dia: x.rotulo, Acompanhantes: x.valor, Visitantes: v[i].valor }));
      })(),
      setores: presentesPorSetor(presentes),
      tendencia: serieDiaria(todos, 30, (r, d) => r.dataEntrada === d && r.tipo === 'visita').map((x) => ({ dia: x.rotulo, Visitas: x.valor })),
      trocas: serieDiaria(todos, 7, (r, d) => r.dataSaida === d && r.status === 'trocado').map((x) => ({ dia: x.rotulo, Trocas: x.valor })),
      horas: porHora(mes).slice(6, 23),
      ranking: rankingSetores(mes),
      perm: permanenciaPorSetor(mes),
      insights: gerarInsights(mes, presentes, todos),
      permMedia: permanenciaMediaHoras(mes),
      mediaVisitas: mes.filter((r) => r.tipo === 'visita').length / new Date().getDate(),
      entradasMes: mes.length,
      trocasMes: mes.filter((r) => r.status === 'trocado').length,
    };
  }, [todos, presentes, mes, historicoPronto, gestor]);

  const dif = hoje.presentesAcomp - hoje.pacientesAcompanhados;

  return (
    <>
      <PageHeader titulo="Painel gerencial" descricao={`Visão geral • ${nomeDoMes()}`} icone={<Activity className="h-5 w-5" />} />
      <div className="mb-6"><AlertasPresenca /></div>

      <SectionTitle>Presença agora</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!presentesPronto ? <><StatSkeleton /><StatSkeleton /><StatSkeleton /></> : <>
          <StatCard titulo="Acompanhantes presentes" valor={hoje.presentesAcomp} icone={<Users className="h-[18px] w-[18px]" />} tom="primary"
            sub={dif > 0 ? `para ${hoje.pacientesAcompanhados} pacientes (${dif} duplicado${dif > 1 ? 's' : ''})` : `para ${hoje.pacientesAcompanhados} paciente${hoje.pacientesAcompanhados !== 1 ? 's' : ''}`} alerta={dif > 0} />
          <StatCard titulo="Visitantes presentes" valor={hoje.presentesVisit} icone={<UserCheck className="h-[18px] w-[18px]" />} tom="visit" sub="Saída automática em 1 hora" />
          <StatCard titulo="Pacientes acompanhados" valor={hoje.pacientesAcompanhados} icone={<HeartHandshake className="h-[18px] w-[18px]" />} tom="success" sub="Com acompanhante ativo" />
        </>}
      </div>

      <SectionTitle>Movimentação de hoje</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!historicoPronto ? <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></> : <>
          <DualStat titulo="Entradas" icone={<DoorOpen className="h-[18px] w-[18px]" />} esquerda={{ rotulo: 'Acompanhantes', valor: hoje.entradasAcomp }} direita={{ rotulo: 'Visitantes', valor: hoje.entradasVisit }} />
          <DualStat titulo="Saídas" icone={<DoorClosed className="h-[18px] w-[18px]" />} tom="danger" esquerda={{ rotulo: 'Acompanhantes', valor: hoje.saidasAcomp }} direita={{ rotulo: 'Visitantes', valor: hoje.saidasVisit }} />
          <StatCard titulo="Trocas de acompanhante" valor={hoje.trocas} icone={<Repeat className="h-[18px] w-[18px]" />} tom="warning" />
          <StatCard titulo="Altas de pacientes" valor={hoje.altas} icone={<CalendarCheck className="h-[18px] w-[18px]" />} tom="info" sub="Saídas por alta" />
        </>}
      </div>

      {gestor && (
        <>
          <SectionTitle>Indicadores do mês</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {!g ? <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></> : <>
              <StatCard titulo="Média diária de visitas" valor={g.mediaVisitas.toFixed(1).replace('.', ',')} icone={<TrendingUp className="h-[18px] w-[18px]" />} tom="visit" sub="Dia 1 até hoje" />
              <StatCard titulo="Permanência média" valor={g.permMedia >= 48 ? `${(g.permMedia / 24).toFixed(1).replace('.', ',')} d` : `${g.permMedia.toFixed(1).replace('.', ',')} h`} icone={<Clock3 className="h-[18px] w-[18px]" />} tom="info" sub="Acompanhantes com saída" />
              <StatCard titulo="Registros no mês" valor={g.entradasMes} icone={<DoorOpen className="h-[18px] w-[18px]" />} tom="primary" sub="Acompanhantes e visitantes" />
              <StatCard titulo="Trocas no mês" valor={g.trocasMes} icone={<Repeat className="h-[18px] w-[18px]" />} tom="warning" sub="Substituições de acompanhante" />
            </>}
          </div>

          <SectionTitle>Análises</SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard titulo="Entradas da semana por tipo" descricao="Últimos 7 dias" pronto={!!g}>
              <ResponsiveContainer><BarChart data={g?.semanal}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="dia" tick={eixo} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} width={28} /><Tooltip content={<Dica />} cursor={{ fill: 'hsl(var(--muted))' }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Acompanhantes" fill={C.acomp} radius={[4, 4, 0, 0]} /><Bar dataKey="Visitantes" fill={C.visit} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </ChartCard>

            <ChartCard titulo="Acompanhantes por setor" descricao="Presentes agora" pronto={!!g}>
              <div className="flex h-full items-center gap-4">
                <div className="h-full w-1/2"><ResponsiveContainer><PieChart><Pie data={g?.setores} dataKey="qtd" nameKey="setor" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none">{g?.setores.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}</Pie><Tooltip formatter={(v: number, n: string) => [v, n]} /></PieChart></ResponsiveContainer></div>
                <ul className="w-1/2 space-y-1.5 overflow-y-auto pr-1 text-[13px]">{g?.setores.map((s, i) => <li key={s.setor} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETA[i % PALETA.length] }} /><span className="flex-1 truncate">{s.setor}</span><span className="tabular font-semibold">{s.qtd}</span><span className="tabular w-11 text-right text-xs text-muted-foreground">{s.pct.toFixed(0)}%</span></li>)}</ul>
              </div>
            </ChartCard>

            <ChartCard titulo="Tendência de visitas" descricao="Últimos 30 dias" pronto={!!g}>
              <ResponsiveContainer><AreaChart data={g?.tendencia}><defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.visit} stopOpacity={0.35} /><stop offset="100%" stopColor={C.visit} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="dia" tick={eixo} axisLine={false} tickLine={false} interval={4} /><YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} width={28} /><Tooltip content={<Dica />} />
                <Area dataKey="Visitas" stroke={C.visit} strokeWidth={2} fill="url(#gv)" type="monotone" /></AreaChart></ResponsiveContainer>
            </ChartCard>

            <ChartCard titulo="Trocas de acompanhante" descricao="Últimos 7 dias" pronto={!!g}>
              <ResponsiveContainer><BarChart data={g?.trocas}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="dia" tick={eixo} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} width={28} /><Tooltip content={<Dica />} cursor={{ fill: 'hsl(var(--muted))' }} /><Bar dataKey="Trocas" fill={C.warn} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </ChartCard>

            <ChartCard titulo="Movimento por horário" descricao="Mês atual" pronto={!!g}>
              <ResponsiveContainer><LineChart data={g?.horas}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="hora" tick={eixo} axisLine={false} tickLine={false} interval={1} /><YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} width={28} /><Tooltip content={<Dica />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="entradas" name="Entradas" stroke={C.acomp} strokeWidth={2} dot={false} type="monotone" /><Line dataKey="saidas" name="Saídas" stroke={C.danger} strokeWidth={2} dot={false} type="monotone" /><Line dataKey="trocas" name="Trocas" stroke={C.warn} strokeWidth={2} dot={false} type="monotone" /></LineChart></ResponsiveContainer>
            </ChartCard>

            <ChartCard titulo="Ranking de setores" descricao="Mês atual" pronto={!!g}>
              <ResponsiveContainer><BarChart data={g?.ranking} layout="vertical" margin={{ left: 20 }}><CartesianGrid horizontal={false} stroke="hsl(var(--border))" /><XAxis type="number" allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="setor" tick={eixo} axisLine={false} tickLine={false} width={110} /><Tooltip content={<Dica />} cursor={{ fill: 'hsl(var(--muted))' }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="acompanhantes" name="Acompanhantes" stackId="a" fill={C.acomp} /><Bar dataKey="visitas" name="Visitas" stackId="a" fill={C.visit} /><Bar dataKey="trocas" name="Trocas" stackId="a" fill={C.warn} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
            </ChartCard>

            <ChartCard titulo="Permanência média por setor" descricao="Horas (acompanhantes com saída)" pronto={!!g} className="xl:col-span-2">
              <ResponsiveContainer><BarChart data={g?.perm}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="setor" tick={eixo} axisLine={false} tickLine={false} /><YAxis tick={eixo} axisLine={false} tickLine={false} width={34} /><Tooltip content={<Dica />} cursor={{ fill: 'hsl(var(--muted))' }} /><Bar dataKey="horas" name="Horas" fill={C.info} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </ChartCard>
          </div>

          {g && g.insights.length > 0 && (
            <Card className="mt-4">
              <CardHeader title="Insights automáticos" icon={<Lightbulb className="h-[18px] w-[18px]" />} />
              <ul className="grid gap-2 p-5 md:grid-cols-2">{g.insights.map((i, k) => <li key={k} className="flex gap-3 rounded-lg bg-muted/50 px-4 py-3 text-sm"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>{i.antes}<strong className="font-semibold text-primary">{i.destaque}</strong>{i.depois}</span></li>)}</ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}
