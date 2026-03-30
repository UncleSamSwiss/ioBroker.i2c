/**
 * Rounds a number using a specified multiplicator.
 *
 * @param value The number to round
 * @param multiplicator The multiplicator to round to (default is 10)
 * @returns The rounded number
 */
export function round(value: number, multiplicator = 10): number {
    return Math.round(value * multiplicator) / multiplicator;
}

/**
 * Combines two bytes into a 16-bit signed integer.
 *
 * @param msb Most significant byte
 * @param lsb Least significant byte
 * @returns The combined 16-bit signed integer
 */
export function int16(msb: number, lsb: number): number {
    const val = uint16(msb, lsb);
    return val > 32767 ? val - 65536 : val;
}

/**
 * Combines two bytes into a 16-bit unsigned integer.
 *
 * @param msb Most significant byte
 * @param lsb Least significant byte
 * @returns The combined 16-bit unsigned integer
 */
export function uint16(msb: number, lsb: number): number {
    return (msb << 8) | lsb;
}

/**
 * Combines three bytes into a 20-bit unsigned integer.
 *
 * @param msb Most significant byte
 * @param lsb Least significant byte
 * @param xlsb Extra least significant byte (4 bits)
 * @returns The combined 20-bit unsigned integer
 */
export function uint20(msb: number, lsb: number, xlsb: number): number {
    return ((((msb << 8) | lsb) << 8) | xlsb) >> 4;
}
