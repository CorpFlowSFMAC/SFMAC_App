import { redirect } from "next/navigation";

export default function GestorDashboardRedirect() {
    redirect("/dashboard/gestor/tickets");
}
