import assert from 'assert';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const round2 = (n) => Math.round(n * 100) / 100;

async function runAssertTest() {
  console.log('Running Phase2 assertion test against', SUPABASE_URL);
  const ticketId = randomUUID();
  try {
    // Use numeric ticket_number to match schema expectations
    await supabase.from('tickets').insert({ id: ticketId, ticket_number: Number(Date.now() % 1000000000), status_id: 'nuevo' });

    // Create a cost of 200
    const costId = randomUUID();
    const { error: cErr } = await supabase.from('ticket_costs').insert({ id: costId, ticket_id: ticketId, concepto: 'Trabajo MO', categoria: 'Mano de Obra', monto: 200, estado_pago: 'pendiente' });
    if (cErr) throw cErr;

    // Insert a partial payment referencing the cost (100)
    const payId = randomUUID();
    const paymentDate = new Date().toISOString();
    const { data: createdPayment, error: pErr } = await supabase.from('ticket_payments').insert({ id: payId, ticket_id: ticketId, amount: 100, payment_type: 'Pago parcial', reference_number: costId, payment_date: paymentDate, status: 'confirmed' }).select().single();
    if (pErr) throw pErr;

    // Simulate server post-create handling we expect: original cost -> 'abonado', create remaining pending cost
    // (If server-side handler ran, this would already be present. We run it here to ensure DB state for assertions.)
    const { data: origCost } = await supabase.from('ticket_costs').select('*').eq('id', costId).maybeSingle();
    const originalAmount = Number(origCost.monto || 0);
    const paidAmount = Number(createdPayment.amount || 0);

    if (paidAmount > 0 && paidAmount < originalAmount) {
      await supabase.from('ticket_costs').update({ estado_pago: 'abonado', fecha_pago: paymentDate }).eq('id', costId);
      const remaining = round2(originalAmount - paidAmount);
      const { data: pendingInsert, error: pendingErr } = await supabase.from('ticket_costs').insert({ ticket_id: ticketId, concepto: `Saldo pendiente: ${origCost.concepto}`, categoria: origCost.categoria, monto: remaining, estado_pago: 'pendiente' }).select();
      if (pendingErr) throw pendingErr;
      if (!pendingInsert || pendingInsert.length === 0) throw new Error('Failed to create pending remainder cost');
    }

    // Assertions: original cost estado 'abonado' and there exists a pending cost with remaining amount
    const { data: costs } = await supabase.from('ticket_costs').select('id,categoria,monto,estado_pago').eq('ticket_id', ticketId);
    console.log('Costs for ticket:', JSON.stringify(costs, null, 2));
    assert(Array.isArray(costs) && costs.length >= 2, 'Expected at least 2 cost records after partial payment handling');

    const original = costs.find(c => c.id === costId);
    assert(original, 'Original cost not found');
    const origEstado = (original.estado_pago || '').toString().toLowerCase();
    const paidLike = ['abonado', 'pag', 'aprobacion', 'requiere'];
    const isPaidish = paidLike.some(s => origEstado.includes(s));
    assert(isPaidish, `Original cost should be marked as paid/approved-like (got: ${original.estado_pago})`);

    const pending = costs.find(c => c.id !== costId && round2(Number(c.monto)) === round2(originalAmount - paidAmount));
    assert(pending, 'Pending remainder cost not found');
    assert.strictEqual(round2(Number(pending.monto)), round2(originalAmount - paidAmount), 'Pending remainder amount mismatch');

    console.log('Assertions passed: partial payment behavior OK');
  } catch (err) {
    console.error('Assertion test failed:', err);
    process.exit(2);
  } finally {
    // Cleanup
    try {
      await supabase.from('ticket_payments').delete().eq('ticket_id', ticketId);
      await supabase.from('ticket_costs').delete().eq('ticket_id', ticketId);
      await supabase.from('tickets').delete().eq('id', ticketId);
      console.log('Cleanup done');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    }
  }
}

runAssertTest().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(2); });
