"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Plus, Trash2, Calculator, FileSpreadsheet, Download, Hash, Type, Layers, Box, DollarSign, List, FileDown } from "lucide-react";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getServiceById } from "@/lib/serviceTypes";
import { round2, formatSoles } from "@/lib/formatters";
import styles from "./OnlineQuotationEditor.module.css";

interface Partida {
    id: string;
    item: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
}

interface OnlineQuotationEditorProps {
    onUpdate?: (items: Partida[], total: number) => void;
    suggestedTotal?: number;
    initialItems?: any[];
    clientInfo?: any;
    sedeInfo?: any;
    servicioId?: string;
    ticketId?: string;
    isLocked?: boolean;
}

const OnlineQuotationEditor = forwardRef<any, OnlineQuotationEditorProps>(({ onUpdate, suggestedTotal, initialItems, clientInfo, sedeInfo, servicioId, ticketId, isLocked }, ref) => {
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [items, setItems] = useState<Partida[]>(() => {
        if (initialItems && initialItems.length > 0) {
            return initialItems.map((it: any, idx: number) => ({
                id: it.id || Math.random().toString(36).substr(2, 9),
                item: it.item || (idx + 1).toString().padStart(2, '0'),
                descripcion: it.descripcion || "",
                unidad: it.unidad || "GLB",
                cantidad: Number(it.cantidad) || 1,
                precioUnitario: Number(it.precioUnitario) || 0,
                total: Number(it.total) || (Number(it.cantidad) * Number(it.precioUnitario)) || 0
            }));
        }
        return [
            { id: '1', item: '01', descripcion: "Mano de obra especializada para el servicio", unidad: "GLB", cantidad: 1, precioUnitario: 0, total: 0 },
            { id: '2', item: '02', descripcion: "Suministro de materiales e insumos necesarios", unidad: "GLB", cantidad: 1, precioUnitario: 0, total: 0 }
        ];
    });

    const addItem = () => {
        const nextNum = (items.length + 1).toString().padStart(2, '0');
        setItems([...items, {
            id: Math.random().toString(36).substr(2, 9),
            item: nextNum,
            descripcion: "",
            unidad: "UND",
            cantidad: 1,
            precioUnitario: 0,
            total: 0
        }]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: keyof Partida, value: string | number) => {
        const newItems = items.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'cantidad' || field === 'precioUnitario') {
                    // ★ FIX PRECISION: Redondear el total de la partida a 2 decimales
                    updatedItem.total = round2(Number(updatedItem.cantidad) * Number(updatedItem.precioUnitario));
                }
                return updatedItem;
            }
            return item;
        });
        setItems(newItems);
    };

    const subtotal = round2(items.reduce((sum, item) => sum + item.total, 0));
    const igv = round2(subtotal * 0.18);
    const grandTotal = round2(subtotal + igv);

    const quoteRef = useRef<HTMLDivElement>(null);

    const handleDownloadPDF = () => {
        return new Promise<void>((resolve) => {
            if (!quoteRef.current) {
                resolve();
                return;
            }
            setIsExporting(true);

            // Esperar un frame a que se rendericen los DIVs estáticos
            setTimeout(async () => {
                const element = quoteRef.current;
                if (!element) {
                    setIsExporting(false);
                    resolve();
                    return;
                }

                try {
                    const canvas = await html2canvas(element, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: "#ffffff"
                    });

                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const imgProps = pdf.getImageProperties(imgData);
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save(`Cotizacion_${ticketId || 'SINFIMAC'}.pdf`);
                } catch (err) {
                    console.error("Error generating PDF:", err);
                } finally {
                    setIsExporting(false);
                    resolve();
                }
            }, 300);
        });
    };

    // Exponer la función de descarga al padre
    useImperativeHandle(ref, () => ({
        downloadPDF: handleDownloadPDF
    }));

    useEffect(() => {
        if (onUpdate && !isLocked) {
            onUpdate(items, grandTotal);
        }
    }, [items, grandTotal, isLocked, onUpdate]);

    useEffect(() => {
        // Solo recargar items si hay datos válidos en initialItems Y no hay items actuales con valores reales
        // Convertimos a número para evitar problemas con tipos
        if (initialItems && initialItems.length > 0) {
            const hasActualItems = items.some(i => Number(i.precioUnitario) > 0 || (i.descripcion && i.descripcion !== "Mano de obra especializada para el servicio"));
            // Solo recargar si está bloqueado y NO tiene items actuales o si hay items pero todos están en cero
            if ((!hasActualItems || isLocked) && !items.every(i => Number(i.precioUnitario) === 0)) {
                setItems(initialItems.map((it: any, idx: number) => ({
                    id: it.id || Math.random().toString(36).substr(2, 9),
                    item: it.item || (idx + 1).toString().padStart(2, '0'),
                    descripcion: it.descripcion || "",
                    unidad: it.unidad || "GLB",
                    cantidad: Number(it.cantidad) || 1,
                    precioUnitario: Number(it.precioUnitario) || 0,
                    total: Number(it.total) || (Number(it.cantidad) * Number(it.precioUnitario)) || 0
                })));
            }
        }
    }, [initialItems, isLocked]);

    return (
        <div className={styles.editorWrapper}>
            <div className={styles.editorActions}>
                <button className={styles.downloadPDFBtn} onClick={handleDownloadPDF}>
                    <FileDown size={16} />
                    DESCARGAR COTIZACIÓN (PDF)
                </button>
            </div>

            <div className={styles.excelContainer} ref={quoteRef}>
                {/* Cabecera del Documento (Ficticia pero Profesional) */}
                <div className={styles.excelDocHeader}>
                    <div className={styles.docInfo}>
                        <div className={styles.logoContainer}>
                            <img
                                src="/images/sinfimac_logo_v3.jpg"
                                alt="SINFIMAC LOGO"
                                className={styles.logoImage}
                            />
                        </div>
                        <div className={styles.companyData}>
                            <div className={styles.supplierRow}>
                                <label>PROVEEDOR:</label>
                                <strong>20535858412 - SINFIMAC EIRL.</strong>
                            </div>
                            <div className={styles.supplierRow}>
                                <label>CLIENTE:</label>
                                <strong>20382036655 - BANCO DE LA MICROEMPRESA S.A.C.</strong>
                            </div>
                            <div className={styles.supplierRow}>
                                <label>AGENCIA:</label>
                                <strong>{sedeInfo?.nombre || '---'}</strong>
                            </div>
                            <div className={styles.supplierRow}>
                                <label>DESCRIPCION:</label>
                                <strong>{getServiceById(servicioId || '')?.nombre?.toUpperCase() || 'SERVICIO DE MANTENIMIENTO'}</strong>
                            </div>
                        </div>
                    </div>
                    <div className={styles.quoteStatusCard}>
                        <div className={styles.quoteInfoBox}>
                            <h3>COTIZACIÓN DE SERVICIO</h3>
                            <div className={styles.quoteNumber}>
                                <strong>N° 001-2026-MB</strong>
                            </div>
                        </div>
                        <div className={styles.quoteDetailsMeta}>
                            <div className={styles.metaRow}>
                                <label>TICKET:</label>
                                <span>{ticketId || '---'}</span>
                            </div>
                            <div className={styles.metaRow}>
                                <label>FECHA:</label>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <div className={styles.metaRow}>
                                <label>GARANTIA:</label>
                                <strong>6 MESES</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grilla Tipo Excel */}
                <div className={styles.gridWrapper}>
                    <table className={styles.vantageTable}>
                        <thead>
                            <tr>
                                <th className={styles.colSmall}>N°</th>
                                <th className={styles.colLarge}>Descripción</th>
                                <th className={styles.colSmall}>Und.</th>
                                <th className={styles.colSmall}>Cant.</th>
                                <th className={styles.colMid}>P. Unit (S/)</th>
                                <th className={styles.colMid}>Total (S/)</th>
                                <th className={styles.colAction}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={item.id} className={styles.gridRow}>
                                    <td>
                                        <input
                                            type="text"
                                            value={item.item}
                                            className={styles.cellInputCenter}
                                            disabled={isLocked}
                                            onChange={(e) => updateItem(item.id, 'item', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        {(isLocked || isExporting) ? (
                                            <div className={styles.cellTextStatic}>
                                                {item.descripcion}
                                            </div>
                                        ) : (
                                            <textarea
                                                value={item.descripcion}
                                                className={styles.cellTextarea}
                                                disabled={isLocked}
                                                onChange={(e) => updateItem(item.id, 'descripcion', e.target.value)}
                                                onInput={(e) => {
                                                    const target = e.target as HTMLTextAreaElement;
                                                    target.style.height = 'auto';
                                                    target.style.height = target.scrollHeight + 'px';
                                                }}
                                                placeholder="Descripción del requerimiento..."
                                            />
                                        )}
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            value={item.unidad}
                                            className={styles.cellInputCenter}
                                            disabled={isLocked}
                                            onChange={(e) => updateItem(item.id, 'unidad', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            value={item.cantidad}
                                            className={styles.cellInputCenter}
                                            disabled={isLocked}
                                            onChange={(e) => updateItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className={styles.currencyCell}>
                                        <input
                                            type={focusedField === `${item.id}-price` ? "number" : "text"}
                                            value={focusedField === `${item.id}-price`
                                                ? (item.precioUnitario || "")
                                                : formatSoles(item.precioUnitario)}
                                            step="0.01"
                                            className={styles.cellInputRight}
                                            disabled={isLocked}
                                            onFocus={() => !isLocked && setFocusedField(`${item.id}-price`)}
                                            onBlur={() => setFocusedField(null)}
                                            onChange={(e) => updateItem(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className={styles.totalCell}>
                                        {formatSoles(item.total)}
                                    </td>
                                    <td className={styles.actionCell}>
                                        {!isLocked && (
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className={styles.rowDeleteBtn}
                                                data-html2canvas-ignore="true"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {!isLocked && (
                        <button
                            className={styles.addRowBtn}
                            onClick={addItem}
                            data-html2canvas-ignore="true"
                        >
                            <Plus size={14} /> Añadir nueva partida a la cotización
                        </button>
                    )}
                </div>

                {/* Resumen Final Estilo Factura */}
                <div className={styles.summarySection}>
                    <div className={styles.notesArea}>
                        <h4>CONDICIONES COMERCIALES:</h4>
                        <p>• Tiempo de entrega: A convenir según complejidad.</p>
                    </div>
                    <div className={styles.totalsTable}>
                        <div className={styles.totalRow}>
                            <span>SUBTOTAL NETO</span>
                            <strong>S/ {formatSoles(subtotal)}</strong>
                        </div>
                        <div className={styles.totalRow}>
                            <span>I.G.V. (18%)</span>
                            <strong>S/ {formatSoles(igv)}</strong>
                        </div>
                        <div className={`${styles.totalRow} ${styles.grandTotalHighlight}`}>
                            <span>TOTAL GENERAL</span>
                            <strong>S/ {formatSoles(grandTotal)}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default OnlineQuotationEditor;
