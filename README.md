# HRPI — Sistema de Controle de Recepção
## Análise técnica e melhorias aplicadas (v2.1)

Este documento resume a análise feita sobre o sistema (`index.html`, `script.js`,
`style.css`) e o que foi alterado nesta versão.

---

## 1. Visão geral do sistema

O sistema é uma aplicação web (HTML/CSS/JS puro, sem framework) que usa o
**Firebase Realtime Database** como backend, com login próprio (usuário/senha
guardados no banco), controle de entrada/saída de acompanhantes e visitantes,
dashboard gerencial com gráficos (Chart.js), relatórios em PDF (jsPDF) e
exportação em Excel/CSV. É um sistema funcional e bem estruturado para o que
se propõe — a base estava sólida (sanitização de HTML já era usada de forma
consistente nas listagens, tratamento de erros com `try/catch`, UI responsiva,
log de auditoria já existente).

Os pontos abaixo são o que foi encontrado e o que foi corrigido/priorizado.

---

## 2. Problemas críticos encontrados e corrigidos

### 2.1. Senhas gravadas em texto puro no banco de dados — **corrigido**
O sistema salvava e comparava senhas diretamente (`user.senha === senha`).
Qualquer pessoa com acesso de leitura ao banco (ou ao próprio navegador,
via DevTools) via a senha de todos os usuários em texto puro.

**O que foi feito:** as senhas agora são armazenadas como hash SHA-256 com
"salt" aleatório por usuário (`senhaHash` + `salt`), usando a Web Crypto API
nativa do navegador. Contas antigas (com o campo `senha` em texto puro) são
**migradas automaticamente** para o novo formato no primeiro login bem-sucedido
— não é necessário resetar senha de ninguém.

> Observação honesta: hashing no lado do cliente é uma melhoria real (o valor
> gravado no banco deixa de ser reversível), mas não substitui um backend de
> autenticação de verdade. Veja a seção 4 (recomendações futuras).

### 2.2. Banco de dados sem regras de segurança — **mitigado, requer ação sua**
Não havia arquivo de regras do Firebase no projeto — ou seja, dependendo da
configuração do console, o banco podia estar **aberto para leitura/escrita por
qualquer pessoa na internet** que soubesse a URL (que já fica visível no
próprio HTML/JS do site).

**O que foi feito:**
- Adicionado `database.rules.json` exigindo `auth != null` para qualquer
  leitura/escrita.
- Adicionada autenticação anônima do Firebase (`firebase.auth().signInAnonymously()`)
  para que essas regras funcionem sem exigir uma reforma completa do sistema
  de login agora.

**Ação necessária de sua parte para isso funcionar em produção:**
1. No Firebase Console → **Authentication → Sign-in method**, habilite o
   provedor **Anônimo**.
2. No Firebase Console → **Realtime Database → Regras**, cole o conteúdo do
   arquivo `database.rules.json` (ou publique via Firebase CLI:
   `firebase deploy --only database`).

Sem isso, o login vai ficar preso em "Conectando..." — o sistema foi feito
para falhar de forma visível, não silenciosa.

> Isso impede que qualquer cliente **não autenticado** acesse o banco, mas
> autenticação anônima ainda permite que qualquer visitante do site "entre"
> anonimamente. Para segurança real por usuário/papel (ex.: só Administrador
> pode escrever em `usuarios`), é necessário migrar para Firebase
> Authentication de verdade (e-mail/senha ou custom tokens) — ver seção 4.

### 2.3. Sessão sem expiração por inatividade real — **corrigido**
O tempo limite de sessão (`SESSION_TIMEOUT`, 30 min) só era checado quando a
página era recarregada. Um usuário que deixasse a aba aberta continuava
"logado" indefinidamente, mesmo sem usar o sistema.

**O que foi feito:** monitor de atividade real (mouse, teclado, toque, scroll)
que desloga automaticamente após 30 minutos sem interação, com aviso via
toast.

---

## 3. Outras melhorias aplicadas

- **Validação de nome de usuário** na criação de conta (3-30 caracteres,
  apenas letras/números/`.`/`_`/`-`), e checagem de duplicidade antes de criar.
- **Busca de login otimizada**: em vez de baixar todos os usuários e comparar
  no navegador, agora usa `orderByChild('usuario').equalTo(...)`, que também
  é o que permite as regras de segurança funcionarem por índice
  (`.indexOn` já incluso nas regras).
- **Feedback visual consistente** (spinners e botões desabilitados) em todas
  as ações assíncronas relacionadas a login/senha, evitando duplo-clique.

### 3.1 Máscara de telefone
Os três campos de telefone (`acTelefone`, `visTelefone`, `trocaNovoTelefone`)
agora formatam automaticamente enquanto o usuário digita:
`(00) 00000-0000` / `(00) 0000-0000`.

### 3.2 Controle de papel já existia, mas só no cliente
O sistema já escondia o menu "Usuários" para quem não é Administrador/
Supervisor — isso é bom para UX, mas **não é segurança**: hoje, com a regra
`auth != null`, qualquer sessão autenticada (mesmo anônima) tecnicamente
consegue escrever direto no nó `usuarios` via chamada de API, contornando a
interface. Reforça o ponto da seção 4.1: só migrando para Firebase
Authentication com "custom claims" de papel é possível impor
`auth.token.role === 'Administrador'` nas regras do banco.

---

## 4. Recomendações para evolução (não aplicadas nesta rodada)

Estas exigem mudanças arquiteturais maiores (geralmente um pequeno backend) e
foram deixadas como recomendação, para não arriscar quebrar o sistema em
produção sem testes junto à equipe de TI do hospital:

1. **Migrar para Firebase Authentication real** (e-mail/senha) com "custom
   claims" de papel (Administrador/Supervisor/Recepcionista/Serviço Social).
   Isso permite regras do tipo `auth.token.role === 'Administrador'`,
   restringindo de verdade quem pode editar usuários, resetar senha etc. —
   hoje qualquer usuário autenticado (mesmo anônimo) tecnicamente consegue
   escrever em qualquer nó se as regras não forem refinadas por papel.
2. **Cloud Function para login**, evitando expor a coleção `usuarios`
   inteira (mesmo que só com hash) ao cliente.
3. **Máscaras e validação de CPF/telefone** nos formulários de cadastro de
   acompanhante, hoje aceitando texto livre.
4. **Testes automatizados** básicos (mesmo que só smoke tests com Playwright)
   para os fluxos críticos: login, registrar entrada/saída, gerar relatório.
5. **Divisão do `script.js`** (hoje ~2.600 linhas em um único arquivo) em
   módulos (`auth.js`, `acompanhantes.js`, `relatorios.js`, `dashboard.js`)
   para facilitar manutenção.

---

## 5. Atualizações desta rodada (v2.2)

### 5.1 Registro de Saída — fluxo único
A tela tinha duas formas de registrar saída (busca rápida + formulário com
lista suspensa), fazendo a mesma coisa de jeitos diferentes. Ficou só o
fluxo por busca — que já era o mais prático — agora com o campo de
**motivo da saída visível e editável nele também** (antes a busca rápida
usava sempre "Fim do horário de visita" fixo, sem opção de trocar).

### 5.2 Contadores do Dashboard separados por tipo
Os cartões "Entradas Hoje" e "Saídas Hoje" somavam acompanhantes e
visitantes num único número. Agora são 4 cartões: **Entradas de
Acompanhantes**, **Entradas de Visitantes**, **Saídas de Acompanhantes** e
**Saídas de Visitantes** — cada um contando só o que diz o nome.

### 5.3 Cores centralizadas em variáveis (fácil de trocar)
Cores que antes estavam espalhadas e repetidas pelo `style.css` (cartões do
dashboard, badges de status) agora são controladas por variáveis no topo do
arquivo, dentro de `:root` (tema claro) e `body.dark-theme` (tema escuro):

```css
:root {
    /* Cores dos cartões do Dashboard Gerencial */
    --stat-pacientes: #1a6b7a;
    --stat-entradas-acomp: #2d8b4e;
    --stat-entradas-visit: #2980b9;
    /* ... */
}
```

Para trocar a identidade visual do sistema (ex.: cor de um hospital
específico), normalmente basta editar `--primary`, `--primary-dark` e
`--secondary` no topo do `style.css` — o resto do sistema (botões, links,
cabeçalho, foco de campos) já herda dessas variáveis.

### 5.4 Índice de navegação no `script.js`
Foi adicionado um comentário-índice logo no início do arquivo, listando
onde encontrar cada bloco de funcionalidade (login, dashboard, formulários,
usuários, relatórios etc.), para facilitar manutenções futuras sem precisar
ler o arquivo inteiro.


## 6. Atualizações desta rodada (v2.3)

### 6.1 Busca também na Troca de Acompanhante
A tela de Troca de Acompanhante tinha uma lista suspensa para escolher quem
está sendo substituído. Segue o mesmo padrão já usado no Registro de Saída:
agora é uma busca por nome do acompanhante, do paciente ou documento — mais
rápido quando há muita gente internada.

### 6.2 Bug dos logs "parando" em 31/07/2026 — corrigido
O log não tinha parado de registrar — era um bug de **ordenação**. As
entradas eram comparadas como texto puro no formato `DD-MM-AAAA`, e nesse
formato `"01-08-2026"` (1º de agosto) é lexicograficamente **menor** que
`"31-07-2026"` (31 de julho), então todo log do início de agosto (dias
01 a 09) ficava posicionado *abaixo* do último log de julho na lista — dando
a impressão de que o sistema tinha parado. A partir de agora, a ordenação
usa data real (e os logs novos passam a guardar também um `timestamp`
numérico, ainda mais confiável). **Os logs anteriores a esta correção
continuam no banco** — eles só não estavam sendo exibidos na ordem certa
antes; nada foi perdido.

### 6.3 Botão "Limpar Logs"
Novo botão na tela de Logs (só para Administrador/Supervisor), que pergunta
quantos dias de histórico manter (ou apaga tudo, se deixado em branco), com
confirmação antes de executar — e o próprio ato de limpar gera um log,
mantendo rastreabilidade.

### 6.4 Painel Gerencial sem filtro — sempre mês atual completo
Removido o filtro de período/setor/recepcionista. O painel agora mostra
sempre os dados completos do mês corrente (dia 1 até hoje), com um rótulo
indicando qual mês está sendo exibido.

### 6.5 Confirmação de presença — o problema do acompanhante "esquecido"
Este era o ponto mais delicado: acompanhantes de pacientes que recebem alta
às vezes saem do hospital sem que a recepção registre a saída no sistema, e
o acompanhante continua contando como "presente" indefinidamente — inflando
a contagem de refeições que a nutrição prepara.

**Por que não foi feito um "auto-encerramento" automático por tempo:**
diferente de uma visita (que tem duração curta e já se encerra sozinha
automaticamente), um acompanhante de internação pode legitimamente ficar
dias ou semanas no hospital. Expirar automaticamente depois de X horas
removeria da lista gente que ainda está lá de verdade — o que seria pior
para a nutrição do que o problema atual (cortaria comida de quem precisa,
em vez de contar comida a mais para quem já saiu).

**A lógica adotada — confirmação periódica de presença:**
- Cada acompanhante ganha um campo `ultimaConfirmacao`, atualizado na
  entrada e sempre que alguém confirma a presença dele.
- Na tela **Acompanhantes Ativos**, quem está há `2` dias ou mais sem
  confirmação (configurável em `CONFIG.DIAS_ALERTA_PRESENCA` no topo do
  `script.js`) aparece com um botão de alerta **"Confirmar (Xd)"** — a
  recepção clica se ele ainda está lá, ou registra a saída dele se já foi
  embora.
- Um botão **"Confirmar Presença de Todos"** permite confirmar todo mundo
  de uma vez, para o dia a dia em que está tudo certo (rotina rápida de
  início de plantão).
- O **Painel Gerencial** mostra um banner de alerta destacado sempre que
  houver acompanhantes pendentes de confirmação, visível para qualquer
  usuário logado (não só Administrador) — já que isso afeta diretamente o
  trabalho da nutrição e de quem mais depender desse número.

Isso não resolve o problema "no automático" (nenhuma lógica resolveria sem
arriscar dados errados em algum sentido), mas transforma um erro invisível
(alguém achando que os números "estão certos" quando não estão) em um
alerta visível que a equipe consegue resolver em poucos cliques.

## 7. Atualizações desta rodada (v2.4)

### 7.1 Saída de visitantes 100% automática
A recepção não registra mais a saída de visitantes manualmente. A duração
da visita ficou fixa em 1 hora (o campo de duração foi removido do
formulário) e a rotina que já existia no sistema (`encerrarVisitasExpiradas`,
que roda a cada 30 segundos) dá baixa automaticamente quando o tempo
acaba. Visitantes também saíram da busca da tela de Saída — só
acompanhantes aparecem lá agora, já que são os únicos que precisam de
baixa manual.

### 7.2 Histórico do paciente
Clicar no nome do paciente (no Histórico ou em Acompanhantes Ativos) abre
um modal com a linha do tempo completa dele: todas as entradas e saídas de
acompanhantes e visitantes, e todas as trocas de acompanhante registradas
— com um resumo no topo (quantos acompanhantes diferentes já passou,
quantas visitas, quantas trocas).

### 7.3 Painel — acompanhantes e visitantes sempre separados
- Dois novos cartões no topo: **Acompanhantes Presentes Agora** e
  **Visitantes Presentes Agora** — o número que mais importa para a rotina
  do dia a dia, agora nunca somado.
- O gráfico "Movimentação Semanal" virou **"Entradas da Semana por Tipo"**,
  com uma barra para acompanhantes e outra para visitantes (antes misturava
  tudo em "Entradas" e "Saídas" genéricas).
- O gráfico de setores foi renomeado para deixar claro que é só de
  acompanhantes (visitantes ficam pouco tempo — 1h — então essa visão não
  faz sentido para eles).

### 7.4 Relatórios em PDF reorganizados
O resumo do período, que antes era uma lista de números corridos, virou
dois blocos visuais bem separados — **ACOMPANHANTES** e **VISITANTES** —
cada um com suas próprias entradas, saídas e quantos estão presentes agora.
A tabela "Movimentação por Setor" também passou a mostrar as colunas de
acompanhantes e visitantes lado a lado, em vez de um total misturado. Na
tabela detalhada, a coluna de status agora tem cores (verde para presente,
vermelho para saiu, laranja para trocado), facilitando a leitura rápida por
quem for extrair indicadores do relatório.

### 7.5 Interface e segurança
- Adicionado favicon, meta tags de SEO/privacidade (`robots: noindex`) e
  uma política de segurança de conteúdo (**Content-Security-Policy**) no
  `<head>`, restringindo de onde o sistema pode carregar scripts e para
  onde pode enviar dados — mesmo que uma falha de segurança permita
  injetar código malicioso, ele não consegue mandar dados para um domínio
  fora da lista (Firebase e as bibliotecas já usadas pelo sistema).
  **Limitação honesta:** como o sistema usa bastante `onclick=""` inline
  nos botões, a política precisou permitir `'unsafe-inline'` para scripts
  — isso não é uma proteção completa contra XSS, mas ainda bloqueia o
  vazamento de dados para fora da lista de domínios permitida. Uma
  reforma futura trocando os `onclick` inline por `addEventListener`
  fecharia essa brecha por completo (fica como recomendação na seção 4).
- Tela de login com o nome do hospital em destaque, botão de
  mostrar/ocultar senha, e cores unificadas com o resto do sistema (antes
  usava um verde ligeiramente diferente do tema, um detalhe que passava
  despercebido mas quebrava a identidade visual).
- Rodapé do menu lateral agora mostra a versão do sistema.

## 8. Correção urgente — v2.4.1 (login bloqueado)

Depois de publicada a v2.4, o login parou de funcionar em produção. O
console do navegador mostrou dois problemas:

### 8.1 CSP bloqueando o próprio Firebase Auth — corrigido
A Content-Security-Policy adicionada na v2.4 estava bloqueando a chamada
que o Firebase Auth faz para `identitytoolkit.googleapis.com`, além de um
`service-worker.js` que aparece no console (aparentemente da hospedagem
usada, algo chamado "HelpHosp" — não faz parte deste sistema; se você
souber o que é isso, me diga que eu ajusto a lista corretamente).

**A causa raiz:** `Content-Security-Policy-Report-Only` (o modo "só avisa,
não bloqueia") só pode ser configurado por cabeçalho HTTP do servidor —
**não existe essa opção via `<meta>` tag**, que é a única forma disponível
num arquivo HTML estático como este. Ou seja, a política que coloquei já
nasceu em modo "bloqueia de verdade", sem eu conseguir testá-la em modo
seguro primeiro. Por isso, **removi a tag CSP** nesta correção — é melhor
o sistema funcionar sem essa camada extra do que ficar bloqueando login.

Se no futuro você quiser reativar essa proteção, o jeito certo é configurar
o cabeçalho `Content-Security-Policy-Report-Only` na hospedagem (Firebase
Hosting tem isso em `firebase.json` → `hosting.headers`; outras
hospedagens costumam ter um arquivo `_headers` ou configuração parecida),
rodar em modo relatório por alguns dias observando o console, ajustar a
lista de domínios permitidos com base no que aparecer, e só então trocar
para o cabeçalho `Content-Security-Policy` (modo que bloqueia de verdade).

### 8.2 `auth/configuration-not-found` — ação sua no Firebase Console
Esse erro é diferente do CSP: ele significa que o produto **Authentication**
do Firebase ainda não foi inicializado no projeto (é um passo anterior a
simplesmente habilitar o provedor Anônimo). Para resolver:

1. Firebase Console → **Build → Authentication** → clique em **"Get
   Started"** (só aparece esse botão se o produto nunca foi ativado nesse
   projeto).
2. Depois disso, vá em **Sign-in method** e habilite o provedor **Anônimo**.
3. Recarregue o sistema e tente logar novamente.

## 9. Atualizações desta rodada (v2.5)

### 9.1 Bloqueio de acompanhante duplicado — agora ativo por padrão
O sistema já tinha uma verificação para isso, mas vinha desligada por
padrão (só mostrava um aviso que dava pra ignorar clicando "OK"). Isso
explica a diferença que apareceu no seu painel entre "Acompanhantes
Presentes" (105) e "Pacientes c/ Acompanhante" (101) — 4 pacientes tinham
mais de um acompanhante ativo ao mesmo tempo.

**O que mudou:**
- O bloqueio agora vem **ativado por padrão** (dá pra desativar em
  Configurações, se algum setor realmente precisar de mais de um
  acompanhante por paciente, mas o recomendado é manter ligado).
- Quando alguém tenta cadastrar um segundo acompanhante para um paciente
  que já tem um presente, o sistema mostra quem já está registrado e
  oferece um atalho direto para **Troca de Acompanhante** — o fluxo certo
  quando é para substituir, em vez de deixar os dois ativos.
- Para os **4 casos que já existiam** no seu banco antes dessa mudança
  (o bloqueio novo não corrige duplicidade retroativa sozinho), adicionei
  um alerta no topo do Painel Gerencial que lista exatamente quais
  pacientes estão duplicados, com um botão "Resolver agora" que abre a
  lista de quem dar saída, um clique por acompanhante. As linhas
  duplicadas também ficam destacadas em vermelho claro na tela de
  Acompanhantes Ativos.

### 9.2 Painel Gerencial reorganizado
Os cards estavam numa lista só, sem contexto, o que deixava confuso
(por exemplo, "Acompanhantes Presentes" ao lado de "Pacientes c/ Acomp."
sem explicar a diferença entre os dois). Reorganizei em 3 grupos com
título:

- **Presença Agora** — Acompanhantes Presentes (já mostra "para N
  pacientes" embaixo do número, e sinaliza duplicidade ali mesmo) e
  Visitantes Presentes.
- **Movimentação de Hoje** — Entradas e Saídas viraram cards únicos com
  os dois números lado a lado (Acompanhantes | Visitantes) em vez de 4
  cards separados — menos caixas na tela, sem perder a separação dos
  números. Trocas e Altas continuam como estavam.
- **Indicadores do Mês** — Média Diária de Visitas e Permanência Média.

De 11 cards soltos para 8, organizados e com um motivo claro para cada
grupo existir.

## 10. Correção urgente — v2.5.1 (login "usuário não encontrado")

Depois da v2.5, alguns usuários não conseguiam logar mesmo com usuário e
senha corretos — como se a conta não existisse.

**Causa raiz:** um bug que eu mesmo introduzi na v2.1, ao trocar a forma de
buscar o usuário no banco. A busca passou a comparar o texto exatamente
como digitado (`"Recepcao1"`), mas todo usuário cadastrado pelo sistema é
salvo sempre em minúsculas (`"recepcao1"`) — então, se a pessoa digitasse
o nome de usuário com qualquer letra maiúscula (bem comum, por hábito de
digitação), a busca não encontrava ninguém e mostrava "Usuário ou senha
inválidos", exatamente como se a conta não existisse.

**Correção:** o texto digitado agora é convertido para minúsculas antes de
buscar no banco (igual já acontecia na hora de criar o usuário). Também
adicionei uma segunda tentativa de busca, mais tolerante, para o caso de
existir algum usuário cadastrado direto no banco (fora do formulário do
sistema) com letras diferentes do padrão.

**Confirmado que não é problema de configuração do Firebase:** as regras
do Realtime Database enviadas foram:
```
{ "rules": { ".read": true, ".write": true } }
```
Ou seja, o banco está totalmente aberto — qualquer leitura/escrita é
permitida, com ou sem login. Isso descarta de vez o Firebase como causa do
login falhar, mas é, por si só, um problema de segurança real: qualquer
pessoa que souber a URL do seu projeto Firebase consegue ler e alterar os
dados de acompanhantes e pacientes sem autenticação nenhuma. Fica como
próximo passo recomendado (não fiz agora para não arriscar travar o acesso
de novo antes de confirmar que o login voltou ao normal): publicar o
`database.rules.json` deste pacote e, dessa vez, também completar a
inicialização do Authentication + Anônimo no Firebase Console (passo a
passo que te mandei no chat), já que as duas coisas precisam andar juntas.

## 11. Atualizações desta rodada (v2.6)

### 11.1 Indicadores do Mês — só para Supervisor/Administrador
"Média Diária de Visitas" e "Permanência Média" saíram da visão da
recepcionista — são números de gestão, não algo que ela precisa checar no
dia a dia. Continuam visíveis para Administrador e Supervisor, junto com
os gráficos e insights (que já eram restritos a esses dois papéis).
Recepcionista agora vê só "Presença Agora" e "Movimentação de Hoje" — o
que ela realmente usa no trabalho.

### 11.2 Paleta de cores profissional
A cor principal do sistema era um verde vibrante (`#10b981`), que lembra
mais um app de startup do que um sistema hospitalar — e nem combinava com
o teal usado na logo/favicon e em vários cartões do painel. Unifiquei tudo
em uma paleta única baseada em teal/azul profissional (a mesma cor da
logo), reservando verde, âmbar e vermelho **só para o significado**
(sucesso, alerta, perigo) e não mais como cor de marca. Como todo o CSS já
usava variáveis (`--primary`, `--secondary` etc.), a nova paleta se
propagou automaticamente por sistema inteiro — login, botões, menu,
cabeçalhos — sem precisar caçar cor por cor.

### 11.3 Segurança
Ver seção 12 abaixo — nesta rodada o foco de segurança foi te guiar pelos
passos do Firebase Console (que só você consegue fazer, por serem ações
na sua conta), já que o código em si já reúne boa parte do que dá pra
fazer do lado do sistema (senha com hash, sessão com expiração por
inatividade, limite de tentativas de login, sanitização de entradas).

## 12. Arquivos desta entrega

- `index.html`, `script.js`, `style.css` — sistema atualizado.
- `database.rules.json` — regras de segurança recomendadas para o Firebase
  Realtime Database (precisa ser publicada manualmente, ver seção 2.2).
- `README-MELHORIAS.md` — este documento.

---

