"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash;
            const search = window.location.search;
            
            // Si hay token o código, ir al dashboard para procesarlos
            if (hash.includes("access_token") || search.includes("code=")) {
                router.replace("/dashboard" + search + hash);
            } else {
                router.replace("/login");
            }
        }
    }, [router]);

    return (
        <div style={{ background: '#0a0a1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'sans-serif' }}>
            SINFIMAC Ecosystem...
        </div>
    );
}
