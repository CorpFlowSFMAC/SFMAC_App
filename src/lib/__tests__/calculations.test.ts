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
    // pactedMO = 1000 -> realProfitability = 1800 - 1000 = 800
    expect(res.totalVenta).toBe(1800);
    expect(res.realProfitability).toBe(800);
  });

  test('Adelanto Operativo al MISMO tecnico del ticket se clasifica como LABOR (MO advance)', () => {
    const TECH_ID = 'tech-123';
    const ticket: any = { labor_cost: 500, total_quoted_amount: 1500, technician_id: TECH_ID };
    const costs: any[] = [
      // Adelanto al mismo tecnico → LABOR
      { id: 'a1', monto: 200, estado_pago: 'pagado', concepto: 'Adelanto Operativo (MANO DE OBRA)', categoria: 'Adelanto Operativo', specialist_id: TECH_ID },
      // Rescate al mismo tecnico → LABOR
      { id: 'a2', monto: 80,  estado_pago: 'pagado', concepto: 'Rescate Financiero',               categoria: 'Rescate Financiero',  specialist_id: TECH_ID },
    ];

    const res = calculateTicketFinances(ticket, costs);
    // Ambos son LABOR (pagos al tecnico principal)
    expect(res.totalLaborConfirmed).toBe(280);
    expect(res.totalOpConfirmed).toBe(0);
    // realLaborCost = max(pactedMO=500, totalLaborConfirmed=280) = 500
    // realProfitability = 1500 - 500 = 1000
    expect(res.realProfitability).toBe(1000);
  });

  test('Adelanto a tecnico DIFERENTE (externo) se clasifica como OPERATING', () => {
    const MAIN_TECH = 'tech-main';
    const EXT_TECH  = 'tech-ext';
    const ticket: any = { labor_cost: 500, total_quoted_amount: 1500, technician_id: MAIN_TECH };
    const costs: any[] = [
      // Adelanto a tecnico externo → OPERATING
      { id: 'b1', monto: 200, estado_pago: 'pagado', concepto: 'Adelanto externo', categoria: 'Adelanto Operativo', specialist_id: EXT_TECH },
      // MO al tecnico principal → LABOR
      { id: 'b2', monto: 300, estado_pago: 'pagado', concepto: 'Pago MO',          categoria: 'Mano de Obra',       specialist_id: MAIN_TECH },
    ];

    const res = calculateTicketFinances(ticket, costs);
    expect(res.totalLaborConfirmed).toBe(300);
    expect(res.totalOpConfirmed).toBe(200);
    // realLaborCost = max(500, 300) = 500; realProfitability = 1500 - 500 - 200 = 800
    expect(res.realProfitability).toBe(800);
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
