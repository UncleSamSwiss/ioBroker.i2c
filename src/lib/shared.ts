/**
 * Converts a number to a hexadecimal string representation (e.g., "0x1A").
 *
 * @param value The number to convert
 * @param length The desired length of the hexadecimal string (default is 2)
 * @returns The hexadecimal string representation of the number
 */
export function toHexString(value: number, length = 2): string {
    // Convert a number to a hex string "0xXX"
    const str = value.toString(16).toUpperCase();
    return `0x${str.padStart(length, '0')}`;
}

/**
 * Recursively converts all objects with numeric string keys into arrays.
 *
 * @param indexed The object to convert
 * @returns The converted object or array
 */
export function indexedToArray(indexed: Record<string, any>): Record<string, any> | any[] {
    if (!indexed || typeof indexed !== 'object') {
        return indexed;
    }

    const entries = Object.entries(indexed);
    const allNumericKeys = entries.every(([key]) => /^\d+$/.test(key));
    if (!allNumericKeys) {
        const obj: Record<string, any> = {};
        for (const [key, value] of entries) {
            obj[key] = indexedToArray(value);
        }
        return obj;
    }

    const array: any[] = [];
    for (const [key, value] of entries) {
        array[Number(key)] = indexedToArray(value);
    }
    return array;
}
