import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

/**
 * Configuração vinda de variáveis de ambiente (arquivo .env.local — não versionado).
 * Nada de credenciais no código-fonte.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const MODO_DEMO = import.meta.env.MODE === 'demo';
export const configuracaoCompleta = MODO_DEMO || Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.databaseURL && firebaseConfig.projectId && firebaseConfig.appId,
);

// Sem configuração, usamos valores fictícios só para o app abrir e mostrar a tela de "configuração ausente"
// (em vez de uma tela branca). Nenhuma conexão real é feita nesse caso.
const cfgEfetiva: FirebaseOptions = configuracaoCompleta ? firebaseConfig : {
  apiKey: 'sem-configuracao', authDomain: 'sem-configuracao.firebaseapp.com', databaseURL: 'https://sem-configuracao-default-rtdb.firebaseio.com', projectId: 'sem-configuracao', appId: '1:0:web:0',
};
export const app = initializeApp(cfgEfetiva);
export const auth = getAuth(app);
export const db = getDatabase(app);

// App Check (opcional): só aceita chamadas vindas do seu site (reCAPTCHA v3).
const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY as string | undefined;
if (siteKey && configuracaoCompleta) {
  import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
  });
}

/** Domínio interno do login por "usuário" (ex.: joao -> joao@recepcao.hrpi.local). Não precisa existir como e-mail. */
export const LOGIN_DOMAIN = (import.meta.env.VITE_LOGIN_DOMAIN as string | undefined)?.trim() || 'recepcao.hrpi.local';
