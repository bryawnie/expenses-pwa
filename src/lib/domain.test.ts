import { describe, expect, it } from 'vitest';
import {
  billingPeriodTotals,
  cardBalance,
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

  describe('card balance', () => {
    const card = (date: string, amount: number, type = 'Comida'): Transaction => ({
      sheetRow: null,
      date,
      name: '',
      description: '',
      amount,
      type,
      account: 'TC'
    });
    const transactions = [
      card('2026-09-10', -20000),
      card('2026-09-20', 5000, 'Traspasos Internos'),
      card('2026-10-02', -10000),
      card('2026-10-03', 4000, 'Traspasos Internos'),
      card('2026-10-04', 1000),
      card('2026-11-05', 3000, 'Traspasos Internos'),
      card('2026-11-06', -2000)
    ];
    const period = { start: '2026-10-01', end: '2026-10-31', isOpen: false };

    it('sums purchases minus refunds and payments up to a date', () => {
      expect(cardBalance(transactions, '2026-09-30')).toBe(15000);
      expect(cardBalance(transactions)).toBe(19000);
    });

    it('lets payments made before the closing reduce the balance at close', () => {
      const totals = billingPeriodTotals(transactions, period);
      expect(totals).toMatchObject({ billed: 9000, balanceBefore: 15000, balanceAtClose: 20000 });
    });

    it('subtracts partial payments made after the closing from what is still pending', () => {
      const totals = billingPeriodTotals(transactions, period);
      expect(totals.paymentsAfterClose).toBe(3000);
      expect(totals.pendingAfterPayments).toBe(17000);
    });
  });

  it('does not count payments as billed usage', () => {
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
