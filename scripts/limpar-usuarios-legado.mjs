// Remove usuários do sistema antigo (nós em usuarios/ sem "email"), que guardam hashes de senha antigos.
// Uso: GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_DATABASE_URL=... node scripts/limpar-usuarios-legado.mjs [--executar]
// Sem --executar apenas lista (simulação).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const url = process.env.FIREBASE_DATABASE_URL;
if (!url || !process.env.GOOGLE_APPLICATION_CREDENTIALS) { console.error('Defina GOOGLE_APPLICATION_CREDENTIALS e FIREBASE_DATABASE_URL.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: url });
const executar = process.argv.includes('--executar');
const snap = await admin.database().ref('usuarios').get();
const legados = [];
snap.forEach((c) => { const v = c.val(); if (!v || typeof v !== 'object' || !v.email) legados.push(c.key); });
console.log(`${legados.length} usuário(s) legado(s) sem e-mail.`);
if (!executar) { console.log('Simulação. Rode com --executar para remover (recrie os usuários pelo sistema).'); process.exit(0); }
const upd = {}; legados.forEach((k) => { upd[k] = null; });
if (legados.length) await admin.database().ref('usuarios').update(upd);
console.log('Removidos.');
process.exit(0);
