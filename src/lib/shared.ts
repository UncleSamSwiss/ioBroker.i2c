export function toHexString(value: number, length?: number): string {
    length = length || 2;
    // Convert a number to a hex string "0xXX"
    let str = value.toString(16).toUpperCase();
    while (str.length < length) {
        str = '0' + str;
    }
    return '0x' + str;
}
