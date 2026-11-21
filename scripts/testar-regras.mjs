// Testa database.rules.json com o simulador "targaryen" (não precisa de emulador/Java).
// Uso: npm run rules:test
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const targaryen = require('targaryen');

const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));
const NOW = 1_800_000_000_000;
const base = {
  usuarios: {
    adm: { nome: 'Ana Admin', email: 'a@x.br', cargo: 'Administrador', ativo: true },
    sup: { nome: 'Sergio Sup', email: 's@x.br', cargo: 'Supervisor', ativo: true },
    rec: { nome: 'Rita Rec', email: 'r@x.br', cargo: 'Recepcionista', ativo: true },
    soc: { nome: 'Sonia Social', email: 'so@x.br', cargo: 'Serviço Social', ativo: true },
    nut: { nome: 'Nara Nutri', login: 'nara', cargo: 'Nutrição', ativo: true },
    legado: { nome: 'Antigo Sem Email', cargo: 'Recepcionista', ativo: true },
    off: { nome: 'Inativo', email: 'i@x.br', cargo: 'Recepcionista', ativo: false },
  },
  sistema: { inicializado: true },
  acompanhantes: { r1: { id: 'r1', tipo: 'acompanhante', nomeAcompanhante: 'Maria', nomePaciente: 'João', setor: 'Pediatria', dataEntrada: '01-11-2026', horaEntrada: '10:00:00', status: 'presente' } },
  logs: { antigo: { id: 'antigo', timestamp: NOW - 40 * 86400000, usuario: 'x', usuarioId: 'rec', acao: 'login', descricao: 'ok' }, novo: { id: 'novo', timestamp: NOW - 86400000, usuario: 'x', usuarioId: 'rec', acao: 'login', descricao: 'ok' } },
  configuracoes: { tema: 'dark' },
};
const db = targaryen.database(rules, base).with({ now: NOW });
// O simulador usa o relógio real a cada operação; fixamos "now" em cada chamada.
const como = (uid) => {
  const c = uid ? db.as({ uid }) : db.as(null);
  return {
    read: (p, query) => c.read(p, { now: NOW, ...(query ? { query } : {}) }),
    write: (p, v) => c.write(p, v, { now: NOW }),
    update: (p, v) => c.update(p, v, { now: NOW }),
  };
};

let falhas = 0;
function esperar(nome, resultado, permitido) {
  const ok = resultado.allowed === permitido;
  if (!ok) falhas++;
  console.log(`${ok ? '✔' : '✘ FALHOU'}  ${nome}${ok ? '' : `\n    ${resultado.info ?? ''}`}`);
}

const novoReg = (id) => ({ id, tipo: 'acompanhante', nomeAcompanhante: 'Carlos', nomePaciente: 'Pedro', setor: 'Pediatria', dataEntrada: '02-11-2026', horaEntrada: '09:00:00', status: 'presente', entradaTs: NOW });
const log = (id, uid, extra = {}) => ({ id, timestamp: NOW, usuario: 'N', usuarioId: uid, acao: 'criar', descricao: 'x', ...extra });

console.log('— Acesso anônimo e contas sem perfil');
esperar('anônimo NÃO lê acompanhantes', como(null).read('/acompanhantes'), false);
esperar('anônimo NÃO escreve acompanhantes', como(null).write('/acompanhantes/n1', novoReg('n1')), false);
esperar('conta Auth sem perfil (invasor) NÃO lê acompanhantes', como('intruso').read('/acompanhantes'), false);
esperar('conta Auth sem perfil NÃO cria registro', como('intruso').write('/acompanhantes/n1', novoReg('n1')), false);
esperar('conta Auth sem perfil NÃO cria o próprio perfil de admin', como('intruso').write('/usuarios/intruso', { nome: 'Hacker', email: 'h@x', cargo: 'Administrador', ativo: true }), false);
esperar('usuário inativo NÃO lê acompanhantes', como('off').read('/acompanhantes'), false);
esperar('raiz não é legível nem por admin', como('adm').read('/'), false);

console.log('— Registros');
esperar('recepcionista lê acompanhantes', como('rec').read('/acompanhantes'), true);
esperar('recepcionista cria registro válido', como('rec').write('/acompanhantes/n1', novoReg('n1')), true);
esperar('registro com id diferente da chave é rejeitado', como('rec').write('/acompanhantes/n1', novoReg('outro')), false);
esperar('registro com status inválido é rejeitado', como('rec').write('/acompanhantes/n1', { ...novoReg('n1'), status: 'hackeado' }), false);
esperar('registro com data inválida é rejeitado', como('rec').write('/acompanhantes/n1', { ...novoReg('n1'), dataEntrada: '2026-11-02' }), false);
esperar('registro com texto gigante é rejeitado', como('rec').write('/acompanhantes/n1', { ...novoReg('n1'), nomeAcompanhante: 'A'.repeat(400) }), false);
esperar('recepcionista dá saída (update de campos)', como('rec').update('/', { 'acompanhantes/r1/status': 'saiu', 'acompanhantes/r1/dataSaida': '03-11-2026', 'acompanhantes/r1/horaSaida': '11:00:00' }), true);
esperar('recepcionista NÃO exclui registro', como('rec').write('/acompanhantes/r1', null), false);
esperar('supervisor exclui registro', como('sup').write('/acompanhantes/r1', null), true);
esperar('recepcionista NÃO apaga a coleção inteira', como('rec').write('/acompanhantes', null), false);

console.log('— Usuários e cargos');
esperar('recepcionista NÃO lista usuários', como('rec').read('/usuarios'), false);
esperar('recepcionista lê o próprio perfil', como('rec').read('/usuarios/rec'), true);
esperar('recepcionista NÃO lê perfil de outro', como('rec').read('/usuarios/adm'), false);
esperar('recepcionista NÃO se promove a admin', como('rec').write('/usuarios/rec/cargo', 'Administrador'), false);
esperar('recepcionista NÃO se reativa/altera ativo', como('rec').write('/usuarios/rec/ativo', true), false);
esperar('recepcionista conclui o próprio primeiro acesso', como('rec').write('/usuarios/rec/primeiroAcesso', false), true);
esperar('recepcionista NÃO reabre primeiro acesso de si (true)', como('rec').write('/usuarios/rec/primeiroAcesso', true), false);
esperar('admin cria usuário', como('adm').write('/usuarios/novo', { nome: 'Novo Usuario', email: 'n@x.br', cargo: 'Recepcionista', ativo: true, primeiroAcesso: true }), true);
esperar('admin cria usuário só com nome e login (sem e-mail/telefone reais)', como('adm').write('/usuarios/novo', { nome: 'Novo Usuario', email: 'novo@recepcao.hrpi.local', login: 'novo', cargo: 'Recepcionista', ativo: true, primeiroAcesso: true }), true);
esperar('admin cria usuário com e-mail e telefone de contato opcionais', como('adm').write('/usuarios/novo', { nome: 'Novo Usuario', email: 'novo@recepcao.hrpi.local', login: 'novo', contatoEmail: 'novo@gmail.com', telefone: '(82) 99999-0000', cargo: 'Recepcionista', ativo: true, primeiroAcesso: true }), true);
esperar('admin NÃO cria usuário com campo desconhecido', como('adm').write('/usuarios/novo', { nome: 'Novo Usuario', email: 'n@x.br', cargo: 'Recepcionista', ativo: true, senha: '123' }), false);
esperar('admin NÃO cria usuário com cargo inválido', como('adm').write('/usuarios/novo', { nome: 'Novo Usuario', email: 'n@x.br', cargo: 'Deus', ativo: true }), false);
esperar('supervisor cria recepcionista', como('sup').write('/usuarios/novo', { nome: 'Novo Usuario', email: 'n@x.br', cargo: 'Recepcionista', ativo: true }), true);
esperar('supervisor NÃO cria administrador', como('sup').write('/usuarios/novo', { nome: 'Novo Usuario', email: 'n@x.br', cargo: 'Administrador', ativo: true }), false);
esperar('supervisor NÃO se promove a administrador', como('sup').write('/usuarios/sup/cargo', 'Administrador'), false);
esperar('supervisor NÃO edita administrador', como('sup').write('/usuarios/adm/ativo', false), false);
esperar('supervisor lista usuários', como('sup').read('/usuarios'), true);

console.log('— Logs de auditoria (imutáveis)');
esperar('recepcionista cria log próprio', como('rec').write('/logs/l1', log('l1', 'rec')), true);
esperar('recepcionista NÃO cria log em nome de outro', como('rec').write('/logs/l1', log('l1', 'adm')), false);
esperar('log com timestamp falso é rejeitado', como('rec').write('/logs/l1', log('l1', 'rec', { timestamp: NOW - 1000 })), false);
esperar('log com campo extra é rejeitado', como('rec').write('/logs/l1', log('l1', 'rec', { extra: 1 })), false);
esperar('log com ação inválida é rejeitado', como('rec').write('/logs/l1', log('l1', 'rec', { acao: 'apagar-tudo' })), false);
esperar('log existente NÃO pode ser alterado', como('rec').write('/logs/novo/descricao', 'adulterado'), false);
esperar('admin NÃO altera log existente', como('adm').write('/logs/novo/descricao', 'adulterado'), false);
esperar('recepcionista NÃO lê logs', como('rec').read('/logs'), false);
esperar('supervisor lê logs', como('sup').read('/logs'), true);
esperar('admin NÃO apaga log recente (<30 dias)', como('adm').write('/logs/novo', null), false);
esperar('admin apaga log antigo (>30 dias)', como('adm').write('/logs/antigo', null), true);
esperar('supervisor NÃO apaga log antigo', como('sup').write('/logs/antigo', null), false);

console.log('— Configuração inicial (primeiro administrador)');
const vazio = targaryen.database(rules, { usuarios: {}, }).with({ now: NOW });
const comoV = (uid) => { const c = vazio.as({ uid }); return { update: (p, v) => c.update(p, v, { now: NOW }), write: (p, v) => c.write(p, v, { now: NOW }), read: (p) => c.read(p, { now: NOW }) }; };
const perfilAdm = { nome: 'Primeiro Admin', email: 'p@x.br', cargo: 'Administrador', ativo: true, primeiroAcesso: false };
esperar('sistema vazio: 1ª conta vira admin + marca inicializado', comoV('novo').update('/', { 'usuarios/novo': perfilAdm, 'sistema/inicializado': true }), true);
esperar('sistema vazio: criar admin SEM marcar inicializado é rejeitado', comoV('novo').write('/usuarios/novo', perfilAdm), false);
esperar('sistema vazio: criar perfil de OUTRO uid é rejeitado', comoV('novo').update('/', { 'usuarios/outro': perfilAdm, 'sistema/inicializado': true }), false);
esperar('sistema vazio: perfil não-admin não abre a porta', comoV('novo').update('/', { 'usuarios/novo': { ...perfilAdm, cargo: 'Recepcionista' }, 'sistema/inicializado': true }), false);
esperar('sistema INICIALIZADO: intruso não vira admin', como('intruso').update('/', { 'usuarios/intruso': perfilAdm, 'sistema/inicializado': true }), false);
esperar('sistema já inicializado não pode ser reescrito', como('adm').write('/sistema/inicializado', true), false);
esperar('conta autenticada lê o marcador', como('intruso').read('/sistema/inicializado'), true);
esperar('anônimo NÃO lê o marcador', como(null).read('/sistema/inicializado'), false);

console.log('— Bloqueios, configurações, presença');
const blq = { id: 'b1', paciente: 'João', motivo: 'Isolamento', ativo: true };
esperar('recepcionista lê bloqueios', como('rec').read('/bloqueios'), true);
esperar('recepcionista NÃO cria bloqueio', como('rec').write('/bloqueios/b1', blq), false);
esperar('serviço social cria bloqueio', como('soc').write('/bloqueios/b1', blq), true);
esperar('recepcionista lê configurações', como('rec').read('/configuracoes'), true);
esperar('recepcionista NÃO altera configurações', como('rec').write('/configuracoes/retencaoRegistrosDias', 5000), false);
esperar('supervisor NÃO altera logo', como('sup').write('/configuracoes/logoHospital', 'data:image/png;base64,AAA'), false);
esperar('admin altera retenção válida', como('adm').write('/configuracoes/retencaoRegistrosDias', 90), true);
esperar('admin NÃO define retenção de logs < 30 dias', como('adm').write('/configuracoes/retencaoLogsDias', 5), false);
esperar('supervisor registra última limpeza', como('sup').write('/configuracoes/ultimaLimpeza', NOW), true);
esperar('nó presenca não existe mais (leitura negada)', como('rec').read('/presenca'), false);
esperar('nó presenca não aceita gravação', como('rec').write('/presenca/rec', { nome: 'Rita', cargo: 'Recepcionista' }), false);

console.log('— Perfil Nutrição, perfis legados, desativar e excluir');
const Q = { orderByChild: 'status', equalTo: 'presente' };
esperar('nutrição lê SÓ os presentes (consulta filtrada)', como('nut').read('/acompanhantes', Q), true);
esperar('nutrição NÃO lê o histórico completo', como('nut').read('/acompanhantes'), false);
esperar('nutrição NÃO lê um registro avulso', como('nut').read('/acompanhantes/r1'), false);
esperar('nutrição NÃO cria registro', como('nut').write('/acompanhantes/n1', novoReg('n1')), false);
esperar('nutrição NÃO lê bloqueios', como('nut').read('/bloqueios'), false);
esperar('nutrição NÃO lista usuários', como('nut').read('/usuarios'), false);
esperar('nutrição NÃO lê logs', como('nut').read('/logs'), false);
esperar('nutrição lê configurações (logo/nome do hospital)', como('nut').read('/configuracoes'), true);
esperar('nutrição registra o próprio log (exportação)', como('nut').write('/logs/ln', log('ln', 'nut', { acao: 'exportar' })), true);
esperar('nutrição NÃO se promove', como('nut').write('/usuarios/nut/cargo', 'Administrador'), false);
esperar('admin cria usuário com cargo Nutrição', como('adm').write('/usuarios/novo2', { nome: 'Nutri Dois', email: 'n2@recepcao.hrpi.local', login: 'nutri2', cargo: 'Nutrição', ativo: true, primeiroAcesso: true }), true);
esperar('supervisor cria usuário Nutrição', como('sup').write('/usuarios/novo2', { nome: 'Nutri Dois', login: 'nutri2', cargo: 'Nutrição', ativo: true, primeiroAcesso: true }), true);
esperar('perfil legado sem e-mail é aceito ao ser corrigido pelo admin', como('adm').write('/usuarios/legado/cargo', 'Supervisor'), true);
esperar('admin desativa usuário', como('adm').write('/usuarios/rec/ativo', false), true);
esperar('admin exclui usuário', como('adm').write('/usuarios/rec', null), true);
esperar('admin NÃO exclui a própria conta', como('adm').write('/usuarios/adm', null), false);
esperar('supervisor exclui recepcionista', como('sup').write('/usuarios/rec', null), true);
esperar('supervisor NÃO exclui administrador', como('sup').write('/usuarios/adm', null), false);
esperar('recepcionista NÃO exclui usuário', como('rec').write('/usuarios/soc', null), false);
esperar('log gravado em atualização multi-caminho (como o app faz)', como('rec').update('/', { 'logs/lm': log('lm', 'rec', { acao: 'login' }) }), true);

console.log(falhas ? `\n${falhas} teste(s) de regras FALHARAM` : '\nTodas as regras se comportaram como esperado.');
process.exit(falhas ? 1 : 0);

