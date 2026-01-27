export function getAllAddresses(baseAddress: number, range: number): number[] {
    const addresses: number[] = [];
    for (let i = 0; i < range; i++) {
        addresses.push(baseAddress + i);
    }

    return addresses;
}
