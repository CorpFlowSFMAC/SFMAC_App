-- Fix for user pjsr71081@gmail.com
-- This user authenticated via Azure AD but their profile was NOT created due to RLS blocking the INSERT
-- This script creates the profile with ADMIN role

-- Check if profile exists first
DO $$
DECLARE
    existing_id UUID;
    existing_email TEXT := 'pjsr71081@gmail.com';
BEGIN
    -- Check if user exists
    SELECT id INTO existing_id FROM public.perfiles WHERE email = existing_email;
    
    IF existing_id IS NOT NULL THEN
        -- User exists, update role to ADMIN
        UPDATE public.perfiles 
        SET rol = 'ADMIN', 
            updated_at = NOW() 
        WHERE email = existing_email;
        RAISE NOTICE 'User % updated to ADMIN', existing_email;
    ELSE
        -- User doesn't exist, insert with ADMIN role
        INSERT INTO public.perfiles (id, email, nombre_completo, rol, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            existing_email,
            'Usuario Admin',
            'ADMIN',
            NOW(),
            NOW()
        );
        RAISE NOTICE 'User % created as ADMIN', existing_email;
    END IF;
END $$;

-- Verify the result
SELECT id, email, rol, nombre_completo, created_at, updated_at 
FROM public.perfiles 
WHERE email = 'pjsr71081@gmail.com';