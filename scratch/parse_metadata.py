import json
import sys

path = r"C:\Users\ang_0\.gemini\antigravity\brain\48c6b347-fbd2-421f-ab36-f474ce35d00e\.system_generated\steps\96\output.txt"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# The output is a string containing JSON
content = data['result']
start_marker = '<untrusted-data-c3cb4704-4bea-4ef4-bbd6-9fd910e69186>'
end_marker = '</untrusted-data-c3cb4704-4bea-4ef4-bbd6-9fd910e69186>'

start_index = content.find(start_marker) + len(start_marker)
end_index = content.find(end_marker)

json_str = content[start_index:end_index].strip()
inner_data = json.loads(json_str)
metadata = inner_data[0]['metadata']

# Remove the long base64 strings to see the structure
if 'historialPagosTecnico' in metadata:
    for p in metadata['historialPagosTecnico']:
        if 'voucherRef' in p and p['voucherRef'] and len(p['voucherRef']) > 100:
            p['voucherRef'] = p['voucherRef'][:50] + "..."
if 'archivoCotizaciónBCP' in metadata and metadata['archivoCotizaciónBCP'] and len(metadata['archivoCotizaciónBCP']) > 100:
    metadata['archivoCotizaciónBCP'] = metadata['archivoCotizaciónBCP'][:50] + "..."

print(json.dumps(metadata, indent=2, ensure_ascii=False))
