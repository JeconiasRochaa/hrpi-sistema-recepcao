import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { BuscaPresente } from '@/components/shared/Autocomplete';
import { PainelPresentes } from '@/components/shared/PainelPresentes';
import { PessoaFields } from '@/components/shared/PessoaFields';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { indicePessoas } from '@/lib/sugestoes';
import { pessoaSchema, erros as extrairErros } from '@/lib/schemas';
import { exibirDataHora } from '@/lib/datetime';
import { registrarTroca } from '@/services/registros';
import type { Registro } from '@/types';

export default function Troca() {
  const { presentes, porId, todos } = useData();
  const indicePes = useMemo(() => indicePessoas(todos), [todos]);
  const [params, setParams] = useSearchParams();
  const [atual, setAtual] = useState<Registro | null>(null);
  const [salvando, setSalvando] = useState(false);
  const f = useForm({ nome: '', documento: '', telefone: '', parentesco: '' });

  useEffect(() => { const id = params.get('id'); if (id && !atual) { const r = porId(id); if (r?.status === 'presente') setAtual(r); } }, [params, porId, atual]);
  // Se outra recepcionista já deu baixa no acompanhante selecionado, limpa a seleção
  useEffect(() => { if (atual && !presentes.some((r) => r.id === atual.id)) { setAtual(null); toast.warning('O acompanhante selecionado não está mais presente.'); } }, [presentes, atual]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!atual) return toast.error('Busque e selecione o acompanhante atual.');
    const er = extrairErros(pessoaSchema.safeParse(f.valores));
    if (Object.keys(er).length) return f.setErros(er);
    setSalvando(true);
    try {
      await registrarTroca(atual, f.valores);
      toast.success('Troca registrada com sucesso!', { description: `${atual.nomeAcompanhante} → ${f.valores.nome}` });
      setAtual(null); f.reset(); setParams({}, { replace: true });
    } catch { toast.error('Não foi possível registrar a troca.'); } finally { setSalvando(false); }
  }

  return (
    <>
      <PageHeader titulo="Troca de acompanhante" descricao="Substituir o acompanhante atual por um novo" icone={<Repeat className="h-5 w-5" />} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <Card>
        <CardHeader title="Acompanhante atual" description="Busque quem está saindo." />
        <CardBody className="space-y-4">
          <BuscaPresente presentes={presentes} selecionado={atual} onSelect={setAtual} onLimpar={() => setAtual(null)} autoFocus />
          {atual && (
            <div className="grid animate-slide-up gap-3 rounded-lg border bg-primary-soft/40 p-4 text-sm sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Acompanhante</p><p className="font-semibold">{atual.nomeAcompanhante}</p></div>
              <div><p className="text-xs text-muted-foreground">Paciente</p><p className="font-semibold">{atual.nomePaciente}</p></div>
              <div><p className="text-xs text-muted-foreground">Setor / leito</p><p className="font-semibold">{atual.setor}{atual.leito ? ` / ${atual.leito}` : ''}</p></div>
              <div><p className="text-xs text-muted-foreground">Desde</p><p className="font-semibold">{exibirDataHora(atual.dataEntrada, atual.horaEntrada)}</p></div>
            </div>
          )}
        </CardBody>
        <form onSubmit={enviar} noValidate>
          <div className="border-y bg-muted/30 px-5 py-3 text-[13px] font-semibold">Dados do novo acompanhante</div>
          <CardBody className="grid gap-x-5 gap-y-4 md:grid-cols-2"><PessoaFields v={f.valores} set={(k, v) => f.set(k, v)} erros={f.erros} indice={indicePes} rotuloNome="Nome do novo acompanhante" /></CardBody>
          <div className="flex justify-end border-t bg-muted/30 px-5 py-3.5"><Button type="submit" disabled={!atual} loading={salvando}><Repeat className="h-4 w-4" /> Registrar troca</Button></div>
        </form>
      </Card>
      <PainelPresentes presentes={presentes} titulo="Acompanhantes presentes" filtro={(r) => r.tipo === 'acompanhante'} onSelect={setAtual} selecionadoId={atual?.id} limite={12} />
      </div>
    </>
  );
}
