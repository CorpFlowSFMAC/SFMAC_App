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

/**
 * Generate avatar URL from email using UI Avatars API
 * Returns a colored avatar with initials or first name
 */
export const getAvatarUrl = (email: string | null | undefined, name?: string | null): string => {
    if (!email) return '';
    // Use UI Avatars API which generates avatars from initials
    const encodedName = encodeURIComponent(name || email.split('@')[0]);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=6366F1&color=fff&size=128&bold=true&font-size=0.4`;
};

/**
 * Generate initials from a name (up to 2 characters)
 */
export const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'G';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};
