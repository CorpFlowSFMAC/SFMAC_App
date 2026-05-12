
import os
import json
from supabase import create_client, Client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def audit_legacy_payments():
    # Fetch all tickets with some payment indicators in metadata
    res = supabase.table("tickets").select("id, ticket_number, metadata, visit_cost, labor_cost").execute()
    tickets = res.data
    
    # Fetch all ticket_costs
    res_costs = supabase.table("ticket_costs").select("ticket_id, monto, categoria, estado_pago").eq("estado_pago", "pagado").execute()
    costs = res_costs.data
    
    missing_costs = []
    
    for t in tickets:
        meta = t.get("metadata") or {}
        
        # Check Adelanto
        if meta.get("adelantoPagado"):
            monto_adelanto = float(meta.get("montoAdelanto") or 0)
            if monto_adelanto > 0:
                # Check if there is a matching cost in ticket_costs
                found = False
                for c in costs:
                    if c["ticket_id"] == t["id"] and abs(float(c["monto"]) - monto_adelanto) < 0.01:
                        found = True
                        break
                if not found:
                    missing_costs.append({
                        "ticket_id": t["id"],
                        "ticket_number": t["ticket_number"],
                        "monto": monto_adelanto,
                        "tipo": "Adelanto (Legacy)",
                        "fecha": meta.get("fechaAprobacion") or meta.get("fechaAsignacion")
                    })

        # Check Visita
        if meta.get("visitPaymentConfirmed"):
            monto_visita = float(meta.get("costoVisita") or meta.get("costoPasaje") or t.get("visit_cost") or 0)
            if monto_visita > 0:
                found = False
                for c in costs:
                    if c["ticket_id"] == t["id"] and abs(float(c["monto"]) - monto_visita) < 0.01:
                        found = True
                        break
                if not found:
                    missing_costs.append({
                        "ticket_id": t["id"],
                        "ticket_number": t["ticket_number"],
                        "monto": monto_visita,
                        "tipo": "Visita (Legacy)",
                        "fecha": meta.get("fechaPagoVisita")
                    })

    print(json.dumps(missing_costs, indent=2))

if __name__ == "__main__":
    audit_legacy_payments()
