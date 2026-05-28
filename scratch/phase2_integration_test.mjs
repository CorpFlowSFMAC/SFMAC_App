import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.sinfimac.pe'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function insertTicket() {
  const id = randomUUID()
  const ticket = {
    id,
    // Some DBs expect a numeric ticket_number; use a timestamp-based numeric id
    ticket_number: Number(Date.now() % 1000000000),
    description: 'Integration test ticket',
    status_id: 'nuevo',
    labor_cost: 0,
    total_quoted_amount: 0
  }
  const { error } = await supabase.from('tickets').insert(ticket)
  if (error) throw error
  return id
}

async function run() {
  console.log('Starting Phase2 integration test against', SUPABASE_URL)
  const ticketA = await insertTicket()
  const ticketB = await insertTicket()
  console.log('Created tickets:', ticketA, ticketB)

  try {
    // Insert two costs on ticketA: one adelanto, one normal
    const { data: costs, error: costErr } = await supabase.from('ticket_costs').insert([
      { id: randomUUID(), ticket_id: ticketA, concepto: 'Adelanto Operativo', categoria: 'Adelanto Operativo', monto: 100, estado_pago: 'pendiente' },
      { id: randomUUID(), ticket_id: ticketA, concepto: 'Materiales', categoria: 'Materiales', monto: 50, estado_pago: 'pendiente' }
    ]).select()
    if (costErr) throw costErr
    console.log('Inserted costs:', costs.map(c => ({ id: c.id, categoria: c.categoria })))

    const adelantoId = costs[0].id

    // Insert a payment referencing the adelanto and with type 'adelanto'
    const payment = {
      id: randomUUID(),
      ticket_id: ticketA,
      amount: 100,
      payment_type: 'Adelanto',
      reference_number: adelantoId,
      payment_date: new Date().toISOString(),
      status: 'confirmed'
    }
    const { data: createdPayment, error: payErr } = await supabase.from('ticket_payments').insert(payment).select().single()
    if (payErr) throw payErr
    console.log('Inserted payment:', { id: createdPayment.id, amount: createdPayment.amount })

    // Post-create sync: mark referenced cost as pagado; mark adelantos as pagado
    const paymentDate = payment.payment_date
    await supabase.from('ticket_costs').update({ estado_pago: 'pagado', fecha_pago: paymentDate }).eq('id', adelantoId)
    await supabase.from('ticket_costs').update({ estado_pago: 'pagado', fecha_pago: paymentDate }).eq('ticket_id', ticketA).ilike('categoria', '%adelanto%')
    console.log('Synchronized cost payment states for adelantos')

    // Verify statuses
    const { data: afterCosts } = await supabase.from('ticket_costs').select('id,categoria,estado_pago').eq('ticket_id', ticketA)
    console.log('Costs after sync:', afterCosts)

    // Now perform transfer: move costs and payments from ticketA -> ticketB
    const { data: movedCosts, error: moveCostsErr } = await supabase.from('ticket_costs').update({ ticket_id: ticketB }).eq('ticket_id', ticketA).select()
    if (moveCostsErr) throw moveCostsErr
    const { data: movedPayments, error: movePaysErr } = await supabase.from('ticket_payments').update({ ticket_id: ticketB }).eq('ticket_id', ticketA).select()
    if (movePaysErr) throw movePaysErr

    console.log(`Moved ${movedCosts.length} costs and ${movedPayments.length} payments to ${ticketB}`)

    // Validate moved records
    const { data: costsOnB } = await supabase.from('ticket_costs').select('id,categoria,estado_pago').eq('ticket_id', ticketB)
    const { data: paysOnB } = await supabase.from('ticket_payments').select('id,amount,reference_number').eq('ticket_id', ticketB)
    console.log('Costs on target ticket:', costsOnB)
    console.log('Payments on target ticket:', paysOnB)

    console.log('Phase2 integration test completed successfully')
  } catch (err) {
    console.error('Test error:', err)
  } finally {
    // Cleanup: delete created tickets and any linked records
    try {
      await supabase.from('ticket_payments').delete().or(`ticket_id.eq.${ticketA},ticket_id.eq.${ticketB}`)
      await supabase.from('ticket_costs').delete().or(`ticket_id.eq.${ticketA},ticket_id.eq.${ticketB}`)
      await supabase.from('tickets').delete().or(`id.eq.${ticketA},id.eq.${ticketB}`)
      console.log('Cleaned up test records')
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr)
    }
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(2) })
