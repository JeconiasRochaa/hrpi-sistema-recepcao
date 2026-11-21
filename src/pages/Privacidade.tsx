import { useMemo, useState } from 'react';
import { Eraser, Lock, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Table, THead, Td, Th, Tr, EmptyState } from '@/components/ui/table';
import { useConfirm } from '@/components/ui/confirm';
import { useAuth } from '@/context/AuthContext';
import { useHistoricoCompleto } from '@/context/DataContext';
import { podeFazer } from '@/lib/permissions';
import { CONFIG, HOSPITAL_NOME } from '@/lib/constants';
import { normalizar } from '@/lib/text';
import { exibirDataHora } from '@/lib/datetime';
import { anonimizarRegistros } from '@/services/registros';

export default function Privacidade() {
  const { perfil } = useAuth();
  const { config, todos } = useHistoricoCompleto();
  const confirmar = useConfirm();
  const admin = podeFazer(perfil?.cargo, 'privacidadeAdmin');
  const [q, setQ] = useState('');
  const [incluirPaciente, setIncluirPaciente] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const achados = useMemo(() => { const t = normalizar(q); return t.length < 3 ? [] : todos.filter((r) => [r.nomeAcompanhante, r.documento, r.nomePaciente].some((c) => normalizar(c).includes(t))).slice(0, 100); }, [q, todos]);

  async function anonimizar() {
    if (!(await confirmar({ titulo: `Anonimizar ${achados.length} registro(s)?`, descricao: 'Nome, documento, telefone e observações serão apagados de forma irreversível. Os dados estatísticos (datas, setor) são mantidos.', confirmar: 'Anonimizar', perigo: true }))) return;
    setOcupado(true);
    try { await anonimizarRegistros(achados.map((r) => r.id), incluirPaciente); toast.success('Registros anonimizados.'); setQ(''); } catch { toast.error('Não foi possível anonimizar.'); } finally { setOcupado(false); }
  }

  const itens: [string, string][] = [
    ['Finalidade', 'Controle de acesso de acompanhantes e visitantes, segurança dos pacientes, organização das refeições e cumprimento de normas sanitárias do hospital.'],
    ['Dados tratados', 'Nome, documento de identificação, telefone, grau de parentesco, paciente visitado, setor/leito e horários de entrada e saída.'],
    ['Base legal (art. 7º, LGPD)', 'Execução de políticas de segurança e legítimo interesse do hospital; proteção da vida e tutela da saúde quando aplicável.'],
    ['Quem acessa', 'Somente funcionários autorizados, com permissões por cargo. Documentos aparecem mascarados e cada visualização é auditada.'],
    ['Retenção', `Registros encerrados são eliminados após ${config.retencaoRegistrosDias ?? CONFIG.RETENCAO_REGISTROS_DIAS_PADRAO} dias; logs de auditoria após ${config.retencaoLogsDias ?? CONFIG.RETENCAO_LOGS_DIAS_PADRAO} dias.`],
    ['Segurança', 'Autenticação individual, sessão com expiração por inatividade, regras de acesso no banco por cargo, trilha de auditoria imutável e conexão criptografada (HTTPS).'],
    ['Direitos do titular (art. 18)', 'Confirmação, acesso, correção, anonimização, eliminação e informação sobre compartilhamento — solicite ao encarregado abaixo.'],
  ];

  return (
    <>
      <PageHeader titulo="Privacidade e LGPD" descricao="Como os dados pessoais são tratados neste sistema" icone={<ShieldCheck className="h-5 w-5" />} />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Aviso de privacidade" description={config.controlador || HOSPITAL_NOME} icon={<Lock className="h-[18px] w-[18px]" />} />
          <dl className="divide-y">{itens.map(([t, d]) => <div key={t} className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr]"><dt className="text-[13px] font-semibold">{t}</dt><dd className="text-sm text-muted-foreground">{d}</dd></div>)}</dl>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Encarregado de dados (DPO)" />
          <CardBody className="space-y-1 text-sm">
            {config.encarregadoNome || config.encarregadoEmail ? <><p className="font-semibold">{config.encarregadoNome || '—'}</p><p className="text-muted-foreground">{config.encarregadoEmail || '—'}</p></> :
              <p className="text-muted-foreground">Ainda não informado. {admin ? 'Cadastre em Configurações.' : 'Procure a administração do hospital.'}</p>}
          </CardBody>
        </Card>
      </div>

      {admin && (
        <Card className="mt-4">
          <CardHeader title="Direitos do titular — anonimização" description="Localize os registros de uma pessoa e remova seus dados pessoais." icon={<Eraser className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou documento (mín. 3 caracteres)…" aria-label="Buscar titular" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={incluirPaciente} onChange={(e) => setIncluirPaciente(e.target.checked)} /> Anonimizar também o nome do paciente</label>
              <Button variant="danger" disabled={!achados.length} loading={ocupado} onClick={anonimizar}><Eraser className="h-4 w-4" /> Anonimizar ({achados.length})</Button>
            </div>
            {q.trim().length >= 3 && (achados.length === 0 ? <EmptyState titulo="Nenhum registro encontrado" /> : (
              <div className="overflow-hidden rounded-lg border"><Table>
                <THead><tr><Th>Nome</Th><Th>Paciente</Th><Th>Entrada</Th><Th>Situação</Th></tr></THead>
                <tbody>{achados.slice(0, 20).map((r) => <Tr key={r.id}><Td className="font-medium">{r.nomeAcompanhante}</Td><Td>{r.nomePaciente}</Td><Td className="tabular text-[13px]">{exibirDataHora(r.dataEntrada, r.horaEntrada)}</Td><Td><Badge>{r.status}</Badge></Td></Tr>)}</tbody>
              </Table>{achados.length > 20 && <p className="border-t px-4 py-2 text-xs text-muted-foreground">… e mais {achados.length - 20} registro(s).</p>}</div>
            ))}
          </CardBody>
        </Card>
      )}
    </>
  );
}
