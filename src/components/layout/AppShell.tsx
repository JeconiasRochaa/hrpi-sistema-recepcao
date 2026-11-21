import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, RefreshCw, Timer, WifiOff } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { SessionBar } from './SessionBar';
import { GlobalSearch } from './GlobalSearch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { preCarregarPaginas } from '@/lib/paginas';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useInatividade } from '@/hooks/useInatividade';
import { tituloDaRota } from '@/lib/nav';
import { useData } from '@/context/DataContext';
import { CONFIG } from '@/lib/constants';
import { podeFazer } from '@/lib/permissions';
import { limparLogsAntigos } from '@/services/logs';
import { limparRegistrosAntigos } from '@/services/registros';
import { salvarConfig } from '@/services/config';

export function AppShell() {
  const { perfil, logout } = useAuth();
  const { pathname } = useLocation();
  const [gaveta, setGaveta] = useState(false);
  const [recolhida, setRecolhida] = useState(() => { try { return localStorage.getItem('hrpi-menu') === '1'; } catch { return false; } });
  const { config, configPronta, online, erroDados, recarregar } = useData();
  useEffect(() => { preCarregarPaginas(); }, []);
  // Retenção automática (LGPD): no máximo 1x por dia, executada por Supervisor/Administrador
  useEffect(() => {
    if (!configPronta || !perfil || !podeFazer(perfil.cargo, 'indicadores')) return;
    if (Date.now() - (config.ultimaLimpeza ?? 0) < 86_400_000) return;
    void (async () => {
      try {
        await salvarConfig({ ultimaLimpeza: Date.now() });
        await limparRegistrosAntigos(config.retencaoRegistrosDias ?? CONFIG.RETENCAO_REGISTROS_DIAS_PADRAO);
        if (perfil.cargo === 'Administrador') await limparLogsAntigos(config.retencaoLogsDias ?? CONFIG.RETENCAO_LOGS_DIAS_PADRAO);
      } catch { /* sem permissão ou offline: tenta no próximo acesso */ }
    })();
  }, [configPronta]); // eslint-disable-line react-hooks/exhaustive-deps
  const { segundosRestantes, continuar } = useInatividade(!!perfil, () => { void logout('Sessão encerrada por inatividade.'); });

  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Ir para o conteúdo</a>
      <Sidebar aberta={gaveta} onFechar={() => setGaveta(false)} recolhida={recolhida}
        onRecolher={() => setRecolhida((r) => { try { localStorage.setItem('hrpi-menu', r ? '0' : '1'); } catch { /* */ } return !r; })} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-card/85 px-4 backdrop-blur lg:px-8">
          <Button variant="ghost" size="icon-md" className="lg:hidden" onClick={() => setGaveta(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
          <h2 className="hidden shrink-0 text-sm font-semibold text-muted-foreground xl:block">{tituloDaRota(pathname)}</h2>
          <div className="flex flex-1 justify-center xl:justify-start xl:pl-6">{perfil?.cargo !== 'Nutrição' && <GlobalSearch />}</div>
          <span className="hidden text-[13px] text-muted-foreground first-letter:uppercase 2xl:block">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <SessionBar />
        </header>
        <main id="conteudo" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="flex min-h-full w-full flex-col px-4 py-5 lg:px-6 lg:py-6 2xl:px-10">
            {!online && <div role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm font-medium text-warning"><WifiOff className="h-4 w-4 shrink-0" /> Sem conexão com o servidor — o sistema continua tentando reconectar. Registros feitos agora serão enviados quando a conexão voltar.</div>}
            {erroDados && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger"><span>{erroDados}</span><button onClick={recarregar} className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-3 py-1 text-xs font-semibold hover:bg-danger/10"><RefreshCw className="h-3.5 w-3.5" /> Tentar de novo</button></div>}
            {/* O menu e o cabeçalho ficam sempre visíveis: só o conteúdo da página mostra o carregamento */}
            <ErrorBoundary resetKey={pathname} compacto>
              <Suspense fallback={<div className="space-y-4" role="status" aria-label="Carregando página"><Skeleton className="h-10 w-72" /><Skeleton className="h-28 w-full" /><Skeleton className="h-96 w-full" /></div>}>
                <div className="flex-1"><Outlet /></div>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <Dialog open={segundosRestantes !== null}>
        <DialogContent tamanho="sm" titulo="Você ainda está aí?" icone={<Timer className="h-5 w-5" />} semFechar onInteractOutside={(e) => e.preventDefault()}>
          <DialogBody className="text-sm text-muted-foreground">
            Por segurança, sua sessão será encerrada em <strong className="tabular text-foreground">{segundosRestantes}s</strong> por inatividade.
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => void logout('Saída manual após aviso de inatividade.')}>Sair agora</Button>
            <Button onClick={continuar} autoFocus>Continuar conectado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
