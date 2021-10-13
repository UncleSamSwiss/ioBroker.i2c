import { ImplementationConfigBase } from '../lib/adapter-config';
import { Delay } from '../lib/async';
import { BigEndianDeviceHandlerBase } from './big-endian-device-handler-base';

export interface SHT3xConfig extends ImplementationConfigBase {
    pollingInterval: number;
    repeatability: 'high' | 'medium' | 'low';
}

export default class SHT3x extends BigEndianDeviceHandlerBase<SHT3xConfig> {
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

        await this.adapter.extendObjectAsync(this.hexAddress + '.temperature', {
            type: 'state',
            common: {
                name: this.hexAddress + ' Temperature',
                read: true,
                write: false,
                type: 'number',
                role: 'value.temperature',
                unit: '°C',
            },
        });

        await this.adapter.extendObjectAsync(this.hexAddress + '.humidity', {
            type: 'state',
            common: {
                name: this.hexAddress + ' Humidity',
                read: true,
                write: false,
                type: 'number',
                role: 'value.humidity',
                unit: '%',
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
            // send the single shot command
            let buffer = Buffer.alloc(2);
            buffer[0] = 0x24;
            switch (this.config.repeatability) {
                case 'high':
                    buffer[1] = 0x00;
                    break;
                case 'medium':
                    buffer[1] = 0x0b;
                    break;
                case 'low':
                    buffer[1] = 0x16;
                    break;
            }
            await this.i2cWrite(buffer.length, buffer);
            await this.delay(15);

            // read the measurement data
            buffer = Buffer.alloc(6);
            const result = await this.i2cRead(buffer.length, buffer);
            if (result.bytesRead != buffer.length) {
                throw new Error(`Only ${result.bytesRead} instead of ${buffer.length} bytes read`);
            }
            const temperatureRaw = buffer.readUInt16BE(0);
            const humidityRaw = buffer.readUInt16BE(3);

            this.setStateAck('temperature', temperatureRaw * 0.00267033 - 45);
            this.setStateAck('humidity', humidityRaw * 0.0015259);
        } catch (e) {
            this.error("Couldn't read current value: " + e);
        }
    }

    private async delay(ms: number): Promise<void> {
        const delay = new Delay(ms);
        await delay.runAsnyc();
    }
}
