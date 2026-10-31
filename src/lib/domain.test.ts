import { describe, expect, it } from 'vitest';
import {
  billingPeriodTotals,
  buildVisibleTransactions,
  computeMonthStats,
  emptySheetData,
  guessAccountKind,
  isTransfer
} from './domain';
import type { QueuedOperation, SheetData, Transaction } from './types';

const sheetData: SheetData = {
  ...emptySheetData(),
  rows: [
    [2, '2026-10-02', 'Café', '', -3000, 'Comida', 'Débito'],
    [3, '2026-10-03', 'Reintegro', '', 1000, 'Comida', 'Débito'],
    [4, '2026-10-03', 'Pago', '', -5000, 'Traspasos Internos', 'Débito']
  ]
};

describe('computeMonthStats', () => {
  it('ignores transfers and subtracts refunds from the category', () => {
    const stats = computeMonthStats('2026-10', buildVisibleTransactions(sheetData, []));
    expect(stats.expenses).toBe(3000);
    expect(stats.income).toBe(1000);
    expect(stats.netByCategory.Comida).toBe(2000);
    expect(stats.transactionCount).toBe(2);
  });
});

describe('buildVisibleTransactions', () => {
  it('applies queued additions and deletions on top of the sheet', () => {
    const queue: QueuedOperation[] = [
      {
        queueId: '1',
        action: 'add',
        payload: {
          items: [
            { id: 'x', date: '2026-10-05', name: 'Pan', desc: '', amount: -1500, type: 'Comida', account: 'Débito' }
          ]
        }
      },
      {
        queueId: '2',
        action: 'delete',
        payload: { row: 2, orig: { d: '2026-10-02', n: 'Café', ds: '', a: -3000, t: 'Comida', c: 'Débito' } }
      }
    ];
    const transactions = buildVisibleTransactions(sheetData, queue);
    expect(transactions.map((transaction) => transaction.name)).toEqual(['Pan', 'Pago', 'Reintegro']);
    expect(transactions[0].isPending).toBe(true);
  });
});

describe('helpers', () => {
  it('recognizes transfers regardless of accents and case', () => {
    expect(isTransfer('Traspasos Internos')).toBe(true);
    expect(isTransfer('Comida')).toBe(false);
  });

  it('guesses the account kind from its name', () => {
    expect(guessAccountKind('Visa Banco')).toBe('credito');
    expect(guessAccountKind('Efectivo')).toBe('efectivo');
    expect(guessAccountKind('Cuenta RUT')).toBe('debito');
  });

  it('does not subtract payments received from what the card billed', () => {
    const transactions: Transaction[] = [
      { sheetRow: 1, date: '2026-10-02', name: 'A', description: '', amount: -10000, type: 'Comida', account: 'TC' },
      {
        sheetRow: 2,
        date: '2026-10-03',
        name: 'Pago',
        description: '',
        amount: 4000,
        type: 'Traspasos Internos',
        account: 'TC'
      },
      { sheetRow: 3, date: '2026-10-04', name: 'Dev', description: '', amount: 1000, type: 'Comida', account: 'TC' }
    ];
    const totals = billingPeriodTotals(transactions, { start: '2026-10-01', end: '2026-10-31', isOpen: false });
    expect(totals).toMatchObject({ purchases: 10000, refunds: 1000, paymentsReceived: 4000, billed: 9000 });
  });
});
