import os

filepath = r"c:\CorpFlowSFMAC\src\app\dashboard\admin\reportes\reportes.module.css"
new_styles = """
.sortableHeader {
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    white-space: nowrap;
}

.sortableHeader:hover {
    background: #F1F5F9;
    color: #002A8F;
}

.tableResponsiveScroll {
    width: 100%;
    overflow-x: auto;
    border-radius: 12px;
}
"""

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

if ".premiumTableAnalytical th {" in content and ".sortableHeader" not in content:
    content = content.replace(".premiumTableAnalytical th {", new_styles + ".premiumTableAnalytical th {")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replacement successful")
else:
    print("Target not found or already replaced")
