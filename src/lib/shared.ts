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
}
