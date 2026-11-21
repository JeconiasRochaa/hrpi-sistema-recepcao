import { CONFIG } from './constants';

const COMUNS = ['123456', '12345678', '1234567890', 'password', 'senha123', 'qwerty', 'hospital', 'hrpi', 'recepcao', 'admin', 'abc123'];

export function validarSenha(senha: string, email = ''): string[] {
  const erros: string[] = [];
  if (senha.length < CONFIG.SENHA_MIN) erros.push(`Mínimo de ${CONFIG.SENHA_MIN} caracteres.`);
  if (!/[a-z]/.test(senha) || !/[A-Z]/.test(senha)) erros.push('Use letras maiúsculas e minúsculas.');
  if (!/\d/.test(senha)) erros.push('Inclua ao menos um número.');
  const baixa = senha.toLowerCase();
  if (COMUNS.some((c) => baixa.includes(c))) erros.push('Evite sequências e palavras comuns.');
  const user = email.split('@')[0]?.toLowerCase();
  if (user && user.length > 2 && baixa.includes(user)) erros.push('A senha não pode conter seu usuário/e-mail.');
  return erros;
}

/** 0 a 4 */
export function forcaSenha(senha: string): number {
  let s = 0;
  if (senha.length >= CONFIG.SENHA_MIN) s++;
  if (senha.length >= 14) s++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) s++;
  if (/\d/.test(senha) && /[^A-Za-z0-9]/.test(senha)) s++;
  return Math.min(4, s);
}

/** Senha temporária aleatória (sem caracteres ambíguos), exibida uma única vez ao administrador. */
export function gerarSenhaTemporaria(tam = 16): string {
  const min = 'abcdefghijkmnpqrstuvwxyz';
  const mai = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const num = '23456789';
  const sim = '!@#$%&*?';
  const todos = min + mai + num + sim;
  const rnd = (n: number) => {
    const a = new Uint32Array(1);
    // rejeição para evitar viés
    const lim = Math.floor(0xffffffff / n) * n;
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  };
  const chars = [min[rnd(min.length)], mai[rnd(mai.length)], num[rnd(num.length)], sim[rnd(sim.length)]];
  while (chars.length < tam) chars.push(todos[rnd(todos.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
