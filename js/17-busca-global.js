// ============================================
// 17-busca-global.js
// Busca global com autocomplete.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// BUSCA GLOBAL E AUTOCOMPLETE
// ============================================
let listaPacientesUnicos = [];

function atualizarListaPacientes() {
    const pacientesMap = new Map();
    Object.values(acompanhantes).forEach(ac => {
        if (ac.nomePaciente) {
            const nome = ac.nomePaciente.trim();
            if (!pacientesMap.has(nome)) {
                pacientesMap.set(nome, { 
                    nome, 
                    setor: ac.setor || '', 
                    leito: ac.leito || '' 
                });
            }
        }
    });
    listaPacientesUnicos = Array.from(pacientesMap.values());
    listaPacientesUnicos.sort((a, b) => a.nome.localeCompare(b.nome));
}

function configurarAutocompletePaciente(inputId, sugestoesId, setorId = null, leitoId = null) {
    const input = document.getElementById(inputId);
    const sugestoesDiv = document.getElementById(sugestoesId);
    if (!input || !sugestoesDiv) return;
    
    input.addEventListener('input', function() {
        const termo = this.value.trim().toLowerCase();
        if (termo.length < 2) {
            sugestoesDiv.style.display = 'none';
            sugestoesDiv.innerHTML = '';
            return;
        }
        
        const sugestoes = listaPacientesUnicos.filter(p => 
            p.nome.toLowerCase().includes(termo)
        );
        
        if (sugestoes.length === 0) {
            sugestoesDiv.style.display = 'none';
            return;
        }
        
        sugestoesDiv.innerHTML = sugestoes.slice(0, 8).map(p => `
            <div class="sugestao-item" data-nome="${sanitizar(p.nome)}" data-setor="${sanitizar(p.setor)}" data-leito="${sanitizar(p.leito)}">
                <span class="paciente-nome">${sanitizar(p.nome)}</span>
                <span class="paciente-info">${p.setor ? sanitizar(p.setor) : ''} ${p.leito ? '· Leito ' + sanitizar(p.leito) : ''}</span>
            </div>
        `).join('');
        
        sugestoesDiv.style.display = 'block';
        
        // Adicionar eventos de clique
        sugestoesDiv.querySelectorAll('.sugestao-item').forEach(item => {
            item.addEventListener('click', function() {
                input.value = this.getAttribute('data-nome');
                sugestoesDiv.style.display = 'none';
                
                if (setorId) {
                    const setorEl = document.getElementById(setorId);
                    if (setorEl && setorEl.tagName === 'SELECT') {
                        const valor = this.getAttribute('data-setor');
                        // Verificar se o valor existe nas opções
                        const options = Array.from(setorEl.options).map(o => o.value);
                        if (options.includes(valor)) {
                            setorEl.value = valor;
                        }
                    }
                }
                
                if (leitoId) {
                    const leitoEl = document.getElementById(leitoId);
                    if (leitoEl) leitoEl.value = this.getAttribute('data-leito');
                }
            });
        });
    });
    
    // Fechar sugestões ao clicar fora
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !sugestoesDiv.contains(e.target)) {
            sugestoesDiv.style.display = 'none';
        }
    });
}

function inicializarAutocompletePacientes() {
    configurarAutocompletePaciente('acPaciente', 'sugestoesAcPaciente', 'acSetor', 'acLeito');
    configurarAutocompletePaciente('visPaciente', 'sugestoesVisPaciente', 'visSetor', 'visLeito');
}

function inicializarBuscaGlobal() {
    const globalSearchInput = document.getElementById('globalSearchInput');
    const searchResults = document.getElementById('searchResults');
    if (!globalSearchInput || !searchResults) return;
    
    globalSearchInput.addEventListener('input', function() {
        const termo = this.value.trim().toLowerCase();
        if (termo.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        
        const resultados = Object.values(acompanhantes).filter(ac => {
            const campos = [
                ac.nomeAcompanhante, 
                ac.documento, 
                ac.nomePaciente, 
                ac.setor, 
                ac.leito, 
                ac.parentesco, 
                ac.observacao
            ];
            return campos.some(campo => campo && campo.toLowerCase().includes(termo));
        });
        
        if (resultados.length === 0) {
            searchResults.innerHTML = `
                <div class="search-result-item" style="justify-content:center;color:var(--text-muted)">
                    <i class="fas fa-search" style="margin-right:8px;"></i> Nenhum resultado encontrado
                </div>
            `;
        } else {
            // Ordenar: primeiro os ativos, depois por data
            resultados.sort((a, b) => {
                if (a.status === 'presente' && b.status !== 'presente') return -1;
                if (a.status !== 'presente' && b.status === 'presente') return 1;
                return (b.dataEntrada + b.horaEntrada).localeCompare(a.dataEntrada + a.horaEntrada);
            });
            
            searchResults.innerHTML = resultados.slice(0, 10).map(ac => {
                const tipoBadge = ac.tipo === 'visita' ? 'badge-visita' : 'badge-info';
                const tipoTexto = ac.tipo === 'visita' ? 'Visita' : 'Acomp.';
                const statusIcon = ac.status === 'presente' ? '🟢' : '⚪';
                
                return `
                    <div class="search-result-item" onclick="selecionarItemBusca('${ac.id}')">
                        <div class="info">
                            <span class="name">${statusIcon} ${sanitizar(ac.nomeAcompanhante)}</span>
                            <span class="detail">
                                ${sanitizar(ac.nomePaciente)} • ${sanitizar(ac.setor)} 
                                ${ac.leito ? '• Leito ' + sanitizar(ac.leito) : ''}
                                ${ac.dataEntrada ? '• ' + ac.dataEntrada : ''}
                            </span>
                        </div>
                        <span class="badge ${tipoBadge}">${tipoTexto}</span>
                    </div>
                `;
            }).join('');
        }
        searchResults.style.display = 'block';
    });
    
    // Fechar ao clicar fora
    document.addEventListener('click', function(e) {
        const searchBox = document.getElementById('searchBox');
        if (searchBox && !searchBox.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
    
    // Navegação por teclado (Enter para o primeiro resultado)
    globalSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && searchResults.style.display === 'block') {
            const primeiro = searchResults.querySelector('.search-result-item');
            if (primeiro) primeiro.click();
        }
        if (e.key === 'Escape') {
            searchResults.style.display = 'none';
            this.blur();
        }
    });
}

function selecionarItemBusca(id) {
    // Fechar a lista de resultados
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('globalSearchInput').value = '';

    const ac = acompanhantes[id];
    if (!ac) return;

    // Se for um acompanhante presente, leva para a troca já com ele selecionado
    if (ac.status === 'presente' && ac.tipo === 'acompanhante') {
        navegarPara('registroTroca');
        // Pequeno delay para garantir que a página esteja pronta
        setTimeout(() => selecionarAcompanhanteTroca(id), 300);
        return;
    }

    // Para visitantes ou acompanhantes que já saíram, vai para o histórico
    navegarPara('historico');
    setTimeout(() => {
        const campoTexto = document.getElementById('filtroTexto');
        if (campoTexto) {
            campoTexto.value = ac.nomeAcompanhante;
            filtrarHistorico();
        }
    }, 300);
}

