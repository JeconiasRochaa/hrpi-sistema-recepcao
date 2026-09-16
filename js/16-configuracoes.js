// ============================================
// 16-configuracoes.js
// Configurações do sistema: logo, fundo de login, tema — inclui os bugs de logo corrigidos.
// Parte do sistema HRPI — ver js/01-config.js para a ordem de carregamento completa.
// ============================================

// ============================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================
function carregarConfiguracoes() {
    // Carregar do sessionStorage primeiro (mais rápido)
    const logoCache = sessionStorage.getItem('hrpi_logo');
    const fundoCache = sessionStorage.getItem('hrpi_fundo');
    
    if (logoCache) {
        logoHospitalCache = logoCache;
        aplicarLogoNaInterface(logoCache);
    }
    
    if (fundoCache) {
        aplicarFundoLogin(fundoCache);
    }
    
    // Carregar do Firebase para sincronizar
    db.ref('configuracoes').once('value').then(snap => {
        const c = snap.val();
        if (!c) return;
        
        if (c.logoHospital && c.logoHospital !== logoCache) {
            logoHospitalCache = c.logoHospital;
            sessionStorage.setItem('hrpi_logo', c.logoHospital);
            aplicarLogoNaInterface(c.logoHospital);
        }
        
        if (c.fundoLogin && c.fundoLogin !== fundoCache) {
            sessionStorage.setItem('hrpi_fundo', c.fundoLogin);
            aplicarFundoLogin(c.fundoLogin);
        }
        
        if (c.tema) {
            document.body.classList.toggle('dark-theme', c.tema === 'dark');
            const icon = document.querySelector('#themeToggleBtn i');
            if (icon) icon.className = c.tema === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        
    });
}

// Aplica a logo personalizada nos três lugares em que ela aparece.
// BUG CORRIGIDO: a logo grande do centro da tela de login (#welcomeLogo)
// nunca tinha um id — só a logo pequena do topo (#loginLogo) e a da
// sidebar (#sidebarLogo) eram atualizadas, então a caixa central sempre
// mostrava o ícone genérico, mesmo com uma logo personalizada configurada.
function aplicarLogoNaInterface(base64) {
    const sidebarLogo = document.getElementById('sidebarLogo');
    const loginLogo = document.getElementById('loginLogo');
    const welcomeLogo = document.getElementById('welcomeLogo');
    if (sidebarLogo) sidebarLogo.innerHTML = `<img src="${base64}" alt="Logo">`;
    if (loginLogo) loginLogo.innerHTML = `<img src="${base64}" alt="Logo">`;
    if (welcomeLogo) welcomeLogo.innerHTML = `<img src="${base64}" alt="Logo">`;
}

function aplicarFundoLogin(base64) {
    const ls = document.getElementById('loginScreen');
    if (!ls) return;
    
    const img = new Image();
    img.onload = () => {
        ls.style.setProperty('--login-bg-image', `url(${base64})`);
        ls.classList.add('fundo-carregado');
        fundoCarregado = true;
    };
    img.onerror = () => {
        console.error('Erro ao carregar imagem de fundo');
    };
    img.src = base64;
}

// Comprimir imagem antes de guardar no Firebase (RTDB não é feito para
// arquivos grandes). BUG CORRIGIDO: a logo estava sendo reduzida para
// apenas 200x80px a 50% de qualidade JPEG — resolução menor que o próprio
// espaço de 178x178px usado na tela de login, resultando em uma logo
// visivelmente borrada e "pixelizada" ao ser esticada pelo CSS. Agora usa
// uma resolução suficiente para o maior espaço em que a logo aparece, com
// qualidade bem mais alta. Logos em PNG (comuns para logos com fundo
// transparente ou texto fino) são mantidas em PNG, sem compressão com
// perdas — é o formato indicado para esse tipo de imagem; fotos (JPG)
// continuam sendo comprimidas em JPEG, que é mais leve para fotografias.
function comprimirImagem(file, maxWidth, maxHeight, qualidade = 0.85) {
    const manterPng = file.type === 'image/png';
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (maxHeight / height) * width;
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                resolve(manterPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', qualidade));
            };
            img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        reader.readAsDataURL(file);
    });
}

async function uploadLogoHandler(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        toast('Selecione uma imagem válida (JPG, PNG).', 'error');
        return;
    }
    
    try {
        // 400x400: espaço suficiente para a maior exibição da logo (o
        // círculo central de 178x178px da tela de login) sem perda visível.
        const base64 = await comprimirImagem(file, 400, 400, 0.85);
        await db.ref('configuracoes').update({ logoHospital: base64 });
        
        logoHospitalCache = base64;
        sessionStorage.setItem('hrpi_logo', base64);
        aplicarLogoNaInterface(base64);
        
        toast('Logo atualizada com sucesso!');
        registrarLog('config', 'Logo do sistema atualizada.');
    } catch (err) {
        console.error('Erro ao fazer upload da logo:', err);
        toast('Erro ao fazer upload da logo.', 'error');
    }
}

async function uploadFundoHandler(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        toast('Selecione uma imagem válida (JPG, PNG).', 'error');
        return;
    }
    
    try {
        const base64 = await comprimirImagem(file, 1600, 1000, 0.55);
        await db.ref('configuracoes').update({ fundoLogin: base64 });
        
        sessionStorage.setItem('hrpi_fundo', base64);
        aplicarFundoLogin(base64);
        
        toast('Fundo de login atualizado com sucesso!');
        registrarLog('config', 'Fundo da tela de login atualizado.');
    } catch (err) {
        console.error('Erro ao fazer upload do fundo:', err);
        toast('Erro ao fazer upload do fundo.', 'error');
    }
}

function removerLogo() {
    if (confirm('Remover a logo personalizada? A logo padrão será exibida.')) {
        db.ref('configuracoes').update({ logoHospital: null }).then(() => {
            logoHospitalCache = null;
            sessionStorage.removeItem('hrpi_logo');
            const sidebarLogo = document.getElementById('sidebarLogo');
            const loginLogo = document.getElementById('loginLogo');
            const welcomeLogo = document.getElementById('welcomeLogo');
            if (sidebarLogo) sidebarLogo.innerHTML = '<i class="fas fa-hospital-alt"></i>';
            if (loginLogo) loginLogo.innerHTML = '';
            if (welcomeLogo) welcomeLogo.innerHTML = '';
            toast('Logo removida com sucesso!');
            registrarLog('config', 'Logo removida.');
        });
    }
}

function removerFundo() {
    if (confirm('Remover o fundo personalizado do login?')) {
        db.ref('configuracoes').update({ fundoLogin: null }).then(() => {
            sessionStorage.removeItem('hrpi_fundo');
            const ls = document.getElementById('loginScreen');
            if (ls) { ls.style.removeProperty('--login-bg-image'); ls.classList.remove('fundo-carregado'); }
            fundoCarregado = false;
            toast('Fundo removido com sucesso!');
            registrarLog('config', 'Fundo removido.');
        });
    }
}


function toggleTema() {
    const isDark = document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('#themeToggleBtn i');
    if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    
    db.ref('configuracoes').update({ tema: isDark ? 'dark' : 'light' });
    toast(`Tema ${isDark ? 'escuro' : 'claro'} ativado!`);
}

