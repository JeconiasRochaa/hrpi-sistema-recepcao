import { ref, update, get, query, orderByChild, endAt } from 'firebase/database';
import { db } from '@/lib/firebase';
import { dataHoje, horaAgora, parseDataHora } from '@/lib/datetime';
import { gerarId } from '@/lib/utils';
import { iniciais, limpar } from '@/lib/text';
import { CONFIG } from '@/lib/constants';
import type { Registro } from '@/types';
import { getPerfilAtual, nomeAtual } from './sessao';
import { montarLog } from './logs';

const uid = () => getPerfilAtual()?.uid;

export interface DadosPessoa {
  nome: string;
  documento?: string;
  telefone?: string;
  parentesco: string;
}

export interface DadosEntrada extends DadosPessoa {
  nomePaciente: string;
  setor: string;
  leito?: string;
  observacao?: string;
}

function base(tipo: Registro['tipo'], d: DadosEntrada): Registro {
  const agora = new Date();
  return {
    id: gerarId(),
    tipo,
    nomeAcompanhante: limpar(d.nome, 120),
    documento: limpar(d.documento, 40),
    telefone: limpar(d.telefone, 30),
    parentesco: limpar(d.parentesco, 40),
    nomePaciente: limpar(d.nomePaciente, 120),
    setor: limpar(d.setor, 60),
    leito: limpar(d.leito, 20),
    dataEntrada: dataHoje(agora),
    horaEntrada: horaAgora(agora),
    entradaTs: agora.getTime(),
    dataSaida: null,
    horaSaida: null,
    status: 'presente',
    recepcionistaEntrada: nomeAtual(),
    recepcionistaSaida: null,
    trocas: [],
    observacao: limpar(d.observacao, 500),
    duracaoVisita: null,
    criadoPor: uid(),
  };
}

export async function registrarEntrada(d: DadosEntrada): Promise<Registro> {
  const r = { ...base('acompanhante', d), ultimaConfirmacao: dataHoje() };
  await update(ref(db), {
    [`acompanhantes/${r.id}`]: r,
    ...montarLog('criar', `Entrada de acompanhante (paciente ${iniciais(r.nomePaciente)}, ${r.setor}).`, r.id),
  });
  return r;
}

export async function registrarVisita(d: DadosEntrada): Promise<Registro> {
  const r = { ...base('visita', d), duracaoVisita: CONFIG.DURACAO_VISITA_MIN, observacao: `Visita de ${CONFIG.DURACAO_VISITA_MIN / 60} hora (saída automática)` };
  await update(ref(db), {
    [`acompanhantes/${r.id}`]: r,
    ...montarLog('criar', `Visita registrada (paciente ${iniciais(r.nomePaciente)}, ${r.setor}).`, r.id),
  });
  return r;
}

/** Troca: encerra o acompanhante atual e cria o novo — tudo em UMA gravação atômica. */
export async function registrarTroca(antigo: Registro, novo: DadosPessoa): Promise<Registro> {
  const agora = new Date();
  const nomeNovo = limpar(novo.nome, 120);
  const trocas = [
    ...(antigo.trocas ?? []),
    { dataHora: `${dataHoje(agora)} ${horaAgora(agora)}`, acompanhanteAntigo: antigo.nomeAcompanhante, acompanhanteNovo: nomeNovo, recepcionista: nomeAtual() },
  ];
  const r: Registro = {
    ...base('acompanhante', {
      nome: nomeNovo, documento: novo.documento, telefone: novo.telefone, parentesco: novo.parentesco,
      nomePaciente: antigo.nomePaciente, setor: antigo.setor, leito: antigo.leito,
      observacao: `Substituiu: ${antigo.nomeAcompanhante}`,
    }),
    ultimaConfirmacao: dataHoje(agora),
  };
  await update(ref(db), {
    [`acompanhantes/${antigo.id}/status`]: 'trocado',
    [`acompanhantes/${antigo.id}/dataSaida`]: dataHoje(agora),
    [`acompanhantes/${antigo.id}/horaSaida`]: horaAgora(agora),
    [`acompanhantes/${antigo.id}/recepcionistaSaida`]: nomeAtual(),
    [`acompanhantes/${antigo.id}/trocas`]: trocas,
    [`acompanhantes/${r.id}`]: r,
    ...montarLog('troca', `Troca de acompanhante (paciente ${iniciais(r.nomePaciente)}, ${r.setor}).`, r.id),
  });
  return r;
}

export async function registrarSaida(reg: Registro, motivo: string): Promise<void> {
  const agora = new Date();
  const obs = reg.observacao ? `${reg.observacao} | Saída: ${motivo}` : `Saída: ${motivo}`;
  await update(ref(db), {
    [`acompanhantes/${reg.id}/status`]: 'saiu',
    [`acompanhantes/${reg.id}/dataSaida`]: dataHoje(agora),
    [`acompanhantes/${reg.id}/horaSaida`]: horaAgora(agora),
    [`acompanhantes/${reg.id}/recepcionistaSaida`]: nomeAtual(),
    [`acompanhantes/${reg.id}/observacao`]: obs.slice(0, 500),
    ...montarLog('saida', `Saída registrada — motivo: ${motivo}.`, reg.id),
  });
}

export async function registrarSaidaLote(regs: Registro[], motivo: string): Promise<void> {
  const agora = new Date();
  const up: Record<string, unknown> = {};
  for (const reg of regs) {
    const obs = reg.observacao ? `${reg.observacao} | Saída: ${motivo}` : `Saída: ${motivo}`;
    up[`acompanhantes/${reg.id}/status`] = 'saiu';
    up[`acompanhantes/${reg.id}/dataSaida`] = dataHoje(agora);
    up[`acompanhantes/${reg.id}/horaSaida`] = horaAgora(agora);
    up[`acompanhantes/${reg.id}/recepcionistaSaida`] = nomeAtual();
    up[`acompanhantes/${reg.id}/observacao`] = obs.slice(0, 500);
  }
  Object.assign(up, montarLog('saida', `Correção em lote: saída de ${regs.length} registro(s). Motivo: ${motivo}.`));
  await update(ref(db), up);
}

export async function confirmarPresencas(ids: string[]): Promise<void> {
  const up: Record<string, unknown> = {};
  for (const id of ids) up[`acompanhantes/${id}/ultimaConfirmacao`] = dataHoje();
  Object.assign(up, montarLog('editar', `Presença confirmada para ${ids.length} acompanhante(s).`, ids.length === 1 ? ids[0] : undefined));
  await update(ref(db), up);
}

export type CamposEdicao = Pick<Registro, 'nomeAcompanhante' | 'documento' | 'telefone' | 'parentesco' | 'nomePaciente' | 'setor' | 'leito' | 'observacao'>;

export async function editarRegistro(id: string, c: CamposEdicao): Promise<void> {
  await update(ref(db), {
    [`acompanhantes/${id}/nomeAcompanhante`]: limpar(c.nomeAcompanhante, 120),
    [`acompanhantes/${id}/documento`]: limpar(c.documento, 40),
    [`acompanhantes/${id}/telefone`]: limpar(c.telefone, 30),
    [`acompanhantes/${id}/parentesco`]: limpar(c.parentesco, 40),
    [`acompanhantes/${id}/nomePaciente`]: limpar(c.nomePaciente, 120),
    [`acompanhantes/${id}/setor`]: limpar(c.setor, 60),
    [`acompanhantes/${id}/leito`]: limpar(c.leito, 20),
    [`acompanhantes/${id}/observacao`]: limpar(c.observacao, 500),
    ...montarLog('editar', 'Registro editado.', id),
  });
}

export async function excluirRegistro(id: string): Promise<void> {
  await update(ref(db), { [`acompanhantes/${id}`]: null, ...montarLog('excluir', 'Registro excluído.', id) });
}

/** Direitos do titular (LGPD art. 18): anonimiza dados pessoais, mantendo apenas dados estatísticos. */
export async function anonimizarRegistros(ids: string[], incluirPaciente: boolean): Promise<void> {
  const up: Record<string, unknown> = {};
  for (const id of ids) {
    up[`acompanhantes/${id}/nomeAcompanhante`] = 'Titular anonimizado';
    up[`acompanhantes/${id}/documento`] = '';
    up[`acompanhantes/${id}/telefone`] = '';
    if (incluirPaciente) up[`acompanhantes/${id}/nomePaciente`] = 'Paciente anonimizado';
    up[`acompanhantes/${id}/observacao`] = '';
  }
  Object.assign(up, montarLog('privacidade', `Anonimização (LGPD) de ${ids.length} registro(s)${incluirPaciente ? ', incluindo paciente' : ''}.`));
  await update(ref(db), up);
}

/** Encerra visitas vencidas. Idempotente: a saída é gravada no horário exato do vencimento. */
export async function encerrarVisitasVencidas(presentes: Registro[]): Promise<number> {
  const agora = Date.now();
  const up: Record<string, unknown> = {};
  let n = 0;
  for (const r of presentes) {
    if (r.tipo !== 'visita' || r.status !== 'presente' || !r.duracaoVisita) continue;
    const fim = parseDataHora(r.dataEntrada, r.horaEntrada).getTime() + r.duracaoVisita * 60_000;
    if (Number.isNaN(fim) || fim > agora) continue;
    const d = new Date(fim);
    up[`acompanhantes/${r.id}/status`] = 'saiu';
    up[`acompanhantes/${r.id}/dataSaida`] = dataHoje(d);
    up[`acompanhantes/${r.id}/horaSaida`] = horaAgora(d);
    up[`acompanhantes/${r.id}/recepcionistaSaida`] = 'Sistema';
    up[`acompanhantes/${r.id}/observacao`] = ((r.observacao ? r.observacao + ' | ' : '') + 'Saída automática por expiração do tempo de visita.').slice(0, 500);
    n++;
  }
  if (n) await update(ref(db), up);
  return n;
}

/** Retenção (LGPD art. 15/16): remove registros encerrados mais antigos que `dias`. */
export async function limparRegistrosAntigos(dias: number): Promise<number> {
  const corte = Date.now() - dias * 86_400_000;
  const snap = await get(query(ref(db, 'acompanhantes'), orderByChild('entradaTs'), endAt(corte)));
  const up: Record<string, null> = {};
  snap.forEach((c) => {
    const r = c.val() as Registro;
    if (r.status !== 'presente' && r.entradaTs && r.entradaTs < corte) up[`acompanhantes/${c.key}`] = null;
  });
  // Registros antigos (sem entradaTs) são tratados pelo botão "Otimizar dados" nas Configurações.
  const n = Object.keys(up).length;
  if (n) await update(ref(db), { ...up, ...montarLog('privacidade', `Retenção: ${n} registro(s) com mais de ${dias} dias removido(s).`) });
  return n;
}

/** Preenche `entradaTs` em registros antigos (habilita consultas rápidas e a retenção automática). */
export async function otimizarRegistrosLegado(): Promise<number> {
  const snap = await get(ref(db, 'acompanhantes'));
  const up: Record<string, number> = {};
  snap.forEach((c) => {
    const r = c.val() as Registro;
    if (!r.entradaTs) {
      const t = parseDataHora(r.dataEntrada, r.horaEntrada).getTime();
      if (!Number.isNaN(t)) up[`acompanhantes/${c.key}/entradaTs`] = t;
    }
  });
  const n = Object.keys(up).length;
  if (n) await update(ref(db), up);
  return n;
}
