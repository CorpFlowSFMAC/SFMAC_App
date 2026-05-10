import json
import sys

file_path = r'C:\Users\ang_0\.gemini\antigravity\brain\48c6b347-fbd2-421f-ab36-f474ce35d00e\.system_generated\steps\1236\output.txt'

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

result = data.get('result', '')
# The result string contains the JSON list within boundaries
import re
match = re.search(r'<untrusted-data-[^>]*>\s*(\[.*\])\s*</untrusted-data-', result, re.DOTALL)
if match:
    tickets = json.loads(match.group(1))
    for t in tickets:
        meta = t.get('metadata', {})
        meta_str = json.dumps(meta)
        if 'MB000009.26' in meta_str or t.get('ticket_number') == 9:
            print("--- DATA ---")
            print(f"ID: {t.get('id')}")
            print(f"NUM: {t.get('ticket_number')}")
            print(f"LC: {t.get('labor_cost')}")
            print(f"TQA: {t.get('total_quoted_amount')}")
            print(f"MLC: {meta.get('labor_cost')}")
            print(f"MPM: {meta.get('monto_pactado_mo')}")
            print(f"CMO: {meta.get('costoManoObra')}")
            print(f"MF: {meta.get('montoFinal')}")
            print(f"IR: {meta.get('ingresos_reales')}")
            print(f"HPT: {len(meta.get('historialPagosTecnico', [])) if meta.get('historialPagosTecnico') else 0}")
            print(f"IGV: {meta.get('igv')}")
            print(f"MIGV: {meta.get('montoIGV')}")
            print("--- END ---")
            
            # Fetch ticket_costs for this ticket
            break
else:
    print("No data found")
