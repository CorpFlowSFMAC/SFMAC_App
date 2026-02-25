/**
 * Utility for handling financial calculations with 2-decimal precision.
 * Avoids floating point errors by rounding at each step.
 */

export const round2 = (value: number | string): number => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const formatSoles = (value: number | string): string => {
    const num = round2(value);
    return num.toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};
