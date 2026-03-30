import type { ImplementationConfigBase } from '../lib/adapter-config';
import { Delay } from '../lib/async';
import { BigEndianDeviceHandlerBase } from './big-endian-device-handler-base';
import type { DeviceHandlerInfo } from './device-handler-base';

export interface SHT3xConfig extends ImplementationConfigBase {
    pollingInterval: number;
    repeatability: 'high' | 'medium' | 'low';
}

export class SHT3xHandler extends BigEndianDeviceHandlerBase<SHT3xConfig> {
    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObject(this.hexAddress, {
            type: 'device',
            common: {
                name: `${this.hexAddress} (${this.name})`,
                role: 'sensor',
            },
            native: this.deviceConfig,
        });

        await this.adapter.extendObject(`${this.hexAddress}.temperature`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Temperature`,
                read: true,
                write: false,
                type: 'number',
                role: 'value.temperature',
                unit: '°C',
            },
        });

        await this.adapter.extendObject(`${this.hexAddress}.humidity`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Humidity`,
                read: true,
                write: false,
                type: 'number',
                role: 'value.humidity',
                unit: '%',
            },
        });

        await this.adapter.extendObject(`${this.hexAddress}.measure`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Measure`,
                read: false,
                write: true,
                type: 'boolean',
                role: 'button',
            },
        });

        this.adapter.addStateChangeListener(
            `${this.hexAddress}.measure`,
            async () => await this.readCurrentValueAsync(),
        );

        if (this.config.pollingInterval > 0) {
            this.startPolling(async () => await this.readCurrentValueAsync(), this.config.pollingInterval * 1000, 1000);
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
        return Promise.resolve();
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

            await this.setStateAckAsync('temperature', temperatureRaw * 0.00267033 - 45);
            await this.setStateAckAsync('humidity', humidityRaw * 0.0015259);
        } catch (e: any) {
            this.error(`Couldn't read current value: ${e}`);
        }
    }

    private async delay(ms: number): Promise<void> {
        const delay = new Delay(ms);
        await delay.runAsnyc();
    }
}

export const SHT3x: DeviceHandlerInfo = {
    type: 'SHT3x',
    createHandler: (deviceConfig, adapter) => new SHT3xHandler(deviceConfig, adapter),
    names: [{ name: 'SHT3x', addresses: [0x44, 0x45] }],
    config: {
        'SHT3x.pollingInterval': {
            type: 'number',
            label: 'Polling Interval',
            default: 10,
            unit: 'sec',
            min: 0,
            xs: 7,
            sm: 5,
            md: 3,
        },
        'SHT3x.repeatability': {
            type: 'select',
            label: 'Repeatability',
            default: 'low',
            options: [
                {
                    value: 'low',
                    label: 'Low',
                },
                {
                    value: 'medium',
                    label: 'Medium',
                },
                {
                    value: 'high',
                    label: 'High',
                },
            ],
            format: 'dropdown',
            xs: 7,
            sm: 5,
            md: 3,
        },
    },
};
