/** Nome para comparar atletas: sem acentos, minúsculo, espaços simples (igual a athlete_key no banco). */
export function athleteKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
