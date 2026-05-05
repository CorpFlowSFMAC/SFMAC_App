"use client";

import { AppDataProvider } from "@/lib/AppDataContext";
import { QueryProvider } from "@/lib/QueryProvider";
import TechniciansPage from "@/app/dashboard/admin/technicians/page";

export default function GestorTechniciansPage() {
    return (
        <QueryProvider>
            <AppDataProvider>
                <TechniciansPage />
            </AppDataProvider>
        </QueryProvider>
    );
}
