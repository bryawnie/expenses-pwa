import type {
  AccountConfig,
  AccountKind,
  Config,
  MonthStats,
  OriginalRowPayload,
  QueuedOperation,
  SheetData,
  SheetRow,
  Transaction,
  TransactionItem
} from './types';
import { addDaysToDate, dayOfMonth, daysInMonth, isoDateInMonth, normalizeText, shiftMonth, todayIso } from './utils';

const DEFAULT_TRANSFER_TYPE = 'Traspasos Internos';
const PENDING_ROW_ORDER = 1e9;
const MAX_AUTOCOMPLETE_NAMES = 300;

export const isTransfer = (type: string) => normalizeText(type).includes('traspaso');

export const emptyConfig = (): Config => ({ accounts: {}, budgets: {}, statements: {}, settings: {} });

export const emptySheetData = (): SheetData => ({
  rows: [],
  types: [],
  accounts: [],
  config: emptyConfig(),
  loaded: false
});

const transactionFromSheetRow = ([
  sheetRow,
  date,
  name,
  description,
  amount,
  type,
  account
]: SheetRow): Transaction => ({
  sheetRow,
  date,
  name,
  description,
  amount,
  type,
  account
});

function transactionFromItem(item: TransactionItem, extra: Partial<Transaction>): Transaction {
  return {
    sheetRow: null,
    date: item.date,
    name: item.name,
    description: item.desc,
    amount: item.amount,
    type: item.type,
    account: item.account,
    ...extra
  };
}

export const toOriginalRowPayload = (transaction: Transaction): OriginalRowPayload => ({
  d: transaction.date,
  n: transaction.name,
  ds: transaction.description,
  a: transaction.amount,
  t: transaction.type,
  c: transaction.account
});

/** Rows may move in the sheet, so a row is found by its content rather than by its number. */
function matchesOriginal(transaction: Transaction, original: OriginalRowPayload): boolean {
  return (
    transaction.date === original.d &&
    normalizeText(transaction.name) === normalizeText(original.n) &&
    normalizeText(transaction.description) === normalizeText(original.ds) &&
    Math.abs(transaction.amount - original.a) < 0.005 &&
    normalizeText(transaction.type) === normalizeText(original.t) &&
    normalizeText(transaction.account) === normalizeText(original.c)
  );
}

/** Sheet rows with the queued operations applied on top, newest first. */
export function buildVisibleTransactions(data: SheetData, queue: QueuedOperation[]): Transaction[] {
  const transactions = data.rows.map(transactionFromSheetRow);
  const isStoredInSheet = (transaction: Transaction) => !transaction.isPending;
  const findSheetTransactionIndex = (original: OriginalRowPayload) =>
    transactions.findIndex((transaction) => isStoredInSheet(transaction) && matchesOriginal(transaction, original));

  for (const operation of queue) {
    if (operation.action === 'add') {
      for (const item of operation.payload.items) {
        transactions.push(transactionFromItem(item, { id: item.id, isPending: true }));
      }
    } else if (operation.action === 'update') {
      const index = findSheetTransactionIndex(operation.payload.orig);
      if (index >= 0) {
        transactions[index] = transactionFromItem(operation.payload.item, {
          sheetRow: transactions[index].sheetRow,
          isPending: true
        });
      }
    } else if (operation.action === 'delete') {
      const index = findSheetTransactionIndex(operation.payload.orig);
      if (index >= 0) transactions.splice(index, 1);
    }
  }

  return transactions.sort(compareNewestFirst);
}

function compareNewestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return rowOrder(b) - rowOrder(a);
}

const rowOrder = (transaction: Transaction) => transaction.sheetRow ?? PENDING_ROW_ORDER;

function compareOldestFirst(a: Transaction, b: Transaction): number {
  if (a.date === b.date) return 0;
  return a.date < b.date ? -1 : 1;
}

export const findTransferType = (types: string[]) => types.find(isTransfer) || DEFAULT_TRANSFER_TYPE;

export function guessAccountKind(accountName: string): AccountKind {
  const name = normalizeText(accountName);
  if (/efectivo|cash/.test(name)) return 'efectivo';
  if (/\b(tc|tdc)\b|credito|visa|master|amex|cmr|lider|falabella|ripley|cencosud|paris/.test(name)) return 'credito';
  return 'debito';
}

export const getAccountConfig = (config: Config, accountName: string): AccountConfig =>
  config.accounts[accountName] || { kind: guessAccountKind(accountName), closeDay: 0, dueDay: 0 };

export const listCreditCards = (data: SheetData) =>
  data.accounts.filter((account) => getAccountConfig(data.config, account).kind === 'credito');

export function defaultTransferDescription(config: Config, destinationAccount: string): string {
  return getAccountConfig(config, destinationAccount).kind === 'credito'
    ? 'Pago ' + destinationAccount
    : 'Traspaso a ' + destinationAccount;
}

/** Transfers are excluded. "Net" amounts subtract refunds from the expenses of the same category/account/day. */
export function computeMonthStats(monthKey: string, transactions: Transaction[]): MonthStats {
  const isCountedInMonth = (transaction: Transaction) =>
    transaction.date.startsWith(monthKey) && !isTransfer(transaction.type);
  const monthTransactions = transactions.filter(isCountedInMonth);
  const [year, month] = monthKey.split('-').map(Number);
  const totalDays = daysInMonth(year, month);

  const dailyNet: number[] = Array(totalDays + 1).fill(0);
  const netByCategory: Record<string, number> = {};
  const netByAccount: Record<string, number> = {};
  let expenses = 0;
  let income = 0;

  for (const transaction of monthTransactions) {
    if (transaction.amount < 0) expenses += -transaction.amount;
    else income += transaction.amount;
    netByCategory[transaction.type] = (netByCategory[transaction.type] || 0) - transaction.amount;
    netByAccount[transaction.account] = (netByAccount[transaction.account] || 0) - transaction.amount;
    dailyNet[dayOfMonth(transaction.date)] -= transaction.amount;
  }

  return {
    expenses,
    income,
    netByCategory,
    netByAccount,
    dailyNet,
    daysInMonth: totalDays,
    transactionCount: monthTransactions.length
  };
}

export function findLatestRowByName(data: SheetData, name: string): SheetRow | null {
  const target = normalizeText(name);
  if (!target) return null;
  let latest: SheetRow | null = null;
  for (const row of data.rows) {
    const [, date, rowName, , , type] = row;
    if (normalizeText(rowName) === target && !isTransfer(type) && (!latest || date >= latest[1])) latest = row;
  }
  return latest;
}

export function mostFrequentNames(data: SheetData): string[] {
  const countByName: Record<string, number> = {};
  for (const [, , name, , , type] of data.rows) {
    if (name && !isTransfer(type)) countByName[name] = (countByName[name] || 0) + 1;
  }
  const byMostUsedFirst = (a: string, b: string) => countByName[b] - countByName[a];
  return Object.keys(countByName).sort(byMostUsedFirst).slice(0, MAX_AUTOCOMPLETE_NAMES);
}

/* ---- Credit cards ---- */

export const statementCloseDate = (config: Config, card: string, monthKey: string) =>
  isoDateInMonth(monthKey, getAccountConfig(config, card).closeDay);

export interface BillingPeriod {
  start: string;
  end: string;
  isOpen: boolean;
}

/** `periodsBack` 0 is the open period, 1 the last closed one, 2 the one before, and so on. */
export function billingPeriod(config: Config, card: string, periodsBack: number): BillingPeriod {
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const openPeriodEnd =
    today <= statementCloseDate(config, card, thisMonth)
      ? statementCloseDate(config, card, thisMonth)
      : statementCloseDate(config, card, shiftMonth(thisMonth, 1));

  const endMonth = shiftMonth(openPeriodEnd.slice(0, 7), -periodsBack);
  const end = statementCloseDate(config, card, endMonth);
  const start = addDaysToDate(statementCloseDate(config, card, shiftMonth(endMonth, -1)), 1);
  return { start, end, isOpen: periodsBack === 0 };
}

export function billingPeriodTotals(cardTransactions: Transaction[], period: BillingPeriod) {
  const isInPeriod = (transaction: Transaction) => transaction.date >= period.start && transaction.date <= period.end;
  const periodTransactions = cardTransactions.filter(isInPeriod).sort(compareOldestFirst);

  let purchases = 0;
  let refunds = 0;
  let paymentsReceived = 0;
  let transferCharges = 0; // outgoing transfers charged to the card, such as cash advances
  for (const transaction of periodTransactions) {
    if (isTransfer(transaction.type)) {
      if (transaction.amount > 0) paymentsReceived += transaction.amount;
      else transferCharges += -transaction.amount;
    } else if (transaction.amount < 0) {
      purchases += -transaction.amount;
    } else {
      refunds += transaction.amount;
    }
  }
  const billed = purchases + transferCharges - refunds;

  const balanceBefore = cardBalance(cardTransactions, addDaysToDate(period.start, -1));
  const balanceAtClose = cardBalance(cardTransactions, period.end);
  const isPaymentAfterClose = (transaction: Transaction) =>
    transaction.date > period.end && isTransfer(transaction.type) && transaction.amount > 0;
  const paymentsAfterClose = cardTransactions
    .filter(isPaymentAfterClose)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    periodTransactions,
    purchases,
    refunds,
    paymentsReceived,
    transferCharges,
    billed,
    balanceBefore,
    balanceAtClose,
    paymentsAfterClose,
    pendingAfterPayments: balanceAtClose - paymentsAfterClose
  };
}

/** Amount owed on the card up to `untilDate` (inclusive): purchases minus refunds and payments. Negative means a credit balance. */
export function cardBalance(cardTransactions: Transaction[], untilDate?: string): number {
  const isIncluded = (transaction: Transaction) => untilDate === undefined || transaction.date <= untilDate;
  return -cardTransactions.filter(isIncluded).reduce((sum, transaction) => sum + transaction.amount, 0);
}
