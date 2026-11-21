import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { normalizarRegistro, porEntradaDesc } from '@/lib/stats';
import { encerrarVisitasVencidas } from '@/services/registros';
import type { Bloqueio, Configuracoes, Registro } from '@/types';
import { toast } from 'sonner';

/**
 * Estratégia de carregamento (pensada para o fluxo da recepção):
 *  1) `presentes` — apenas quem está no hospital agora (consulta indexada, poucos KB) → telas de
 *     entrada/saída/troca ficam utilizáveis em instantes.
 *  2) `historico` — base completa, carregada logo depois em segundo plano (ou sob demanda).
 *  Nenhum dado pessoal é guardado em localStorage/IndexedDB: tudo fica só em memória.
 */
interface DataCtx {
  presentes: Registro[];
  presentesPronto: boolean;
  historico: Registro[];
  historicoPronto: boolean;
  /** Melhor lista disponível agora (histórico completo, ou os presentes enquanto carrega). */
  todos: Registro[];
  bloqueios: Bloqueio[];
  config: Configuracoes;
  configPronta: boolean;
  porId: (id: string) => Registro | undefined;
  garantirHistorico: () => void;
  /** Conectado ao banco de dados agora? */
  online: boolean;
  /** Mensagem quando alguma leitura falhou (permissão/conexão). As telas deixam de ficar "carregando" e mostram o aviso. */
  erroDados: string | null;
  recarregar: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

function mapear(val: Record<string, Record<string, unknown>> | null): Registro[] {
  if (!val) return [];
  return Object.entries(val).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => normalizarRegistro(v, k));
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { perfil } = useAuth();
  /** Perfil Nutrição: só enxerga os presentes (as regras do banco também impedem o resto). */
  const soPresentes = perfil?.cargo === 'Nutrição';
  const [presentes, setPresentes] = useState<Registro[]>([]);
  const [presentesPronto, setPresentesPronto] = useState(false);
  const [historico, setHistorico] = useState<Registro[]>([]);
  const [historicoPronto, setHistoricoPronto] = useState(false);
  const [historicoAtivo, setHistoricoAtivo] = useState(false);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [config, setConfig] = useState<Configuracoes>({});
  const [configPronta, setConfigPronta] = useState(false);
  const [online, setOnline] = useState(true);
  const [erroDados, setErroDados] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const avisouErro = useRef(false);

  const erro = useCallback((msg: string) => {
    setErroDados(msg);
    if (avisouErro.current) return;
    avisouErro.current = true;
    toast.error(msg, { id: 'erro-dados', duration: 8000 });
  }, []);
  const recarregar = useCallback(() => { avisouErro.current = false; setErroDados(null); setHistoricoAtivo(false); setPresentesPronto(false); setHistoricoPronto(false); setTentativa((t) => t + 1); }, []);

  // Estado da conexão com o banco
  useEffect(() => onValue(ref(db, '.info/connected'), (s) => setOnline(s.val() === true)), []);

  // 1) Presentes (rápido)
  useEffect(() => {
    const q = query(ref(db, 'acompanhantes'), orderByChild('status'), equalTo('presente'));
    return onValue(q, (s) => { setPresentes(mapear(s.val()).sort(porEntradaDesc)); setPresentesPronto(true); setErroDados(null); },
      () => { setPresentesPronto(true); erro('Sem permissão ou sem conexão para carregar os registros.'); });
  }, [erro, tentativa]);

  // 2) Pequenos conjuntos (bloqueios e configurações)
  useEffect(() => soPresentes ? undefined : onValue(ref(db, 'bloqueios'), (s) => {
    const v = (s.val() ?? {}) as Record<string, Bloqueio>;
    setBloqueios(Object.entries(v).map(([id, b]) => ({ ...b, id: b.id || id })));
  }, () => undefined), [tentativa, soPresentes]);
  useEffect(() => onValue(ref(db, 'configuracoes'), (s) => { setConfig((s.val() ?? {}) as Configuracoes); setConfigPronta(true); }, () => setConfigPronta(true)), [tentativa]);

  // 3) Histórico completo — após os presentes (ou quando uma tela pedir)
  useEffect(() => {
    if (!presentesPronto || soPresentes) return;
    if (!historicoAtivo) {
      const t = window.setTimeout(() => setHistoricoAtivo(true), 600);
      return () => window.clearTimeout(t);
    }
    return onValue(ref(db, 'acompanhantes'), (s) => { setHistorico(mapear(s.val()).sort(porEntradaDesc)); setHistoricoPronto(true); },
      () => { setHistoricoPronto(true); erro('Não foi possível carregar o histórico completo.'); });
  }, [presentesPronto, historicoAtivo, erro, soPresentes]);

  // Encerramento automático das visitas vencidas
  const presentesRef = useRef(presentes);
  presentesRef.current = presentes;
  useEffect(() => {
    if (soPresentes) return;
    const rodar = () => { void encerrarVisitasVencidas(presentesRef.current).catch(() => undefined); };
    rodar();
    const id = window.setInterval(rodar, 30_000);
    const vis = () => { if (document.visibilityState === 'visible') rodar(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [presentesPronto, soPresentes]);

  const garantirHistorico = useCallback(() => setHistoricoAtivo(true), []);
  const todos = historicoPronto ? historico : presentes;
  const mapa = useMemo(() => {
    const m = new Map<string, Registro>();
    for (const r of historico) m.set(r.id, r);
    for (const r of presentes) m.set(r.id, r);
    return m;
  }, [historico, presentes]);

  const value = useMemo<DataCtx>(
    () => ({
      presentes, presentesPronto, historico, historicoPronto, todos, bloqueios, config, configPronta,
      porId: (id) => mapa.get(id),
      garantirHistorico, online, erroDados, recarregar,
    }),
    [presentes, presentesPronto, historico, historicoPronto, todos, bloqueios, config, configPronta, mapa, garantirHistorico, online, erroDados, recarregar],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData fora do DataProvider');
  return c;
}

/** Chame em telas que precisam do histórico completo para iniciar o carregamento imediatamente. */
export function useHistoricoCompleto() {
  const d = useData();
  const { garantirHistorico } = d;
  useEffect(() => { garantirHistorico(); }, [garantirHistorico]);
  return d;
}
