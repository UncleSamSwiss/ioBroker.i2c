import type { ConfigItemAny } from '@iobroker/dm-utils';
import type { I2CDeviceConfig } from '../lib/adapter-config';
import { getAllAddresses } from '../lib/i2c';
import type { I2cAdapter } from '../main';
import type { DeviceHandlerInfo } from './device-handler-base';
import type { Register } from './mcp230xx-base';
import { createPinConfig, MCP230xxBase } from './mcp230xx-base';

export class MCP23017Handler extends MCP230xxBase {
    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(16, deviceConfig, adapter);
    }

    protected indexToName(index: number): string {
        return `${index < 8 ? 'A' : 'B'}${index % 8}`;
    }

    protected readRegister(register: Register): Promise<number> {
        return this.readWord(register * 2);
    }

    protected writeRegister(register: Register, value: number): Promise<void> {
        return this.writeWord(register * 2, value);
    }
}

function createPinConfigs(): Record<string, ConfigItemAny> {
    const configs: Record<string, ConfigItemAny> = {};
    for (let i = 0; i < 16; i++) {
        Object.assign(configs, createPinConfig('MCP23017', i, `${i < 8 ? 'A' : 'B'}${i % 8}`));
    }
    return configs;
}

export const MCP23017: DeviceHandlerInfo = {
    type: 'MCP23017',
    createHandler: (deviceConfig, adapter) => new MCP23017Handler(deviceConfig, adapter),
    names: [{ name: 'MCP23017', addresses: getAllAddresses(0x20, 8) }],
    config: {
        'MCP23017.pollingInterval': {
            type: 'number',
            label: 'Polling Interval',
            default: 200,
            unit: 'ms',
            xs: 7,
            sm: 5,
            md: 3,
        },
        'MCP23017.interrupt': {
            type: 'objectId',
            label: 'Interrupt State Object ID',
            xs: 12,
            newLine: true,
        },
        ...createPinConfigs(),
    },
};
