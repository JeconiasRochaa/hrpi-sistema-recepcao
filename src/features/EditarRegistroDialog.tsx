import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { PARENTESCOS, SETORES } from '@/lib/constants';
import { entradaSchema, erros as extrairErros } from '@/lib/schemas';
import { mascaraTelefoneInput } from '@/lib/text';
import { editarRegistro } from '@/services/registros';

export default function EditarRegistroDialog({ registroId, onClose }: { registroId: string; onClose: () => void }) {
  const { porId } = useData();
  const r = porId(registroId);
  const f = useForm({
    nome: r?.nomeAcompanhante ?? '', documento: r?.documento ?? '', telefone: r?.telefone ?? '', parentesco: r?.parentesco ?? '',
    nomePaciente: r?.nomePaciente ?? '', setor: r?.setor ?? '', leito: r?.leito ?? '', observacao: r?.observacao ?? '',
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const res = entradaSchema.safeParse(f.valores);
    const er = extrairErros(res);
    if (Object.keys(er).length) { f.setErros(er); return; }
    setSalvando(true);
    try {
      await editarRegistro(registroId, {
        nomeAcompanhante: f.valores.nome, documento: f.valores.documento, telefone: f.valores.telefone, parentesco: f.valores.parentesco,
        nomePaciente: f.valores.nomePaciente, setor: f.valores.setor, leito: f.valores.leito, observacao: f.valores.observacao,
      });
      toast.success('Registro atualizado.');
      onClose();
    } catch { toast.error('Não foi possível salvar. Verifique sua permissão e conexão.'); } finally { setSalvando(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent tamanho="md" icone={<Pencil className="h-5 w-5" />} titulo="Editar registro" descricao="Corrija os dados informados na recepção.">
        <form onSubmit={salvar} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={f.erros.nome}>{(id) => <Input id={id} value={f.valores.nome} onChange={(e) => f.set('nome', e.target.value)} aria-invalid={!!f.erros.nome} autoComplete="off" />}</Field>
            <Field label="Documento">{(id) => <Input id={id} value={f.valores.documento} onChange={(e) => f.set('documento', e.target.value)} autoComplete="off" />}</Field>
            <Field label="Telefone">{(id) => <Input id={id} type="tel" value={f.valores.telefone} onChange={(e) => f.set('telefone', mascaraTelefoneInput(e.target.value))} autoComplete="off" />}</Field>
            <Field label="Parentesco" required error={f.erros.parentesco}>{(id) => (
              <Select id={id} value={f.valores.parentesco} onChange={(e) => f.set('parentesco', e.target.value)}><option value="">Selecione…</option>{PARENTESCOS.map((p) => <option key={p}>{p}</option>)}</Select>
            )}</Field>
            <Field label="Paciente" required error={f.erros.nomePaciente}>{(id) => <Input id={id} value={f.valores.nomePaciente} onChange={(e) => f.set('nomePaciente', e.target.value)} aria-invalid={!!f.erros.nomePaciente} autoComplete="off" />}</Field>
            <Field label="Setor" required error={f.erros.setor}>{(id) => (
              <Select id={id} value={f.valores.setor} onChange={(e) => f.set('setor', e.target.value)}><option value="">Selecione…</option>{SETORES.map((p) => <option key={p}>{p}</option>)}</Select>
            )}</Field>
            <Field label="Leito">{(id) => <Input id={id} value={f.valores.leito} onChange={(e) => f.set('leito', e.target.value)} autoComplete="off" />}</Field>
            <Field label="Observação">{(id) => <Input id={id} value={f.valores.observacao} onChange={(e) => f.set('observacao', e.target.value)} autoComplete="off" />}</Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={salvando}>Salvar alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
