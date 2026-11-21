import { Field, Input, Select } from '@/components/ui/form';
import { PARENTESCOS } from '@/lib/constants';
import { mascaraTelefoneInput } from '@/lib/text';
import type { SugPessoa } from '@/lib/sugestoes';
import { PessoaAutocomplete } from './Autocomplete';

interface V { nome: string; documento: string; telefone: string; parentesco: string }
export function PessoaFields({ v, set, erros, rotuloNome = 'Nome do acompanhante', indice = [], autoFocus }: {
  v: V; set: (k: keyof V, val: string) => void; erros: Record<string, string>; rotuloNome?: string; indice?: SugPessoa[]; autoFocus?: boolean;
}) {
  /** Quem já passou pela recepção: preenche só o que ainda está vazio (não sobrescreve o que a recepcionista digitou). */
  function preencher(p: SugPessoa) {
    if (!v.documento && p.documento) set('documento', p.documento);
    if (!v.telefone && p.telefone) set('telefone', mascaraTelefoneInput(p.telefone));
    if (!v.parentesco && p.parentesco) set('parentesco', p.parentesco);
  }
  return (
    <>
      <Field label={rotuloNome} required error={erros.nome}>{(id) => <PessoaAutocomplete id={id} value={v.nome} onChange={(x) => set('nome', x)} indice={indice} onPick={preencher} invalid={!!erros.nome} autoFocus={autoFocus} />}</Field>
      <Field label="Documento" hint="RG, CPF ou outro. Fica mascarado nas telas.">{(id) => <Input id={id} value={v.documento} onChange={(e) => set('documento', e.target.value)} placeholder="Documento de identificação" autoComplete="off" maxLength={40} />}</Field>
      <Field label="Telefone">{(id) => <Input id={id} type="tel" inputMode="tel" value={v.telefone} onChange={(e) => set('telefone', mascaraTelefoneInput(e.target.value))} placeholder="(00) 00000-0000" autoComplete="off" />}</Field>
      <Field label="Parentesco" required error={erros.parentesco}>{(id) => (
        <Select id={id} value={v.parentesco} onChange={(e) => set('parentesco', e.target.value)} aria-invalid={!!erros.parentesco}>
          <option value="">Selecione…</option>{PARENTESCOS.map((p) => <option key={p}>{p}</option>)}
        </Select>
      )}</Field>
    </>
  );
}
