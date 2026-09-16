// ============================================
// 23-app-start.js
// Mensagens finais de inicialização no console.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// INICIALIZAÇÃO FINAL
// ------------------------------------------
// Este é o ÚLTIMO script carregado — por isso é o lugar certo para
// disparar o carregamento dos partials e, só depois que eles chegarem,
// chamar iniciarAplicacao() (definida em js/04-dom-init.js). Rodar isso
// aqui (e não direto em "DOMContentLoaded") garante que todo o resto do
// código já foi definido antes de ser chamado.
// ============================================
carregarPartials().then(() => {
    if (typeof iniciarAplicacao === 'function') {
        iniciarAplicacao();
    } else {
        console.error('iniciarAplicacao() não foi encontrada — verifique se js/04-dom-init.js foi carregado.');
    }

    console.log('✅ HRPI - Sistema de Controle de Recepção carregado com sucesso!');
    console.log('🔑 Funcionalidades:');
    console.log('   ✅ Primeiro acesso com troca de senha obrigatória');
    console.log('   ✅ Múltiplos cargos: Admin, Supervisor, Serviço Social, Recepcionista');
    console.log('   ✅ Controle de permissões por cargo');
    console.log('   ✅ Busca global com autocomplete');
    console.log('   ✅ Gráficos e indicadores para gestores');
    console.log('   ✅ Relatórios em PDF e exportação CSV');
    console.log('   ✅ Logs de auditoria completos');
    console.log('   ✅ Bloqueio de visitas por paciente');
    console.log('   ✅ Encerramento automático de visitas expiradas');
    console.log('   ✅ Sistema de crachá para impressão');
    console.log('   ✅ Temas claro e escuro');
    console.log('   ✅ Responsivo para mobile');
}).catch(err => {
    console.error('Erro ao carregar as partes do sistema:', err);
    document.body.innerHTML = `
        <div style="max-width:560px;margin:60px auto;padding:28px 32px;font-family:'Inter',sans-serif;
                    background:#fff;border:1px solid #e6eaf2;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.08);color:#1b2430;">
            <h2 style="margin:0 0 10px;color:#e5484d;">Não foi possível carregar o sistema</h2>
            <p style="margin:0 0 10px;line-height:1.5;">
                O HRPI agora carrega as páginas em arquivos HTML separados (pasta <code>partials/</code>),
                e isso exige que o site seja aberto por um <strong>servidor HTTP</strong> — não funciona
                abrindo o <code>index.html</code> direto no navegador (<code>file://</code>).
            </p>
            <p style="margin:0 0 10px;line-height:1.5;">Se você está testando localmente, rode, na pasta do projeto:</p>
            <pre style="background:#f3f6fb;padding:10px 14px;border-radius:8px;overflow:auto;">npx serve .</pre>
            <p style="margin:0;line-height:1.5;">Em produção (Vercel), isso já funciona normalmente.</p>
        </div>`;
});

