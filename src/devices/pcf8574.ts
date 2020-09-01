export interface PCF8574Config {
    pollingInterval: number;
    pins: PinConfig[];
}

export interface PinConfig {
    dir: 'in' | 'out';
    inv?: boolean;
}
