/** Redimensiona/comprime uma imagem no navegador antes de guardar (logo). */
export function comprimirImagem(file: File, maxLado = 400, qualidade = 0.88): Promise<string> {
  const png = file.type === 'image/png';
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return reject(new Error('Use uma imagem PNG, JPG ou WebP.'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('Imagem muito grande (máx. 5 MB).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const esc = Math.min(1, maxLado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * esc);
      c.height = Math.round(img.height * esc);
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')); };
    img.src = url;
  });
}
