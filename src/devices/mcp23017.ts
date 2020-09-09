import { I2CDeviceConfig } from '../lib/shared';
import { I2cAdapter } from '../main';
import { MCP230xxBase, Register } from './mcp230xx-base';

export default class MCP23017 extends MCP230xxBase {
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
