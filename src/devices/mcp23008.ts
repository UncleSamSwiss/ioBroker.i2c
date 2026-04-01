import type { ConfigItemAny } from '@iobroker/dm-utils';
import type { I2CDeviceConfig } from '../lib/adapter-config';
import { getAllAddresses } from '../lib/i2c';
import type { I2cAdapter } from '../main';
import type { DeviceHandlerInfo } from './device-handler-base';
import type { Register } from './mcp230xx-base';
import { createPinConfig, MCP230xxBase } from './mcp230xx-base';

export class MCP23008Handler extends MCP230xxBase {
    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(8, deviceConfig, adapter);
    }

    protected indexToName(index: number): string {
        return index.toString();
    }

    protected readRegister(register: Register): Promise<number> {
        return this.readByte(register);
    }

    protected writeRegister(register: Register, value: number): Promise<void> {
        return this.writeByte(register, value);
    }
}

function createPinConfigs(): Record<string, ConfigItemAny> {
    const configs: Record<string, ConfigItemAny> = {};
    for (let i = 0; i < 8; i++) {
        Object.assign(configs, createPinConfig('MCP23008', i, i.toString()));
    }
    return configs;
}

export const MCP23008: DeviceHandlerInfo = {
    type: 'MCP23008',
    createHandler: (deviceConfig, adapter) => new MCP23008Handler(deviceConfig, adapter),
    names: [{ name: 'MCP23008', addresses: getAllAddresses(0x20, 8) }],
    config: {
        'MCP23008.pollingInterval': {
            type: 'number',
            label: 'Polling Interval',
            default: 200,
            unit: 'ms',
            xs: 7,
            sm: 5,
            md: 3,
        },
        'MCP23008.interrupt': {
            type: 'objectId',
            label: 'Interrupt State Object ID',
            xs: 12,
            newLine: true,
        },
        ...createPinConfigs(),
    },
};
