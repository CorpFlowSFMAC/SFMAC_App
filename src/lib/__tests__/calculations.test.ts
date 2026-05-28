import { calculateTicketFinances } from '../calculations';

describe('calculateTicketFinances', () => {
  test('excludes IGV from net profit when montoIGV present', () => {
    const ticket: any = {
      labor_cost: 1000,
      total_quoted_amount: 2000,
      montoIGV: 200
    };

    const costs: any[] = [
      { id: 'c1', monto: 300, estado_pago: 'pagado', concepto: 'Mano de obra', categoria: 'Mano de Obra' }
    ];

    const res = calculateTicketFinances(ticket, costs);
    // montoBase = montoFinal - igv = 2000-200 = 1800
    // totalLaborConfirmed = 300 -> realProfitability = 1800 - 300 = 1500
    expect(res.totalVenta).toBe(1800);
    expect(res.realProfitability).toBe(1500);
  });

  test('handles adelanto cost as operating expense vs labor correctly', () => {
    const ticket: any = { labor_cost: 500, total_quoted_amount: 1500 };
    const costs: any[] = [
      { id: 'a1', monto: 200, estado_pago: 'pagado', concepto: 'Adelanto recibido', categoria: 'Adelanto Operativo' },
      { id: 'a2', monto: 300, estado_pago: 'pagado', concepto: 'Pago MO', categoria: 'Mano de Obra' }
    ];

    const res = calculateTicketFinances(ticket, costs);
    // totalOpConfirmed should include adelanto (200), totalLaborConfirmed should include 300
    expect(res.totalOpConfirmed).toBe(200);
    expect(res.totalLaborConfirmed).toBe(300);
    expect(res.realProfitability).toBe(res.totalVenta - (res.totalOpConfirmed + res.totalLaborConfirmed));
  });

  test('partial payment consumption: abonado + pending remainder', () => {
    const ticket: any = { labor_cost: 1000, total_quoted_amount: 2500 };
    const costs: any[] = [
      { id: 'orig', monto: 400, estado_pago: 'abonado', concepto: 'Trabajo MO', categoria: 'Mano de Obra' },
      { id: 'rem', monto: 100, estado_pago: 'pendiente', concepto: 'Saldo pendiente', categoria: 'Mano de Obra' },
      { id: 'op', monto: 150, estado_pago: 'pagado', concepto: 'Materiales', categoria: 'Materiales' }
    ];

    const res = calculateTicketFinances(ticket, costs);
    // confirmed labor = only those with estado_pago confirmed/abonado (isConfirmed uses 'abonado' as confirmed)
    expect(res.totalLaborConfirmed).toBe(400);
    expect(res.totalOpConfirmed).toBe(150);
    // netLaborBalance = pactedMO - totalLaborConfirmed (pactedMO defaults to labor_cost 1000)
    expect(res.netLaborBalance).toBe(600);
  });
});
