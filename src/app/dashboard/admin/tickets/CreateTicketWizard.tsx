"use client";

import { useState, useEffect } from "react";
import {
    X, ChevronLeft, ChevronRight, Check, Search, MapPin, Building2,
    Upload, Image as ImageIcon, FileText, Trash2, CheckCircle, Wrench, Users, Monitor, Sparkles,
    ShieldCheck, UserCheck, RefreshCw
} from "lucide-react";
import styles from "./CreateTicketWizard.module.css";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { useAppData } from "@/lib/AppDataContext";
import { useBranches } from "@/hooks/useSupabaseData";
import { gestorasAPI } from "@/lib/routing-api";

interface CreateTicketWizardProps {
    onClose: () => void;
    onCreateTicket: (ticket: any) => void;
    // Assignment policy context
    creatorRole?: 'ADMIN' | 'GESTORA' | string;
    creatorGestoraId?: string | null;
    creatorGestoraNombre?: string | null;
}

export default function CreateTicketWizard({ onClose, onCreateTicket, creatorRole, creatorGestoraId, creatorGestoraNombre }: CreateTicketWizardProps) {
    // Policy: ADMIN starts at step 0 (gestor selection), GESTORA 