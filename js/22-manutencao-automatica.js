// ============================================
// 22-manutencao-automatica.js
// Rotinas automáticas: encerrar visitas expiradas e limpar registros antigos.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// AUTO-ENCERRAR VISITAS EXPIRADAS
// ============================================
function encerrarVisitasExpiradas() {
    const agora = new Date();
    let encerradas = 0;
    
    Object.values(acompanhantes).forEach(ac => {
        if (ac.status === 'presente' && ac.tipo === 'visita' && ac.duracaoVisita) {
            const [h, m, s] = ac.horaEntrada.split(':');
            const [d, mm, aa] = ac.dataEntrada.split('-');
            const entrada = new Date(parseInt(aa), parseInt(mm) - 1, parseInt(d), parseInt(h), parseInt(m), parseInt(s));
            
            const minutosPassados = Math.floor((agora - entrada) / 60000);
            if (minutosPassados >= ac.duracaoVisita) {
                db.ref('acompanhantes/' + ac.id).update({
                    status: 'saiu',
                    dataSaida: dataHoje(),
                    horaSaida: horaAgora(),
                    observacao: (ac.observacao ? ac.observacao + ' | ' : '') + 'Saída automática por expiração do tempo de visita.'
                });
                encerradas++;
            }
        }
    });
    
    if (encerradas > 0) {
        console.log(`⏰ ${encerradas} visita(s) encerrada(s) automaticamente.`);
    }
}

// Executar a cada 30 segundos
setInterval(encerrarVisitasExpiradas, 30000);

// ============================================
// LIMPEZA DE REGISTROS ANTIGOS
// ============================================
function limparRegistrosEncerrados(dias = 60) {
    const corte = new Date();
    corte.setDate(corte.getDate() - dias);
    
    db.ref('acompanhantes').once('value').then(snap => {
        const registros = snap.val() || {};
        let removidos = 0;
        
        Object.entries(registros).forEach(([key, ac]) => {
            if (ac.status === 'saiu' && ac.dataSaida) {
                const [d, m, a] = ac.dataSaida.split('-');
                const dataSaida = new Date(parseInt(a), parseInt(m) - 1, parseInt(d));
                if (dataSaida < corte) {
                    db.ref('acompanhantes/' + key).remove();
                    removidos++;
                }
            }
        });
        
        if (removidos > 0) {
            console.log(`🧹 ${removidos} registros antigos removidos.`);
        }
    });
}

// Executar limpeza a cada 7 dias
setInterval(() => limparRegistrosEncerrados(60), 7 * 24 * 60 * 60 * 1000);
