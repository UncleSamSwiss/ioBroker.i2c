import * as React from 'react';
import { I2CDeviceConfig } from '../../../src/lib/adapter-config';
import * as ADS1x15 from './ads1x15';
import * as BH1750 from './bh1750';
import * as BME280 from './bme280';
import * as Generic from './generic';
import * as INA219 from './ina219';
import * as MCP23008 from './mcp23008';
import * as MCP23017 from './mcp23017';
import * as MCP4725 from './mcp4725';
import * as PCA9685 from './pca9685';
import * as PCF8574 from './pcf8574';
import * as SeesawSoil from './seesawsoil';
import * as SHT3x from './sht3x';
import * as SRF02 from './srf02';
import * as SX150x from './sx150x';
import * as xMC5883 from './xmc5883';

export interface DeviceInfo {
    readonly name: string;
    readonly type: string;
    readonly addresses: number[];
    readonly react: typeof React.Component;
}

export class DeviceFactory {
    public static readonly supportedDevices: DeviceInfo[] = [
        ...ADS1x15.Infos,
        BH1750.Info,
        BME280.Info,
        Generic.Info,
        INA219.Info,
        MCP23008.Info,
        MCP23017.Info,
        MCP4725.Info,
        PCA9685.Info,
        ...PCF8574.Infos,
        SeesawSoil.Info,
        SHT3x.Info,
        ...SRF02.Infos,
        ...SX150x.Infos,
        ...xMC5883.Infos,
    ];

    static getSupportedDevices(address: number): DeviceInfo[] {
        return this.supportedDevices
            .filter((info) => !!info.addresses.find((a) => a === address))
            .sort(DeviceFactory.compareDevice);
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

    private static compareDevice(a: DeviceInfo, b: DeviceInfo): number {
        const nameA = a.name == 'Generic' ? 'zzzz' : a.name;
        const nameB = b.name == 'Generic' ? 'zzzz' : b.name;

        return nameA.localeCompare(nameB);
    }
}
