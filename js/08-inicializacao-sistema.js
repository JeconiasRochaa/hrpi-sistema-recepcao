// ============================================
// 08-inicializacao-sistema.js
// Carregamento inicial dos dados do Firebase ao entrar no sistema.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================
function iniciarSistema() {
    db.ref('acompanhantes').on('value', snapshot => {
        acompanhantes = snapshot.val() || {};
        encerrarVisitasExpiradas(); // checa na hora, não espera o intervalo de 30s
        atualizarDashboardGerencial();
        atualizarAtivos();
        atualizarHistorico();
        atualizarSelects();
        atualizarListaPacientes();
        atualizarUltimosRegistros();
    });
    db.ref('bloqueios').on('value', snapshot => { bloqueios = snapshot.val() || {}; });
    inicializarAutocompletePacientes();
    // Se a aba ficou em segundo plano (navegador pode pausar o setInterval)
    // e volta a ficar visível, checa visitas expiradas na hora.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && usuarioLogado) encerrarVisitasExpiradas();
    });
}
function atualizarDataAtual() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Aplica máscara de telefone brasileiro ((00) 00000-0000 / (00) 0000-0000)
// enquanto o usuário digita, sem travar colar/apagar.
function aplicarMascaraTelefone(input) {
    input.addEventListener('input', () => {
        let v = input.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 10) {
            v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
        } else if (v.length > 5) {
            v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        } else if (v.length > 2) {
            v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        } else if (v.length > 0) {
            v = v.replace(/(\d{0,2})/, '($1');
        }
        input.value = v.trim().replace(/-$/, '').replace(/\)\s*$/, ') ');
    });
}
function inicializarMascarasTelefone() {
    document.querySelectorAll('input[type="tel"]').forEach(aplicarMascaraTelefone);
}

