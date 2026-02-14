"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { MIBANCO_BRANCHES } from "@/lib/data/mibanco-branches";
import { CheckCircle2, AlertCircle, RefreshCw, Play } from "lucide-react";

export default function FixBranchesPage() {
    const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
    const [progress, setProgress] = useState("");
    const [logs, setLogs] = useState<string[]>([]);
    const [stats, setStats] = useState({ total: 0, updated: 0, skipped: 0, errors: 0 });

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 100));

    const runMigration = async () => {
        setStatus("running");
        setLogs([]);
        setStats({ total: MIBANCO_BRANCHES.length, updated: 0, skipped: 0, errors: 0 });

        try {
            // 1. Obtener ID del cliente MiBanco
            const { data: client, error: clientErr } = await supabase
                .from('clients')
                .select('id')
                .eq('name', 'MiBanco')
                .maybeSingle();

            if (clientErr || !client) {
                throw new Error("No se encontró el cliente 'MiBanco' en Supabase.");
            }

            const clientId = client.id;
            addLog(`✅ Cliente MiBanco encontrado (ID: ${clientId})`);

            // 2. Obtener todas las sedes actuales de MiBanco en Supabase
            const { data: supaBranches, error: branchErr } = await supabase
                .from('branch_offices')
                .select('id, name, zone')
                .eq('client_id', clientId);

            if (branchErr) throw branchErr;
            addLog(`📦 Se encontraron ${supaBranches?.length || 0} sedes en Supabase.`);

            if (!supaBranches || supaBranches.length === 0) {
                throw new Error("No hay sedes para actualizar en Supabase.");
            }

            // 3. Emparejar y actualizar
            for (const localBranch of MIBANCO_BRANCHES) {
                // Buscar por nombre (case insensitive y trimmed)
                const target = supaBranches.find(sb =>
                    sb.name?.trim().toLowerCase() === localBranch.nombre?.trim().toLowerCase()
                );

                if (target) {
                    try {
                        const { error: updateErr } = await supabase
                            .from('branch_offices')
                            .update({
                                departamento: localBranch.departamento,
                                provincia: localBranch.provincia,
                                distrito: localBranch.distrito,
                                codigo_topaz: localBranch.codigoTopaz,
                                tipo: localBranch.tipo || 'Agencia',
                                zone: localBranch.zona || target.zone
                            })
                            .eq('id', target.id);

                        if (updateErr) throw updateErr;

                        setStats(prev => ({ ...prev, updated: prev.updated + 1 }));
                        addLog(`✨ Actualizado: ${localBranch.nombre}`);
                    } catch (err: any) {
                        setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
                        addLog(`❌ Error en ${localBranch.nombre}: ${err.message}`);
                    }
                } else {
                    setStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
                    addLog(`⚠️ Saltado (no encontrado): ${localBranch.nombre}`);
                }
            }

            setStatus("completed");
            addLog("🏁 Migración terminada.");

        } catch (err: any) {
            console.error(err);
            setStatus("error");
            addLog(`🛑 FATAL: ${err.message}`);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, system-ui' }}>
            <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', padding: '32px' }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>🛠️ Reparador de Sedes (MiBanco)</h1>
                <p style={{ color: '#64748B', marginBottom: '24px' }}>
                    Esta herramienta sincroniza los campos faltantes (Departamento, Provincia, Distrito, CÓdigo Topaz)
                    desde el archivo local hacia Supabase para las sedes de MiBanco.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>Total Local</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.total}</div>
                    </div>
                    <div style={{ background: '#F0FDF4', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#166534' }}>Actualizados</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#16A34A' }}>{stats.updated}</div>
                    </div>
                    <div style={{ background: '#FFFBEB', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#92400E' }}>No Encontrados</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#D97706' }}>{stats.skipped}</div>
                    </div>
                    <div style={{ background: '#FEF2F2', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#991B1B' }}>Errores</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#DC2626' }}>{stats.errors}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <button
                        onClick={runMigration}
                        disabled={status === "running"}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: '#0F172A',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            opacity: status === "running" ? 0.7 : 1
                        }}
                    >
                        {status === "running" ? <RefreshCw className="spin" size={20} /> : <Play size={20} />}
                        {status === "idle" ? "Iniciar Reparación" : status === "running" ? "Procesando..." : "Volver a Correr"}
                    </button>

                    {status === "completed" && (
                        <div style={{
                            padding: '0 16px',
                            background: '#DCFCE7',
                            color: '#166534',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: '600'
                        }}>
                            <CheckCircle2 size={20} style={{ marginRight: '8px' }} />
                            ¡Listo!
                        </div>
                    )}
                </div>

                <div style={{
                    background: '#0F172A',
                    color: '#94A3B8',
                    padding: '16px',
                    borderRadius: '8px',
                    height: '300px',
                    overflowY: 'auto',
                    fontSize: '13px',
                    fontFamily: 'monospace'
                }}>
                    {logs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '4px' }}>
                            <span style={{ color: '#475569' }}>[{new Date().toLocaleTimeString()}]</span> {log}
                        </div>
                    ))}
                    {logs.length === 0 && <div style={{ color: '#475569' }}>Esperando inicio...</div>}
                </div>
            </div>

            <style jsx global>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
