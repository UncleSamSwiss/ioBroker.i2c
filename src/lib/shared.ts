export function toHexString(value: number, length?: number): string {
    length = length || 2;
    // Convert a number to a hex string "0xXX"
    let str = value.toString(16).toUpperCase();
    while (str.length < length) {
        str = `0${str}`;
    }
    return `0x${str}`;
}

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
