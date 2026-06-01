import psycopg2
import sys

DB_CONFIG = {
    'host': '87.99.137.96',
    'port': 5432,
    'user': 'postgres',
    'password': 'CorpFlowSFMAC_DB_2026',
    'database': 'postgres',
    'connect_timeout': 10
}

try:
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # 1. Query for costs equal to 400 or category with adelanto
    print("--- COSTS WITH 400 OR ADELANTO ---")
    cursor.execute("""
        SELECT id, ticket_id, concepto, categoria, monto, estado_pago 
        FROM ticket_costs 
        WHERE monto = 400 OR estado_pago = 'adelanto' OR categoria = 'Adelanto' OR categoria = 'Adelanto Operativo'
        LIMIT 10;
    """)
    rows = cursor.fetchall()
    ticket_ids = set()
    for row in rows:
        print(row)
        ticket_ids.add(row[1])
        
    if ticket_ids:
        print("\n--- TICKETS DETAILS ---")
        for tid in ticket_ids:
            cursor.execute("SELECT id, ticket_number, status_id, labor_cost, total_quoted_amount FROM tickets WHERE id = %s;", (tid,))
            t_row = cursor.fetchone()
            print("Ticket:", t_row)
            
            cursor.execute("SELECT id, concepto, categoria, monto, estado_pago FROM ticket_costs WHERE ticket_id = %s;", (tid,))
            print("Costs for ticket:")
            for c_row in cursor.fetchall():
                print("  ", c_row)
                
            cursor.execute("SELECT * FROM vw_ticket_financials WHERE ticket_id = %s;", (tid,))
            print("View data:")
            colnames = [desc[0] for desc in cursor.description]
            v_row = cursor.fetchone()
            if v_row:
                for col, val in zip(colnames, v_row):
                    print(f"  {col}: {val}")
    
    # 2. Get current view definition of vw_ticket_financials
    print("\n--- VIEW DEFINITION ---")
    cursor.execute("SELECT pg_get_viewdef('vw_ticket_financials'::regclass);")
    print(cursor.fetchone()[0])
    
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
