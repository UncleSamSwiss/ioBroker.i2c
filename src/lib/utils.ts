export function round(value: number, multiplicator?: number): number {
    multiplicator = multiplicator || 10;
    return Math.round(value * multiplicator) / multiplicator;
}

export function int16(msb: number, lsb: number): number {
    const val = uint16(msb, lsb);
    return val > 32767 ? val - 65536 : val;
}

export function uint16(msb: number, lsb: number): number {
    return (msb << 8) | lsb;
}

export function uint20(msb: number, lsb: number, xlsb: number): number {
    return ((((msb << 8) | lsb) << 8) | xlsb) >> 4;
}
