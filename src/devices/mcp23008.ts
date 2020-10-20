import { I2CDeviceConfig } from '../lib/adapter-config';
import { I2cAdapter } from '../main';
import { MCP230xxBase, Register } from './mcp230xx-base';

export default class MCP23008 extends MCP230xxBase {
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
