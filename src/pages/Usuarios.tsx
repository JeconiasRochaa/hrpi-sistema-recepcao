import { useEffect, useState } from 'react';
import { KeyRound, Link2, MailCheck, Pencil, Plus, Power, ShieldAlert, Trash2, UserCog } from 'lucide-react';
import { onValue, ref } from 'firebase/database';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tip } from '@/components/ui/tooltip';
import { Field, Input, Select } from '@/components/ui/form';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { EmptyState, Table, THead, Td, Th, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/page';
import { useAuth } from '@/context/AuthContext';
import { useForm } from '@/hooks/useForm';
import { db } from '@/lib/firebase';
import { CARGOS, SENHA_PADRAO } from '@/lib/constants';
import { useConfirm } from '@/components/ui/confirm';
import { usuarioSchema, erros as extrairErros } from '@/lib/schemas';
import { corAvatar, mascaraTelefoneInput } from '@/lib/text';
import { atualizarUsuario, criarUsuario, definirAtivo, enviarRedefinicaoSenha, excluirUsuario, exigirNovaSenha, temEmailReal, vincularConta } from '@/services/usuarios';
import type { Cargo, Perfil } from '@/types';

export default function Usuarios() {
  const { perfil } = useAuth();
  const souAdmin = perfil?.cargo === 'Administrador';
  const [lista, setLista] = useState<Perfil[] | null>(null);
  const [novo, setNovo] = useState(false);
  const [edit, setEdit] = useState<Perfil | null>(null);
  const [senha, setSenha] = useState<{ nome: string; login: string; senha: string } | null>(null);
  const [semEmail, setSemEmail] = useState<Perfil | null>(null);
  const [vincular, setVincular] = useState(false);
  const confirmar = useConfirm();
  const fv = useForm({ uid: '', nome: '', login: '', cargo: 'Recepcionista' as string });
  const [salvando, setSalvando] = useState(false);
  const f = useForm({ nome: '', login: '', email: '', telefone: '', cargo: 'Recepcionista' as string });
  const fe = useForm({ nome: '', email: '', telefone: '', cargo: 'Recepcionista' as string, ativo: 'true' });
  const cargosPermitidos = CARGOS.filter((c) => souAdmin || c !== 'Administrador');

  useEffect(() => onValue(ref(db, 'usuarios'), (s) => {
    // Tolerante a cadastros antigos/incompletos: mostra TODO perfil existente, mesmo sem e-mail, login ou nome.
    const v = (s.val() ?? {}) as Record<string, Partial<Omit<Perfil, 'uid'>> | null>;
    setLista(Object.entries(v).filter(([, p]) => p && typeof p === 'object').map(([uid, p]) => {
      const x = p as Partial<Perfil>;
      return { ...x, uid, nome: x.nome || x.login || uid, email: x.email ?? '', cargo: x.cargo as Cargo, ativo: x.ativo === true || (x.ativo as unknown) === 'true' } as Perfil;
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
  }, () => setLista([])), []);

  const podeGerir = (u: Perfil) => souAdmin || u.cargo !== 'Administrador';

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const er = extrairErros(usuarioSchema.safeParse(f.valores));
    if (Object.keys(er).length) return f.setErros(er);
    setSalvando(true);
    try {
      const r = await criarUsuario({ nome: f.valores.nome, login: f.valores.login, email: f.valores.email, telefone: f.valores.telefone, cargo: f.valores.cargo as Cargo });
      setNovo(false); setSenha({ nome: f.valores.nome, login: r.login, senha: r.senhaTemporaria }); f.reset();
    } catch (err) {
      const code = (err as { code?: string }).code;
      toast.error(code === 'auth/email-already-in-use' ? 'Este login já existe. Escolha outro (ou, para refazer o acesso de quem esqueceu a senha, exclua antes a conta no Firebase → Authentication).' : code === 'auth/invalid-email' ? 'Login inválido.' : 'Não foi possível criar o usuário.', { duration: 9000 });
    } finally { setSalvando(false); }
  }
  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    if (edit.uid === perfil?.uid && fe.valores.ativo === 'false') return toast.error('Você não pode desativar a própria conta.');
    setSalvando(true);
    try { await atualizarUsuario(edit.uid, { nome: fe.valores.nome, cargo: fe.valores.cargo as Cargo, ativo: fe.valores.ativo === 'true', email: fe.valores.email, telefone: fe.valores.telefone }); toast.success('Usuário atualizado.'); setEdit(null); }
    catch { toast.error('Sem permissão para esta alteração.'); } finally { setSalvando(false); }
  }
  async function alternarAtivo(u: Perfil) {
    if (u.uid === perfil?.uid) return toast.error('Você não pode desativar a própria conta.');
    const desativar = u.ativo;
    if (desativar && !(await confirmar({ titulo: `Desativar ${u.nome}?`, descricao: 'A pessoa perde o acesso imediatamente. Você pode reativar quando quiser; o histórico é mantido.', confirmar: 'Desativar', perigo: true }))) return;
    try { await definirAtivo(u.uid, !desativar); toast.success(desativar ? 'Usuário desativado.' : 'Usuário reativado.'); } catch { toast.error('Sem permissão para esta alteração.'); }
  }
  async function excluir(u: Perfil) {
    if (u.uid === perfil?.uid) return toast.error('Você não pode excluir a própria conta.');
    if (!(await confirmar({ titulo: `Excluir ${u.nome}?`, descricao: 'O acesso é removido de vez e não pode ser desfeito. Para só suspender o acesso, use "Desativar". O histórico de auditoria é mantido.', confirmar: 'Excluir usuário', perigo: true }))) return;
    try { await excluirUsuario(u.uid); toast.success('Usuário excluído.'); } catch { toast.error('Sem permissão para excluir este usuário.'); }
  }
  async function vincularExistente(e: React.FormEvent) {
    e.preventDefault();
    const uid = fv.valores.uid.trim();
    if (!/^[A-Za-z0-9]{20,40}$/.test(uid)) return fv.setErros({ uid: 'Cole o "UID do usuário" exatamente como aparece no Firebase Console → Authentication.' });
    if (fv.valores.nome.trim().length < 3) return fv.setErros({ nome: 'Informe o nome completo.' });
    setSalvando(true);
    try { await vincularConta({ uid, nome: fv.valores.nome, login: fv.valores.login, cargo: fv.valores.cargo as Cargo }); toast.success('Conta vinculada. A pessoa já pode entrar com a senha que ela já tem.'); setVincular(false); fv.reset(); }
    catch { toast.error('Não foi possível vincular (sem permissão ou dados inválidos).'); } finally { setSalvando(false); }
  }

  return (
    <>
      <PageHeader titulo="Usuários" descricao="Contas de acesso e cargos" icone={<UserCog className="h-5 w-5" />} acoes={<><Button variant="outline" onClick={() => setVincular(true)}><Link2 className="h-4 w-4" /> Vincular conta existente</Button><Button onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo usuário</Button></>} />
      <Card>
        {lista === null ? <TableSkeleton colunas={5} /> : lista.length === 0 ? <EmptyState titulo="Nenhum usuário" /> : (
          <Table>
            <THead><tr><Th>Nome</Th><Th>Login</Th><Th>Contato</Th><Th>Cargo</Th><Th>Status</Th><Th>1º acesso</Th><Th className="text-right">Ações</Th></tr></THead>
            <tbody>{lista.map((u) => (
              <Tr key={u.uid} className={u.ativo ? undefined : 'opacity-60'}>
                <Td><div className="flex items-center gap-3"><Avatar nome={u.nome} cor={corAvatar(u.nome)} tamanho={32} /><span className="font-semibold">{u.nome}{u.uid === perfil?.uid && <span className="font-normal text-muted-foreground"> (você)</span>}{!CARGOS.includes(u.cargo) && <span className="ml-2 text-[11px] font-medium text-warning">cadastro incompleto — edite e escolha o cargo</span>}</span></div></Td>
                <Td className="font-mono text-[13px]">{u.login ?? (u.email || '—')}</Td>
                <Td className="text-[13px] text-muted-foreground">{[u.contatoEmail, u.telefone].filter(Boolean).join(' · ') || '—'}</Td>
                <Td><Badge tone={u.cargo === 'Administrador' ? 'primary' : u.cargo === 'Nutrição' ? 'success' : 'neutral'}>{u.cargo ?? '—'}</Badge></Td>
                <Td><Badge tone={u.ativo ? 'success' : 'danger'} dot>{u.ativo ? 'Ativo' : 'Inativo'}</Badge></Td>
                <Td><Badge tone={u.primeiroAcesso ? 'warning' : 'info'}>{u.primeiroAcesso ? 'Pendente' : 'OK'}</Badge></Td>
                <Td><div className="flex justify-end gap-0.5">
                  {podeGerir(u) && <>
                    <Tip texto="Editar"><Button variant="ghost" size="icon" aria-label="Editar" onClick={() => { setEdit(u); fe.reset({ nome: u.nome, email: u.contatoEmail ?? '', telefone: u.telefone ?? '', cargo: CARGOS.includes(u.cargo) ? u.cargo : 'Recepcionista', ativo: String(u.ativo) }); }}><Pencil className="h-4 w-4" /></Button></Tip>
                    <Tip texto="Redefinir senha"><Button variant="ghost" size="icon" aria-label="Redefinir senha" onClick={() => u.email && temEmailReal(u.email) ? enviarRedefinicaoSenha(u.email, u.uid).then(() => toast.success('E-mail de redefinição enviado.'), () => toast.error('Não foi possível enviar o e-mail.')) : setSemEmail(u)}><MailCheck className="h-4 w-4" /></Button></Tip>
                    <Tip texto="Exigir nova senha no próximo acesso"><Button variant="ghost" size="icon" aria-label="Exigir nova senha" onClick={() => exigirNovaSenha(u.uid).then(() => toast.success('Nova senha será exigida no próximo acesso.'), () => toast.error('Erro ao atualizar.'))}><KeyRound className="h-4 w-4" /></Button></Tip>
                    {u.uid !== perfil?.uid && <>
                      <Tip texto={u.ativo ? 'Desativar acesso' : 'Reativar acesso'}><Button variant="ghost" size="icon" aria-label={u.ativo ? 'Desativar' : 'Reativar'} className={u.ativo ? undefined : 'text-success'} onClick={() => void alternarAtivo(u)}><Power className="h-4 w-4" /></Button></Tip>
                      <Tip texto="Excluir usuário"><Button variant="ghost" size="icon" aria-label="Excluir" className="text-danger hover:text-danger" onClick={() => void excluir(u)}><Trash2 className="h-4 w-4" /></Button></Tip>
                    </>}
                  </>}
                </div></Td>
              </Tr>))}</tbody>
          </Table>
        )}
      </Card>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent tamanho="md" titulo="Novo usuário" descricao={`A senha inicial é a padrão (${SENHA_PADRAO}); a pessoa será obrigada a trocá-la no primeiro acesso.`} icone={<Plus className="h-5 w-5" />}>
          <form onSubmit={criar} className="flex min-h-0 flex-1 flex-col" noValidate>
            <DialogBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo" required error={f.erros.nome} className="sm:col-span-2">{(id) => <Input id={id} value={f.valores.nome} onChange={(e) => f.set('nome', e.target.value)} autoComplete="off" />}</Field>
              <Field label="Login (usuário)" required error={f.erros.login} hint="É com ele que a pessoa entra no sistema. Ex.: maria.silva">{(id) => <Input id={id} value={f.valores.login} onChange={(e) => f.set('login', e.target.value.toLowerCase().replace(/\s/g, ''))} autoComplete="off" autoCapitalize="none" spellCheck={false} />}</Field>
              <Field label="Cargo" required>{(id) => <Select id={id} value={f.valores.cargo} onChange={(e) => f.set('cargo', e.target.value)}>{cargosPermitidos.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
              <Field label="E-mail (opcional)" error={f.erros.email}>{(id) => <Input id={id} type="email" value={f.valores.email} onChange={(e) => f.set('email', e.target.value)} autoComplete="off" placeholder="Só se a pessoa tiver" />}</Field>
              <Field label="Telefone (opcional)">{(id) => <Input id={id} type="tel" value={f.valores.telefone} onChange={(e) => f.set('telefone', mascaraTelefoneInput(e.target.value))} autoComplete="off" placeholder="(00) 00000-0000" />}</Field>
            </DialogBody>
            <DialogFooter><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button type="submit" loading={salvando}>Criar usuário</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent tamanho="sm" titulo="Editar usuário" icone={<Pencil className="h-5 w-5" />}>
          <form onSubmit={salvarEdicao} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-4">
              <Field label="Nome completo" required>{(id) => <Input id={id} value={fe.valores.nome} onChange={(e) => fe.set('nome', e.target.value)} />}</Field>
              <Field label="E-mail (opcional)">{(id) => <Input id={id} type="email" value={fe.valores.email} onChange={(e) => fe.set('email', e.target.value)} />}</Field>
              <Field label="Telefone (opcional)">{(id) => <Input id={id} type="tel" value={fe.valores.telefone} onChange={(e) => fe.set('telefone', mascaraTelefoneInput(e.target.value))} />}</Field>
              <Field label="Cargo">{(id) => <Select id={id} value={fe.valores.cargo} onChange={(e) => fe.set('cargo', e.target.value)}>{cargosPermitidos.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
              <Field label="Status" hint="Usuários inativos perdem o acesso imediatamente.">{(id) => <Select id={id} value={fe.valores.ativo} onChange={(e) => fe.set('ativo', e.target.value)}><option value="true">Ativo</option><option value="false">Inativo</option></Select>}</Field>
            </DialogBody>
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button type="submit" loading={salvando}>Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!senha}>
        {senha && (
          <DialogContent tamanho="sm" titulo="Usuário criado" icone={<ShieldAlert className="h-5 w-5" />} semFechar onInteractOutside={(e) => e.preventDefault()}>
            <DialogBody className="space-y-4 text-sm">
              <p>Passe estes dados para <strong>{senha.nome}</strong>. No primeiro acesso ela será obrigada a criar uma senha pessoal.</p>
              <div className="space-y-1.5 rounded-lg border bg-muted/50 p-4 font-mono text-[13px]">
                <div>Login: <strong>{senha.login}</strong></div>
                <div>Senha inicial: <strong className="select-all">{senha.senha}</strong></div>
              </div>
            </DialogBody>
            <DialogFooter><Button onClick={() => setSenha(null)}>Fechar</Button></DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={vincular} onOpenChange={(o) => { setVincular(o); if (!o) fv.reset(); }}>
        <DialogContent tamanho="md" titulo="Vincular conta existente" descricao="Para quem já tem login no Firebase Authentication mas não aparece aqui: a pessoa continua com a mesma senha." icone={<Link2 className="h-5 w-5" />}>
          <form onSubmit={vincularExistente} className="flex min-h-0 flex-1 flex-col" noValidate>
            <DialogBody className="grid gap-4 sm:grid-cols-2">
              <Field label="UID do usuário" required error={fv.erros.uid} hint="Firebase Console → Authentication → Usuários → coluna “UID do usuário”." className="sm:col-span-2">{(id) => <Input id={id} value={fv.valores.uid} onChange={(e) => fv.set('uid', e.target.value)} autoComplete="off" spellCheck={false} className="font-mono text-[13px]" />}</Field>
              <Field label="Nome completo" required error={fv.erros.nome} className="sm:col-span-2">{(id) => <Input id={id} value={fv.valores.nome} onChange={(e) => fv.set('nome', e.target.value)} autoComplete="off" />}</Field>
              <Field label="Login (opcional)" hint="Só para exibir na lista.">{(id) => <Input id={id} value={fv.valores.login} onChange={(e) => fv.set('login', e.target.value.toLowerCase().replace(/\s/g, ''))} autoComplete="off" autoCapitalize="none" />}</Field>
              <Field label="Cargo" required>{(id) => <Select id={id} value={fv.valores.cargo} onChange={(e) => fv.set('cargo', e.target.value)}>{cargosPermitidos.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
            </DialogBody>
            <DialogFooter><Button variant="outline" onClick={() => setVincular(false)}>Cancelar</Button><Button type="submit" loading={salvando}>Vincular</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!semEmail} onOpenChange={(o) => !o && setSemEmail(null)}>
        {semEmail && (
          <DialogContent tamanho="md" titulo="Refazer o acesso (esqueceu a senha)" icone={<KeyRound className="h-5 w-5" />}>
            <DialogBody className="space-y-3 text-sm">
              <p><strong>{semEmail.nome}</strong> entra só com login, sem e-mail real — por isso o sistema não consegue enviar um link de redefinição.</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                <li>No <strong>Firebase Console → Authentication → Usuários</strong>, exclua a conta <span className="font-mono">{semEmail.email}</span>.</li>
                <li>Aqui em <strong>Usuários → Novo usuário</strong>, crie de novo com o <strong>mesmo login</strong> ({semEmail.login ?? semEmail.email}).</li>
                <li>O sistema aplica a senha inicial padrão e remove o cadastro antigo automaticamente; a pessoa troca no primeiro acesso. O histórico de auditoria é mantido.</li>
              </ol>
            </DialogBody>
            <DialogFooter><Button onClick={() => setSemEmail(null)}>Entendi</Button></DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
