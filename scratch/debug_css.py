import os

filepath = r"c:\CorpFlowSFMAC\src\app\dashboard\admin\reportes\reportes.module.css"
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines[1130:1150]):
        print(f"{i+1131}: {repr(line)}")
