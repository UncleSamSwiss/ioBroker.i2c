import type { ConfigItemAny } from '@iobroker/dm-utils';
import type { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { getAllAddresses } from '../lib/i2c';
import { toHexString } from '../lib/shared';
import type { I2cAdapter } from '../main';
import type { DeviceHandlerInfo } from './device-handler-base';
import { DeviceHandlerBase } from './device-handler-base';

export interface PCF8574Config extends ImplementationConfigBase {
    pollingInterval: number;
    interrupt?: string;
    pins: PinConfig[];
}

export type PinDirection = 'in' | 'in-to-vcc' | 'out';

export interface PinConfig {
    dir: PinDirection;
    inv?: boolean;
}

export class PCF8574Handler extends DeviceHandlerBase<PCF8574Config> {
    private readonly isHorter: boolean;
    private readValue = 0;
    private writeValue = 0;

    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(deviceConfig, adapter);

        this.isHorter = this.name.startsWith('Horter');
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

        let hasInput = false;
        for (let i = 0; i < 8; i++) {
            const pinConfig = this.config.pins[i] || { dir: this.isHorter ? 'in' : 'out' };
            const isInput = pinConfig.dir !== 'out';
            await this.adapter.extendObject(`${this.hexAddress}.${i}`, {
                type: 'state',
                common: {
                    name: `${this.hexAddress} ${isInput ? 'In' : 'Out'}put ${i}`,
                    read: isInput,
                    write: !isInput,
                    type: 'boolean',
                    role: isInput ? 'indicator' : 'switch',
                },
                native: pinConfig,
            });

            if (isInput) {
                hasInput = true;
                if (pinConfig.dir === 'in') {
                    this.writeValue |= 1 << i; // PCF input pins must be set to high level
                }
                // else do not set the write value
            } else {
                this.addOutputListener(i);
                let value = this.getStateValue(i);
                if (value === undefined) {
                    value = pinConfig.inv === true;
                    await this.setStateAckAsync(i, value);
                }
                if (pinConfig.inv) {
                    value = !value;
                }
                if (!value) {
                    this.writeValue |= 1 << i;
                }
            }
        }

        this.debug(`Setting initial value to ${toHexString(this.writeValue)}`);
        await this.sendCurrentValueAsync();

        await this.readCurrentValueAsync(true);
        if (hasInput && this.config.pollingInterval > 0) {
            this.startPolling(async () => await this.readCurrentValueAsync(false), this.config.pollingInterval, 50);
        }

        if (hasInput && this.config.interrupt) {
            try {
                // check if interrupt object exists
                await this.adapter.getObjectAsync(this.config.interrupt);

                // subscribe to the object and add change listener
                this.adapter.addForeignStateChangeListener(this.config.interrupt, async _value => {
                    this.debug('Interrupt detected');
                    await this.readCurrentValueAsync(false);
                });

                this.debug('Interrupt enabled');
            } catch {
                this.error(`Interrupt object ${this.config.interrupt} not found!`);
            }
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
        return Promise.resolve();
    }

    private async sendCurrentValueAsync(): Promise<void> {
        this.debug(`Sending ${toHexString(this.writeValue)}`);
        try {
            await this.sendByte(this.writeValue);
        } catch (e: any) {
            this.error(`Couldn't send current value: ${e}`);
        }
    }

    private async readCurrentValueAsync(force: boolean): Promise<void> {
        const oldValue = this.readValue;
        try {
            let retries = 3;
            do {
                // writing the current value before reading to make sure the "direction" of all pins is set correctly
                await this.sendByte(this.writeValue);
                this.readValue = await this.receiveByte();

                // reading all 1's (0xFF) could be because of a reset, let's try 3x
            } while (!force && this.readValue == 0xff && --retries > 0);
        } catch (e: any) {
            this.error(`Couldn't read current value: ${e}`);
            return;
        }

        if (oldValue == this.readValue && !force) {
            return;
        }

        this.debug(`Read ${toHexString(this.readValue)}`);
        for (let i = 0; i < 8; i++) {
            const mask = 1 << i;
            if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].dir !== 'out') {
                let value = (this.readValue & mask) > 0;
                if (this.config.pins[i].inv) {
                    value = !value;
                }
                this.setStateAck(i, value);
            }
        }
    }

    private addOutputListener(pin: number): void {
        this.adapter.addStateChangeListener<boolean>(
            `${this.hexAddress}.${pin}`,
            async (_oldValue: boolean, newValue: boolean) => await this.changeOutputAsync(pin, newValue),
        );
    }

    private async changeOutputAsync(pin: number, value: boolean): Promise<void> {
        const mask = 1 << pin;
        const realValue = this.config.pins[pin].inv ? !value : value;
        if (realValue) {
            this.writeValue &= ~mask;
        } else {
            this.writeValue |= mask;
        }

        await this.sendCurrentValueAsync();
        await this.setStateAckAsync(pin, value);
    }
}

function createPinConfig(index: number, defaultDir: PinDirection): Record<string, ConfigItemAny> {
    return {
        [`_PCF8574_${index}`]: {
            type: 'staticText',
            xs: 2,
            md: 1,
            text: `Pin ${index + 1}`,
            newLine: true,
        },
        [`PCF8574.pins.${index}.dir`]: {
            type: 'select',
            options: [
                { value: 'in', label: 'Input with external pull-up resistor' },
                { value: 'in-to-vcc', label: 'Input with external pull-down resistor' },
                { value: 'out', label: 'Output' },
            ],
            default: defaultDir,
            xs: 7,
            md: 6,
            lg: 5,
            label: 'Direction',
        },
        [`PCF8574.pins.${index}.inv`]: {
            type: 'checkbox',
            default: false,
            xs: 2,
            label: 'inverted',
        },
    };
}

function createPinConfigs(isHorter: boolean): Record<string, ConfigItemAny> {
    const configs: Record<string, ConfigItemAny> = {};
    const defaultDir: PinDirection = isHorter ? 'in' : 'out';
    for (let i = 0; i < 8; i++) {
        Object.assign(configs, createPinConfig(i, defaultDir));
    }
    return isHorter
        ? {
              _horter: {
                  type: 'panel',
                  items: configs,
                  hidden: true,
              },
          }
        : configs;
}

export const PCF8574: DeviceHandlerInfo = {
    type: 'PCF8574',
    createHandler: (deviceConfig, adapter) => new PCF8574Handler(deviceConfig, adapter),
    names: [
        { name: 'PCF8574', addresses: getAllAddresses(0x20, 8), config: createPinConfigs(false) },
        { name: 'PCF8574A', addresses: getAllAddresses(0x38, 8), config: createPinConfigs(false) },
        {
            name: 'Horter Digital Input Module',
            addresses: [...getAllAddresses(0x20, 8), ...getAllAddresses(0x38, 8)],
            config: createPinConfigs(true),
        },
    ],
    config: {
        pollingInterval: {
            type: 'number',
            label: 'Polling Interval',
            default: 200,
            unit: 'ms',
            xs: 7,
            sm: 5,
            md: 3,
            help: 'Set to 0 to disable polling',
        },
        interrupt: {
            type: 'objectId',
            label: 'Interrupt State Object ID',
            xs: 12,
            newLine: true,
        },
    },
};
