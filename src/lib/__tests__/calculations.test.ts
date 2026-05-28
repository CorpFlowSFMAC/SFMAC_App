import { calculateTicketFinances } from '../calculations';

describe('calculateTicketFinances (basic scenarios)', () => {
  test('calculates net base removing IGV and aggregates confirmed costs', () => {
    const ticket: any = {
      montoFinal: 118,
      montoIGV: 18,
      monto_pactado_mo: 50
    };

    const costs = [
      { id: 'c1', categoria: 'Mano de Obra', concepto: 'Pago MO', monto: 30, estado_pago: 'pagado' },
      { id: 'c2', categoria: 'Compras', concepto: 'Materiales', monto: 20, estado_pago: 'pagado' }
    ];

    const res = calculateTicketFinances(ticket, costs as any[]);

    expect(res.totalVenta).toBe(100); // 118 - 18 IGV
    expect(res.totalLaborConfirmed).toBe(30);
    expect(res.totalOpConfirmed).toBe(20);
    expect(res.realProfitability).toBe(50); // 100 - 30 - 20
    expect(res.netLaborBalance).toBe(20); // 50 pactado - 30 paid
  });

  test('treats "Adelanto Operativo" as operating expense', () => {
    const ticket: any = { montoFinal: 100 };
    const costs = [
      { id: 'a1', categoria: 'Adelanto Operativo', concepto: 'Adelanto', monto: 40, estado_pago: 'pagado' }
    ];

    const res = calculateTicketFinances(ticket, costs as any[]);
    expect(res.operatingItems.length).toBe(1);
    expect(res.laborItems.length).toBe(0);
    expect(res.totalOpConfirmed).toBe(40);
  });

  test('handles partial payment (abonado) and remainder pending', () => {
    const ticket: any = {
      montoFinal: 200,
      monto_pactado_mo: 100
    };

    // cost c1 is part-paid: monto less than pactado -> should count as labor confirmed and netLaborBalance reflect remainder
    const costs = [
      { id: 'c1', categoria: 'Mano de Obra', concepto: 'Pago MO parcial', monto: 60, estado_pago: 'pagado' },
      { id: 'c2', categoria: 'Compras', concepto: 'Materiales', monto: 30, estado_pago: 'pendiente' }
    ];

    const res = calculateTicketFinances(ticket, costs as any[]);
    expect(res.totalLaborConfirmed).toBe(60);
    expect(res.totalLaborPending).toBe(0); // pending labor none
    expect(res.totalOpPending).toBe(30);
    expect(res.netLaborBalance).toBe(40); // 100 pactado - 60 paid
  });

  test('handles tickets without IGV (montoIGV absent)', () => {
    const ticket: any = { montoFinal: 150 };
    const costs = [
      { id: 'm1', categoria: 'Mano de Obra', concepto: 'Pago', monto: 50, estado_pago: 'pagado' }
    ];

    const res = calculateTicketFinances(ticket, costs as any[]);
    // montoBase should equal montoFinal when no IGV field provided
    expect(res.totalVenta).toBe(150);
    expect(res.netProfit).toBe(100);
  });

  test('sanitizes non-numeric and negative values', () => {
    const ticket: any = { montoFinal: '250', montoIGV: '0' };
    const costs = [
      { id: 'x1', categoria: 'Mano de Obra', concepto: 'Pago', monto: ' -70.5 ', estado_pago: 'pagado' },
      { id: 'x2', categoria: 'Materiales', concepto: 'Compra', monto: 'abc', estado_pago: 'pagado' }
    ];

    const res = calculateTicketFinances(ticket, costs as any[]);
    // invalid 'abc' -> 0, negative string parses to -70.5 -> included in sums
    expect(res.totalLaborConfirmed + res.totalOpConfirmed).toBeCloseTo(-70.5 + 0);
    expect(res.totalVenta).toBe(250);
  });
});
