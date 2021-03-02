import { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { Delay } from '../lib/async';
import { I2cAdapter } from '../main';
import { BigEndianDeviceHandlerBase } from './big-endian-device-handler-base';

export interface SRF02Config extends ImplementationConfigBase {
    pollingInterval: number;
}

export default class SRF02 extends BigEndianDeviceHandlerBase<SRF02Config> {
    private readonly useRegisters: boolean;

    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(deviceConfig, adapter);

        this.useRegisters = this.name == 'SRF02';
    }

    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObjectAsync(this.hexAddress, {
            type: 'device',
            common: {
                name: this.hexAddress + ' (' + this.name + ')',
                role: 'sensor',
            },
            native: this.config as any,
        });

        await this.adapter.extendObjectAsync(this.hexAddress + '.distance', {
            type: 'state',
            common: {
                name: this.hexAddress + ' Distance',
                read: true,
                write: false,
                type: 'number',
                role: 'value.distance',
                unit: 'cm',
            },
        });

        await this.adapter.extendObjectAsync(this.hexAddress + '.measure', {
            type: 'state',
            common: {
                name: this.hexAddress + ' Measure',
                read: false,
                write: true,
                type: 'boolean',
                role: 'button',
            },
        });

        this.adapter.addStateChangeListener(
            this.hexAddress + '.measure',
            async () => await this.readCurrentValueAsync(),
        );

        if (this.config.pollingInterval > 0) {
            this.startPolling(async () => await this.readCurrentValueAsync(), this.config.pollingInterval * 1000, 1000);
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
    }

    private async readCurrentValueAsync(): Promise<void> {
        try {
            // send the range command
            if (this.useRegisters) {
                await this.writeByte(0x00, 0x51);
            } else {
                await this.sendByte(0x51);
            }
            await this.delay(100);

            // read the measurement data
            let value: number;

            if (this.useRegisters) {
                value = await this.readWord(0x02);
            } else {
                const buffer = Buffer.alloc(2);
                await this.i2cRead(buffer.length, buffer);
                // masking awai the highest bit (undocumented!)
                value = buffer.readUInt16BE() & 0x7fff;
            }

            await this.setStateAckAsync('distance', value);
        } catch (e) {
            this.error("Couldn't read current value: " + e);
        }
    }

    private async delay(ms: number): Promise<void> {
        const delay = new Delay(ms);
        await delay.runAsnyc();
    }
}
