export interface I2CAdapterConfig {
    busNumber: number;
    devices: I2CDeviceConfig[];

    // for debugging purposes only
    serverPort?: number;
    clientAddress?: string;
}

export interface I2CDeviceConfig {
    address: number;
    name?: string;
    type?: string;

    // this can't be described properly with TypeScript as a key of type string wouldn't allow other properties,
    // thus we allow "any" even thought when indexing with a string, we always want an ImplementationConfigBase
    [key: string]: ImplementationConfigBase | any;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ImplementationConfigBase {}

export function toHexString(value: number): string {
    // Convert a number to a hex string "0xXX"
    const str = value.toString(16);
    return '0x' + (str.length == 1 ? '0' + str : str).toUpperCase();
}
