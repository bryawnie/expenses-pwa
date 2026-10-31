/** [sheetRow, date, name, description, amount, type, account], as sent by the server. */
export type SheetRow = [number, string, string, string, number, string, string];

export interface Transaction {
  sheetRow: number | null;
  date: string;
  name: string;
  description: string;
  amount: number;
  type: string;
  account: string;
  id?: string;
  isPending?: boolean;
}

/** Transaction as the server expects it inside queued operations (wire format, do not rename). */
export interface TransactionItem {
  id: string;
  date: string;
  name: string;
  desc: string;
  amount: number;
  type: string;
  account: string;
}

/** Wire format used by the server to find the sheet row an operation refers to. */
export interface OriginalRowPayload {
  d: string;
  n: string;
  ds: string;
  a: number;
  t: string;
  c: string;
}

export type OperationInput =
  | { action: 'add'; payload: { items: TransactionItem[] } }
  | {
      action: 'update';
      payload: {
        row: number | null;
        orig: OriginalRowPayload;
        item: TransactionItem;
      };
    }
  | {
      action: 'delete';
      payload: { row: number | null; orig: OriginalRowPayload };
    }
  | { action: 'saveConfig'; payload: { config: Config } };

export type QueuedOperation = OperationInput & { queueId: string };

export type AccountKind = 'debito' | 'credito' | 'efectivo';

export interface AccountConfig {
  kind: AccountKind;
  closeDay: number;
  dueDay: number;
}

export interface Config {
  accounts: Record<string, AccountConfig>;
  budgets: Record<string, number>;
  statements: Record<string, number>;
  settings: Record<string, unknown>;
}

export interface SheetData {
  rows: SheetRow[];
  types: string[];
  accounts: string[];
  config: Config;
  loaded: boolean;
}

export interface ConnectionSettings {
  url: string;
  token: string;
}

export type Tab = 'register' | 'transactions' | 'summary' | 'cards' | 'settings';
export type SyncStatus = 'ok' | 'offline' | 'error';

export type TransactionKind = 'expense' | 'income' | 'transfer';

/** Form state. The `has*` flags stop autocomplete from overwriting what the user already chose. */
export interface TransactionDraft {
  kind: TransactionKind;
  amountDigits: string;
  name: string;
  description: string;
  date: string;
  type: string;
  account: string;
  destinationAccount: string;
  hasChosenType: boolean;
  hasChosenAccount: boolean;
  hasEditedDescription: boolean;
}

export interface MonthStats {
  expenses: number;
  income: number;
  netByCategory: Record<string, number>;
  netByAccount: Record<string, number>;
  dailyNet: number[];
  daysInMonth: number;
  transactionCount: number;
}

export interface MovementFilter {
  account: string;
  category: string;
  query: string;
}

export interface SelectedCard {
  name: string;
  periodOffset: number;
}
