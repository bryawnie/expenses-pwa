/* Borradores del formulario de movimientos y su validación. */
import { defaultTransferDesc, transferType } from './domain';
import type { Config, Form, Item, Row } from './types';
import { today, uid } from './utils';

export function newForm(lastAcct = ''): Form {
  return {
    kind: 'gasto',
    amount: '',
    name: '',
    desc: '',
    date: today(),
    type: '',
    acct: lastAcct,
    to: '',
    typeTouched: false,
    acctTouched: !!lastAcct,
    descTouched: false
  };
}

export function formFromRow(row: Row): Form {
  return {
    kind: row.a < 0 ? 'gasto' : 'ingreso',
    amount: String(Math.abs(Math.round(row.a))),
    name: row.n,
    desc: row.ds,
    date: row.d,
    type: row.t,
    acct: row.c,
    to: '',
    typeTouched: true,
    acctTouched: true,
    descTouched: true
  };
}

export type Built<T> = { error: string } | { error?: undefined; value: T };

/** Valida un alta y arma los ítems (un traspaso son dos: sale de una cuenta y entra en la otra). */
export function buildNewItems(f: Form, types: string[], config: Config): Built<Item[]> {
  const amount = +f.amount;
  if (!amount) return { error: 'Ingresa un monto.' };
  const date = f.date || today();

  if (f.kind === 'traspaso') {
    if (!f.acct || !f.to) return { error: 'Elige la cuenta de origen y la de destino.' };
    const desc = f.desc.trim() || defaultTransferDesc(config, f.to);
    const type = transferType(types);
    return {
      value: [
        { id: uid(), date, name: 'Transferencia', desc, amount: -amount, type, account: f.acct },
        { id: uid(), date, name: 'Transferencia', desc, amount, type, account: f.to }
      ]
    };
  }

  if (!f.name.trim()) return { error: 'Escribe el comercio o nombre.' };
  if (!f.type) return { error: 'Elige un tipo.' };
  if (!f.acct) return { error: 'Elige una cuenta.' };
  return {
    value: [
      {
        id: uid(),
        date,
        name: f.name.trim(),
        desc: f.desc.trim(),
        amount: f.kind === 'gasto' ? -amount : amount,
        type: f.type,
        account: f.acct
      }
    ]
  };
}

/** Valida una edición y arma el ítem resultante. */
export function buildEditItem(f: Form, id: string): Built<Item> {
  const amount = +f.amount;
  if (!amount) return { error: 'Ingresa un monto.' };
  if (!f.name.trim() && !f.desc.trim()) return { error: 'Escribe un nombre.' };
  if (!f.type || !f.acct) return { error: 'Elige tipo y cuenta.' };
  return {
    value: {
      id,
      date: f.date || today(),
      name: f.name.trim(),
      desc: f.desc.trim(),
      amount: f.kind === 'gasto' ? -amount : amount,
      type: f.type,
      account: f.acct
    }
  };
}
