// ============================================
// 18-cracha.js
// Geração do crachá de identificação para impressão.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// CRACHÁ
// ============================================
function abrirCracha(id) {
    const ac = acompanhantes[id];
    if (!ac) {
        toast('Registro não encontrado.', 'error');
        return;
    }
    
    const modal = document.getElementById('badgeModal');
    const content = document.getElementById('badgeContent');
    if (!modal || !content) return;
    
    const logoHTML = logoHospitalCache
        ? `<img src="${logoHospitalCache}" alt="Logo" style="max-width:80px;max-height:60px;">`
        : '<i class="fas fa-hospital-alt" style="font-size:40px;color:#1b4f9c;"></i>';
    
    const tipoBadge = ac.tipo === 'visita' 
        ? 'background:#f0ecfe;color:#7c5cfc;' 
        : 'background:#e8eefd;color:#2f6fed;';
    const tipoTexto = ac.tipo === 'visita' ? 'VISITANTE' : 'ACOMPANHANTE';
    
    content.innerHTML = `
        <div class="cracha-container">
            <div class="cracha-logo">${logoHTML}</div>
            <div class="cracha-titulo">Hospital Regional de Palmeira dos Índios</div>
            <div class="cracha-subtitulo">Controle de Recepção</div>
            <div class="cracha-nome">${sanitizar(ac.nomeAcompanhante)}</div>
            <span class="cracha-tipo-badge" style="${tipoBadge}">${tipoTexto}</span>
            <div class="cracha-info">
                <div class="campo"><strong>Paciente</strong><span>${sanitizar(ac.nomePaciente)}</span></div>
                <div class="campo"><strong>Setor</strong><span>${sanitizar(ac.setor)}</span></div>
                <div class="campo"><strong>Leito</strong><span>${sanitizar(ac.leito) || '-'}</span></div>
                <div class="campo"><strong>Entrada</strong><span>${ac.dataEntrada} ${ac.horaEntrada}</span></div>
            </div>
            <div class="cracha-codigo">
                <i class="fas fa-qrcode"></i> ID: ${ac.id.substring(0, 16)}...
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function imprimirCracha() {
    window.print();
}

