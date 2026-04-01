/**
 * Generates an array of I2C addresses starting from a base address up to a specified range.
 *
 * @param baseAddress The starting I2C address
 * @param range The number of addresses to generate
 * @returns An array of I2C addresses
 */
export function getAllAddresses(baseAddress: number, range: number): number[] {
    const addresses: number[] = [];
    for (let i = 0; i < range; i++) {
        addresses.push(baseAddress + i);
    }

    return addresses;
}
