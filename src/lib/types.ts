/** Fila cruda tal como la envía el servidor: [fila, fecha, nombre, descripción, monto, tipo, cuenta]. */
export type RawRow = [number, string, string, string, number, string, string];

/** Fila de movimiento que ve el usuario (la planilla + operaciones pendientes aplicadas). */
export interface Row {
  r: number | null; // nº de fila en la planilla (null = aún no existe)
  d: string; // fecha 'YYYY-MM-DD'
  n: string; // nombre/comercio
  ds: string; // descripción
  a: number; // monto (negativo = gasto)
  t: string; // tipo/categoría
  c: string; // cuenta
  id?: string;
  pending?: boolean;
  upd?: boolean;
}

/** Movimiento en la cola de envío (nombres largos, es lo que entiende el servidor). */
export interface Item {
  id: string;
  date: string;
  name: string;
  desc: string;
  amount: number;
  type: string;
  account: string;
}

export type Original = Pick<Row, 'd' | 'n' | 'ds' | 'a' | 't' | 'c'>;

export type Op =
  | { qid: string; action: 'add'; payload: { items: Item[] } }
  | { qid: string; action: 'update'; payload: { row: number | null; orig: Original; item: Item } }
  | { qid: string; action: 'delete'; payload: { row: number | null; orig: Original } }
  | { qid: string; action: 'saveConfig'; payload: { config: Config } };

export type NewOp =
  | { action: 'add'; payload: { items: Item[] } }
  | { action: 'update'; payload: { row: number | null; orig: Original; item: Item } }
  | { action: 'delete'; payload: { row: number | null; orig: Original } }
  | { action: 'saveConfig'; payload: { config: Config } };

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

export interface Data {
  rows: RawRow[];
  types: string[];
  accounts: string[];
  config: Config;
  loaded: boolean;
}

export interface Settings {
  url: string;
  token: string;
}

export type Tab = 'registrar' | 'movimientos' | 'resumen' | 'tarjetas' | 'ajustes';
export type SyncState = 'ok' | 'offline' | 'error';

export type FormKind = 'gasto' | 'ingreso' | 'traspaso';

/** Borrador del formulario. Los flags *Touched evitan que el autocompletado pise lo que el usuario ya eligió. */
export interface Form {
  kind: FormKind;
  amount: string; // solo dígitos
  name: string;
  desc: string;
  date: string;
  type: string;
  acct: string;
  to: string; // cuenta destino (solo traspasos)
  typeTouched: boolean;
  acctTouched: boolean;
  descTouched: boolean;
}

export interface Stats {
  gasto: number;
  ingreso: number;
  byCat: Record<string, number>;
  byAcct: Record<string, number>;
  daily: number[];
  days: number;
  n: number;
}
