// ============================================
// 00-partials-loader.js
// Carrega os fragmentos de HTML (partials/*.html) e injeta no DOM.
// ------------------------------------------
// O index.html agora é só a "casca" do sistema: tela de login, sidebar
// e cabeçalho. O conteúdo de cada página (Painel, Entrada, Saída,
// Usuários, etc.) e os modais vivem em arquivos HTML separados dentro
// de partials/, um por assunto — assim fica muito mais fácil abrir só
// o arquivo da página que você precisa editar, em vez de vasculhar um
// index.html gigante.
//
// IMPORTANTE: como isso usa fetch() para ler arquivos locais, o sistema
// precisa ser aberto por um servidor HTTP (Vercel, "npx serve",
// "python -m http.server" etc.) — não funciona abrindo o index.html
// direto no navegador (file://), pois o navegador bloqueia esse tipo
// de leitura de arquivo local por segurança.
// ============================================

const HRPI_PARTIALS = {
    // injetados em #pagesContainer, dentro de <main>
    pagesContainer: [
        'partials/dashboard.html',
        'partials/entrada.html',
        'partials/visita.html',
        'partials/bloqueios.html',
        'partials/troca.html',
        'partials/saida.html',
        'partials/ativos.html',
        'partials/historico.html',
        'partials/relatorios.html',
        'partials/usuarios.html',
        'partials/configuracoes.html',
        'partials/logs.html',
        'partials/diagnostico.html',
    ],
    // injetados em #modalsContainer, logo após a tela de login
    modalsContainer: [
        'partials/modals.html',
    ],
};

async function carregarPartials() {
    for (const [containerId, arquivos] of Object.entries(HRPI_PARTIALS)) {
        const container = document.getElementById(containerId);
        if (!container) continue;
        const conteudos = await Promise.all(arquivos.map(async (caminho) => {
            const resp = await fetch(caminho);
            if (!resp.ok) throw new Error(`Falha ao carregar ${caminho} (HTTP ${resp.status})`);
            return resp.text();
        }));
        container.innerHTML = conteudos.join('\n');
    }
}
