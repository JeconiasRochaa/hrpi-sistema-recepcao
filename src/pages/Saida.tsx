import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/form';
import { BuscaPresente } from '@/components/shared/Autocomplete';
import { PainelPresentes } from '@/components/shared/PainelPresentes';
import { useData } from '@/context/DataContext';
import { MOTIVOS_SAIDA } from '@/lib/constants';
import { exibirDataHora } from '@/lib/datetime';
import { registrarSaida } from '@/services/registros';
import type { Registro } from '@/types';

export default function Saida() {
  const { presentes } = useData();
  const [sel, setSel] = useState<Registro | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [chave, setChave] = useState(0);

  useEffect(() => { if (sel && !presentes.some((r) => r.id === sel.id)) { setSel(null); toast.warning('Este acompanhante já teve a saída registrada.'); setChave((c) => c + 1); } }, [presentes, sel]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!sel || !motivo) return toast.error('Selecione o acompanhante e o motivo da saída.');
    setSalvando(true);
    try { await registrarSaida(sel, motivo); toast.success(`Saída de ${sel.nomeAcompanhante} registrada.`); setSel(null); setMotivo(''); setChave((c) => c + 1); }
    catch { toast.error('Não foi possível registrar a saída.'); } finally { setSalvando(false); }
  }

  return (
    <>
      <PageHeader titulo="Registro de saída" descricao="Visitantes saem automaticamente 1 hora após a entrada" icone={<LogOut className="h-5 w-5" />} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <Card>
        <CardHeader title="Buscar acompanhante" description="Digite ao menos 2 letras." />
        <form onSubmit={enviar}>
          <CardBody className="space-y-5">
            <BuscaPresente key={chave} presentes={presentes} selecionado={sel} onSelect={setSel} onLimpar={() => setSel(null)} autoFocus />
            {sel && (
              <div className="grid animate-slide-up gap-3 rounded-lg border bg-primary-soft/40 p-4 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Paciente</p><p className="font-semibold">{sel.nomePaciente}</p></div>
                <div><p className="text-xs text-muted-foreground">Setor</p><p className="font-semibold">{sel.setor}{sel.leito ? ` / Leito ${sel.leito}` : ''}</p></div>
                <div><p className="text-xs text-muted-foreground">Entrada</p><p className="font-semibold">{exibirDataHora(sel.dataEntrada, sel.horaEntrada)}</p></div>
              </div>
            )}
            <Field label="Motivo da saída" required>{(id) => (
              <Select id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)}><option value="">Selecione o motivo…</option>{MOTIVOS_SAIDA.map((m) => <option key={m}>{m}</option>)}</Select>
            )}</Field>
          </CardBody>
          <div className="flex justify-end border-t bg-muted/30 px-5 py-3.5"><Button type="submit" variant="danger" disabled={!sel || !motivo} loading={salvando}><LogOut className="h-4 w-4" /> Registrar saída</Button></div>
        </form>
      </Card>
      <PainelPresentes presentes={presentes} titulo="Acompanhantes presentes" filtro={(r) => r.tipo === 'acompanhante'} onSelect={setSel} selecionadoId={sel?.id} limite={12} />
      </div>
    </>
  );
}
