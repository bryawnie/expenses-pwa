/* Utilidades: texto, dinero y fechas. */

/** Normaliza para comparar: minúsculas, sin tildes y sin espacios sobrantes. */
export const norm = (value: unknown): string =>
  String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Separa un emoji inicial del resto del texto: "🍔 Comida" → { e: '🍔', txt: 'Comida' }. */
export function splitEmoji(value: string | null | undefined) {
  const text = String(value || '');
  const match = text.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.*)$/u);
  return match ? { e: match[1], txt: match[2] } : { e: '', txt: text };
}

/** Número estable (0-359) a partir de un texto, para dar color a cada categoría. */
export function hue(value: string): number {
  let h = 0;
  for (const ch of String(value)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* ---- Dinero (pesos chilenos) ---- */

export const clp = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

/** $12.345 (con signo menos delante si es negativo). */
export const money = (n: number) => (n < 0 ? '-' : '') + '$' + clp.format(Math.abs(Math.round(n)));

/** Versión compacta para ejes de gráficos: $1,5 M, $320 mil, $900. */
export function short(n: number): string {
  const abs = Math.abs(n);
  let text: string;
  if (abs >= 1e6) text = '$' + (abs / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' M';
  else if (abs >= 1e3) text = '$' + Math.round(abs / 1e3) + ' mil';
  else text = '$' + Math.round(abs);
  return (n < 0 ? '-' : '') + text;
}

/** Deja solo dígitos (máx. 11) y los formatea con separador de miles. */
export function formatDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits ? clp.format(+digits) : '';
}

/* ---- Fechas ----
 * Las fechas viajan como texto 'YYYY-MM-DD' y los meses como 'YYYY-MM'. */

export const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const today = () => ymd(new Date());

export const currentMonth = () => today().slice(0, 7);

export function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(str: string, n: number): string {
  const date = parseDate(str);
  date.setDate(date.getDate() + n);
  return ymd(date);
}

/** Cantidad de días del mes `m` (1-12) del año `y`. */
export const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

/** Desplaza un mes 'YYYY-MM' en `n` meses (puede ser negativo). */
export function monthShift(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, m - 1 + n, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Formatea una fecha con Intl en español; `stripDots` quita el punto de las abreviaturas ("oct."). */
function formatDate(str: string, options: Intl.DateTimeFormatOptions, stripDots = false): string {
  const text = new Intl.DateTimeFormat('es-CL', options).format(parseDate(str));
  return stripDots ? text.replace(/\./g, '') : text;
}

export const monthName = (key: string) => capitalize(formatDate(key + '-01', { month: 'long' }));
export const monthShort = (key: string) => capitalize(formatDate(key + '-01', { month: 'short' }, true));
export const monthLabel = (key: string) => monthName(key) + ' ' + key.slice(0, 4);
export const dayLabel = (str: string) =>
  capitalize(formatDate(str, { weekday: 'short', day: 'numeric', month: 'short' }, true));
export const dayMonth = (str: string) => formatDate(str, { day: 'numeric', month: 'short' }, true);
