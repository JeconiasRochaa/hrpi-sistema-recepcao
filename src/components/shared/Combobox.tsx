import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/form';
import { cn } from '@/lib/utils';

export interface ComboboxProps<T> {
  id?: string;
  value: string;
  onChange: (texto: string) => void;
  /** Itens já filtrados/ordenados pelo chamador. */
  items: T[];
  itemKey: (i: T) => string;
  render: (i: T, ativo: boolean) => ReactNode;
  onPick: (i: T) => void;
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Ao clicar no campo vazio, mostra a lista (ex.: "Recentes"); não abre sozinha ao receber foco automático. */
  abrirVazio?: boolean;
  titulo?: string;
  vazio?: string;
  inputClassName?: string;
  leading?: ReactNode;
  maxLength?: number;
  onFocus?: () => void;
  onBlurTexto?: () => void;
}

/** Campo com sugestões acessível (padrão ARIA combobox): setas, Enter, Esc, clique; a lista nunca bloqueia o preenchimento manual. */
export function Combobox<T>(p: ComboboxProps<T>) {
  const uid = useId();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listaId = `${uid}-lista`;

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setAberto(false); };
    window.addEventListener('mousedown', fora);
    return () => window.removeEventListener('mousedown', fora);
  }, []);
  useEffect(() => setAtivo(0), [p.items]);

  const podeMostrar = aberto && (p.items.length > 0 || (p.vazio && p.value.trim().length >= 2));
  const itemAtivo = useMemo(() => (podeMostrar ? p.items[ativo] : undefined), [podeMostrar, p.items, ativo]);
  const escolher = (i: T) => { p.onPick(i); setAberto(false); };

  return (
    <div ref={box} className="relative">
      {p.leading}
      <Input
        id={p.id} value={p.value} autoComplete="off" autoFocus={p.autoFocus} aria-invalid={p.invalid} placeholder={p.placeholder} maxLength={p.maxLength} className={p.inputClassName}
        role="combobox" aria-expanded={!!podeMostrar} aria-controls={listaId} aria-autocomplete="list"
        aria-activedescendant={itemAtivo ? `${uid}-${p.itemKey(itemAtivo)}` : undefined}
        onFocus={() => { p.onFocus?.(); if (p.value.trim().length >= 2) setAberto(true); }}
        onClick={() => { if (p.abrirVazio) setAberto(true); }}
        onBlur={() => p.onBlurTexto?.()}
        onChange={(e) => { p.onChange(e.target.value); setAberto(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); if (!aberto) setAberto(true); else setAtivo((s) => Math.min(s + 1, Math.max(p.items.length - 1, 0))); }
          else if (e.key === 'ArrowUp' && aberto) { e.preventDefault(); setAtivo((s) => Math.max(s - 1, 0)); }
          else if (e.key === 'Enter' && podeMostrar && itemAtivo) { e.preventDefault(); escolher(itemAtivo); }
          else if (e.key === 'Escape' && aberto) { e.stopPropagation(); setAberto(false); }
        }}
      />
      {podeMostrar && (
        <ul id={listaId} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full animate-slide-up overflow-y-auto rounded-lg border bg-popover p-1 shadow-pop">
          {p.titulo && p.items.length > 0 && <li role="presentation" className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{p.titulo}</li>}
          {p.items.length === 0 && <li role="presentation" className="px-3 py-5 text-center text-sm text-muted-foreground">{p.vazio}</li>}
          {p.items.map((i, idx) => (
            <li key={p.itemKey(i)} id={`${uid}-${p.itemKey(i)}`} role="option" aria-selected={idx === ativo}
              onMouseEnter={() => setAtivo(idx)} onMouseDown={(e) => { e.preventDefault(); escolher(i); }}
              className={cn('cursor-pointer rounded-md px-3 py-2', idx === ativo && 'bg-muted')}>
              {p.render(i, idx === ativo)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Texto com o trecho digitado em destaque. */
export function Destaque({ partes }: { partes: [string, string, string] }) {
  return <>{partes[0]}{partes[1] && <mark className="rounded-sm bg-primary/15 px-0 font-semibold text-inherit">{partes[1]}</mark>}{partes[2]}</>;
}
