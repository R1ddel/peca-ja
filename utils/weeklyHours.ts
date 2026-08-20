/**
 * Horários por dia da semana (painel do comerciante).
 */
export type WeekdayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

export type WeeklyHours = Record<WeekdayKey, DayHours>;

export const WEEKDAY_ORDER: WeekdayKey[] = [
  'seg',
  'ter',
  'qua',
  'qui',
  'sex',
  'sab',
  'dom',
];

export const WEEKDAY_LABEL: Record<WeekdayKey, string> = {
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
  dom: 'Dom',
};

export function defaultWeeklyHours(): WeeklyHours {
  const day = (open: string, close: string, closed = false): DayHours => ({
    open,
    close,
    closed,
  });
  return {
    seg: day('08:00', '22:00'),
    ter: day('08:00', '22:00'),
    qua: day('08:00', '22:00'),
    qui: day('08:00', '22:00'),
    sex: day('08:00', '23:00'),
    sab: day('09:00', '23:00'),
    dom: day('09:00', '21:00'),
  };
}

/** Converte string legada "08:00–22:00" em grade semanal. */
export function parseHoursToWeekly(raw?: string | null): WeeklyHours {
  const base = defaultWeeklyHours();
  if (!raw?.trim()) return base;
  const m = raw.match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return base;
  const open = `${m[1].padStart(2, '0')}:${m[2]}`;
  const close = `${m[3].padStart(2, '0')}:${m[4]}`;
  const next = { ...base };
  for (const key of WEEKDAY_ORDER) {
    next[key] = { open, close, closed: false };
  }
  return next;
}

/** Resumo curto para exibir na loja / cliente. */
export function formatWeeklyHoursSummary(weekly: WeeklyHours): string {
  const openDays = WEEKDAY_ORDER.filter((d) => !weekly[d].closed);
  if (openDays.length === 0) return 'Fechado';
  const first = weekly[openDays[0]];
  const same = openDays.every(
    (d) => weekly[d].open === first.open && weekly[d].close === first.close
  );
  if (same && openDays.length === 7) {
    return `${first.open}–${first.close}`;
  }
  if (same) {
    const labels = openDays.map((d) => WEEKDAY_LABEL[d]).join(', ');
    return `${labels} ${first.open}–${first.close}`;
  }
  return openDays
    .map((d) => `${WEEKDAY_LABEL[d]} ${weekly[d].open}–${weekly[d].close}`)
    .join(' · ');
}
