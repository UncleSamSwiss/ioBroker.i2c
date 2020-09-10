import { I2CDeviceConfig, ImplementationConfigBase } from '../lib/shared';
import { I2cAdapter } from '../main';
import { DeviceHandlerBase } from './device-handler-base';

export abstract class LittleEndianDeviceHandlerBase<T extends ImplementationConfigBase> extends DeviceHandlerBase<T> {
    private address: number;

    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(deviceConfig, adapter);

        this.address = deviceConfig.address;
    }

    protected async readWord(command: number): Promise<number> {
        return await this.adapter.i2cBus.readWord(this.address, command);
    }

    protected async writeWord(command: number, word: number): Promise<void> {
        return await this.adapter.i2cBus.writeWord(this.address, command, word);
    }
}
