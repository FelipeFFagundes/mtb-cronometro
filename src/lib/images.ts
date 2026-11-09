/**
 * Reduz uma imagem para o lado maior caber em `maxSide` px e devolve em data URL (WebP, ou JPEG
 * onde o navegador não gera WebP). Fotos de celular de 4 MB viram ~150 KB, o que cabe no
 * armazenamento do navegador e carrega rápido na TV.
 */
export async function shrinkImage(file: Blob, maxSide: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível ler a imagem. Use JPG, PNG ou WebP.')
  })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const webp = canvas.toDataURL('image/webp', quality)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality)
}

/** Data URL → Blob (para enviar ao armazenamento do servidor). */
export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}
