import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Info, LogIn, Repeat, Save, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { PessoaFields } from '@/components/shared/PessoaFields';
import { PacienteAutocomplete } from '@/components/shared/Autocomplete';
import { PainelPresentes } from '@/components/shared/PainelPresentes';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { SETORES, SETORES_ACOMPANHANTE, SETORES_SOMENTE_VISITA } from '@/lib/constants';
import { entradaSchema, erros as extrairErros } from '@/lib/schemas';
import { mesmoNome } from '@/lib/text';
import { indicePacientes, indicePessoas, leitosDoSetor, type SugPaciente } from '@/lib/sugestoes';
import { exibirDataHora } from '@/lib/datetime';
import { registrarEntrada, registrarVisita } from '@/services/registros';
import type { Registro } from '@/types';

const ULTIMO_SETOR = 'hrpi-ultimo-setor'; // preferência de uso (não é dado pessoal)
const lerSetor = () => { try { return localStorage.getItem(ULTIMO_SETOR) ?? ''; } catch { return ''; } };
const gravarSetor = (s: string) => { try { localStorage.setItem(ULTIMO_SETOR, s); } catch { /* sem armazenamento */ } };

const inicial = { nome: '', documento: '', telefone: '', parentesco: '', nomePaciente: '', setor: '', leito: '', observacao: '' };

export default function RegistroForm({ tipo }: { tipo: 'acompanhante' | 'visita' }) {
  const visita = tipo === 'visita';
  const { presentes, todos, bloqueios } = useData();
  const nav = useNavigate();
  const setores = visita ? SETORES : SETORES_ACOMPANHANTE;
  const f = useForm(inicial);
  // Memória de fluxo: reaproveita o último setor usado neste computador (recepção costuma atender o mesmo setor em sequência)
  useEffect(() => { const u = lerSetor(); if (u && (setores as readonly string[]).includes(u)) f.set('setor', u); }, [visita]); // eslint-disable-line react-hooks/exhaustive-deps
  const [chave, setChave] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [duplicado, setDuplicado] = useState<Registro | null>(null);
  const indicePac = useMemo(() => indicePacientes(todos), [todos]);
  const indicePes = useMemo(() => indicePessoas(todos), [todos]);
  const leitos = useMemo(() => leitosDoSetor(todos, f.valores.setor), [todos, f.valores.setor]);

  /** Paciente conhecido: traz setor e leito do último registro (sem sobrescrever o que já foi escolhido). */
  function aoEscolherPaciente(p: SugPaciente) {
    if (!f.valores.setor && (setores as readonly string[]).includes(p.setor)) f.set('setor', p.setor);
    if (!f.valores.leito && p.leito) f.set('leito', p.leito);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const er = extrairErros(entradaSchema.safeParse(f.valores));
    if (Object.keys(er).length) { f.setErros(er); toast.error('Revise os campos destacados.'); return; }
    const v = f.valores;

    if (!visita) {
      if (SETORES_SOMENTE_VISITA.includes(v.setor)) { f.setErros({ setor: `${v.setor} permite apenas visitas.` }); toast.error(`${v.setor} permite apenas visitas — acompanhante fixo não é permitido.`); return; }
      const ativo = presentes.find((r) => r.tipo === 'acompanhante' && r.status === 'presente' && mesmoNome(r.nomePaciente, v.nomePaciente));
      if (ativo) { setDuplicado(ativo); return; }
    } else {
      const b = bloqueios.find((x) => x.ativo && mesmoNome(x.paciente, v.nomePaciente));
      if (b) { toast.error(`Visitas BLOQUEADAS para este paciente. Motivo: ${b.motivo}`, { duration: 9000 }); return; }
    }

    setSalvando(true);
    try {
      const dados = { nome: v.nome, documento: v.documento, telefone: v.telefone, parentesco: v.parentesco, nomePaciente: v.nomePaciente, setor: v.setor, leito: v.leito, observacao: v.observacao };
      if (visita) { await registrarVisita(dados); toast.success('Visita registrada!', { description: 'Saída automática em 1 hora.' }); }
      else { await registrarEntrada(dados); toast.success('Entrada registrada com sucesso!'); }
      gravarSetor(v.setor);
      f.reset({ setor: v.setor }); setChave((c) => c + 1); // mantém o setor e volta o cursor ao primeiro campo
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar. Verifique a conexão e tente novamente.');
    } finally { setSalvando(false); }
  }

  return (
    <>
      <PageHeader titulo={visita ? 'Registro de visita' : 'Entrada de acompanhante'} descricao={visita ? 'Registrar visita de curta duração' : 'Registrar novo acompanhante no hospital'} icone={visita ? <Clock className="h-5 w-5" /> : <LogIn className="h-5 w-5" />} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]">
      <Card>
        <CardHeader title={visita ? 'Dados do visitante' : 'Dados do acompanhante'} description="Campos com * são obrigatórios." />
        <form key={chave} onSubmit={enviar} noValidate>
          <CardBody className="grid gap-x-5 gap-y-4 md:grid-cols-2">
            <PessoaFields v={f.valores} set={(k, val) => f.set(k, val)} erros={f.erros} indice={indicePes} autoFocus rotuloNome={visita ? 'Nome do visitante' : 'Nome do acompanhante'} />
            <Field label="Nome do paciente" required error={f.erros.nomePaciente}>{(id) => <PacienteAutocomplete id={id} value={f.valores.nomePaciente} onChange={(x) => f.set('nomePaciente', x)} indice={indicePac} onPick={aoEscolherPaciente} invalid={!!f.erros.nomePaciente} />}</Field>
            <Field label="Setor" required error={f.erros.setor} hint={!visita ? 'UTI I e UTI II permitem apenas visitas.' : undefined}>{(id) => (
              <Select id={id} value={f.valores.setor} onChange={(e) => f.set('setor', e.target.value)} aria-invalid={!!f.erros.setor}><option value="">Selecione…</option>{setores.map((s) => <option key={s}>{s}</option>)}</Select>
            )}</Field>
            <Field label="Leito">{(id) => <><Input id={id} list={`${id}-leitos`} value={f.valores.leito} onChange={(e) => f.set('leito', e.target.value)} placeholder="Número do leito" autoComplete="off" maxLength={20} /><datalist id={`${id}-leitos`}>{leitos.map((l) => <option key={l} value={l} />)}</datalist></>}</Field>
            {visita ? (
              <Field label="Duração da visita">{(id) => <Input id={id} value="1 hora (saída automática)" disabled />}</Field>
            ) : (
              <Field label="Observação" className="md:col-span-2">{(id) => <Textarea id={id} rows={2} value={f.valores.observacao} onChange={(e) => f.set('observacao', e.target.value)} placeholder="Informações adicionais…" maxLength={500} />}</Field>
            )}
            {visita && <p className="flex items-start gap-2 text-[13px] text-muted-foreground md:col-span-2"><Info className="mt-0.5 h-4 w-4 shrink-0" />A saída de visitantes é registrada automaticamente 1 hora após a entrada. Não é necessário dar baixa manual.</p>}
          </CardBody>
          <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3.5">
            <Button variant="outline" onClick={() => f.reset()} disabled={salvando}>Limpar</Button>
            <Button type="submit" loading={salvando}><Save className="h-4 w-4" />{visita ? 'Registrar visita' : 'Registrar entrada'}</Button>
          </div>
        </form>
      </Card>
      <PainelPresentes presentes={presentes} titulo={visita ? 'Visitantes agora' : 'Acompanhantes agora'} filtro={(r) => r.tipo === tipo} />
      </div>

      <Dialog open={!!duplicado} onOpenChange={(o) => !o && setDuplicado(null)}>
        {duplicado && (
          <DialogContent tamanho="sm" titulo="Paciente já tem acompanhante" icone={<TriangleAlert className="h-5 w-5 text-warning" />}>
            <DialogBody className="space-y-3 text-sm">
              <div className="rounded-lg border border-warning/30 bg-warning-soft p-4">
                <p><strong>{duplicado.nomePaciente}</strong> já possui um acompanhante presente:</p>
                <p className="mt-2"><span className="text-muted-foreground">Nome:</span> {duplicado.nomeAcompanhante}</p>
                <p><span className="text-muted-foreground">Setor:</span> {duplicado.setor}{duplicado.leito ? ` • Leito ${duplicado.leito}` : ''}</p>
                <p><span className="text-muted-foreground">Desde:</span> {exibirDataHora(duplicado.dataEntrada, duplicado.horaEntrada)}</p>
              </div>
              <p className="text-muted-foreground">Só é permitido <strong>um acompanhante ativo por paciente</strong>. Se este acompanhante está sendo substituído, use a Troca de acompanhante.</p>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicado(null)}>Cancelar</Button>
              <Button onClick={() => nav(`/troca?id=${duplicado.id}`)}><Repeat className="h-4 w-4" /> Ir para a troca</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

