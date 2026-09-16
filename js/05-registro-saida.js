// ============================================
// 05-registro-saida.js
// Tela de Registro de Saída: busca de acompanhante/paciente e confirmação.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// ============================================
// REGISTRO DE SAÍDA — busca + confirmação (fluxo único)
// ============================================
let inputBuscaSaida, resultadosBuscaSaida, btnSaidaRapida;

// Chamada por iniciarAplicacao() depois que os partials de HTML das
// páginas são injetados no DOM (ver js/00-partials-loader.js) — antes
// disso, estes elementos ainda não existem na página.
function inicializarBuscaSaida() {
    inputBuscaSaida = document.getElementById('buscaSaidaRapida');
    resultadosBuscaSaida = document.getElementById('resultadosBuscaSaida');
    btnSaidaRapida = document.getElementById('btnSaidaRapida');

    if (!inputBuscaSaida) return;

    // Digitação no campo de busca
    inputBuscaSaida.addEventListener('input', function () {
        const termo = this.value.trim().toLowerCase();
        limparSelecaoSaida(false);
        if (termo.length < 2) {
            resultadosBuscaSaida.style.display = 'none';
            return;
        }

        const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente' && a.tipo === 'acompanhante');
        const filtrados = presentes.filter(a =>
            a.nomeAcompanhante.toLowerCase().includes(termo) ||
            a.nomePaciente.toLowerCase().includes(termo) ||
            (a.documento && a.documento.toLowerCase().includes(termo))
        );

        if (filtrados.length === 0) {
            resultadosBuscaSaida.innerHTML = '<div class="search-result-item" style="justify-content:center;color:var(--text-muted)">Nenhum resultado</div>';
            resultadosBuscaSaida.style.display = 'block';
            return;
        }

        resultadosBuscaSaida.innerHTML = filtrados.slice(0, 8).map(ac => `
            <div class="search-result-item" data-id="${ac.id}" style="cursor:pointer;">
                <div class="info">
                    <span class="name">${sanitizar(ac.nomeAcompanhante)}</span>
                    <span class="detail">${sanitizar(ac.nomePaciente)} • ${sanitizar(ac.setor)} ${ac.leito ? '• Leito ' + sanitizar(ac.leito) : ''}</span>
                </div>
                <span class="badge ${ac.tipo === 'visita' ? 'badge-visita' : 'badge-info'}">${ac.tipo === 'visita' ? 'Visita' : 'Acomp.'}</span>
            </div>
        `).join('');

        resultadosBuscaSaida.style.display = 'block';

        // Evento de clique nos resultados
        resultadosBuscaSaida.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function () {
                const id = this.getAttribute('data-id');
                selecionarAcompanhanteSaidaRapida(id);
            });
        });
    });

    // Fechar sugestões ao clicar fora
    document.addEventListener('click', function (e) {
        if (!inputBuscaSaida.contains(e.target) && !resultadosBuscaSaida.contains(e.target)) {
            resultadosBuscaSaida.style.display = 'none';
        }
    });
}

function selecionarAcompanhanteSaidaRapida(id) {
    const ac = acompanhantes[id];
    if (!ac || ac.status !== 'presente') {
        toast('Acompanhante/visitante não está mais presente.', 'error');
        return;
    }

    document.getElementById('saidaAcompanhante').value = id;
    document.getElementById('saidaInfo').style.display = 'block';
    setText('saidaPaciente', ac.nomePaciente);
    setText('saidaSetor', ac.setor);
    setText('saidaEntrada', `${ac.dataEntrada} ${ac.horaEntrada}`);

    btnSaidaRapida.disabled = false;

    // Fechar sugestões e refletir a seleção no campo de busca
    resultadosBuscaSaida.style.display = 'none';
    inputBuscaSaida.value = ac.nomeAcompanhante;
}

function limparSelecaoSaida(limparBusca = true) {
    document.getElementById('saidaAcompanhante').value = '';
    document.getElementById('saidaInfo').style.display = 'none';
    btnSaidaRapida.disabled = true;
    if (limparBusca && inputBuscaSaida) inputBuscaSaida.value = '';
}

