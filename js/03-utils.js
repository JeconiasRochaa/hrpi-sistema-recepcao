// ============================================
// 03-utils.js
// Funções utilitárias pequenas usadas em vários lugares: data/hora, toast, sanitização, log, etc.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================
function dataHoje() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
function horaAgora() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
function gerarId() {
    return 'hrpi_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}
function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const message = document.getElementById('toastMessage');
    if (!t || !icon || !message) { alert(msg); return; }
    message.textContent = msg;
    icon.className = tipo === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
    t.className = `toast show ${tipo === 'error' ? 'error' : ''}`;
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), 4000);
}
function sanitizar(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function fecharModal() {
    const modal = document.getElementById('genericModal');
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
}
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
function registrarLog(acao, descricao, registroId = null) {
    if (!usuarioLogado) return;
    const log = {
        id: gerarId(),
        timestamp: Date.now(),
        dataHora: `${dataHoje()} ${horaAgora()}`,
        usuario: usuarioLogado.nome,
        usuarioId: usuarioLogado.id,
        acao: acao,
        descricao: descricao,
        registroId: registroId || ''
    };
    db.ref('logs/' + log.id).set(log).catch(err => console.error('Erro ao registrar log:', err));
}
// Converte "DD-MM-AAAA HH:MM:SS" em um Date válido para ordenação/filtro.
// Usa o campo "timestamp" (numérico) quando disponível — mais rápido e
// imune a formatos futuros — e cai para o parse da string em logs antigos.
function dataHoraLog(log) {
    if (log.timestamp) return new Date(log.timestamp);
    const [dataParte, horaParte] = (log.dataHora || '').split(' ');
    const [d, m, a] = (dataParte || '').split('-').map(Number);
    const [h = 0, mi = 0, s = 0] = (horaParte || '').split(':').map(Number);
    return new Date(a, (m || 1) - 1, d || 1, h, mi, s);
}
function formatarData(date) {
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

