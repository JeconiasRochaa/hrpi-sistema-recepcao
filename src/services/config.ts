import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { Configuracoes } from '@/types';
import { montarLog } from './logs';

export async function salvarConfig(parcial: Partial<Configuracoes>, descricaoLog?: string) {
  const up: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parcial)) up[`configuracoes/${k}`] = v ?? null;
  if (descricaoLog) Object.assign(up, montarLog('config', descricaoLog));
  await update(ref(db), up);
}
