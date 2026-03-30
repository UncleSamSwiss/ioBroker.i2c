import type { ConfigItemAny } from '@iobroker/dm-utils';
import type { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { Delay } from '../lib/async';
import { getAllAddresses } from '../lib/i2c';
import type { I2cAdapter } from '../main';
import type { DeviceHandlerInfo } from './device-handler-base';
import { DeviceHandlerBase } from './device-handler-base';

export interface MCP342xConfig extends ImplementationConfigBase {
    pollingInterval?: number;
    channels: Channel[];
}

export enum Resolution {
    Bits12 = 0,
    Bits14 = 1,
    Bits16 = 2,
    Bits18 = 3,
}

export enum Gain {
    X1 = 0,
    X2 = 1,
    X4 = 2,
    X8 = 3,
}

export interface Channel {
    enabled: boolean;
    resolution: Resolution;
    gain: Gain;
}

export class MCP342xHandler extends DeviceHandlerBase<MCP342xConfig> {
    private channelCount: 4 | 2;
    private has18Bit: boolean;

    private currentDelay?: Delay;

    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(deviceConfig, adapter);

        const kind = parseInt(this.name.substring(3)); // 3422, 3423, 3424, 3426, 3427 or 3428
        this.channelCount = kind === 3424 || kind === 3428 ? 4 : 2;
        this.has18Bit = kind < 3426;
    }

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

        let hasEnabled = false;
        for (let i = 0; i < this.channelCount; i++) {
            const channelConfig = this.config.channels[i] || { enabled: false };
            if (channelConfig.enabled) {
                hasEnabled = true;
            }
            await this.adapter.extendObject(`${this.hexAddress}.${i + 1}`, {
                type: 'state',
                common: {
                    name: `${this.hexAddress} Channel ${i + 1}`,
                    read: true,
                    write: false,
                    type: 'number',
                    role: 'value.voltage',
                    unit: 'V',
                },
                native: channelConfig,
            });
        }

        if (!hasEnabled) {
            return;
        }

        await this.readCurrentValuesAsync();

        if (this.config.pollingInterval) {
            this.startPolling(async () => await this.readCurrentValuesAsync(), this.config.pollingInterval, 100);
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
        this.currentDelay?.cancel();
        return Promise.resolve();
    }

    async readCurrentValuesAsync(): Promise<void> {
        for (let index = 0; index < this.channelCount; index++) {
            const config = this.config.channels[index];
            if (!config?.enabled) {
                continue;
            }

            const writeVal = 0x80 | (index << 5) | (config.resolution << 2) | config.gain;
            await this.sendByte(writeVal);

            this.currentDelay = new Delay(this.getDelay(config.resolution));
            await this.currentDelay.runAsnyc();

            const buffer = Buffer.alloc(config.resolution === Resolution.Bits18 ? 4 : 3);
            await this.i2cRead(buffer.length, buffer);

            const status = buffer[buffer.length - 1];
            if (status & 0x80) {
                this.warn(`Couldn't read channel ${index}, not ready`);
                continue;
            }

            let value: number;
            if (config.resolution === Resolution.Bits18) {
                value = buffer.readInt32BE() >> 8; // kind of like readInt24BE()
            } else {
                value = buffer.readInt16BE();
            }

            const lsb = this.getLsb(config.resolution);
            const pga = 1 << config.gain;

            await this.setStateAckAsync(index + 1, (value * lsb) / pga);
        }
    }

    private getDelay(resolution: Resolution): number {
        switch (resolution) {
            case Resolution.Bits18:
                return 267; // 3.75 SPS
            case Resolution.Bits16:
                return 67; // 15 SPS
            case Resolution.Bits14:
                return 17; // 60 SPS
            case Resolution.Bits12:
                return 5; // 240 SPS
            default:
                throw new Error(`Unsupported resolution: ${resolution as any} bits`);
        }
    }

    private getLsb(resolution: Resolution): number {
        switch (resolution) {
            case Resolution.Bits18:
                return 15.625 / 1000000; // 15.625 μV
            case Resolution.Bits16:
                return 62.5 / 1000000; // 62.5 μV
            case Resolution.Bits14:
                return 250 / 1000000; // 250 μV
            case Resolution.Bits12:
                return 1 / 1000; // 1 mV
            default:
                throw new Error(`Unsupported resolution: ${resolution as any} bits`);
        }
    }
}

function createChannelConfig(index: number, has18Bit: boolean): Record<string, ConfigItemAny> {
    return {
        [`MCP342x.channels.${index}.enabled`]: {
            type: 'checkbox',
            default: false,
            xs: 4,
            md: 3,
            xl: 2,
            label: `Channel ${index + 1}`,
            newLine: true,
        },
        [`MCP342x.channels.${index}.resolution`]: {
            type: 'select',
            options: [
                { value: Resolution.Bits12, label: '12 bits' },
                { value: Resolution.Bits14, label: '14 bits' },
                { value: Resolution.Bits16, label: '16 bits' },
                { value: Resolution.Bits18, label: '18 bits', hidden: !has18Bit },
            ],
            default: Resolution.Bits12,
            format: 'dropdown',
            disabled: `!data.MCP342x.channels["${index}"].enabled`,
            xs: 4,
            md: 3,
            xl: 2,
            label: 'Resolution',
        },
        [`MCP342x.channels.${index}.gain`]: {
            type: 'select',
            options: [
                { value: Gain.X1, label: 'x1' },
                { value: Gain.X2, label: 'x2' },
                { value: Gain.X4, label: 'x4' },
                { value: Gain.X8, label: 'x8' },
            ],
            default: Gain.X1,
            format: 'dropdown',
            disabled: `!data.MCP342x.channels["${index}"].enabled`,
            xs: 4,
            md: 3,
            xl: 2,
            label: 'Gain',
        },
    };
}

export const MCP342x: DeviceHandlerInfo = {
    type: 'MCP342x',
    createHandler: (deviceConfig, adapter) => new MCP342xHandler(deviceConfig, adapter),
    names: [
        {
            name: 'MCP3422',
            addresses: [0x68],
            config: {
                ...createChannelConfig(0, true),
                ...createChannelConfig(1, true),
            },
        },
        {
            name: 'MCP3423',
            addresses: getAllAddresses(0x68, 8),
            config: {
                ...createChannelConfig(0, true),
                ...createChannelConfig(1, true),
            },
        },
        {
            name: 'MCP3424',
            addresses: getAllAddresses(0x68, 8),
            config: {
                ...createChannelConfig(0, true),
                ...createChannelConfig(1, true),
                ...createChannelConfig(2, true),
                ...createChannelConfig(3, true),
            },
        },
        {
            name: 'MCP3426',
            addresses: [0x68],
            config: {
                ...createChannelConfig(0, false),
                ...createChannelConfig(1, false),
            },
        },
        {
            name: 'MCP3427',
            addresses: getAllAddresses(0x68, 8),
            config: {
                ...createChannelConfig(0, false),
                ...createChannelConfig(1, false),
            },
        },
        {
            name: 'MCP3428',
            addresses: getAllAddresses(0x68, 8),
            config: {
                ...createChannelConfig(0, false),
                ...createChannelConfig(1, false),
                ...createChannelConfig(2, false),
                ...createChannelConfig(3, false),
            },
        },
    ],
    config: {
        'MCP342x.pollingInterval': {
            type: 'number',
            label: 'Polling Interval',
            default: 60000,
            unit: 'ms',
            xs: 7,
            sm: 5,
            md: 3,
        },
    },
};
