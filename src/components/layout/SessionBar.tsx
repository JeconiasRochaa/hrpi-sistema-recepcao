import * as M from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTema } from '@/context/ThemeContext';
import { Avatar } from '@/components/ui/page';
import { corAvatar, primeiroNome } from '@/lib/text';

/** Caixa do usuário (canto superior direito): nome, cargo, tema e sair. */
export function SessionBar() {
  const { perfil, logout } = useAuth();
  const { tema, alternar } = useTema();
  if (!perfil) return null;
  return (
    <M.Root>
      <M.Trigger asChild>
        <button className="group flex items-center gap-2 rounded-full border bg-card py-1 pl-1.5 pr-2.5 text-left shadow-card transition-colors hover:bg-muted" aria-label="Menu do usuário">
          <Avatar nome={perfil.nome} cor={corAvatar(perfil.nome)} tamanho={28} />
          <span className="hidden leading-tight sm:block">
            <span className="block text-[12.5px] font-semibold">{primeiroNome(perfil.nome)}</span>
            <span className="block text-[10.5px] text-muted-foreground">{perfil.cargo}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </button>
      </M.Trigger>
      <M.Portal>
        <M.Content align="end" sideOffset={8} className="z-50 w-72 animate-slide-up overflow-hidden rounded-lg border bg-popover shadow-pop">
          <div className="flex items-center gap-3 border-b px-4 py-3.5">
            <Avatar nome={perfil.nome} cor={corAvatar(perfil.nome)} tamanho={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{perfil.nome}</p>
              {perfil.login && <p className="truncate text-xs text-muted-foreground">Login: {perfil.login}</p>}
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary"><ShieldCheck className="h-3 w-3" />{perfil.cargo}</p>
            </div>
          </div>
          <div className="p-1.5">
            <M.Item onSelect={(e) => { e.preventDefault(); alternar(); }} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-muted">
              {tema === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Tema {tema === 'dark' ? 'claro' : 'escuro'}
            </M.Item>
            <M.Item onSelect={() => void logout()} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft">
              <LogOut className="h-4 w-4" /> Sair do sistema
            </M.Item>
          </div>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
