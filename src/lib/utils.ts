export const normalizeText = (value: unknown): string =>
  String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "🍔 Comida" → { emoji: '🍔', text: 'Comida' } */
export function splitLeadingEmoji(value: string | null | undefined) {
  const text = String(value || '');
  const match = text.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.*)$/u);
  return match ? { emoji: match[1], text: match[2] } : { emoji: '', text };
}

/** Stable value between 0 and 359, used to give each category its own color. */
export function hueFromText(value: string): number {
  let hue = 0;
  for (const character of String(value)) hue = (hue * 31 + character.charCodeAt(0)) % 360;
  return hue;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* ---- Money (Chilean pesos) ---- */

export const pesoNumberFormat = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 0
});

export const formatMoney = (amount: number) =>
  (amount < 0 ? '-' : '') + '$' + pesoNumberFormat.format(Math.abs(Math.round(amount)));

/** Compact form for chart axes: $1,5 M, $320 mil, $900. */
export function formatCompactMoney(amount: number): string {
  const absolute = Math.abs(amount);
  let text: string;
  if (absolute >= 1e6) text = '$' + (absolute / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' M';
  else if (absolute >= 1e3) text = '$' + Math.round(absolute / 1e3) + ' mil';
  else text = '$' + Math.round(absolute);
  return (amount < 0 ? '-' : '') + text;
}

const MAX_AMOUNT_DIGITS = 11;

export const keepDigits = (value: string) => value.replace(/\D/g, '').slice(0, MAX_AMOUNT_DIGITS);

export function formatDigitsWithThousands(value: string): string {
  const digits = keepDigits(value);
  return digits ? pesoNumberFormat.format(+digits) : '';
}

/* ---- Dates: days travel as 'YYYY-MM-DD' strings and months as 'YYYY-MM'. ---- */

const padTwoDigits = (value: number) => String(value).padStart(2, '0');

export const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`;

export const todayIso = () => toIsoDate(new Date());

export const currentMonthKey = () => todayIso().slice(0, 7);

export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysToDate(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** `month` goes from 1 to 12. */
export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export const dayOfMonth = (isoDate: string) => +isoDate.slice(8);

export function isoDateInMonth(monthKey: string, day: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${monthKey}-${padTwoDigits(Math.min(day, daysInMonth(year, month)))}`;
}

export function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}`;
}

function formatIsoDate(isoDate: string, options: Intl.DateTimeFormatOptions, removeDots = false): string {
  const text = new Intl.DateTimeFormat('es-CL', options).format(parseIsoDate(isoDate));
  return removeDots ? text.replace(/\./g, '') : text;
}

export const monthName = (monthKey: string) => capitalize(formatIsoDate(monthKey + '-01', { month: 'long' }));
export const shortMonthName = (monthKey: string) =>
  capitalize(formatIsoDate(monthKey + '-01', { month: 'short' }, true));
export const monthAndYear = (monthKey: string) => monthName(monthKey) + ' ' + monthKey.slice(0, 4);
export const weekdayDayAndMonth = (isoDate: string) =>
  capitalize(formatIsoDate(isoDate, { weekday: 'short', day: 'numeric', month: 'short' }, true));
export const dayAndMonth = (isoDate: string) => formatIsoDate(isoDate, { day: 'numeric', month: 'short' }, true);
