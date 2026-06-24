const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) envVars[match[1].trim()] = match[2].trim();
});

const url = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const key = envVars['SUPABASE_SERVICE_ROLE_KEY'];

async function execSQL(sql, label) {
    const res = await fetch(url + '/pg/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ query: sql })
    });
    const text = await res.text();
    console.log(label + ':', res.ok ? 'OK' : res.status + ' - ' + text.substring(0, 500));
    return res.ok;
}

const sql = `
CREATE OR REPLACE FUNCTION auto_generate_invoice()
RETURNS trigger AS $$
DECLARE
    v_raw_amount NUMERIC;
    v_base NUMERIC;
    v_igv NUMERIC;
    v_total NUMERIC;
    v_es_mas_igv BOOLEAN;
BEGIN
    -- Only act when status changes to ticket_cerrado
    IF NEW.status_id = 'ticket_cerrado' AND (OLD.status_id IS NULL OR OLD.status_id != 'ticket_cerrado') THEN
        
        -- Check if invoice already exists
        IF NOT EXISTS (SELECT 1 FROM invoices WHERE ticket_id = NEW.id) THEN
            
            -- Get raw amount
            v_raw_amount := COALESCE(
                (NEW.metadata->>'montoFinal')::NUMERIC,
                (NEW.metadata->>'total_quoted_amount')::NUMERIC,
                NEW.total_quoted_amount,
                0
            );

            -- Determine IGV logic
            v_es_mas_igv := COALESCE((NEW.metadata->>'mas_igv')::BOOLEAN, false);
            
            IF v_es_mas_igv THEN
                v_base := v_raw_amount;
                v_igv := ROUND((v_base * 0.18)::NUMERIC, 2);
                v_total := ROUND((v_base + v_igv)::NUMERIC, 2);
            ELSE
                v_base := ROUND((v_raw_amount / 1.18)::NUMERIC, 2);
                v_igv := ROUND((v_base * 0.18)::NUMERIC, 2);
                v_total := v_raw_amount;
            END IF;

            -- Create invoice
            INSERT INTO invoices (
                ticket_id,
                amount_base,
                amount_igv,
                amount_total,
                status,
                client_id
            ) VALUES (
                NEW.id,
                v_base,
                v_igv,
                v_total,
                'emitida',
                NEW.client_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_generate_invoice ON tickets;

CREATE TRIGGER trg_auto_generate_invoice
AFTER UPDATE OF status_id ON tickets
FOR EACH ROW
EXECUTE FUNCTION auto_generate_invoice();
`;

async function run() {
    await execSQL(sql, 'auto_generate_invoice trigger');
}

run().catch(console.error);
