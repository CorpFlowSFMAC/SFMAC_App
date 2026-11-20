"use client";

import ReportesEficienciaV2 from "@/app/dashboard/admin/reportes/ReportesEficienciaV2";
import { useAppData } from "@/lib/AppDataContext";
import { Layers } from "lucide-react";

export default function GestorReportesPage() {
    const { activeGestora } = useAppData();

    return (
        <div style={{ padding: "2rem 2.5rem 3rem", minHeight: "100vh", background: "#f8fafc" }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1.75rem",
                padding: "1.25rem 1.5rem",
                background: "#fff",
                borderRadius: "1rem",
                border: "1px solid #E2E8F0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}>
                <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: "0.75rem",
                    background: "linear-gradient(135deg, #4338CA, #6366F1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    boxShadow: "0 4px 12px rgba(99,102,241,0.25)"
                }}>
                    <Layers size={22} />
                </div>
                <div>
                    <h1 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0F172A", margin: 0 }}>
                        Mi Rendimiento y Productividad
                    </h1>
                    <p style={{ color: "#64748B", fontSize: "0.82rem", margin: "0.25rem 0 0 0" }}>
                        Control de tickets cerrados, facturación generada, inversión en tickets y rentabilidad histórica mes a mes
                    </p>
                </div>
            </div>

            <ReportesEficienciaV2
                lockToGestoraId={activeGestora?.id || undefined}
                isGestorView={true}
            />
        </div>
    );
}
