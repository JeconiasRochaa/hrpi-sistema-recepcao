import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const HistoricoPacienteDialog = lazy(() => import('./HistoricoPacienteDialog'));
const HistoricoPessoaDialog = lazy(() => import('./HistoricoPessoaDialog'));
const EditarRegistroDialog = lazy(() => import('./EditarRegistroDialog'));
const CrachaDialog = lazy(() => import('./CrachaDialog'));

interface Api {
  historicoPaciente: (nomePaciente: string) => void;
  historicoPessoa: (registroId: string) => void;
  editar: (registroId: string) => void;
  cracha: (registroId: string) => void;
}
const Ctx = createContext<Api | null>(null);

type Estado = { k: 'paciente'; v: string } | { k: 'pessoa'; v: string } | { k: 'editar'; v: string } | { k: 'cracha'; v: string } | null;

/** Hospeda os diálogos "globais" (carregados sob demanda) para que qualquer tela possa abri-los. */
export function DialogsProvider({ children }: { children: ReactNode }) {
  const [e, setE] = useState<Estado>(null);
  const fechar = useCallback(() => setE(null), []);
  const api = useMemo<Api>(() => ({
    historicoPaciente: (v) => setE({ k: 'paciente', v }),
    historicoPessoa: (v) => setE({ k: 'pessoa', v }),
    editar: (v) => setE({ k: 'editar', v }),
    cracha: (v) => setE({ k: 'cracha', v }),
  }), []);
  return (
    <Ctx.Provider value={api}>
      {children}
      <Suspense fallback={null}>
        {e?.k === 'paciente' && <HistoricoPacienteDialog nomePaciente={e.v} onClose={fechar} />}
        {e?.k === 'pessoa' && <HistoricoPessoaDialog registroId={e.v} onClose={fechar} />}
        {e?.k === 'editar' && <EditarRegistroDialog registroId={e.v} onClose={fechar} />}
        {e?.k === 'cracha' && <CrachaDialog registroId={e.v} onClose={fechar} />}
      </Suspense>
    </Ctx.Provider>
  );
}

export function useDialogs() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDialogs fora do DialogsProvider');
  return c;
}
