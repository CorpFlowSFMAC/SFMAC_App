-- =============================================================================
-- POLÍTICAS RLS PARA ticket_costs - Resolver bloqueo de INSERT
-- =============================================================================
-- Este script crea las políticas RLS necesarias para permitir inserts en ticket_costs
-- por usuarios autenticados (ADMIN y GESTORA)

-- Verificar si RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'ticket_costs';

-- =============================================================================
-- POLÍTICA 1: INSERT - Permite a usuarios autenticados crear costos
-- =============================================================================
DROP POLICY IF EXISTS "Permitir insert ticket_costs authenticated" ON ticket_costs;

CREATE POLICY "Permitir insert ticket_costs authenticated" ON ticket_costs
FOR INSERT
TO authenticated
USING (
    -- Allow insert for any authenticated user
    auth.role() IN ('authenticated', 'anon')
)
WITH CHECK (
    auth.role() IN ('authenticated', 'anon')
);

-- =============================================================================
-- POLÍTICA 2: SELECT - Permite lectura a usuarios autenticados
-- =============================================================================
DROP POLICY IF EXISTS "Permitir select ticket_costs all" ON ticket_costs;

CREATE POLICY "Permitir select ticket_costs all" ON ticket_costs
FOR SELECT
TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================================================
-- POLÍTICA 3: UPDATE - Permite actualizaciones a usuarios autenticados
-- =============================================================================
DROP POLICY IF EXISTS "Permitir update ticket_costs authenticated" ON ticket_costs;

CREATE POLICY "Permitir update ticket_costs authenticated" ON ticket_costs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================================================
-- POLÍTICA 4: DELETE - Permite eliminar a usuarios autenticados  
-- =============================================================================
DROP POLICY IF EXISTS "Permitir delete ticket_costs authenticated" ON ticket_costs;

CREATE POLICY "Permitir delete ticket_costs authenticated" ON ticket_costs
FOR DELETE
TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================================================
-- NOTA: Estas políticas permiten acceso total a usuarios autenticados.
-- Para políticas más restrictivas, modificar USING/WITH CHECK
-- =============================================================================