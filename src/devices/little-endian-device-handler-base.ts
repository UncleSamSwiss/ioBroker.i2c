import { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { toHexString } from '../lib/shared';
import { I2cAdapter } from '../main';
import { DeviceHandlerBase } from './device-handler-base';

export abstract class LittleEndianDeviceHandlerBase<T extends ImplementationConfigBase> extends DeviceHandlerBase<T> {
    private address: number;

    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(deviceConfig, adapter);

        this.address = deviceConfig.address;
    }

    protected async readWord(command: number): Promise<number> {
        const word = await this.adapter.i2cBus.readWord(this.address, command);
        this.silly(`readWord(${toHexString(command)}): ${toHexString(word, 4)}`);
        return word;
    }

    protected async writeWord(command: number, word: number): Promise<void> {
        this.silly(`writeWord(${toHexString(command)}, ${toHexString(word, 4)})`);
        return await this.adapter.i2cBus.writeWord(this.address, command, word);
    }
}
