"use client";

import AdminTicketsPage from "@/app/dashboard/admin/tickets/page";
import GestorTurnoWidget from "@/components/GestorTurnoWidget";

export default function GestorTicketsPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
            <GestorTurnoWidget />
            <AdminTicketsPage />
        </div>
    );
}
