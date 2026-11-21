import { useCallback, useState } from 'react';

/** Estado de formulário simples (valores + erros + reset). */
export function useForm<T extends Record<string, string>>(inicial: T) {
  const [valores, setValores] = useState<T>(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const set = useCallback(<K extends keyof T>(k: K, v: T[K]) => {
    setValores((x) => ({ ...x, [k]: v }));
    setErros((e) => (e[k as string] ? { ...e, [k]: '' } : e));
  }, []);
  const reset = useCallback((v?: Partial<T>) => { setValores({ ...inicial, ...v }); setErros({}); }, [inicial]);
  return { valores, set, erros, setErros, reset, setValores };
}
