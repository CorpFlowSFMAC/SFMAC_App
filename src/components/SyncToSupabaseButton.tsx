/**
 * OPCIÓN C: Sincronización Automática desde la UI
 * 
 * Este componente agrega un botón en la aplicación para sincronizar
 * localStorage → Supabase con un solo clic.
 */

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SyncToSupabaseButton() {
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState('');
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState('');
    const [cleanupResults, setCleanupResults] = useState<any>(null);

    const cleanInvalidData = () => {
        try {
            // Leer datos actuales
            const clients = JSON.parse(localStorage.getItem('clients') || '[]');
            const before = clients.length;

            // Filtrar clientes válidos
            const validClients = clients.filter((c: any) => {
                const hasName = c.nombre || c.name;
                return hasName && hasName.trim() !== '';
            });

            const removed = before - validClients.length;

            // Guardar datos limpios
            localStorage.setItem('clients', JSON.stringify(validClients));

            setCleanupResults({
                before,
                after: validClients.length,
                removed
            });

            setProgress('✅ Datos limpiados correctamente');
        } catch (err: any) {
            setError(`Error al limpiar datos: ${err.message}`);
        }
    };

    const syncToSupabase = async () => {
        setSyncing(true);
        setProgress('Iniciando sincronización...');
        setError('');
        setResults(null);

        try {
            // Usar el cliente unificado

            // 1. Leer datos de localStorage
            setProgress('📦 Leyendo datos de localStorage...');
            const localClients = JSON.parse(localStorage.getItem('clients') || '[]');
            const localTechnicians = JSON.parse(localStorage.getItem('technicians') || '[]');
            const localTickets = JSON.parse(localStorage.getItem('tickets') || '[]');

            const stats = {
                clientsFound: localClients.length,
                techniciansFound: localTechnicians.length,
                ticketsFound: localTickets.length,
                clientsCreated: 0,
                branchesCreated: 0,
                techniciansCreated: 0,
                ticketsCreated: 0,
                errors: [] as string[]
            };

            // 2. Migrar clientes
            setProgress('📋 Migrando clientes...');
            const clientMap: Record<string, string> = {};

            for (const client of localClients) {
                try {
                    // Validar que el cliente tenga nombre
                    const clientName = client.nombre || client.name;
                    if (!clientName || clientName.trim() === '') {
                        stats.errors.push(`Cliente sin nombre (ID: ${client.id || 'desconocido'})`);
                        continue;
                    }

                    // Verificar si existe
                    const { data: existing } = await supabase
                        .from('clients')
                        .select('*')
                        .eq('name', clientName)
                        .maybeSingle();

                    if (existing) {
                        clientMap[client.id] = existing.id;
                    } else {
                        // Crear nuevo
                        const { data: newClient, error } = await supabase
                            .from('clients')
                            .insert({ name: clientName })
                            .select()
                            .single();

                        if (error) throw error;
                        clientMap[client.id] = newClient.id;
                        stats.clientsCreated++;
                    }
                } catch (err: any) {
                    const clientName = client.nombre || client.name || 'sin nombre';
                    stats.errors.push(`Cliente "${clientName}": ${err.message}`);
                }
            }

            // 3. Migrar sedes
            setProgress('🏢 Migrando sedes...');
            const branchMap: Record<string, string> = {};

            for (const client of localClients) {
                if (!client.agencias || client.agencias.length === 0) continue;

                const supabaseClientId = clientMap[client.id];
                if (!supabaseClientId) continue;

                for (const branch of client.agencias) {
                    try {
                        const { data: existing } = await supabase
                            .from('branch_offices')
                            .select('*')
                            .eq('name', branch.nombre)
                            .eq('client_id', supabaseClientId)
                            .maybeSingle();

                        if (existing) {
                            branchMap[branch.id] = existing.id;
                        } else {
                            const { data: newBranch, error } = await supabase
                                .from('branch_offices')
                                .insert({
                                    client_id: supabaseClientId,
                                    name: branch.nombre,
                                    address: branch.direccion || '',
                                    zone: branch.zona || 'LIMA',
                                    departamento: branch.departamento || null,
                                    provincia: branch.provincia || null,
                                    distrito: branch.distrito || null,
                                    codigo_topaz: branch.codigoTopaz || null,
                                    tipo: branch.tipo || 'Agencia'
                                })
                                .select()
                                .single();

                            if (error) throw error;
                            branchMap[branch.id] = newBranch.id;
                            stats.branchesCreated++;
                        }
                    } catch (err: any) {
                        stats.errors.push(`Sede "${branch.nombre}": ${err.message}`);
                    }
                }
            }

            // 4. Migrar técnicos
            setProgress('👨‍🔧 Migrando técnicos...');
            const techMap: Record<string, string> = {};

            for (const tech of localTechnicians) {
                try {
                    const { data: existing } = tech.dni
                        ? await supabase
                            .from('technicians')
                            .select('*')
                            .eq('document_number', tech.dni)
                            .maybeSingle()
                        : { data: null };

                    if (existing) {
                        techMap[tech.id] = existing.id;
                    } else {
                        const { data: newTech, error } = await supabase
                            .from('technicians')
                            .insert({
                                name: `${tech.nombre} ${tech.apellido || ''}`.trim(),
                                document_number: tech.dni || null,
                                phone: tech.telefono || null,
                                email: tech.email || null,
                                bank_name: tech.banco || null,
                                account_number: tech.numeroCuenta || null,
                                cci: tech.cci || null,
                                yape_number: tech.yape || null,
                                plin_number: tech.plin || null,
                                status: tech.estado || 'active'
                            })
                            .select()
                            .single();

                        if (error) throw error;
                        techMap[tech.id] = newTech.id;
                        stats.techniciansCreated++;
                    }
                } catch (err: any) {
                    stats.errors.push(`Técnico "${tech.nombre}": ${err.message}`);
                }
            }

            // 5. Migrar tickets
            setProgress('🎫 Migrando tickets...');

            for (const ticket of localTickets) {
                try {
                    const clientId = clientMap[ticket.clienteId];
                    const branchId = branchMap[ticket.sedeId];
                    const techId = ticket.tecnicoAsignado?.id ? techMap[ticket.tecnicoAsignado.id] : null;

                    if (!clientId || !branchId) {
                        stats.errors.push(`Ticket ${ticket.id}: Cliente o sede no encontrados`);
                        continue;
                    }

                    const { error } = await supabase
                        .from('tickets')
                        .insert({
                            client_id: clientId,
                            branch_id: branchId,
                            technician_id: techId,
                            status_id: ticket.estadoId || 'nuevo',
                            description: ticket.descripcionProblema || ticket.descripcion || '',
                            client_ticket_number: ticket.numeroTicketCliente || 'PENDIENTE',
                            labor_cost: ticket.costoManoObra || 0,
                            materials_cost: ticket.costoMateriales || 0,
                            visit_cost: ticket.costoVisita || 0,
                            total_quoted_amount: ticket.montoCotizado || 0,
                            metadata: {
                                service_type: ticket.tipoServicio,
                                original_id: ticket.id,
                                migrated_at: new Date().toISOString()
                            }
                        });

                    if (error) throw error;
                    stats.ticketsCreated++;
                } catch (err: any) {
                    stats.errors.push(`Ticket ${ticket.id}: ${err.message}`);
                }
            }

            setProgress('✅ Sincronización completada');
            setResults(stats);

        } catch (err: any) {
            setError(err.message);
            setProgress('❌ Error en la sincronización');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxWidth: '400px'
        }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>
                🔄 Sincronizar con Supabase
            </h3>

            <button
                onClick={syncToSupabase}
                disabled={syncing}
                style={{
                    width: '100%',
                    padding: '12px',
                    background: syncing ? '#ccc' : '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                }}
            >
                {syncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
            </button>

            <button
                onClick={cleanInvalidData}
                disabled={syncing}
                style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '10px',
                    background: syncing ? '#ccc' : '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                }}
            >
                🧹 Limpiar Datos Inválidos
            </button>

            {cleanupResults && (
                <div style={{
                    marginTop: '15px',
                    padding: '15px',
                    background: '#fff3e0',
                    borderRadius: '6px',
                    fontSize: '14px'
                }}>
                    <div style={{ fontWeight: '600', marginBottom: '10px' }}>
                        🧹 Limpieza Completada
                    </div>
                    <div>📊 Clientes antes: {cleanupResults.before}</div>
                    <div>✅ Clientes después: {cleanupResults.after}</div>
                    <div style={{ color: '#f57c00', fontWeight: '600' }}>
                        🗑️ Eliminados: {cleanupResults.removed}
                    </div>
                </div>
            )}

            {progress && (
                <div style={{
                    marginTop: '15px',
                    padding: '10px',
                    background: '#f5f5f5',
                    borderRadius: '6px',
                    fontSize: '14px'
                }}>
                    {progress}
                </div>
            )}

            {error && (
                <div style={{
                    marginTop: '15px',
                    padding: '10px',
                    background: '#fee',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: '#c00'
                }}>
                    ❌ {error}
                </div>
            )}

            {results && (
                <div style={{
                    marginTop: '15px',
                    padding: '15px',
                    background: '#e8f5e9',
                    borderRadius: '6px',
                    fontSize: '14px'
                }}>
                    <div style={{ fontWeight: '600', marginBottom: '10px' }}>
                        ✅ Sincronización Completada
                    </div>
                    <div>📊 Clientes creados: {results.clientsCreated}</div>
                    <div>🏢 Sedes creadas: {results.branchesCreated}</div>
                    <div>👨‍🔧 Técnicos creados: {results.techniciansCreated}</div>
                    <div>🎫 Tickets creados: {results.ticketsCreated}</div>

                    {results.errors.length > 0 && (
                        <div style={{ marginTop: '10px', color: '#c00' }}>
                            ⚠️ {results.errors.length} errores
                            <details style={{ marginTop: '5px', fontSize: '12px' }}>
                                <summary>Ver errores</summary>
                                {results.errors.map((err: string, i: number) => (
                                    <div key={i}>• {err}</div>
                                ))}
                            </details>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
