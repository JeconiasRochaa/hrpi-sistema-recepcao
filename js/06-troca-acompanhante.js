// ============================================
// 06-troca-acompanhante.js
// Tela de Troca de Acompanhante: busca do acompanhante atual a ser substituído.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// TROCA DE ACOMPANHANTE — busca (mesmo padrão da tela de Saída)
// ============================================
let inputBuscaTroca, resultadosBuscaTroca, btnRegistrarTroca;

// Chamada por iniciarAplicacao() depois que os partials de HTML das
// páginas são injetados no DOM (ver js/00-partials-loader.js).
function inicializarBuscaTroca() {
    inputBuscaTroca = document.getElementById('buscaTrocaAtual');
    resultadosBuscaTroca = document.getElementById('resultadosBuscaTroca');
    btnRegistrarTroca = document.getElementById('btnRegistrarTroca');

    if (!inputBuscaTroca) return;

    inputBuscaTroca.addEventListener('input', function () {
        const termo = this.value.trim().toLowerCase();
        limparSelecaoTroca(false);
        if (termo.length < 2) {
            resultadosBuscaTroca.style.display = 'none';
            return;
        }

        const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente' && a.tipo === 'acompanhante');
        const filtrados = presentes.filter(a =>
            a.nomeAcompanhante.toLowerCase().includes(termo) ||
            a.nomePaciente.toLowerCase().includes(termo) ||
            (a.documento && a.documento.toLowerCase().includes(termo))
        );

        if (filtrados.length === 0) {
            resultadosBuscaTroca.innerHTML = '<div class="search-result-item" style="justify-content:center;color:var(--text-muted)">Nenhum resultado</div>';
            resultadosBuscaTroca.style.display = 'block';
            return;
        }

        resultadosBuscaTroca.innerHTML = filtrados.slice(0, 8).map(ac => `
            <div class="search-result-item" data-id="${ac.id}" style="cursor:pointer;">
                <div class="info">
                    <span class="name">${sanitizar(ac.nomeAcompanhante)}</span>
                    <span class="detail">${sanitizar(ac.nomePaciente)} • ${sanitizar(ac.setor)} ${ac.leito ? '• Leito ' + sanitizar(ac.leito) : ''}</span>
                </div>
                <span class="badge badge-info">Acomp.</span>
            </div>
        `).join('');

        resultadosBuscaTroca.style.display = 'block';
        resultadosBuscaTroca.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function () {
                selecionarAcompanhanteTroca(this.getAttribute('data-id'));
            });
        });
    });

    document.addEventListener('click', function (e) {
        if (!inputBuscaTroca.contains(e.target) && !resultadosBuscaTroca.contains(e.target)) {
            resultadosBuscaTroca.style.display = 'none';
        }
    });
}

function selecionarAcompanhanteTroca(id) {
    const ac = acompanhantes[id];
    if (!ac || ac.status !== 'presente') {
        toast('Acompanhante não está mais presente.', 'error');
        return;
    }
    document.getElementById('trocaAcompanhanteAtual').value = id;
    document.getElementById('trocaInfoAtual').style.display = 'block';
    setText('trocaPaciente', ac.nomePaciente);
    setText('trocaSetor', ac.setor);
    setText('trocaLeito', ac.leito || '-');
    if (btnRegistrarTroca) btnRegistrarTroca.disabled = false;
    resultadosBuscaTroca.style.display = 'none';
    inputBuscaTroca.value = ac.nomeAcompanhante;
}

function limparSelecaoTroca(limparBusca = true) {
    document.getElementById('trocaAcompanhanteAtual').value = '';
    document.getElementById('trocaInfoAtual').style.display = 'none';
    if (btnRegistrarTroca) btnRegistrarTroca.disabled = true;
    if (limparBusca && inputBuscaTroca) inputBuscaTroca.value = '';
}

