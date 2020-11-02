import { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { toHexString } from '../lib/shared';
import { I2cAdapter } from '../main';
import { DeviceHandlerBase } from './device-handler-base';

function swapWord(value: number): number {
    return ((value >> 8) & 0xff) | ((value << 8) & 0xff00);
}

export abstract class BigEndianDeviceHandlerBase<T extends ImplementationConfigBase> extends DeviceHandlerBase<T> {
    private address: number;

    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(deviceConfig, adapter);

        this.address = deviceConfig.address;
    }

    protected async readWord(command: number): Promise<number> {
        let word = await this.adapter.i2cBus.readWord(this.address, command);
        word = swapWord(word);
        this.silly(`readWord(${toHexString(command)}): ${toHexString(word, 4)}`);
        return word;
    }

    protected async writeWord(command: number, word: number): Promise<void> {
        this.silly(`writeWord(${toHexString(command)}, ${toHexString(word, 4)})`);
        word = swapWord(word);
        return await this.adapter.i2cBus.writeWord(this.address, command, word);
    }
}
