# Padrão de qualidade — sistemas do HRPI

Vale para o **Controle de Recepção** e para o **Centro Cirúrgico (ExaGestão)**. Ao criar ou alterar uma tela, siga a lista.

## Visual
- Mesma identidade: azul-marinho `#0B3B5C` (primária), verde-água `#00C9B7` (destaque), menu lateral escuro, cartões claros, fonte Inter.
- Tela de login: foto à esquerda (~65%), texto de boas-vindas sobre a imagem, formulário à direita. A foto fica **embutida no código** (sem depender de internet).
- Conteúdo ocupa **toda a largura útil** (sem caixas centralizadas estreitas); tabelas e listas crescem com a tela.
- Tema claro e escuro; contraste suficiente nos dois.

## Carregamento e erros (nada de "tela travada")
- Menu e cabeçalho **nunca** somem durante o carregamento: só a área da página mostra o esqueleto (`Suspense` dentro do layout).
- Toda leitura do banco tem tratamento de erro: em falha, a tela sai do "carregando" e mostra aviso com botão "Tentar de novo".
- `ErrorBoundary` na raiz e na área de conteúdo; falha de pacote após atualização do sistema recarrega a página uma vez.
- Páginas secundárias são pré-carregadas quando o navegador está ocioso.
- Indicador de conexão (offline) visível.

## Fluxo de trabalho
- Primeiro campo com foco; Enter confirma sugestões; Esc fecha; setas navegam.
- Autocomplete **sempre ajuda e nunca bloqueia**: o texto digitado vale mesmo sem sugestão.
- Memória só **em memória do sistema** (calculada dos registros) — nenhum dado pessoal em `localStorage`/IndexedDB (LGPD). Preferências não pessoais (ex.: último setor) podem ser guardadas no navegador.
- Após salvar: formulário limpo, mantém o contexto útil (setor) e devolve o cursor ao início.

## Qualidade técnica (antes de entregar)
1. `npx tsc -b --noEmit` sem erros.
2. `npm test` passando.
3. `npm run build` concluído.
4. Abrir cada tela alterada e testar o fluxo principal (entrada, saída, troca etc.).
5. Declarar no relatório apenas o que foi realmente executado.
