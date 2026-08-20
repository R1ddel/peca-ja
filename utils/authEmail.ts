/** Normaliza e-mail para login / recuperação (sempre minúsculo, sem espaços). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/\s+/g, '');
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return e.includes('@') && e.includes('.') && e.length >= 6 && !e.startsWith('@') && !e.endsWith('@');
}
