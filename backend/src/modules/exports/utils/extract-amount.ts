/**
 * Shared utility for extracting monetary amounts from record data.
 * Handles both raw number values and structured { amount: number } objects.
 */
export function extractAmountCents(data: Record<string, unknown>, key: string): number {
    const val = data[key];
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val !== null && 'amount' in val) {
        return (val as { amount: number }).amount;
    }
    return 0;
}
