/* Lógica de dominio pura: filas visibles (planilla + pendientes), estadísticas y tarjetas. */
import type { AccountConfig, Config, Data, Item, Op, Original, Row, Stats } from './types';
import { addDays, daysInMonth, monthShift, norm, pad, today } from './utils';

/** ¿Es un traspaso entre cuentas propias? (no cuenta como gasto ni ingreso) */
export const isTransfer = (type: string) => norm(type).includes('traspaso');

export const emptyConfig = (): Config => ({ accounts: {}, budgets: {}, statements: {}, settings: {} });

export const emptyData = (): Data => ({ rows: [], types: [], accounts: [], config: emptyConfig(), loaded: false });

/** ¿Dos filas son "la misma"? Sirve para ubicar una fila aunque haya cambiado de número en la planilla. */
export function sameSignature(x: Original, o: Original): boolean {
  return (
    x.d === o.d &&
    norm(x.n) === norm(o.n) &&
    norm(x.ds) === norm(o.ds) &&
    Math.abs(x.a - o.a) < 0.005 &&
    norm(x.t) === norm(o.t) &&
    norm(x.c) === norm(o.c)
  );
}

/** Convierte un ítem de la cola (nombres largos) a la forma corta de fila. */
function itemToRow(item: Item, extra: Partial<Row>): Row {
  return { r: null, d: item.date, n: item.name, ds: item.desc, a: item.amount, t: item.type, c: item.account, ...extra };
}

/** Datos de una fila tal como estaban en la planilla; el servidor los usa para verificar que no cambió. */
export const originalOf = (r: Row): Original => ({ d: r.d, n: r.n, ds: r.ds, a: r.a, t: r.t, c: r.c });

/**
 * Todas las filas que ve el usuario: las de la planilla con las operaciones
 * pendientes ya aplicadas encima (altas, ediciones y borrados), más nuevas primero.
 */
export function viewRows(data: Data, queue: Op[]): Row[] {
  const rows: Row[] = data.rows.map(r => ({ r: r[0], d: r[1], n: r[2], ds: r[3], a: r[4], t: r[5], c: r[6] }));

  for (const op of queue) {
    if (op.action === 'add') {
      for (const item of op.payload.items) rows.push(itemToRow(item, { r: null, id: item.id, pending: true }));
    } else if (op.action === 'update') {
      const i = rows.findIndex(x => !x.pending && sameSignature(x, op.payload.orig));
      if (i >= 0) rows[i] = itemToRow(op.payload.item, { r: rows[i].r, pending: true, upd: true });
    } else if (op.action === 'delete') {
      const i = rows.findIndex(x => !x.pending && sameSignature(x, op.payload.orig));
      if (i >= 0) rows.splice(i, 1);
    }
  }

  const rowOrder = (row: Row) => (row.r == null ? 1e9 : row.r); // las pendientes (sin fila) van primero
  rows.sort((a, b) => {
    if (a.d !== b.d) return a.d < b.d ? 1 : -1;
    return rowOrder(b) - rowOrder(a);
  });
  return rows;
}

export const transferType = (types: string[]) => types.find(isTransfer) || 'Traspasos Internos';

/** Adivina si una cuenta es efectivo, crédito o débito según su nombre. */
export function guessKind(name: string): AccountConfig['kind'] {
  const n = norm(name);
  if (/efectivo|cash/.test(n)) return 'efectivo';
  if (/\b(tc|tdc)\b|credito|visa|master|amex|cmr|lider|falabella|ripley|cencosud|paris/.test(n)) return 'credito';
  return 'debito';
}

/** Configuración de una cuenta: { kind, closeDay, dueDay }. */
export const accountConfig = (config: Config, name: string): AccountConfig =>
  config.accounts[name] || { kind: guessKind(name), closeDay: 0, dueDay: 0 };

export const creditCards = (data: Data) => data.accounts.filter(a => accountConfig(data.config, a).kind === 'credito');

export function defaultTransferDesc(config: Config, toAccount: string): string {
  return accountConfig(config, toAccount).kind === 'credito' ? 'Pago ' + toAccount : 'Traspaso a ' + toAccount;
}

/**
 * Estadísticas de un mes (sin contar traspasos).
 * Los montos "netos" restan los reintegros a los gastos de la misma categoría/cuenta.
 */
export function stats(monthKey: string, rows: Row[]): Stats {
  const monthRows = rows.filter(r => r.d.startsWith(monthKey) && !isTransfer(r.t));
  const [y, m] = monthKey.split('-').map(Number);
  const days = daysInMonth(y, m);

  const daily: number[] = Array(days + 1).fill(0); // gasto neto de cada día (índice 1..days)
  const byCat: Record<string, number> = {};
  const byAcct: Record<string, number> = {};
  let gasto = 0;
  let ingreso = 0;

  for (const r of monthRows) {
    if (r.a < 0) gasto += -r.a;
    else ingreso += r.a;
    byCat[r.t] = (byCat[r.t] || 0) - r.a;
    byAcct[r.c] = (byAcct[r.c] || 0) - r.a;
    daily[+r.d.slice(8)] -= r.a;
  }

  return { gasto, ingreso, byCat, byAcct, daily, days, n: monthRows.length };
}

/** Último movimiento (no traspaso) con ese nombre, para autocompletar tipo, cuenta y descripción. */
export function lastByName(data: Data, name: string) {
  const target = norm(name);
  if (!target) return null;
  let best: Data['rows'][number] | null = null;
  for (const r of data.rows) {
    if (norm(r[2]) === target && !isTransfer(r[5]) && (!best || r[1] >= best[1])) best = r;
  }
  return best;
}

/** Los 300 nombres más usados, para el autocompletado. */
export function frequentNames(data: Data): string[] {
  const frequency: Record<string, number> = {};
  for (const r of data.rows) {
    if (r[2] && !isTransfer(r[5])) frequency[r[2]] = (frequency[r[2]] || 0) + 1;
  }
  return Object.keys(frequency)
    .sort((a, b) => frequency[b] - frequency[a])
    .slice(0, 300);
}

/* ---- Tarjetas de crédito ---- */

/** Fecha de cierre de una tarjeta en el mes `monthKey` (ajustada si el mes es más corto que el día de cierre). */
export function closeDateFor(config: Config, card: string, monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${monthKey}-${pad(Math.min(accountConfig(config, card).closeDay, daysInMonth(y, m)))}`;
}

export interface Period {
  start: string;
  end: string;
  open: boolean;
}

/**
 * Período de facturación de una tarjeta. `offset` 0 = período abierto (aún sin cerrar),
 * 1 = último cerrado, 2 = el anterior, etc.
 */
export function periodFor(config: Config, card: string, offset: number): Period {
  const now = today();
  const thisMonth = now.slice(0, 7);
  const openPeriodEnd =
    now <= closeDateFor(config, card, thisMonth)
      ? closeDateFor(config, card, thisMonth)
      : closeDateFor(config, card, monthShift(thisMonth, 1));

  const endMonth = monthShift(openPeriodEnd.slice(0, 7), -offset);
  const end = closeDateFor(config, card, endMonth);
  const start = addDays(closeDateFor(config, card, monthShift(endMonth, -1)), 1);
  return { start, end, open: offset === 0 };
}

/** Movimientos de una tarjeta dentro de un período y sus totales. */
export function periodTotals(rows: Row[], period: Period) {
  const periodRows = rows
    .filter(r => r.d >= period.start && r.d <= period.end)
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

  let compras = 0; // compras normales
  let devol = 0; // devoluciones
  let pagos = 0; // pagos recibidos desde otra cuenta (traspaso entrante)
  let cargosTr = 0; // traspasos salientes cargados a la tarjeta (ej. avances)
  for (const r of periodRows) {
    if (isTransfer(r.t)) {
      if (r.a > 0) pagos += r.a;
      else cargosTr += -r.a;
    } else if (r.a < 0) {
      compras += -r.a;
    } else {
      devol += r.a;
    }
  }
  // Lo que el banco factura: el uso del período, sin descontar los pagos.
  return { periodRows, compras, devol, pagos, cargosTr, facturado: compras + cargosTr - devol };
}
