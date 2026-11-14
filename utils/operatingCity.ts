/** Compara cidade de atuação ("Mucugê — BA" e "Mucugê" são a mesma). */

export function operatingCityKey(value?: string | null): string {
  if (!value?.trim()) return '';
  const name = value.split(/\s+[—-]\s+/)[0] || value;
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function sameOperatingCity(a?: string | null, b?: string | null): boolean {
  const left = operatingCityKey(a);
  const right = operatingCityKey(b);
  if (!left || !right) return false;
  return left === right;
}
