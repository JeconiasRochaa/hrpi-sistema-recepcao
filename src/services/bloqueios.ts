import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { dataHoje, horaAgora } from '@/lib/datetime';
import { gerarId } from '@/lib/utils';
import { iniciais, limpar } from '@/lib/text';
import type { Bloqueio } from '@/types';
import { nomeAtual } from './sessao';
import { montarLog } from './logs';

export async function criarBloqueio(d: { paciente: string; setor?: string; leito?: string; motivo: string }) {
  const b: Bloqueio = {
    id: gerarId('blq'),
    paciente: limpar(d.paciente, 120),
    setor: limpar(d.setor, 60),
    leito: limpar(d.leito, 20),
    motivo: limpar(d.motivo, 400),
    solicitante: nomeAtual(),
    dataBloqueio: `${dataHoje()} ${horaAgora()}`,
    ativo: true,
  };
  await update(ref(db), { [`bloqueios/${b.id}`]: b, ...montarLog('bloqueio', `Bloqueio de visitas criado (paciente ${iniciais(b.paciente)}).`, b.id) });
}

export async function removerBloqueio(id: string) {
  await update(ref(db), { [`bloqueios/${id}/ativo`]: false, ...montarLog('bloqueio', 'Bloqueio de visitas removido.', id) });
}
