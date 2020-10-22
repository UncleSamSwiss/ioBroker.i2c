import * as React from 'react';
import { I2CDeviceConfig } from '../../../src/lib/adapter-config';
import * as BH1750 from './bh1750';
import * as MCP23008 from './mcp23008';
import * as MCP23017 from './mcp23017';
import * as PCA9685 from './pca9685';
import * as PCF8574 from './pcf8574';

export interface DeviceInfo {
    readonly name: string;
    readonly type: string;
    readonly addresses: number[];
    readonly react: typeof React.Component;
}

export class DeviceFactory {
    public static readonly supportedDevices: DeviceInfo[] = [
        ...PCF8574.Infos,
        MCP23008.Info,
        MCP23017.Info,
        PCA9685.Info,
        BH1750.Info,
    ];

    static getSupportedDevices(address: number): DeviceInfo[] {
        return this.supportedDevices
            .filter((info) => !!info.addresses.find((a) => a === address))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    static createComponent(config: I2CDeviceConfig): typeof React.Component | undefined {
        console.log('createComponent', config);
        if (!config.type) {
            return undefined;
        }
        const device = this.supportedDevices.find((info) => info.type === config.type && info.name === config.name);
        if (!device) {
            return undefined;
        }

        return device.react;
    }
}
