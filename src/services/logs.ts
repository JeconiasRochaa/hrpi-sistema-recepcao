import { ref, set, update, serverTimestamp, query, orderByChild, endAt, get, limitToFirst } from 'firebase/database';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { gerarId } from '@/lib/utils';
import type { AcaoLog } from '@/types';
import { getPerfilAtual } from './sessao';

/**
 * Trilha de auditoria (LGPD art. 37 / 46). Os logs NÃO guardam nomes completos nem documentos:
 * apenas ações, IDs de registro e iniciais. As regras do banco tornam os logs imutáveis
 * (só podem ser criados; só podem ser apagados pelo Administrador após a retenção mínima).
 */
export function montarLog(acao: AcaoLog, descricao: string, registroId?: string): Record<string, unknown> {
  const p = getPerfilAtual();
  if (!p) return {};
  const id = gerarId('log');
  return {
    [`logs/${id}`]: {
      id,
      timestamp: serverTimestamp(),
      usuario: p.nome,
      usuarioId: p.uid,
      acao,
      descricao: descricao.slice(0, 400),
      registroId: registroId ?? '',
    },
  };
}

let avisouFalha = false;
/** Código do último erro ao gravar log (mostrado na tela de Logs para facilitar o diagnóstico). */
export let ultimaFalhaLog: string | null = null;

export async function registrarLog(acao: AcaoLog, descricao: string, registroId?: string) {
  const l = montarLog(acao, descricao, registroId);
  const [caminho, valor] = Object.entries(l)[0] ?? [];
  if (!caminho) return;
  try {
    await set(ref(db, caminho), valor);
    ultimaFalhaLog = null;
  } catch (e) {
    const cod = (e as { code?: string; message?: string }).code ?? (e as Error).message ?? 'erro';
    ultimaFalhaLog = cod;
    console.error('Falha ao registrar log de auditoria', e);
    if (!avisouFalha) { avisouFalha = true; toast.error(`Auditoria: não foi possível gravar o log (${cod}). Verifique se as regras do banco estão publicadas.`, { duration: 10000 }); }
  }
}

/** Apaga logs mais antigos que `dias` (as regras exigem ≥ 30 dias e perfil Administrador). */
export async function limparLogsAntigos(dias: number): Promise<number> {
  const corte = Date.now() - dias * 86_400_000;
  const snap = await get(query(ref(db, 'logs'), orderByChild('timestamp'), endAt(corte), limitToFirst(2000)));
  const updates: Record<string, null> = {};
  snap.forEach((c) => { updates[`logs/${c.key}`] = null; });
  const n = Object.keys(updates).length;
  if (n) await update(ref(db), updates);
  return n;
}
