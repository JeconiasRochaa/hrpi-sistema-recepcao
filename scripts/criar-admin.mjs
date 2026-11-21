// Cria o PRIMEIRO administrador (Firebase Auth + perfil em usuarios/{uid}).
// Nenhuma credencial fica no código:
//   - a conta de serviço vem de GOOGLE_APPLICATION_CREDENTIALS (arquivo JSON fora do repositório)
//   - e-mail e senha são digitados no terminal (a senha não aparece na tela).
// Uso: GOOGLE_APPLICATION_CREDENTIALS=/caminho/sa.json FIREBASE_DATABASE_URL=https://xxx.firebaseio.com node scripts/criar-admin.mjs
import readline from 'node:readline';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const url = process.env.FIREBASE_DATABASE_URL;
if (!url || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS e FIREBASE_DATABASE_URL.');
  process.exit(1);
}

function perguntar(texto, oculto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (s) => { if (s.includes(texto)) rl.output.write(s); };
    }
    rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write('\n'); resolve(r.trim()); });
  });
}

const nome = await perguntar('Nome completo: ');
const email = (await perguntar('E-mail de login: ')).toLowerCase();
const senha = await perguntar('Senha (mín. 10 caracteres, não será exibida): ', true);
if (nome.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) { console.error('Nome ou e-mail inválido.'); process.exit(1); }
if (senha.length < 10 || !/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/\d/.test(senha)) {
  console.error('Senha fraca: use 10+ caracteres com maiúscula, minúscula e número.'); process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: url });
let user;
try { user = await admin.auth().createUser({ email, password: senha, displayName: nome }); }
catch (e) {
  if (e.code === 'auth/email-already-exists') user = await admin.auth().getUserByEmail(email);
  else throw e;
}
await admin.database().ref(`usuarios/${user.uid}`).set({
  nome, email, cargo: 'Administrador', ativo: true, primeiroAcesso: false, criadoEm: admin.database.ServerValue.TIMESTAMP,
});
await admin.database().ref('sistema/inicializado').set(true);
console.log(`\nAdministrador criado (uid ${user.uid}). Faça login pelo sistema.`);
process.exit(0);
