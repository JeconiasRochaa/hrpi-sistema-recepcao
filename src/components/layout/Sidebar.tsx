import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, ChevronsLeft, ChevronsRight, HeartPulse, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { podeFazer } from '@/lib/permissions';
import { gruposVisiveis, NAV_INICIO, NAV_TOPO, type NavItem } from '@/lib/nav';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { agruparDuplicados, pendentesPresenca } from '@/lib/stats';
import { Tip } from '@/components/ui/tooltip';
import { HOSPITAL_NOME, VERSAO } from '@/lib/constants';

function Logo({ src, compacto }: { src?: string | null; compacto?: boolean }) {
  return (
    <div className="flex items-center gap-3 overflow-hidden">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/10">
        {src ? <img src={src} alt="Logo do hospital" className="h-full w-full object-contain p-1" /> : <HeartPulse className="h-5 w-5 text-teal-300" aria-hidden />}
      </span>
      {!compacto && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold tracking-wide text-white">HRPI</p>
          <p className="truncate text-[11px] text-sidebar-muted">Controle de Recepção</p>
        </div>
      )}
    </div>
  );
}

function Item({ item, compacto, onNavigate, contador }: { item: NavItem; compacto: boolean; onNavigate: () => void; contador?: number }) {
  const Icone = item.icone;
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white',
          isActive && 'bg-sidebar-accent text-white before:absolute before:-left-3 before:top-1.5 before:h-[calc(100%-12px)] before:w-[3px] before:rounded-full before:bg-teal-400',
          compacto && 'justify-center px-0',
        )
      }
    >
      <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!compacto && <span className="flex-1 truncate">{item.rotulo}</span>}
      {!!contador && contador > 0 && (
        <span
          className={cn('flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-slate-950', compacto && 'absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]')}
          aria-label={`${contador} pendências`}
        >
          {contador > 99 ? '99+' : contador}
        </span>
      )}
    </NavLink>
  );
  return compacto ? <Tip texto={item.rotulo} lado="right">{link}</Tip> : link;
}

export function Sidebar({ aberta, onFechar, recolhida, onRecolher }: { aberta: boolean; onFechar: () => void; recolhida: boolean; onRecolher: () => void }) {
  const { perfil } = useAuth();
  const { presentes, config } = useData();
  const { pathname } = useLocation();
  const grupos = useMemo(() => gruposVisiveis(perfil?.cargo), [perfil?.cargo]);
  const pendencias = useMemo(() => pendentesPresenca(presentes).length + agruparDuplicados(presentes).length, [presentes]);

  const grupoAtivo = grupos.find((g) => g.itens.some((i) => i.to === pathname))?.id;
  // Acordeão: começa fechado; abre o grupo da página atual e mantém no máximo UM grupo aberto
  const [aberto, setAberto] = useState<string | null>(grupoAtivo ?? null);
  useEffect(() => { if (grupoAtivo) setAberto(grupoAtivo); }, [grupoAtivo]);

  const compacto = recolhida && !aberta; // no mobile (gaveta) sempre expandida

  return (
    <>
      {aberta && <div className="fixed inset-0 z-30 animate-fade-in bg-slate-950/50 backdrop-blur-[2px] lg:hidden" onClick={onFechar} aria-hidden />}
      <aside
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-gradient-to-b from-[#0A2A40] to-[#0B3248] text-sidebar-foreground transition-[width,transform] dark:from-[#071b2b] dark:to-[#081f31] duration-200 lg:static lg:translate-x-0',
          aberta ? 'translate-x-0' : '-translate-x-full',
          compacto ? 'w-[72px]' : 'w-[288px]',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4', compacto && 'justify-center px-0')}>
          <Logo src={config.logoHospital} compacto={compacto} />
          <button onClick={onFechar} className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-white lg:hidden" aria-label="Fechar menu"><X className="h-5 w-5" /></button>
        </div>

        <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <Item item={NAV_INICIO} compacto={compacto} onNavigate={onFechar} />
          {podeFazer(perfil?.cargo, 'registrar') && <Item item={NAV_TOPO} compacto={compacto} onNavigate={onFechar} contador={pendencias} />}

          {grupos.map((g) => {
            const Icone = g.icone;
            // Grupo com um único item (ex.: Privacidade) vira link direto
            if (g.itens.length === 1) return <Item key={g.id} item={{ ...g.itens[0], rotulo: g.itens[0].rotulo }} compacto={compacto} onNavigate={onFechar} />;
            if (compacto) {
              return (
                <div key={g.id} className="my-2 space-y-1 border-t border-sidebar-border pt-2">
                  {g.itens.map((i) => <Item key={i.to} item={i} compacto onNavigate={onFechar} />)}
                </div>
              );
            }
            const open = aberto === g.id;
            return (
              <Collapsible.Root key={g.id} open={open} onOpenChange={(o) => setAberto(o ? g.id : null)} className="pt-1">
                <Collapsible.Trigger
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-sidebar-muted transition-colors hover:text-white',
                    grupoAtivo === g.id && 'text-teal-300',
                  )}
                >
                  <Icone className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 text-left">{g.rotulo}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
                </Collapsible.Trigger>
                <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="ml-[18px] space-y-0.5 border-l border-sidebar-border pb-1 pl-3 pt-0.5">
                    {g.itens.map((i) => <Item key={i.to} item={i} compacto={false} onNavigate={onFechar} />)}
                  </div>
                </Collapsible.Content>
              </Collapsible.Root>
            );
          })}
        </nav>

        <div className={cn('border-t border-sidebar-border p-3', compacto && 'flex justify-center')}>
          {!compacto && (
            <p className="mb-2 px-1 text-[11px] leading-snug text-sidebar-muted">
              {HOSPITAL_NOME}
              <span className="mt-0.5 block opacity-70">Sistema {VERSAO}</span>
            </p>
          )}
          <button
            onClick={onRecolher}
            className="hidden w-full items-center justify-center gap-2 rounded-md py-2 text-xs font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white lg:flex"
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
          >
            {recolhida ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Recolher menu</>}
          </button>
        </div>
      </aside>
    </>
  );
}
