"use client";

import { useState, useMemo } from "react";
import {
    Calculator, TrendingUp, History, Download,
    CheckCircle2, Clock, AlertTriangle, ArrowUpRight,
    Briefcase, X, Target, Zap, Star, ChevronRight, Info
} from "lucide-react";
import { useAppData } from "@/lib/AppDataContext";
import { normalizeStateId } from "@/lib/ticketStates";
import { formatSoles } from "@/lib/formatters";

// ── Terminal states that unlock closure_date-based productivity ──
const TERMINAL_STATES = ["por_liquidar", "ticket_cerrado"];
// ── Advanced (in-transit) states for rollover / goal tracker ──
const TRANSIT_STATES = ["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar"];

// ── Función helper para parseo seguro de números ──
function safeNum(val: any): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const clean = val.replace(/[^0-9.-]/g, '');
        return parseFloat(clean) || 0;
    }
    return 0;
}

// ── Utility: calc net profit from a ticket (Subtotal minus real outflows)
// VERSIÓN MEJORADA - Considera legacy + moderna + pactado
function netUtility(t: any): number {
    const meta = t.metadata || {};
    
    // 1. INGRESOS: Priorizar ingresos reales confirmados
    const ingresoBruto = [
        t.ingresos_reales,
        t.montoFinal,
        t.total_quoted_amount,
        meta.ingresos_reales,
        meta.total_quoted_amount,
        meta.montoFinal
    ].reduce((best: number, val: any) => {
        const num = safeNum(val);
        return (num > 0 && (!best || num < best)) ? num : best;
    }, 0);
    
    const subtotal = ingresoBruto / 1.18; // excl. IGV
    
    // 2. PAGOS AL TÉCNICO: Unificar legacy + moderna
    // Legacy payments
    const legacyPagos = (meta.historialPagosTecnico || meta.historialPagosTécnico || []).reduce((s: number, p: any) => {
        if (p.estado !== 'anulado' && p.estado !== 'rechazado') {
            return s + safeNum(p.monto);
        }
        return s;
    }, 0);
    
    // Modern costs ( tabla ticket_costs )
    const modernCosts = (t.costos || []).reduce((s: number, c: any) => {
        const st = (c.estado_pago || '').toLowerCase();
        if (!st.includes('anulado') && !st.includes('rechazado')) {
            return s + safeNum(c.monto);
        }
        return s;
    }, 0);
    
    // 3. COSTOS PACTADOS: Mano de obra pactada
    const pactadoMO = [
        t.monto_pactado_mo,
        t.labor_cost,
        meta.costoManoObra,
        meta.monto_pactado_mo
    ].reduce((best: number, val: any) => {
        const num = safeNum(val);
        return (num > 0 && (!best || num < best)) ? num : best;
    }, 0);
    
    // 4. COSTOS ADICIONALES: materiales, visita, etc.
    const materialsCost = safeNum(t.materials_cost || 0);
    const visitCost = safeNum(t.visit_cost || 0);
    
    // Total de salidas reales = máximo entre pactadoMO vs lo realmente pagado 
    // (para evitar utilidad negativa por pagos mayores al pactado)
    const totalPagos = legacyPagos + modernCosts;
    const totalOutflow = Math.max(pactadoMO + materialsCost + visitCost, totalPagos);
    
    return Math.max(0, subtotal - totalOutflow);
}

// ── Days remaining in current month ──
function daysLeftInMonth(): number {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate();
}

export default function ClosingPage() {
    const { tickets, gestoras, gestorasTargets, loadingTickets, loadingGestoras } = useAppData();

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [activeModal, setActiveModal] = useState<null | "achieved" | "rollover" | "bonus" | "rate">(null);
    const [expandedGestora, setExpandedGestora] = useState<string | null>(null);

    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    const isCurrentMonth = selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();
    const daysLeft = isCurrentMonth ? daysLeftInMonth() : 0;

    // ── CORE CALCULATIONS ──────────────────────────────────
    const closingData = useMemo(() => {
        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        // Tickets with closure_date inside this period → ACHIEVED (LOGRADO)
        const achievedTickets = tickets.filter(t => {
            if (!t.closure_date) return false;
            const d = new Date(t.closure_date);
            return d >= startOfMonth && d <= endOfMonth;
        });

        // Tickets created in or before this period still open/no closure_date → ROLLOVER
        const rolloverTickets = tickets.filter(t => {
            const created = new Date(t.createdAt || t.created_at);
            if (created > endOfMonth) return false;
            const sid = normalizeStateId(t.estadoId);
            if (!t.closure_date) return true; // open with no closure_date
            const cDate = new Date(t.closure_date);
            return cDate > endOfMonth; // closed after this period
        }).filter(t => !TERMINAL_STATES.includes(normalizeStateId(t.estadoId)) || !t.closure_date);

        // Per-gestora stats
        const statsByGestora = gestoras.map(g => {
            const targetObj = gestorasTargets.find(tg => tg.gestora_id === g.id && tg.month_key === monthKey);
            const myAchieved = achievedTickets.filter(t => t.gestora_id === g.id);
            const myRollover = rolloverTickets.filter(t => t.gestora_id === g.id);

            // Transit tickets (near closure, for Impulso Final Recommender)
            const myTransit = tickets.filter(t =>
                t.gestora_id === g.id &&
                TRANSIT_STATES.includes(normalizeStateId(t.estadoId)) &&
                !t.closure_date
            ).map(t => ({ ...t, _utility: netUtility(t) }))
             .sort((a, b) => b._utility - a._utility);

            const utilityTotal = myAchieved.reduce((a, t) => a + netUtility(t), 0);
            const utilityProyectada = myRollover.reduce((a, t) => a + netUtility(t), 0);

            const targetAmount = parseFloat(targetObj?.target_amount || g.meta_mensual_utilidad || "35000");
            const multiplier = parseFloat(targetObj?.bonus_multiplier || "0.1");
            const baseLaboral = parseFloat(g.costo_laboral_mensual || "0");

            const percentAchieved = targetAmount > 0 ? Math.max(0, (utilityTotal / targetAmount) * 100) : 0;
            const bonusEarned = percentAchieved >= 80 ? (utilityTotal / targetAmount) * (baseLaboral * multiplier) : 0;
            const metaBono = parseFloat(targetObj?.meta_bono || g.meta_mensual_bono || "1500");
            const faltante = Math.max(0, metaBono - bonusEarned);

            // Impulso Final: find top 3 transit tickets whose sum covers the gap
            let impulsoTop: any[] = [];
            let cumSum = 0;
            for (const t of myTransit) {
                if (cumSum >= faltante && impulsoTop.length >= 1) break;
                impulsoTop.push(t);
                cumSum += t._utility;
                if (impulsoTop.length >= 5) break;
            }

            return {
                ...g,
                myAchieved,
                myRollover,
                myTransit,
                ticketsCount: myAchieved.length,
                rolloverCount: myRollover.length,
                utilityTotal,
                utilityProyectada,
                percentAchieved,
                bonusEarned,
                targetAmount,
                metaBono,
                faltante,
                impulsoTop,
            };
        });

        const totalAchieved = achievedTickets.reduce((a, t) => a + (parseFloat(t.montoFinal || t.total_quoted_amount || 0)), 0);
        const totalRollover = rolloverTickets.reduce((a, t) => a + (parseFloat(t.montoFinal || t.total_quoted_amount || 0)), 0);
        const totalBonus = statsByGestora.reduce((s, g) => s + g.bonusEarned, 0);
        const totalTickets = achievedTickets.length + rolloverTickets.length;
        const closureRate = totalTickets > 0 ? Math.round((achievedTickets.length / totalTickets) * 100) : 0;

        return { achievedTickets, rolloverTickets, statsByGestora, totalAchieved, totalRollover, totalBonus, closureRate };
    }, [tickets, gestoras, gestorasTargets, selectedMonth, selectedYear, monthKey]);

    if (loadingTickets || loadingGestoras) {
        return (
            <div style={{ padding: '4rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center', background: '#0B0B14', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
                <Calculator size={32} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                <p>Calculando periodos de cierre...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: "1.5rem 2.5rem", minHeight: "100vh", background: "#0B0B14", fontFamily: 'Inter, sans-serif' }}>

            {/* ── MODAL BACKDROP ── */}
            {activeModal && (
                <div
                    onClick={() => setActiveModal(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000 }}
                />
            )}

            {/* ── MODAL: LOGRADO ── */}
            {activeModal === 'achieved' && (
                <DrillModal
                    title="Tickets Cerrados en el Mes"
                    subtitle={`Periodo: ${monthKey} — Usando campo closure_date como fuente de verdad`}
                    color="#10B981"
                    onClose={() => setActiveModal(null)}
                >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {['Ticket', 'Gestora', 'Monto Bruto', 'Subtotal (s/IGV)', 'Pagos Técnico', 'Utilidad Neta', 'Cierre'].map(h => (
                                    <th key={h} style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.3)', textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {closingData.achievedTickets.length === 0 && (
                                <tr><td colSpan={7} style={{ padding: '24px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Sin tickets cerrados en este periodo</td></tr>
                            )}
                            {closingData.achievedTickets.map((t, i) => {
                                const bruto = parseFloat(t.montoFinal || t.total_quoted_amount || 0);
                                const sub = bruto / 1.18;
                                const pagos = (t.metadata?.historialPagosTecnico || []).reduce((s: number, p: any) => s + parseFloat(p.monto || 0), 0);
                                const util = sub - pagos;
                                const g = closingData.statsByGestora.find(g => g.id === t.gestora_id);
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                        <td style={{ padding: '10px 12px', color: 'white', fontWeight: 700 }}>{t.numeroTicketCliente || t.id?.slice(0,8)}</td>
                                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>{g?.name || '—'}</td>
                                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.7)' }}>S/ {formatSoles(bruto)}</td>
                                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.7)' }}>S/ {formatSoles(sub)}</td>
                                        <td style={{ padding: '10px 12px', color: '#F59E0B' }}>- S/ {formatSoles(pagos)}</td>
                                        <td style={{ padding: '10px 12px', color: '#10B981', fontWeight: 800 }}>S/ {formatSoles(util)}</td>
                                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{t.closure_date ? new Date(t.closure_date).toLocaleDateString('es-PE') : '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div style={{ marginTop: '1rem', padding: '12px 16px', background: 'rgba(16,185,129,0.08)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <span style={{ color: '#10B981', fontWeight: 900 }}>Total Ingresado (Bruto): S/ {formatSoles(closingData.totalAchieved)}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '20px', fontSize: '0.8rem' }}>Fuente: Sistema de Tickets + Tesorería (historialPagosTecnico)</span>
                    </div>
                </DrillModal>
            )}

            {/* ── MODAL: ROLLOVER ── */}
            {activeModal === 'rollover' && (
                <DrillModal
                    title="Rollover / Tickets En Tránsito"
                    subtitle="Tickets sin closure_date — su bono contará en el mes donde finalmente se cierren"
                    color="#F59E0B"
                    onClose={() => setActiveModal(null)}
                >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {['Ticket', 'Gestora', 'Estado Actual', 'Monto Bruto', 'Utilidad Proyectada', 'Días Activo'].map(h => (
                                    <th key={h} style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.3)', textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {closingData.rolloverTickets.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: '24px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Sin tickets en rollover ✅</td></tr>
                            )}
                            {closingData.rolloverTickets.map((t, i) => {
                                const bruto = parseFloat(t.montoFinal || t.total_quoted_amount || 0);
                                const util = netUtility(t);
                                const g = closingData.statsByGestora.find(g => g.id === t.gestora_id);
                                const sid = normalizeStateId(t.estadoId);
                                const dias = Math.floor((Date.now() - new Date(t.createdAt || t.created_at).getTime()) / 86400000);
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                        <td style={{ padding: '10px 12px', color: 'white', fontWeight: 700 }}>{t.numeroTicketCliente || t.id?.slice(0,8)}</td>
                                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>{g?.name || '—'}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '99px' }}>
                                                {sid.replace(/_/g,' ')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.7)' }}>S/ {formatSoles(bruto)}</td>
                                        <td style={{ padding: '10px 12px', color: '#F59E0B', fontWeight: 800 }}>S/ {formatSoles(util)}</td>
                                        <td style={{ padding: '10px 12px', color: dias > 30 ? '#EF4444' : 'rgba(255,255,255,0.4)', fontWeight: dias > 30 ? 800 : 400 }}>{dias}d</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div style={{ marginTop: '1rem', padding: '12px 16px', background: 'rgba(245,158,11,0.08)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <span style={{ color: '#F59E0B', fontWeight: 900 }}>Total Rollover (Bruto): S/ {formatSoles(closingData.totalRollover)}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '20px', fontSize: '0.8rem' }}>Estos montos se acreditarán al mes en que se registre su closure_date</span>
                    </div>
                </DrillModal>
            )}

            {/* ── MODAL: BONO ── */}
            {activeModal === 'bonus' && (
                <DrillModal
                    title="Detalle de Bonos a Pagar"
                    subtitle="Fórmula: (Utilidad Neta / Meta) × (Costo Laboral × Multiplicador) — Solo si ≥ 80% de meta"
                    color="#8B5CF6"
                    onClose={() => setActiveModal(null)}
                >
                    {closingData.statsByGestora.map((g, i) => (
                        <div key={i} style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: 'white', fontWeight: 800 }}>{g.name}</span>
                                <span style={{ color: g.bonusEarned > 0 ? '#A78BFA' : 'rgba(255,255,255,0.2)', fontWeight: 900 }}>
                                    S/ {formatSoles(g.bonusEarned)}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '8px' }}>
                                    <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Utilidad lograda</div>
                                    <div style={{ color: '#10B981', fontWeight: 800 }}>S/ {formatSoles(g.utilityTotal)}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '8px' }}>
                                    <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Meta utilidad</div>
                                    <div style={{ color: 'white', fontWeight: 800 }}>S/ {formatSoles(g.targetAmount)}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '8px' }}>
                                    <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>% Cumplimiento</div>
                                    <div style={{ color: g.percentAchieved >= 80 ? '#10B981' : '#F59E0B', fontWeight: 800 }}>{Math.round(g.percentAchieved)}%</div>
                                </div>
                            </div>
                            {g.percentAchieved < 80 && (
                                <div style={{ marginTop: '8px', fontSize: '0.73rem', color: '#F59E0B', background: 'rgba(245,158,11,0.08)', padding: '6px 10px', borderRadius: '8px' }}>
                                    ⚠ No alcanzó el mínimo del 80%. Bono bloqueado para este periodo.
                                </div>
                            )}
                        </div>
                    ))}
                </DrillModal>
            )}

            {/* ── MODAL: TASA ── */}
            {activeModal === 'rate' && (
                <DrillModal
                    title="Tasa de Cierre — Eficiencia de Ejecución"
                    subtitle="Tickets cerrados / (cerrados + rollover) en el periodo seleccionado"
                    color="#3B82F6"
                    onClose={() => setActiveModal(null)}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Cerrados (Logrado)', value: closingData.achievedTickets.length, color: '#10B981' },
                            { label: 'Rollover (Pendiente)', value: closingData.rolloverTickets.length, color: '#F59E0B' },
                            { label: 'Tasa', value: `${closingData.closureRate}%`, color: '#3B82F6' },
                        ].map((s, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color }}>{s.value}</div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '4px' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        {closingData.statsByGestora.map((g, i) => {
                            const total = g.ticketsCount + g.rolloverCount;
                            const rate = total > 0 ? Math.round((g.ticketsCount / total) * 100) : 0;
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', width: '180px', fontSize: '0.82rem' }}>{g.name}</span>
                                    <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${rate}%`, height: '100%', background: rate >= 70 ? '#10B981' : '#F59E0B', transition: 'width 0.8s' }} />
                                    </div>
                                    <span style={{ color: 'white', fontWeight: 800, width: '40px', textAlign: 'right', fontSize: '0.82rem' }}>{rate}%</span>
                                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', width: '80px' }}>{g.ticketsCount}/{total} cerrados</span>
                                </div>
                            );
                        })}
                    </div>
                </DrillModal>
            )}

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ color: 'white', fontWeight: 900, fontSize: '1.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calculator color="#8B5CF6" size={32} /> Cierre de Facturación y Bonos
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.35)', margin: '4px 0 0', fontWeight: 500, fontSize: '0.85rem' }}>
                        Productividad auditada · Módulos: Tickets + Tesorería + HR
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px' }}>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}
                            style={{ background: 'transparent', color: 'white', border: 'none', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
                            {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
                                <option key={i} value={i} style={{ background: '#0B0B14' }}>{m}</option>
                            ))}
                        </select>
                        <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
                            style={{ background: 'transparent', color: 'white', border: 'none', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
                            {[2024, 2025, 2026].map(y => <option key={y} value={y} style={{ background: '#0B0B14' }}>{y}</option>)}
                        </select>
                    </div>
                    <button style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(139,92,246,0.3)' }}>
                        <Download size={16} /> Exportar Planilla
                    </button>
                </div>
            </div>

            {/* ── PROXIMITY ALERT BANNER ── */}
            {isCurrentMonth && daysLeft <= 5 && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem', background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(245,158,11,0.08))', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertTriangle color="#EF4444" size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ color: '#FCA5A5', fontWeight: 900, margin: 0, fontSize: '0.95rem' }}>
                            ⏰ ¡Cierre de mes en {daysLeft} día{daysLeft !== 1 ? 's' : ''}! — Impulsa los tickets en tránsito.
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', fontSize: '0.78rem' }}>
                            {closingData.rolloverTickets.length} tickets sin closure_date pasarán al siguiente mes si no se finalizan antes.
                        </p>
                    </div>
                    <span style={{ color: '#EF4444', fontWeight: 900, fontSize: '1.4rem', fontFamily: 'monospace' }}>{daysLeft}d</span>
                </div>
            )}

            {/* ── KPI CARDS (clickable) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
                <KpiCard
                    label="Logrado en el Mes"
                    value={`S/ ${formatSoles(closingData.totalAchieved)}`}
                    sub={`${closingData.achievedTickets.length} Tickets Cerrados`}
                    icon={<CheckCircle2 color="#10B981" size={20} />}
                    color="#10B981"
                    onClick={() => setActiveModal('achieved')}
                />
                <KpiCard
                    label="Rollover (En Tránsito)"
                    value={`S/ ${formatSoles(closingData.totalRollover)}`}
                    sub={`${closingData.rolloverTickets.length} Tickets Pendientes`}
                    icon={<Clock color="#F59E0B" size={20} />}
                    color="#F59E0B"
                    onClick={() => setActiveModal('rollover')}
                />
                <KpiCard
                    label="Bono Total a Pagar"
                    value={`S/ ${formatSoles(closingData.totalBonus)}`}
                    sub="Gestoras con Meta ≥ 80%"
                    icon={<TrendingUp color="#8B5CF6" size={20} />}
                    color="#8B5CF6"
                    onClick={() => setActiveModal('bonus')}
                />
                <KpiCard
                    label="Tasa de Cierre"
                    value={`${closingData.closureRate}%`}
                    sub="Eficiencia de Ejecución"
                    icon={<History color="#3B82F6" size={20} />}
                    color="#3B82F6"
                    onClick={() => setActiveModal('rate')}
                />
            </div>

            {/* ── GOAL TRACKER PER GESTORA ── */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Target color="#8B5CF6" size={20} /> Goal Tracker — Seguimiento de Metas
                    </h2>
                    <span style={{ color: '#8B5CF6', fontWeight: 700, fontSize: '0.78rem', background: 'rgba(139,92,246,0.1)', padding: '4px 12px', borderRadius: '99px' }}>
                        {monthKey}
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {closingData.statsByGestora.map((g, i) => {
                        const isExpanded = expandedGestora === g.id;
                        const pct = Math.min(g.percentAchieved, 100);
                        const barColor = pct >= 100 ? '#10B981' : pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
                        const impulsoSum = g.impulsoTop.reduce((s: number, t: any) => s + t._utility, 0);

                        return (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
                                {/* Gestora header row */}
                                <div
                                    onClick={() => setExpandedGestora(isExpanded ? null : g.id)}
                                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px' }}
                                >
                                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', fontSize: '0.9rem', flexShrink: 0 }}>
                                        {g.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{g.name}</span>
                                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>
                                                    {g.ticketsCount} cerrados · {g.rolloverCount} rollover
                                                </span>
                                                <span style={{ color: barColor, fontWeight: 900, fontSize: '0.95rem' }}>
                                                    {Math.round(g.percentAchieved)}% de meta
                                                </span>
                                                <ChevronRight color="rgba(255,255,255,0.2)" size={16} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '4px', transition: 'width 0.8s ease' }} />
                                            {/* 80% threshold marker */}
                                            <div style={{ position: 'absolute', top: 0, left: '80%', width: '2px', height: '100%', background: 'rgba(255,255,255,0.3)' }} title="Mínimo para bono" />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem' }}>S/ 0</span>
                                            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem', position: 'relative', left: `calc(${Math.min(pct,100)}% - 40px)` }}>
                                                S/ {formatSoles(g.utilityTotal)}
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem' }}>S/ {formatSoles(g.targetAmount)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded: Impulso Final */}
                                {isExpanded && (
                                    <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', margin: '1rem 0' }}>
                                            <StatMini label="Utilidad Neta Lograda" value={`S/ ${formatSoles(g.utilityTotal)}`} color="#10B981" />
                                            <StatMini label="Bono Ganado" value={`S/ ${formatSoles(g.bonusEarned)}`} color="#A78BFA" />
                                            <StatMini label="Faltante p/ Meta Bono" value={g.faltante > 0 ? `S/ ${formatSoles(g.faltante)}` : '✅ Superado'} color={g.faltante > 0 ? '#F59E0B' : '#10B981'} />
                                        </div>

                                        {/* Impulso Final Recommender */}
                                        {isCurrentMonth && g.faltante > 0 && g.impulsoTop.length > 0 && (
                                            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                    <Zap color="#8B5CF6" size={16} />
                                                    <span style={{ color: '#A78BFA', fontWeight: 800, fontSize: '0.85rem' }}>
                                                        IMPULSO FINAL — Cierra estos {g.impulsoTop.length} ticket{g.impulsoTop.length > 1 ? 's' : ''} para asegurar tu bono de S/ {formatSoles(g.metaBono)}
                                                    </span>
                                                </div>
                                                {g.impulsoTop.map((t: any, j: number) => (
                                                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', marginBottom: '6px' }}>
                                                        <div>
                                                            <span style={{ color: 'white', fontWeight: 700, fontSize: '0.82rem' }}>{t.numeroTicketCliente || t.id?.slice(0,8)}</span>
                                                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', marginLeft: '10px' }}>{normalizeStateId(t.estadoId).replace(/_/g,' ')}</span>
                                                        </div>
                                                        <span style={{ color: '#10B981', fontWeight: 900, fontSize: '0.85rem' }}>+S/ {formatSoles(t._utility)}</span>
                                                    </div>
                                                ))}
                                                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', margin: '8px 0 0' }}>
                                                    Suma potencial: S/ {formatSoles(impulsoSum)} — Faltante actual: S/ {formatSoles(g.faltante)}
                                                </p>
                                            </div>
                                        )}

                                        {isCurrentMonth && g.faltante <= 0 && (
                                            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                                                <Star color="#10B981" size={20} style={{ marginBottom: '6px' }} />
                                                <p style={{ color: '#10B981', fontWeight: 900, margin: 0 }}>¡Meta de bono alcanzada! 🎉 Bono de S/ {formatSoles(g.bonusEarned)} confirmado.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── TABLE A: Productividad Lograda ── */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Briefcase color="#10B981" size={18} /> Tabla A: Productividad Lograda — Bono Liquidable
                    </h2>
                    <span style={{ color: '#10B981', fontWeight: 700, fontSize: '0.78rem', background: 'rgba(16,185,129,0.1)', padding: '4px 12px', borderRadius: '99px' }}>
                        closure_date en {monthKey}
                    </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(255,255,255,0.05)' }}>
                            {['Gestora', 'Tickets', 'Utilidad Neta', 'Meta (%)', 'Bono Ganado'].map(h => (
                                <th key={h} style={{ padding: '10px 12px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {closingData.statsByGestora.map((g, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '14px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 900 }}>
                                            {g.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <span style={{ color: 'white', fontWeight: 700 }}>{g.name}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '14px 12px', color: 'white', fontWeight: 800 }}>{g.ticketsCount}</td>
                                <td style={{ padding: '14px 12px', color: '#10B981', fontWeight: 900 }}>S/ {formatSoles(g.utilityTotal)}</td>
                                <td style={{ padding: '14px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(g.percentAchieved, 100)}%`, height: '100%', background: g.percentAchieved >= 80 ? '#10B981' : '#F59E0B', borderRadius: '3px' }} />
                                        </div>
                                        <span style={{ color: 'white', fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{Math.round(g.percentAchieved)}%</span>
                                    </div>
                                </td>
                                <td style={{ padding: '14px 12px' }}>
                                    <span style={{ background: g.bonusEarned > 0 ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)', color: g.bonusEarned > 0 ? '#A78BFA' : 'rgba(255,255,255,0.2)', fontWeight: 900, padding: '5px 14px', borderRadius: '8px', border: `1px solid ${g.bonusEarned > 0 ? 'rgba(139,92,246,0.25)' : 'transparent'}` }}>
                                        S/ {formatSoles(g.bonusEarned)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── TABLE B: Rollover ── */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ArrowUpRight color="#F59E0B" size={18} /> Tabla B: Rollover — Venta Proyectada Mes Siguiente
                    </h2>
                    <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.78rem', background: 'rgba(245,158,11,0.1)', padding: '4px 12px', borderRadius: '99px' }}>
                        Sin closure_date — Acredita al mes de cierre
                    </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(255,255,255,0.05)' }}>
                            {['Gestora', 'Pendientes', 'Utilidad Proyectada', 'Impacto en Meta'].map(h => (
                                <th key={h} style={{ padding: '10px 12px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {closingData.statsByGestora.map((g, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '14px 12px', color: 'white', fontWeight: 600 }}>{g.name}</td>
                                <td style={{ padding: '14px 12px', color: 'white', fontWeight: 800 }}>{g.rolloverCount}</td>
                                <td style={{ padding: '14px 12px', color: '#F59E0B', fontWeight: 900 }}>S/ {formatSoles(g.utilityProyectada)}</td>
                                <td style={{ padding: '14px 12px', color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
                                    +{Math.round((g.utilityProyectada / g.targetAmount) * 100)}% hacia la meta del siguiente mes
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── FOOTER ── */}
            <div style={{ marginTop: '2rem', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', padding: '1rem 1.5rem', border: '1px solid rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Info color="#8B5CF6" size={22} />
                <p style={{ color: 'rgba(255,255,255,0.55)', margin: 0, fontSize: '0.82rem', lineHeight: 1.6 }}>
                    <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Reglas de Negocio:</strong> El bono se calcula sobre la Utilidad Neta (Subtotal sin IGV − Pagos reales al Técnico). El trigger <code>closure_date</code> se activa automáticamente al pasar a <em>Por Liquidar</em> o <em>Cerrado</em>. Tickets sin este campo son rollover automático.
                </p>
            </div>

            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
    );
}

// ── COMPONENTS ────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, onClick }: any) {
    return (
        <div
            onClick={onClick}
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}25`, borderRadius: '20px', padding: '1.25rem', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = `${color}10`; (e.currentTarget as HTMLDivElement).style.borderColor = `${color}50`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${color}25`; }}
        >
            <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '70px', height: '70px', background: `${color}15`, borderRadius: '50%', filter: 'blur(20px)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{value}</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: '4px', fontWeight: 600 }}>{sub}</div>
            <div style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '0.65rem', color: color, fontWeight: 700, opacity: 0.6 }}>Ver detalle →</div>
        </div>
    );
}

function DrillModal({ title, subtitle, color, onClose, children }: any) {
    return (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1001, width: '90vw', maxWidth: '900px', maxHeight: '80vh', overflow: 'auto', background: '#12121e', border: `1px solid ${color}30`, borderRadius: '20px', padding: '1.5rem', boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px ${color}20` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <h2 style={{ color: 'white', margin: 0, fontWeight: 900, fontSize: '1.1rem' }}>{title}</h2>
                    <p style={{ color: 'rgba(255,255,255,0.35)', margin: '4px 0 0', fontSize: '0.78rem' }}>{subtitle}</p>
                </div>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', borderRadius: '8px', padding: '6px', display: 'flex' }}>
                    <X size={18} />
                </button>
            </div>
            {children}
        </div>
    );
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '10px' }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginBottom: '4px', fontWeight: 600 }}>{label}</div>
            <div style={{ color, fontWeight: 900, fontSize: '0.9rem' }}>{value}</div>
        </div>
    );
}
