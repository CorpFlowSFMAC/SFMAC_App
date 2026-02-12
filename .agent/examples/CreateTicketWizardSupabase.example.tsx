/**
 * EJEMPLO: CreateTicketWizard con Supabase Hooks
 * 
 * Este es un ejemplo de cómo actualizar el wizard existente
 * para usar los hooks de Supabase en lugar de localStorage.
 */

'use client';

import { useState, useEffect } from 'react';
import { useClients, useBranches, useTickets } from '@/hooks/useSupabaseData';
import styles from './CreateTicketWizard.module.css';

interface CreateTicketWizardProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreateTicketWizardSupabase({
    isOpen,
    onClose
}: CreateTicketWizardProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        cliente: null as any,
        clienteId: '',
        sede: null as any,
        sedeId: '',
        tipoServicio: '',
        descripcionProblema: '',
        tieneNumeroCliente: false,
        numeroTicketCliente: '',
        evidencias: [] as File[]
    });

    // ============================================
    // HOOKS DE SUPABASE (Reemplazan localStorage)
    // ============================================

    const { clients, loading: loadingClients } = useClients();
    const { branches, loading: loadingBranches } = useBranches(formData.clienteId);
    const { createTicket } = useTickets();

    // ============================================
    // BÚSQUEDA DE CLIENTES
    // ============================================

    const [searchTerm, setSearchTerm] = useState('');
    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ============================================
    // PASO 1: SELECCIÓN DE CLIENTE
    // ============================================

    const handleSelectCliente = (cliente: any) => {
        setFormData({
            ...formData,
            cliente,
            clienteId: cliente.id,
            // Resetear sede al cambiar cliente
            sede: null,
            sedeId: ''
        });
    };

    // ============================================
    // PASO 2: SELECCIÓN DE SEDE
    // ============================================

    const handleSelectSede = (sede: any) => {
        setFormData({
            ...formData,
            sede,
            sedeId: sede.id
        });
    };

    // ============================================
    // PASO 5: GENERAR TICKET
    // ============================================

    const handleGenerarTicket = async () => {
        try {
            const nuevoTicket = await createTicket({
                client_id: formData.clienteId,
                branch_id: formData.sedeId,
                status_id: 'nuevo',
                description: formData.descripcionProblema,
                client_ticket_number: formData.tieneNumeroCliente
                    ? formData.numeroTicketCliente
                    : 'PENDIENTE',
                metadata: {
                    service_type: formData.tipoServicio,
                    has_evidences: formData.evidencias.length > 0,
                    evidence_count: formData.evidencias.length
                }
            });

            console.log('✅ Ticket creado en Supabase:', nuevoTicket);

            // TODO: Subir evidencias a Supabase Storage si existen
            if (formData.evidencias.length > 0) {
                console.log('📸 Evidencias pendientes de subir:', formData.evidencias);
            }

            // Resetear formulario
            setFormData({
                cliente: null,
                clienteId: '',
                sede: null,
                sedeId: '',
                tipoServicio: '',
                descripcionProblema: '',
                tieneNumeroCliente: false,
                numeroTicketCliente: '',
                evidencias: []
            });
            setCurrentStep(1);

            onClose();
        } catch (error) {
            console.error('❌ Error al crear ticket:', error);
            alert('Error al crear el ticket. Por favor intenta de nuevo.');
        }
    };

    // ============================================
    // VALIDACIONES
    // ============================================

    const canProceed = (): boolean => {
        switch (currentStep) {
            case 1: return !!formData.clienteId;
            case 2: return !!formData.sedeId;
            case 3: return !!formData.tipoServicio &&
                formData.descripcionProblema.length >= 10;
            case 4: return true; // Evidencias opcionales
            case 5: return true;
            default: return false;
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.wizard}>
                {/* BARRA DE PROGRESO */}
                <div className={styles.progressBar}>
                    {[1, 2, 3, 4, 5].map(step => (
                        <div
                            key={step}
                            className={`${styles.progressStep} ${currentStep === step ? styles.active : ''
                                } ${currentStep > step ? styles.completed : ''}`}
                        >
                            {currentStep > step ? '✓' : step}
                        </div>
                    ))}
                </div>

                {/* PASO 1: CLIENTE */}
                {currentStep === 1 && (
                    <div className={styles.step}>
                        <h2>Paso 1: Selecciona el Cliente</h2>

                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInput}
                        />

                        {loadingClients ? (
                            <div className={styles.loading}>Cargando clientes...</div>
                        ) : (
                            <div className={styles.clientGrid}>
                                {filteredClients.map(client => (
                                    <div
                                        key={client.id}
                                        className={`${styles.clientCard} ${formData.clienteId === client.id ? styles.selected : ''
                                            }`}
                                        onClick={() => handleSelectCliente(client)}
                                    >
                                        <div className={styles.clientLogo}>
                                            {client.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className={styles.clientInfo}>
                                            <h3>{client.name}</h3>
                                        </div>
                                        {formData.clienteId === client.id && (
                                            <div className={styles.checkmark}>✓</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* PASO 2: SEDE */}
                {currentStep === 2 && (
                    <div className={styles.step}>
                        <h2>Paso 2: Selecciona la Sede</h2>

                        {formData.cliente && (
                            <div className={styles.selectedClient}>
                                <strong>Cliente:</strong> {formData.cliente.name}
                            </div>
                        )}

                        {loadingBranches ? (
                            <div className={styles.loading}>Cargando sedes...</div>
                        ) : branches.length === 0 ? (
                            <div className={styles.noBranches}>
                                No hay sedes registradas para este cliente.
                            </div>
                        ) : (
                            <div className={styles.branchGrid}>
                                {branches.map(branch => (
                                    <div
                                        key={branch.id}
                                        className={`${styles.branchCard} ${formData.sedeId === branch.id ? styles.selected : ''
                                            }`}
                                        onClick={() => handleSelectSede(branch)}
                                    >
                                        <h3>{branch.name}</h3>
                                        <p className={styles.branchAddress}>
                                            📍 {branch.address}
                                        </p>
                                        <p className={styles.branchZone}>
                                            Zona: {branch.zone}
                                        </p>
                                        {formData.sedeId === branch.id && (
                                            <div className={styles.checkmark}>✓</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* PASO 3, 4, 5: Mantener igual que antes */}
                {/* ... */}

                {/* NAVEGACIÓN */}
                <div className={styles.navigation}>
                    {currentStep > 1 && (
                        <button
                            className={styles.btnBack}
                            onClick={() => setCurrentStep(currentStep - 1)}
                        >
                            ← Atrás
                        </button>
                    )}

                    {currentStep < 5 ? (
                        <button
                            className={styles.btnNext}
                            onClick={() => setCurrentStep(currentStep + 1)}
                            disabled={!canProceed()}
                        >
                            Siguiente →
                        </button>
                    ) : (
                        <button
                            className={styles.btnGenerate}
                            onClick={handleGenerarTicket}
                        >
                            ✓ Generar Ticket
                        </button>
                    )}
                </div>

                <button className={styles.btnClose} onClick={onClose}>
                    ✕
                </button>
            </div>
        </div>
    );
}
