import { defaultTransferDescription, findTransferType } from './domain';
import type { Config, Transaction, TransactionDraft, TransactionItem } from './types';
import { generateId, todayIso } from './utils';

export function emptyDraft(lastUsedAccount = ''): TransactionDraft {
  return {
    kind: 'expense',
    amountDigits: '',
    name: '',
    description: '',
    date: todayIso(),
    type: '',
    account: lastUsedAccount,
    destinationAccount: '',
    hasChosenType: false,
    hasChosenAccount: !!lastUsedAccount,
    hasEditedDescription: false
  };
}

export function draftFromTransaction(transaction: Transaction): TransactionDraft {
  return {
    kind: transaction.amount < 0 ? 'expense' : 'income',
    amountDigits: String(Math.abs(Math.round(transaction.amount))),
    name: transaction.name,
    description: transaction.description,
    date: transaction.date,
    type: transaction.type,
    account: transaction.account,
    destinationAccount: '',
    hasChosenType: true,
    hasChosenAccount: true,
    hasEditedDescription: true
  };
}

export type ValidationResult<T> = { error: string } | { error?: undefined; value: T };

/** A transfer becomes two items: money leaves one account and enters the other. */
export function validateNewTransactions(
  draft: TransactionDraft,
  types: string[],
  config: Config
): ValidationResult<TransactionItem[]> {
  const amount = +draft.amountDigits;
  if (!amount) return { error: 'Ingresa un monto.' };
  const date = draft.date || todayIso();

  if (draft.kind === 'transfer') {
    if (!draft.account || !draft.destinationAccount) return { error: 'Elige la cuenta de origen y la de destino.' };
    const desc = draft.description.trim() || defaultTransferDescription(config, draft.destinationAccount);
    const type = findTransferType(types);
    return {
      value: [
        { id: generateId(), date, name: 'Transferencia', desc, amount: -amount, type, account: draft.account },
        { id: generateId(), date, name: 'Transferencia', desc, amount, type, account: draft.destinationAccount }
      ]
    };
  }

  if (!draft.name.trim()) return { error: 'Escribe el comercio o nombre.' };
  if (!draft.type) return { error: 'Elige un tipo.' };
  if (!draft.account) return { error: 'Elige una cuenta.' };
  return {
    value: [
      {
        id: generateId(),
        date,
        name: draft.name.trim(),
        desc: draft.description.trim(),
        amount: draft.kind === 'expense' ? -amount : amount,
        type: draft.type,
        account: draft.account
      }
    ]
  };
}

export function validateEditedTransaction(draft: TransactionDraft, id: string): ValidationResult<TransactionItem> {
  const amount = +draft.amountDigits;
  if (!amount) return { error: 'Ingresa un monto.' };
  if (!draft.name.trim() && !draft.description.trim()) return { error: 'Escribe un nombre.' };
  if (!draft.type || !draft.account) return { error: 'Elige tipo y cuenta.' };
  return {
    value: {
      id,
      date: draft.date || todayIso(),
      name: draft.name.trim(),
      desc: draft.description.trim(),
      amount: draft.kind === 'expense' ? -amount : amount,
      type: draft.type,
      account: draft.account
    }
  };
}
