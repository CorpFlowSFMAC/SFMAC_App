/**
 * Campos que son COLUMNAS reales en la tabla 'tickets'.
 * Estos campos NUNCA deben persistirse dentro del JSON de 'metadata' para evitar 
 * la "Duplicidad de Verdad" y parpadeos por desincronización.
 */
export const TICKET_COLUMNS = [
    'id',
    'status_id',
    'estadoId',             // Alias frecuente en el frontend
    'service_type',
    'tipoServicio',         // Alias
    'description',
    'descripcionProblema',  // Alias
    'client_ticket_number',
    'numeroTicketCliente',  // Alias
    'created_at',
    'fechaCreacion',        // Alias
    'labor_cost',
    'costoManoObra',        // Alias
    'materials_cost',
    'costoMateriales',      // Alias
    'visit_cost',
    'costoVisita',          // Alias
    'total_quoted_amount',
    'montoFinal',           // Alias
    'client_id',
    'branch_id',
    'technician_id',
    'gestora_id',
    'diagnosis',
    'diagnostico',          // Alias
    'closure_date',
    'execution_date',
    'sede_reportada_cliente',
    'updated_at',
    // UI-ONLY fields that should not be in DB at all
    'isMaximized',
    'isMinimized',
    'position',
    'zIndex',
    'cliente',
    'sede',
    'tecnico',
    'gestora'
];

/**
 * Filtra un objeto de metadatos para asegurar que no contenga campos que 
 * corresponden a columnas de la tabla o estados de UI efímeros.
 */
export function cleanMetadata(meta: any): any {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return meta;
    
    const clean = { ...meta };
    
    TICKET_COLUMNS.forEach(col => {
        delete clean[col];
    });

    // Seguridad adicional: eliminar cualquier referencia circular o anidada de 'metadata'
    delete clean.metadata;

    return clean;
}
