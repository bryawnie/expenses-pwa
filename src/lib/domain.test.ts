import { describe, expect, it } from 'vitest';
import { emptyData, guessKind, isTransfer, periodTotals, stats, viewRows } from './domain';
import type { Data, Op, Row } from './types';

const data: Data = {
  ...emptyData(),
  rows: [
    [2, '2026-10-02', 'Café', '', -3000, 'Comida', 'Débito'],
    [3, '2026-10-03', 'Reintegro', '', 1000, 'Comida', 'Débito'],
    [4, '2026-10-03', 'Pago', '', -5000, 'Traspasos Internos', 'Débito']
  ]
};

describe('stats', () => {
  it('ignora traspasos y descuenta reintegros', () => {
    const rows = viewRows(data, []);
    const st = stats('2026-10', rows);
    expect(st.gasto).toBe(3000);
    expect(st.ingreso).toBe(1000);
    expect(st.byCat.Comida).toBe(2000);
    expect(st.n).toBe(2);
  });
});

describe('viewRows', () => {
  it('aplica altas, ediciones y borrados pendientes', () => {
    const item = {
      id: 'x',
      date: '2026-10-05',
      name: 'Pan',
      desc: '',
      amount: -1500,
      type: 'Comida',
      account: 'Débito'
    };
    const queue: Op[] = [
      { qid: '1', action: 'add', payload: { items: [item] } },
      {
        qid: '2',
        action: 'delete',
        payload: { row: 2, orig: { d: '2026-10-02', n: 'Café', ds: '', a: -3000, t: 'Comida', c: 'Débito' } }
      }
    ];
    const rows = viewRows(data, queue);
    expect(rows.map((r) => r.n)).toEqual(['Pan', 'Pago', 'Reintegro']);
    expect(rows[0].pending).toBe(true);
  });
});

describe('helpers', () => {
  it('reconoce traspasos sin importar tildes ni mayúsculas', () => {
    expect(isTransfer('Traspasos Internos')).toBe(true);
    expect(isTransfer('Comida')).toBe(false);
  });
  it('adivina el tipo de cuenta', () => {
    expect(guessKind('Visa Banco')).toBe('credito');
    expect(guessKind('Efectivo')).toBe('efectivo');
    expect(guessKind('Cuenta RUT')).toBe('debito');
  });
  it('periodTotals no resta los pagos recibidos', () => {
    const rows: Row[] = [
      { r: 1, d: '2026-10-02', n: 'A', ds: '', a: -10000, t: 'Comida', c: 'TC' },
      { r: 2, d: '2026-10-03', n: 'Pago', ds: '', a: 4000, t: 'Traspasos Internos', c: 'TC' },
      { r: 3, d: '2026-10-04', n: 'Dev', ds: '', a: 1000, t: 'Comida', c: 'TC' }
    ];
    const t = periodTotals(rows, { start: '2026-10-01', end: '2026-10-31', open: false });
    expect(t).toMatchObject({ compras: 10000, devol: 1000, pagos: 4000, facturado: 9000 });
  });
});
