/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
// this class is based on https://github.com/alphacharlie/node-ads1x15/blob/master/index.js
// probably MIT license (not explicitely mentioned, but it is based on the Adafruit Python code which is MIT)

import type { ConfigItemAny } from '@iobroker/dm-utils';
import type { ImplementationConfigBase } from '../lib/adapter-config';
import { Delay } from '../lib/async';
import { getAllAddresses } from '../lib/i2c';
import { toHexString } from '../lib/shared';
import { BigEndianDeviceHandlerBase } from './big-endian-device-handler-base';
import type { DeviceHandlerInfo } from './device-handler-base';

export interface ADS1x15Config extends ImplementationConfigBase {
    pollingInterval?: number; // legacy value in seconds
    pollingIntervalMs: number; // value since v1.1.0
    channels: Channel[];
}

export interface DisabledChannel {
    channelType: 'off';
}

export interface EnabledChannel {
    channelType: 'single' | 'diffTo1' | 'diffTo3';
    gain: number;
    samples: number;
}

export type Channel = DisabledChannel | EnabledChannel;

// chip
enum IC {
    ADS1015 = 0x00,
    ADS1115 = 0x01,
}

// Pointer Register
enum ADS1x15_REG_POINTER {
    MASK = 0x03,
    CONVERT = 0x00,
    CONFIG = 0x01,
    LOWTHRESH = 0x02,
    HITHRESH = 0x03,
}

// Config Register
enum ADS1x15_REG_CONFIG_OS {
    MASK = 0x8000,
    SINGLE = 0x8000, // Write: Set to start a single-conversion
    BUSY = 0x0000, // Read: Bit = 0 when conversion is in progress
    NOTBUSY = 0x8000, // Read: Bit = 1 when device is not performing a conversion
}

enum ADS1x15_REG_CONFIG_MUX {
    MASK = 0x7000,
    DIFF_0_1 = 0x0000, // Differential P = AIN0, N = AIN1 (default)
    DIFF_0_3 = 0x1000, // Differential P = AIN0, N = AIN3
    DIFF_1_3 = 0x2000, // Differential P = AIN1, N = AIN3
    DIFF_2_3 = 0x3000, // Differential P = AIN2, N = AIN3
    SINGLE_0 = 0x4000, // Single-ended AIN0
    SINGLE_1 = 0x5000, // Single-ended AIN1
    SINGLE_2 = 0x6000, // Single-ended AIN2
    SINGLE_3 = 0x7000, // Single-ended AIN3
}

enum ADS1x15_REG_CONFIG_PGA {
    MASK = 0x0e00,
    VAL_6_144V = 0x0000, // +/-6.144V range
    VAL_4_096V = 0x0200, // +/-4.096V range
    VAL_2_048V = 0x0400, // +/-2.048V range (default)
    VAL_1_024V = 0x0600, // +/-1.024V range
    VAL_0_512V = 0x0800, // +/-0.512V range
    VAL_0_256V = 0x0a00, // +/-0.256V range
}

enum ADS1x15_REG_CONFIG_MODE {
    MASK = 0x0100,
    CONTIN = 0x0000, // Continuous conversion mode
    SINGLE = 0x0100, // Power-down single-shot mode (default)
}

enum ADS1x15_REG_CONFIG_DR {
    MASK = 0x00e0,
    ADS1015_128SPS = 0x0000, // 128 samples per second
    ADS1015_250SPS = 0x0020, // 250 samples per second
    ADS1015_490SPS = 0x0040, // 490 samples per second
    ADS1015_920SPS = 0x0060, // 920 samples per second
    ADS1015_1600SPS = 0x0080, // 1600 samples per second (default)
    ADS1015_2400SPS = 0x00a0, // 2400 samples per second
    ADS1015_3300SPS = 0x00c0, // 3300 samples per second (also 0x00E0)

    ADS1115_8SPS = 0x0000, // 8 samples per second
    ADS1115_16SPS = 0x0020, // 16 samples per second
    ADS1115_32SPS = 0x0040, // 32 samples per second
    ADS1115_64SPS = 0x0060, // 64 samples per second
    ADS1115_128SPS = 0x0080, // 128 samples per second
    ADS1115_250SPS = 0x00a0, // 250 samples per second (default)
    ADS1115_475SPS = 0x00c0, // 475 samples per second
    ADS1115_860SPS = 0x00e0, // 860 samples per second
}

enum ADS1x15_REG_CONFIG_CMODE {
    MASK = 0x0010,
    TRAD = 0x0000, // Traditional comparator with hysteresis (default)
    WINDOW = 0x0010, // Window comparator
}

enum ADS1x15_REG_CONFIG_CPOL {
    MASK = 0x0008,
    ACTVLOW = 0x0000, // ALERT/RDY pin is low when active (default)
    ACTVHI = 0x0008, // ALERT/RDY pin is high when active
}

enum ADS1x15_REG_CONFIG_CLAT {
    MASK = 0x0004, // Determines if ALERT/RDY pin latches once asserted
    NONLAT = 0x0000, // Non-latching comparator (default)
    LATCH = 0x0004, // Latching comparator
}

enum ADS1x15_REG_CONFIG_CQUE {
    MASK = 0x0003,
    CONV1 = 0x0000, // Assert ALERT/RDY after one conversions
    CONV2 = 0x0001, // Assert ALERT/RDY after two conversions
    CONV4 = 0x0002, // Assert ALERT/RDY after four conversions
    NONE = 0x0003, // Disable the comparator and put ALERT/RDY in high state (default)
}

// This is a javascript port of python, so use objects instead of dictionaries here
// These simplify and clean the code (avoid the abuse of if/elif/else clauses)
const spsADS1115: Record<number, ADS1x15_REG_CONFIG_DR> = {
    8: ADS1x15_REG_CONFIG_DR.ADS1115_8SPS,
    16: ADS1x15_REG_CONFIG_DR.ADS1115_16SPS,
    32: ADS1x15_REG_CONFIG_DR.ADS1115_32SPS,
    64: ADS1x15_REG_CONFIG_DR.ADS1115_64SPS,
    128: ADS1x15_REG_CONFIG_DR.ADS1115_128SPS,
    250: ADS1x15_REG_CONFIG_DR.ADS1115_250SPS,
    475: ADS1x15_REG_CONFIG_DR.ADS1115_475SPS,
    860: ADS1x15_REG_CONFIG_DR.ADS1115_860SPS,
};
const spsADS1015: Record<number, ADS1x15_REG_CONFIG_DR> = {
    128: ADS1x15_REG_CONFIG_DR.ADS1015_128SPS,
    250: ADS1x15_REG_CONFIG_DR.ADS1015_250SPS,
    490: ADS1x15_REG_CONFIG_DR.ADS1015_490SPS,
    920: ADS1x15_REG_CONFIG_DR.ADS1015_920SPS,
    1600: ADS1x15_REG_CONFIG_DR.ADS1015_1600SPS,
    2400: ADS1x15_REG_CONFIG_DR.ADS1015_2400SPS,
    3300: ADS1x15_REG_CONFIG_DR.ADS1015_3300SPS,
};

const pgaADS1x15: Record<number, ADS1x15_REG_CONFIG_PGA> = {
    6144: ADS1x15_REG_CONFIG_PGA.VAL_6_144V,
    4096: ADS1x15_REG_CONFIG_PGA.VAL_4_096V,
    2048: ADS1x15_REG_CONFIG_PGA.VAL_2_048V,
    1024: ADS1x15_REG_CONFIG_PGA.VAL_1_024V,
    512: ADS1x15_REG_CONFIG_PGA.VAL_0_512V,
    256: ADS1x15_REG_CONFIG_PGA.VAL_0_256V,
};

export class ADS1x15Handler extends BigEndianDeviceHandlerBase<ADS1x15Config> {
    private pga = 6144; // set this to a sane default...
    private busy = false;
    private readAgain = false;
    private ic!: IC;
    private currentDelay?: Delay;
    private muxes: Record<number, ADS1x15_REG_CONFIG_MUX> = {};

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

        if (this.name === 'ADS1015') {
            this.ic = IC.ADS1015;
        } else {
            this.ic = IC.ADS1115;
        }

        let hasEnabled = false;
        for (let i = 0; i < 4; i++) {
            const channelConfig = this.config.channels[i] || { channelType: 'off' };
            switch (channelConfig.channelType) {
                case 'single':
                    this.muxes[i] = ADS1x15_REG_CONFIG_MUX.SINGLE_0 + 0x1000 * i;
                    break;
                case 'diffTo1':
                    this.muxes[i] = ADS1x15_REG_CONFIG_MUX.DIFF_0_1;
                    break;
                case 'diffTo3':
                    this.muxes[i] = ADS1x15_REG_CONFIG_MUX.DIFF_0_3 + 0x1000 * i;
                    break;
                default:
                    this.muxes[i] = 0;
                    break;
            }
            if (this.muxes[i] !== 0) {
                hasEnabled = true;
            }
            await this.adapter.extendObject(`${this.hexAddress}.${i}`, {
                type: 'state',
                common: {
                    name: `${this.hexAddress} Channel ${i}`,
                    read: true,
                    write: false,
                    type: 'number',
                    role: 'value.voltage',
                    unit: 'V',
                },
                native: channelConfig as any,
            });
        }

        if (!hasEnabled) {
            return;
        }

        // backwards compatibility:
        // - old pollingInterval was in seconds
        // - new pollingIntervalMs is in milliseconds
        let pollingIntervalMs = 0;
        if (this.config.pollingInterval) {
            pollingIntervalMs = this.config.pollingInterval * 1000;
        } else {
            pollingIntervalMs = this.config.pollingIntervalMs || 0;
        }
        if (pollingIntervalMs > 0) {
            this.startPolling(async () => await this.readCurrentValueAsync(), pollingIntervalMs, 100);
        } else {
            await this.readCurrentValueAsync();
        }
    }

    stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
        this.currentDelay?.cancel();
        return Promise.resolve();
    }

    private async readCurrentValueAsync(): Promise<void> {
        if (this.busy) {
            this.error("Busy reading values, can't read right now!");
            this.readAgain = true;
            return;
        }

        do {
            this.busy = true;
            this.readAgain = false;
            for (let i = 0; i < 4; i++) {
                try {
                    await this.readAdcAsync(i);
                } catch (e: any) {
                    this.error(`Couldn't read ADC ${i}: ${e}`);
                }
            }
        } while (this.readAgain);
        this.busy = false;
    }

    private async readAdcAsync(index: number): Promise<void> {
        const channelConfig = this.config.channels[index];
        if (!channelConfig || channelConfig.channelType === 'off') {
            this.debug(`Channel ${index} disabled`);
            return;
        }

        // Disable comparator, Non-latching, Alert/Rdy active low
        // traditional comparator, single-shot mode
        let config =
            ADS1x15_REG_CONFIG_CQUE.NONE |
            ADS1x15_REG_CONFIG_CLAT.NONLAT |
            ADS1x15_REG_CONFIG_CPOL.ACTVLOW |
            ADS1x15_REG_CONFIG_CMODE.TRAD |
            ADS1x15_REG_CONFIG_MODE.SINGLE;
        config |= this.muxes[index];

        // Set samples per second
        const spsMap = this.ic == IC.ADS1015 ? spsADS1015 : spsADS1115;
        if (channelConfig.samples in spsMap) {
            config |= spsMap[channelConfig.samples];
        } else {
            this.debug('Using default 250 SPS');
            config |= ADS1x15_REG_CONFIG_DR.ADS1015_250SPS;
        }

        // Set PGA/voltage range
        if (channelConfig.gain in pgaADS1x15) {
            config |= pgaADS1x15[channelConfig.gain];
        } else {
            this.debug('Using default PGA 6.144 V');
            config |= ADS1x15_REG_CONFIG_PGA.VAL_6_144V;
        }

        // Set 'start single-conversion' bit
        config |= ADS1x15_REG_CONFIG_OS.SINGLE;
        await this.writeRegister(ADS1x15_REG_POINTER.CONFIG, config);

        // Wait for the ADC conversion to complete
        // The minimum delay depends on the sps: delay >= 1s/sps
        // We add 1ms to be sure
        const delay = 1000 / channelConfig.samples + 1;
        this.currentDelay = new Delay(delay);
        await this.currentDelay.runAsnyc();

        const result = await this.readRegister(ADS1x15_REG_POINTER.CONVERT);
        let value: number;
        if (this.ic == IC.ADS1015) {
            // Shift right 4 bits for the 12-bit ADS1015 and convert to V
            value = ((result >> 4) * channelConfig.gain) / 2048.0 / 1000;
        } else {
            // Return a V value for the ADS1115
            // (Take signed values into account as well)
            if (result > 0x7fff) {
                value = ((result - 0xffff) * channelConfig.gain) / 32768.0 / 1000;
            } else {
                value = (result * channelConfig.gain) / 32768.0 / 1000;
            }
        }

        await this.setStateAckAsync(index, value);
    }

    private async writeRegister(register: ADS1x15_REG_POINTER, value: number): Promise<void> {
        this.debug(`Writing ${toHexString(register)} = ${toHexString(value, 4)}`);
        await this.writeWord(register, value);
    }

    private async readRegister(register: ADS1x15_REG_POINTER): Promise<number> {
        const value = await this.readWord(register);
        this.debug(`Read ${toHexString(register)} = ${toHexString(value, 4)}`);
        return value;
    }
}

function createChannelConfigs(name: 'ADS1015' | 'ADS1115'): Record<string, ConfigItemAny> {
    let allowedSamples: number[];
    if (name === 'ADS1015') {
        allowedSamples = [128, 250, 490, 920, 1600, 2400, 3300];
    } else {
        allowedSamples = [8, 16, 32, 64, 128, 250, 475, 860];
    }

    function ct(index: number): string {
        return `data.ADS1x15.channels["${index}"].channelType`;
    }

    const configs: Record<string, ConfigItemAny> = {};
    for (let i = 0; i < 4; i++) {
        const ctDisabled =
            i === 1
                ? `${ct(0)} === "diffTo1"`
                : i === 3
                  ? `${ct(0)} === "diffTo3" || ${ct(1)} === "diffTo3" || ${ct(2)} === "diffTo3"`
                  : undefined;
        configs[`ADS1x15.channels.${i}.channelType`] = {
            type: 'select',
            label: `Channel ${i} Mode`,
            options: [
                { value: 'off', label: 'Unused', hidden: ctDisabled },
                { value: 'off', label: 'Unused by other channel(s)', hidden: `!(${ctDisabled})` },
                { value: 'single', label: 'Single-ended' },
                { value: 'diffTo1', label: 'Differential to Channel 1', hidden: i >= 1 || `${ct(1)} !== "off"` },
                { value: 'diffTo3', label: 'Differential to Channel 3', hidden: i >= 3 || `${ct(3)} !== "off"` },
            ],
            format: 'dropdown',
            disabled: ctDisabled,
            default: 'off',
            xs: 4,
            newLine: true,
        };
        configs[`ADS1x15.channels.${i}.samples`] = {
            type: 'select',
            label: 'Samples per second',
            options: allowedSamples.map(s => ({ value: s, label: s.toString() })),
            default: allowedSamples[0],
            format: 'dropdown',
            hidden: `${ct(i)} === "off"`,
            xs: 4,
        };
        configs[`ADS1x15.channels.${i}.gain`] = {
            type: 'select',
            label: 'Gain',
            options: [6144, 4096, 2048, 1024, 512, 256].map(g => ({ value: g, label: `${g / 1000.0} V` })),
            default: 6144,
            format: 'dropdown',
            hidden: `${ct(i)} === "off"`,
            xs: 4,
        };
    }

    return configs;
}

export const ADS1x15: DeviceHandlerInfo = {
    type: 'ADS1x15',
    createHandler: (deviceConfig, adapter) => new ADS1x15Handler(deviceConfig, adapter),
    names: [
        { name: 'ADS1015', addresses: getAllAddresses(0x48, 4), config: createChannelConfigs('ADS1015') },
        { name: 'ADS1115', addresses: getAllAddresses(0x48, 4), config: createChannelConfigs('ADS1115') },
    ],
    config: {
        'ADS1x15.pollingIntervalMs': {
            type: 'number',
            label: 'Polling Interval (ms)',
            default: 60000,
            unit: 'ms',
            xs: 7,
            sm: 5,
            md: 3,
            help: 'Set to 0 to disable polling',
        },
    },
};
