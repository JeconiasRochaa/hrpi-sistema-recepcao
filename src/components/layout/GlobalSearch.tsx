import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useDialogs } from '@/features/DialogsProvider';
import { normalizar } from '@/lib/text';
import { TipoBadge, StatusBadge } from '@/components/shared/Badges';

export function GlobalSearch() {
  const { todos } = useData();
  const dlg = useDialogs();
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName))) { e.preventDefault(); input.current?.focus(); }
    };
    const c = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setAberto(false); };
    window.addEventListener('keydown', k); window.addEventListener('mousedown', c);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('mousedown', c); };
  }, []);

  const resultados = useMemo(() => {
    const t = normalizar(q);
    if (t.length < 2) return [];
    return todos.filter((r) => [r.nomeAcompanhante, r.nomePaciente, r.setor, r.leito, r.documento].some((c) => normalizar(c).includes(t))).slice(0, 8);
  }, [q, todos]);

  const abrir = (i: number) => {
    const r = resultados[i];
    if (!r) return;
    setAberto(false); setQ(''); dlg.historicoPaciente(r.nomePaciente);
  };

  return (
    <div ref={box} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={input} value={q} role="combobox" aria-expanded={aberto && resultados.length > 0} aria-controls="busca-resultados" autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setAberto(true); setSel(0); }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, resultados.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          else if (e.key === 'Enter') abrir(sel);
          else if (e.key === 'Escape') { setAberto(false); input.current?.blur(); }
        }}
        placeholder="Buscar paciente, acompanhante, setor…"
        className="h-10 w-full rounded-lg border bg-muted/50 pl-9 pr-14 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">Ctrl K</kbd>
      {aberto && q.trim().length >= 2 && (
        <ul id="busca-resultados" role="listbox" className="absolute left-0 right-0 top-12 z-40 max-h-96 animate-slide-up overflow-y-auto rounded-lg border bg-popover p-1 shadow-pop">
          {resultados.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum resultado para “{q}”.</li>}
          {resultados.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => abrir(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 ${i === sel ? 'bg-muted' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.nomeAcompanhante}</p>
                <p className="truncate text-xs text-muted-foreground">{r.nomePaciente} · {r.setor}{r.leito ? ` · Leito ${r.leito}` : ''}</p>
              </div>
              <TipoBadge tipo={r.tipo} /><StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
