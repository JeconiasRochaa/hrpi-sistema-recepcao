# HRPI · Controle de Recepção (v3.2 — React + TypeScript)

Sistema de recepção hospitalar: entrada de acompanhantes, visitas, troca de acompanhantes, saídas, histórico por paciente (com PDF), bloqueios, relatórios, auditoria e conformidade com a LGPD.

**Stack:** Vite · React 18 · TypeScript · Tailwind · Radix UI · Firebase Auth + Realtime Database · jsPDF.

## Novidades da v3.2
- **Início** (logo do hospital ao centro) como 1ª tela; o painel gerencial ficou em *Painel gerencial*. **Menu em acordeão**: só abre o grupo clicado.
- **Usuários**: só **nome + login** são obrigatórios; e-mail e telefone são opcionais. Quem esquece a senha: ver *Usuários → Redefinir senha*.
- **PDF por paciente** não trava mais (agrupamento em uma passada + busca adiada).
- **Lista para a nutrição**: nova tela (por setor e leito, filtros, PDF para imprimir e CSV).
- Removido o "quem está online"; ficam só os **logs de auditoria**.

## Novidades da v3.1
- **Sem travar no carregamento:** o menu fica sempre visível; só a área da página mostra o esqueleto. Erros de leitura/permissão/conexão saem do "carregando" e mostram aviso com **Tentar de novo**; falhas inesperadas caem num `ErrorBoundary`.
- **Tela cheia:** o conteúdo usa toda a largura; Entrada, Visita, Saída e Troca ganharam painel lateral com quem está no hospital (clique para selecionar).
- **Login** com a foto da recepção embutida no código (`src/assets/login-recepcao.jpg`), no mesmo padrão do Centro Cirúrgico.
- **Autocomplete com memória** (sem guardar dados pessoais no navegador): paciente conhecido traz setor e leito; acompanhante que já passou pela recepção preenche documento, telefone e parentesco; leitos sugeridos por setor; último setor lembrado; busca da saída/troca mostra as entradas recentes; destaque do trecho digitado; navegação por teclado.
- Padrão visual/qualidade comum aos sistemas: `docs/PADRAO_DE_QUALIDADE.md`.

## 1. Configuração

1. `npm install`
2. O arquivo `.env.local` (que vai no ZIP, **mas nunca para o GitHub**) já traz as chaves do projeto `hrpi-sistema-recepcao`. Para outro projeto, copie `.env.example` para `.env.local` e preencha.
3. No Firebase Console:
   - **Authentication → Método de login:** ative *E-mail/senha* (e desative cadastro livre de outras formas).
   - **Realtime Database → Regras:** publique o conteúdo de `database.rules.json` (ou `firebase deploy --only database`).
   - **Google Cloud → Credenciais:** restrinja a chave de API aos domínios do seu site (referenciadores HTTP).
   - (Opcional, recomendado) ative o **App Check** com reCAPTCHA v3 e preencha `VITE_APPCHECK_SITE_KEY`.
4. **Primeiro administrador (jeito mais fácil):** depois de publicar as regras, crie sua conta em *Authentication → Users → Adicionar usuário* (e-mail e senha), abra o sistema e faça login. Como ainda não há administrador, o sistema mostra a tela **Configuração inicial**: informe seu nome e clique em *Tornar-me administrador*. Isso grava seu perfil e fecha a porta (nó `sistema/inicializado`); depois disso ninguém mais consegue se promover. Faça logo após publicar as regras.
   - Alternativa por terminal (sem senha em código): `GOOGLE_APPLICATION_CREDENTIALS=/caminho/conta-servico.json FIREBASE_DATABASE_URL=https://SEU-PROJETO.firebaseio.com node scripts/criar-admin.mjs`
   Os demais usuários são criados na tela **Usuários**: só nome + login + cargo. Todos começam com a **senha inicial padrão** (`hrpi12345`, ou o valor de `VITE_SENHA_PADRAO`) e são obrigados a trocá-la no primeiro acesso. Cargos: Administrador, Supervisor, Recepcionista, Serviço Social e **Nutrição** (só vê a Lista para nutrição). Dá para **desativar** (reversível) e **excluir** usuários, e **vincular contas já existentes** no Firebase Authentication pelo UID.
5. Usuários do sistema antigo precisam ser recriados (o login antigo guardava hashes de senha no banco). Para apagar esses registros: `node scripts/limpar-usuarios-legado.mjs` (simulação) e `--executar` (remove).
6. `npm run dev` para desenvolver · `npm run build` para produção.

## 2. Publicar: GitHub + Vercel
1. **GitHub** (repositório *privado*): `git init && git add . && git commit -m "HRPI Recepção" && git branch -M main && git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git && git push -u origin main`.
   O `.gitignore` já impede o envio de `.env.local`, chaves de serviço (`serviceAccount*.json`), backups e `node_modules`. Antes do `git add`, rode `git status` e confirme que `.env.local` **não** aparece.
2. **Vercel**: *Add New → Project* → importe o repositório (Framework: Vite). Em **Settings → Environment Variables**, cadastre as variáveis do arquivo `VARIAVEIS-VERCEL.txt` (entregue à parte) para *Production*, *Preview* e *Development*. Clique em **Deploy**.
3. **Firebase**: em *Authentication → Settings → Domínios autorizados*, adicione o domínio da Vercel (`seu-projeto.vercel.app`). Ative *Authentication → Método de login → E-mail/senha* e publique as regras (`database.rules.json`).
4. Restrinja a chave de API no Google Cloud (Credenciais → HTTP referrers) ao domínio da Vercel.
5. **Primeiro administrador:** em *Authentication → Usuários → Adicionar usuário* crie `admin@recepcao.hrpi.local` com uma senha forte; abra o sistema, entre com o usuário `admin` e conclua a *Configuração inicial*. Os demais são criados em **Usuários** (só nome + login).

> **Sobre "esconder" as chaves:** a chave do app web do Firebase vai, por natureza, dentro do JavaScript que o navegador baixa — nenhuma hospedagem consegue escondê-la de quem abre o site. Por isso ela não é um segredo e **não dá acesso aos dados**: quem protege são o login e as **regras do banco**. O que este projeto faz: não coloca as chaves no GitHub (ficam em `.env.local` e nas variáveis da Vercel), restringe a chave por domínio e (opcional) usa o App Check. Segredos *de verdade* (contas de serviço) nunca entram no projeto.

### Cabeçalhos de segurança

`vercel.json` já traz CSP restrita, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` e cache de assets. Em Firebase Hosting, replique esses cabeçalhos em `firebase.json`.

## 3. Segurança
- Nenhum login, senha ou chave no código; configuração via variáveis de ambiente.
- Autenticação pelo Firebase Auth (sessão encerra ao fechar o navegador; logout por inatividade em 30 min).
- As regras do banco exigem perfil **ativo** e **cargo** (`usuarios/{uid}`); contas criadas por terceiros no Auth não leem nem gravam nada. Logs de auditoria são imutáveis; validação de formato/tamanho em todos os campos.
- Cargos: Administrador, Supervisor (não gerencia Administradores), Recepcionista, Serviço Social.
- Saída de dados: React escapa tudo; CSV neutraliza injeção de fórmulas; sem dados pessoais em localStorage/IndexedDB.
- Regenere as regras com `node scripts/gerar-regras.mjs` e teste com `npm run rules:test`.

## 4. LGPD (o que o sistema faz)
Minimização (documento/telefone mascarados; exibir o documento é registrado em auditoria), logs sem nome completo, retenção configurável (registros 60 dias, logs 180 dias; mínimo de 30 dias imposto pelas regras), anonimização a pedido do titular, aviso de privacidade (menu *LGPD e privacidade*) com campos do encarregado (DPO), PDFs com rodapé de confidencialidade.

## 5. Limitações honestas
- Nenhum sistema é "não hackeável". Este reduz a superfície de ataque, mas depende de configuração correta (chave restrita, App Check, 2FA nas contas do Firebase/Google Cloud, backups, patching).
- As regras foram testadas com o simulador *targaryen* (`npm run rules:test`), **não** com o emulador oficial do Firebase (indisponível no ambiente de desenvolvimento). Rode-as no emulador antes de ir para produção.
- O bloqueio de tentativas de login é feito no cliente + proteção nativa do Firebase Auth; contas excluídas do Auth devem ser removidas também pelo Console.
- Revise o aviso de privacidade e os prazos de retenção com o jurídico/encarregado do hospital.


## v3.3 — resumo

- Novo cargo **Nutrição**: login próprio, vê apenas a Lista para nutrição (as regras do banco só deixam esse perfil consultar acompanhantes **presentes**).
- Usuários: lista tolerante a cadastros antigos/incompletos, desativar/reativar, excluir, vincular conta existente por UID.
- Senha inicial padrão (o Firebase exige mínimo de 6 caracteres; "12345" não é aceita). Troca obrigatória no 1º acesso.
- Logs: gravação direta, erro de gravação/leitura é exibido (com o código do banco) em vez de ficar em silêncio. **Republique `database.rules.json` no Firebase** a cada versão.
