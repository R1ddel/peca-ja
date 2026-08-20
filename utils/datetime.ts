/**
 * Formatação de data/hora estável no Hermes (Expo Go).
 * Evita toLocale* com options — costuma falhar ou ignorar fuso no Android.
 */

function parseDate(iso: string | number | Date): Date | null {
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** HH:mm no fuso local do aparelho */
export function formatOrderTime(iso: string | number | Date): string {
  const d = parseDate(iso);
  if (!d) return '--:--';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** dd/mm/aaaa */
export function formatOrderDate(iso: string | number | Date): string {
  const d = parseDate(iso);
  if (!d) return '--/--/----';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** dd/mm/aaaa às HH:mm */
export function formatOrderDateTime(iso: string | number | Date): string {
  const d = parseDate(iso);
  if (!d) return '—';
  return `${formatOrderDate(d)} às ${formatOrderTime(d)}`;
}

/** Minutos desde o instante (nunca negativo). */
export function minutesSince(iso: string | number | Date, nowMs = Date.now()): number {
  const d = parseDate(iso);
  if (!d) return 0;
  return Math.max(0, Math.floor((nowMs - d.getTime()) / 60000));
}

/** "agora" | "há 1 min" | "há 12 min" | "há 2 h" */
export function formatWaitLabel(iso: string | number | Date, nowMs = Date.now()): string {
  const mins = minutesSince(iso, nowMs);
  if (mins < 1) return 'agora';
  if (mins === 1) return 'há 1 min';
  if (mins < 60) return `há ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h === 1) return 'há 1 h';
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

/** Relógio + espera: "14:32 · há 3 min" */
export function formatOrderClockWait(iso: string | number | Date, nowMs = Date.now()): string {
  return `${formatOrderTime(iso)} · ${formatWaitLabel(iso, nowMs)}`;
}
