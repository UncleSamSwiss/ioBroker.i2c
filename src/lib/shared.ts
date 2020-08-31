export interface I2CAdapterConfig {
    busNumber: number;
    devices: I2CDeviceConfig[];
}

export interface I2CDeviceConfig {
    type: string;
}
