import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Gera ID único (não previsível) para novos registros. */
export function gerarId(prefixo = 'hrpi'): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
  return `${prefixo}_${Date.now().toString(36)}_${rand}`;
}

export function debounce<T extends (...a: never[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
