import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const CHUNK_FLAG = 'hrpi-chunk-reload';
const ehErroDeChunk = (e: unknown) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError/i.test(String((e as Error)?.message ?? e));

interface Props { children: ReactNode; /** Muda quando a rota muda: limpa o erro para o usuário poder navegar. */ resetKey?: string; compacto?: boolean }
interface State { erro: Error | null }

/**
 * Evita tela branca/travada: qualquer falha de renderização (ou de carregamento de uma página nova após uma
 * atualização do sistema) vira uma mensagem com botão para tentar de novo. Falha de "chunk" recarrega 1 vez sozinha.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };
  static getDerivedStateFromError(erro: Error): State { return { erro }; }
  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Erro de interface:', erro, info.componentStack);
    if (ehErroDeChunk(erro)) {
      try {
        if (sessionStorage.getItem(CHUNK_FLAG) !== '1') { sessionStorage.setItem(CHUNK_FLAG, '1'); window.location.reload(); }
      } catch { /* sem sessionStorage: mostra a mensagem */ }
    }
  }
  componentDidUpdate(prev: Props) { if (this.state.erro && prev.resetKey !== this.props.resetKey) this.setState({ erro: null }); }
  render() {
    if (!this.state.erro) return this.props.children;
    const chunk = ehErroDeChunk(this.state.erro);
    return (
      <div role="alert" className={this.props.compacto ? 'flex min-h-[50vh] items-center justify-center p-6' : 'flex min-h-screen items-center justify-center p-6'}>
        <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-pop">
          <AlertTriangle className="mx-auto mb-3 h-9 w-9 text-warning" />
          <h2 className="text-lg font-bold">{chunk ? 'O sistema foi atualizado' : 'Algo não saiu como esperado'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{chunk ? 'Recarregue a página para usar a versão mais recente.' : 'Nenhum dado foi perdido. Tente novamente; se continuar, recarregue a página.'}</p>
          <div className="mt-5 flex justify-center gap-2">
            {!chunk && <button className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted" onClick={() => this.setState({ erro: null })}>Tentar novamente</button>}
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground" onClick={() => { try { sessionStorage.removeItem(CHUNK_FLAG); } catch { /* */ } window.location.reload(); }}><RefreshCw className="h-4 w-4" /> Recarregar</button>
          </div>
        </div>
      </div>
    );
  }
}
