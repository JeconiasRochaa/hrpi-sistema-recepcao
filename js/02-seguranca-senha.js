// ============================================
// 02-seguranca-senha.js
// Hash + salt de senhas (SHA-256) — criação e verificação de credenciais.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// SEGURANÇA DE SENHAS (HASH + SALT)
// ------------------------------------------
// As senhas nunca são mais gravadas em texto puro.
// Usamos SHA-256 (Web Crypto API) com um "salt" aleatório
// por usuário. Contas antigas (criadas na versão anterior,
// com campo "senha" em texto puro) são migradas
// automaticamente para hash no primeiro login com sucesso.
// ============================================
function gerarSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashSenha(senha, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + ':' + senha);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function criarCredenciais(senhaPlana) {
    const salt = gerarSalt();
    const senhaHash = await hashSenha(senhaPlana, salt);
    return { salt, senhaHash };
}
// Confere a senha digitada contra o registro do usuário.
// Retorna true/false. Se o usuário ainda estiver no formato
// antigo (senha em texto puro), migra para hash automaticamente
// quando a senha confere.
async function conferirSenha(user, senhaDigitada) {
    if (user.senhaHash && user.salt) {
        const hashDigitado = await hashSenha(senhaDigitada, user.salt);
        return hashDigitado === user.senhaHash;
    }
    // Compatibilidade com contas antigas (texto puro)
    if (user.senha && user.senha === senhaDigitada) {
        return true; // sinaliza para o chamador migrar este usuário
    }
    return false;
}
async function migrarSenhaLegado(userId, senhaPlana) {
    try {
        const { salt, senhaHash } = await criarCredenciais(senhaPlana);
        await db.ref('usuarios/' + userId).update({ senhaHash, salt, senha: null });
        console.log('🔐 Conta migrada para armazenamento de senha com hash.');
    } catch (e) {
        console.error('Erro ao migrar senha legada:', e);
    }
}

