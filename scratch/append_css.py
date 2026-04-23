import os

filepath = r"c:\CorpFlowSFMAC\src\app\dashboard\admin\reportes\reportes.module.css"
new_styles = """
.gestorasOverviewSection {
    margin-top: 1rem;
}

.gestorasGridPermanent {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
}

.gestoraActionCard {
    background: white;
    padding: 1.5rem;
    border-radius: 24px;
    border: 1px solid #E2E8F0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
}

.gestoraActionCard:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05);
    border-color: #3B82F6;
}

.gestoraAvatar {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #EFF6FF;
    color: #3B82F6;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.2rem;
}

.gestoraMiniFunnel {
    margin: 1.25rem 0;
}

.miniFunnelLabels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748B;
    margin-bottom: 0.5rem;
}

.miniBarTrack {
    height: 8px;
    background: #F1F5F9;
    border-radius: 10px;
    display: flex;
    overflow: hidden;
}

.miniBarProceso {
    background: #3B82F6;
    height: 100%;
}

.miniBarCerrado {
    background: #10B981;
    height: 100%;
    opacity: 0.8;
}

.gestoraKpisMini {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid #F1F5F9;
}

.miniKpi label {
    display: block;
    font-size: 0.65rem;
    font-weight: 700;
    color: #94A3B8;
    text-transform: uppercase;
}

.miniKpi strong {
    font-size: 0.9rem;
    font-weight: 800;
    color: #1E293B;
}

.slaMiniContainer {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.slaValueText {
    font-weight: 800;
    font-size: 0.9rem;
    min-width: 40px;
}

.slaProgressBars {
    flex: 1;
}

.slaBarTrack {
    height: 6px;
    background: #F1F5F9;
    border-radius: 10px;
    overflow: hidden;
}

.slaBarFill {
    height: 100%;
    border-radius: 10px;
}
"""

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

if "@media (max-width: 1200px) {" in content:
    content = content.replace("@media (max-width: 1200px) {", new_styles + "\n@media (max-width: 1200px) {")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replacement successful")
else:
    print("Media query not found")
