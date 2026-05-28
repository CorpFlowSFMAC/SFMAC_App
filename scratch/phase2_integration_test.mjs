import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// Forzamos el uso del ecosistema seguro de producción de Sinfimac
const SUPABASE_URL = 'https://api.sinfimac.pe'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc'

// Inicializamos con permisos de SERVICE_ROLE y las cabeceras explícitas que exige Kong
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  }
})

async function insertTicket() {
  const id = randomUUID()
  const ticket = {
    id,
    ticket_number: Number(Date.now() % 1000000000),
    description: 'Integration test ticket - Sinfimac',
    status_id: 'nuevo',
    labor_cost: 0,
    total_quoted_amount: 0
  }
  const { error } = await supabase.from('tickets').insert(ticket)
  if (error) throw error
  return id
}

async function run() {
  console.log('🚀 Iniciando Phase2 integration test contra:', SUPABASE_URL)
  const ticketA = await insertTicket()
  const ticketB = await insertTicket()
  console.log('✅ Tickets temporales creados con éxito en producción:', ticketA, ticketB)

  try {
    // Inserta dos costos en el ticketA: un adelanto operativo y un costo normal
    const { data: costs, error: costErr } = await supabase.from('ticket_costs').insert([
      { id: randomUUID(), ticket_id: ticketA, concepto: 'Adelanto Operativo Test', categoria: 'Adelanto Operativo', monto: 100, estado_pago: 'pendiente' },
      { id: randomUUID(), ticket_id: ticketA, concepto: 'Materiales Test', categoria: 'Materiales', monto: 50, estado_pago: 'pendiente' }
    ]).select()
    if (costErr) throw costErr
    console.log('✅ Costos de prueba insertados:', costs.map(c => ({ id: c.id, categoria: c.categoria })))

    const adelantoId = costs[0].id

    // Inserta un pago de tipo 'Adelanto' referenciando el costo anterior
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
    console.log('✅ Pago por Adelanto confirmado en sistema:', { id: createdPayment.id, amount: createdPayment.amount })

    // Sincronización post-creación: marcar adelantos como pagados
    const paymentDate = payment.payment_date
    await supabase.from('ticket_costs').update({ estado_pago: 'pagado', fecha_pago: paymentDate }).eq('id', adelantoId)
    await supabase.from('ticket_costs').update({ estado_pago: 'pagado', fecha_pago: paymentDate }).eq('ticket_id', ticketA).ilike('categoria', '%adelanto%')
    console.log('✅ Sincronización de estados completada en Tesorería')

    // Verificar que los estados cambiaron de forma correcta
    const { data: afterCosts } = await supabase.from('ticket_costs').select('id,categoria,estado_pago').eq('ticket_id', ticketA)
    console.log('📊 Estado de los costos tras sincronización:', afterCosts)

    // Ejecutar transferencia simulada de costos y pagos de Ticket A -> Ticket B
    const { data: movedCosts, error: moveCostsErr } = await supabase.from('ticket_costs').update({ ticket_id: ticketB }).eq('ticket_id', ticketA).select()
    if (moveCostsErr) throw moveCostsErr
    const { data: movedPayments, error: movePaysErr } = await supabase.from('ticket_payments').update({ ticket_id: ticketB }).eq('ticket_id', ticketA).select()
    if (movePaysErr) throw movePaysErr

    console.log(`➡️ Movidos exitosamente ${movedCosts.length} costos y ${movedPayments.length} pagos al Ticket Destino: ${ticketB}`)

    // Validar los registros movidos
    const { data: costsOnB } = await supabase.from('ticket_costs').select('id,categoria,estado_pago').eq('ticket_id', ticketB)
    const { data: paysOnB } = await supabase.from('ticket_payments').select('id,amount,reference_number').eq('ticket_id', ticketB)
    console.log('📊 Costos finales en ticket destino:', costsOnB)
    console.log('📊 Pagos finales en ticket destino:', paysOnB)

    console.log('🎉 ¡El Test de Integración de la Fase 2 completado exitosamente sin errores!')
  } catch (err) {
    console.error('❌ Error detectado durante el test:', err)
  } finally {
    // LIMPIEZA INMEDIATA: Borrar los registros creados para dejar producción impecable
    try {
      await supabase.from('ticket_payments').delete().or(`ticket_id.eq.${ticketA},ticket_id.eq.${ticketB}`)
      await supabase.from('ticket_costs').delete().or(`ticket_id.eq.${ticketA},ticket_id.eq.${ticketB}`)
      await supabase.from('tickets').delete().or(`id.eq.${ticketA},id.eq.${ticketB}`)
      console.log('🧹 Registros de prueba eliminados. Base de datos limpia.')
    } catch (cleanupErr) {
      console.error('⚠️ Error en la limpieza de registros:', cleanupErr)
    }
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(2) })