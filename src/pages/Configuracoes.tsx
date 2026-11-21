import { useRef, useState } from 'react';
import { Database, ImageIcon, Settings, Trash2, Upload, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/confirm';
import { useData } from '@/context/DataContext';
import { CONFIG } from '@/lib/constants';
import { comprimirImagem } from '@/lib/imagem';
import { salvarConfig } from '@/services/config';
import { limparLogsAntigos } from '@/services/logs';
import { limparRegistrosAntigos, otimizarRegistrosLegado } from '@/services/registros';

export default function Configuracoes() {
  const { config } = useData();
  const confirmar = useConfirm();
  const arquivo = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [regDias, setRegDias] = useState(String(config.retencaoRegistrosDias ?? CONFIG.RETENCAO_REGISTROS_DIAS_PADRAO));
  const [logDias, setLogDias] = useState(String(config.retencaoLogsDias ?? CONFIG.RETENCAO_LOGS_DIAS_PADRAO));
  const [ctrl, setCtrl] = useState(config.controlador ?? '');
  const [dpoN, setDpoN] = useState(config.encarregadoNome ?? '');
  const [dpoE, setDpoE] = useState(config.encarregadoEmail ?? '');

  async function tarefa(chave: string, fn: () => Promise<void>, erro = 'Não foi possível concluir a ação.') {
    setOcupado(chave);
    try { await fn(); } catch (e) { console.error(e); toast.error(erro); } finally { setOcupado(null); }
  }

  const enviarLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    void tarefa('logo', async () => {
      try { await salvarConfig({ logoHospital: await comprimirImagem(f, 400) }, 'Logo do hospital atualizada.'); toast.success('Logo atualizada.'); }
      catch (err) { toast.error((err as Error).message); }
    });
  };

  return (
    <>
      <PageHeader titulo="Configurações" descricao="Identidade visual, retenção de dados e manutenção" icone={<Settings className="h-5 w-5" />} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Logo do hospital" description="Aparece no menu, nos crachás e nos PDFs." icon={<ImageIcon className="h-[18px] w-[18px]" />} />
          <CardBody className="flex items-center gap-5">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/50">{config.logoHospital ? <img src={config.logoHospital} alt="Logo atual" className="h-full w-full object-contain p-2" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}</div>
            <div className="space-y-2"><input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={enviarLogo} />
              <div className="flex gap-2"><Button variant="outline" onClick={() => arquivo.current?.click()} loading={ocupado === 'logo'}><Upload className="h-4 w-4" /> Enviar imagem</Button>
                {config.logoHospital && <Button variant="ghost" className="text-danger" onClick={async () => { if (await confirmar({ titulo: 'Remover a logo?', perigo: true, confirmar: 'Remover' })) void tarefa('rlogo', async () => { await salvarConfig({ logoHospital: null }, 'Logo removida.'); toast.success('Logo removida.'); }); }}><Trash2 className="h-4 w-4" /></Button>}</div>
              <p className="text-xs text-muted-foreground">PNG, JPG ou WebP até 5 MB (será redimensionada).</p></div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Controlador e encarregado (LGPD)" description="Exibidos na página de privacidade." icon={<Settings className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-4">
            <Field label="Controlador dos dados">{(id) => <Input id={id} value={ctrl} onChange={(e) => setCtrl(e.target.value)} placeholder="Ex.: Hospital Regional de Palmeira dos Índios" maxLength={150} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Encarregado (DPO)">{(id) => <Input id={id} value={dpoN} onChange={(e) => setDpoN(e.target.value)} maxLength={120} />}</Field>
              <Field label="E-mail do encarregado">{(id) => <Input id={id} type="email" value={dpoE} onChange={(e) => setDpoE(e.target.value)} maxLength={120} />}</Field>
            </div>
            <Button loading={ocupado === 'dpo'} onClick={() => tarefa('dpo', async () => { await salvarConfig({ controlador: ctrl.trim(), encarregadoNome: dpoN.trim(), encarregadoEmail: dpoE.trim() }, 'Dados do controlador/encarregado atualizados.'); toast.success('Salvo.'); })}>Salvar</Button>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Retenção de dados" description="Princípio da necessidade (LGPD): dados são eliminados após o prazo." icon={<Database className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Registros encerrados — manter por (dias)" hint="Registros ‘saiu’/‘trocado’ mais antigos são removidos pela rotina de retenção.">{(id) => <Input id={id} type="number" min={7} max={3650} value={regDias} onChange={(e) => setRegDias(e.target.value)} />}</Field>
              <Field label="Logs de auditoria — manter por (dias)" hint={`Mínimo ${CONFIG.RETENCAO_LOGS_DIAS_MIN} dias (imposto pelas regras do banco).`}>{(id) => <Input id={id} type="number" min={CONFIG.RETENCAO_LOGS_DIAS_MIN} max={3650} value={logDias} onChange={(e) => setLogDias(e.target.value)} />}</Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button loading={ocupado === 'ret'} onClick={() => {
                const a = Math.max(7, parseInt(regDias, 10) || 0); const b = Math.max(CONFIG.RETENCAO_LOGS_DIAS_MIN, parseInt(logDias, 10) || 0);
                void tarefa('ret', async () => { await salvarConfig({ retencaoRegistrosDias: a, retencaoLogsDias: b }, `Política de retenção atualizada (registros ${a} d, logs ${b} d).`); setRegDias(String(a)); setLogDias(String(b)); toast.success('Política de retenção salva.'); });
              }}>Salvar política</Button>
              <Button variant="outline" loading={ocupado === 'run'} onClick={async () => {
                if (!(await confirmar({ titulo: 'Executar retenção agora?', descricao: 'Registros encerrados e logs além do prazo serão apagados permanentemente.', perigo: true, confirmar: 'Executar' }))) return;
                void tarefa('run', async () => {
                  const r = await limparRegistrosAntigos(config.retencaoRegistrosDias ?? CONFIG.RETENCAO_REGISTROS_DIAS_PADRAO);
                  const l = await limparLogsAntigos(config.retencaoLogsDias ?? CONFIG.RETENCAO_LOGS_DIAS_PADRAO);
                  await salvarConfig({ ultimaLimpeza: Date.now() });
                  toast.success(`Retenção executada: ${r} registro(s) e ${l} log(s) removidos.`);
                });
              }}><Trash2 className="h-4 w-4" /> Executar agora</Button>
            </div>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Otimizar dados antigos" description="Cria o índice de data nos registros anteriores à v3 (deixa consultas e retenção mais rápidas)." icon={<Zap className="h-[18px] w-[18px]" />} />
          <CardBody><Button variant="outline" loading={ocupado === 'otm'} onClick={() => tarefa('otm', async () => { const n = await otimizarRegistrosLegado(); toast.success(n ? `${n} registro(s) otimizado(s).` : 'Nada a otimizar — tudo em dia.'); })}><Zap className="h-4 w-4" /> Otimizar agora</Button></CardBody>
        </Card>
      </div>
    </>
  );
}
