// ============================================
// 20-exportar-csv.js
// Exportação de dados em CSV.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// EXPORTAR CSV
// ============================================
function exportarExcel() {
    const inicio = document.getElementById('filtroDataInicio')?.value;
    const fim = document.getElementById('filtroDataFim')?.value;
    const status = document.getElementById('filtroStatus')?.value;
    const tipo = document.getElementById('filtroTipo')?.value;
    const texto = document.getElementById('filtroTexto')?.value?.trim().toLowerCase();
    
    let registros = Object.values(acompanhantes);
    
    if (status) registros = registros.filter(a => a.status === status);
    if (tipo) registros = registros.filter(a => a.tipo === tipo);
    if (inicio) {
        registros = registros.filter(a => {
            const [d, m, y] = a.dataEntrada.split('-');
            return new Date(y, m - 1, d) >= new Date(inicio + 'T00:00:00');
        });
    }
    if (fim) {
        registros = registros.filter(a => {
            const [d, m, y] = a.dataEntrada.split('-');
            return new Date(y, m - 1, d) <= new Date(fim + 'T23:59:59');
        });
    }
    if (texto) {
        registros = registros.filter(a => {
            const campos = ['nomeAcompanhante', 'documento', 'nomePaciente', 'setor', 'leito', 'parentesco', 'observacao'];
            return campos.some(c => a[c] && a[c].toLowerCase().includes(texto));
        });
    }
    
    // Ordenar
    registros.sort((a, b) => (b.dataEntrada + b.horaEntrada).localeCompare(a.dataEntrada + a.horaEntrada));
    
    // Criar CSV
    let csv = '\uFEFFTipo;Nome;Documento;Parentesco;Paciente;Setor;Leito;Data Entrada;Hora Entrada;Data Saída;Hora Saída;Status;Observação\n';
    registros.forEach(ac => {
        csv += [
            ac.tipo,
            `"${ac.nomeAcompanhante || ''}"`,
            `"${ac.documento || ''}"`,
            `"${ac.parentesco || ''}"`,
            `"${ac.nomePaciente || ''}"`,
            `"${ac.setor || ''}"`,
            `"${ac.leito || ''}"`,
            ac.dataEntrada || '',
            ac.horaEntrada || '',
            ac.dataSaida || '',
            ac.horaSaida || '',
            ac.status || '',
            `"${(ac.observacao || '').replace(/"/g, '""')}"`
        ].join(';') + '\n';
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HRPI_Registros_${dataHoje()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast(`${registros.length} registro(s) exportado(s) com sucesso!`);
}

// Lista simples e direta de quem está presente agora como acompanhante,
// organizada por setor — para a nutrição usar na hora de montar as
// refeições, sem precisar filtrar a planilha completa de registros.
function exportarListaNutricao() {
    const presentes = Object.values(acompanhantes).filter(a => a.status === 'presente' && a.tipo === 'acompanhante');
    if (presentes.length === 0) { toast('Nenhum acompanhante presente no momento.', 'error'); return; }

    presentes.sort((a, b) => a.setor.localeCompare(b.setor) || a.leito?.localeCompare(b.leito || '') || 0);

    let csv = '\uFEFFSetor;Leito;Paciente;Acompanhante;Desde\n';
    presentes.forEach(ac => {
        csv += [
            `"${ac.setor || ''}"`,
            `"${ac.leito || '-'}"`,
            `"${ac.nomePaciente || ''}"`,
            `"${ac.nomeAcompanhante || ''}"`,
            `${ac.dataEntrada} ${ac.horaEntrada}`
        ].join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HRPI_Lista_Nutricao_${dataHoje()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast(`Lista com ${presentes.length} acompanhante(s) exportada!`);
    registrarLog('config', `Lista de acompanhantes presentes exportada para a nutrição (${presentes.length} registros).`);
}

