import type { ConfigItemAny } from '@iobroker/dm-utils';
import type { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { toHexString } from '../lib/shared';
import type { I2cAdapter } from '../main';
import { LittleEndianDeviceHandlerBase } from './little-endian-device-handler-base';

export interface MCP230xxConfig extends ImplementationConfigBase {
    pollingInterval: number;
    interrupt?: string;
    pins: PinConfig[];
}

export type PinDirection = 'in-no' | 'in-pu' | 'out';

export interface PinConfig {
    dir: PinDirection;
    inv?: boolean;
}

// register addresses (for MCP23008, for MCP23017 register "A" in IOCON.BANK = 0 you must multiply by 2)
export enum Register {
    IODIR = 0x00,
    IPOL = 0x01,
    GPINTEN = 0x02,
    DEFVAL = 0x03,
    INTCON = 0x04,
    IOCON = 0x05,
    GPPU = 0x06,
    INTF = 0x07,
    INTCAP = 0x08,
    GPIO = 0x09,
    OLAT = 0x0a,
}

export abstract class MCP230xxBase extends LittleEndianDeviceHandlerBase<MCP230xxConfig> {
    private initialized = false;
    private hasInput = false;
    private directions = 0;
    private polarities = 0;
    private pullUps = 0;
    private readValue = 0;
    private writeValue = 0;

    constructor(
        private pinCount: number,
        deviceConfig: I2CDeviceConfig,
        adapter: I2cAdapter,
    ) {
        super(deviceConfig, adapter);
    }

    protected abstract indexToName(index: number): string;

    protected abstract readRegister(register: Register): Promise<number>;

    protected abstract writeRegister(register: Register, value: number): Promise<void>;

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

        for (let i = 0; i < this.pinCount; i++) {
            const pinConfig = this.config.pins[i] || { dir: 'out' };
            const isInput = pinConfig.dir !== 'out';
            await this.adapter.extendObject(`${this.hexAddress}.${this.indexToName(i)}`, {
                type: 'state',
                common: {
                    name: `${this.hexAddress} ${isInput ? 'In' : 'Out'}put ${this.indexToName(i)}`,
                    read: isInput,
                    write: !isInput,
                    type: 'boolean',
                    role: isInput ? 'indicator' : 'switch',
                },
                native: pinConfig as any,
            });

            if (isInput) {
                this.directions |= 1 << i;
                if (pinConfig.dir == 'in-pu') {
                    this.pullUps |= 1 << i;
                }
                if (pinConfig.inv) {
                    this.polarities |= 1 << i;
                }
                this.hasInput = true;
            } else {
                this.addOutputListener(i);
                let value = this.getStateValue(this.indexToName(i));
                if (value === undefined) {
                    value = pinConfig.inv === true;
                    await this.setStateAckAsync(this.indexToName(i), value);
                }
                if (pinConfig.inv) {
                    value = !value;
                }
                if (!value) {
                    this.writeValue |= 1 << i;
                }
            }
        }

        await this.checkInitializedAsync();

        if (this.hasInput && this.config.pollingInterval > 0) {
            this.startPolling(async () => await this.readCurrentValueAsync(false), this.config.pollingInterval, 50);
        }

        if (this.hasInput && this.config.interrupt) {
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

    private async checkInitializedAsync(): Promise<boolean> {
        if (this.initialized) {
            // checking if the directions are still the same, if not, the chip might have reset itself
            try {
                const readDirections = await this.readRegister(Register.IODIR);
                if (readDirections === this.directions) {
                    return true;
                }
            } catch (e: any) {
                this.error(`Couldn't read IODIR register: ${e}`);
                return false;
            }

            this.error('GPIO directions unexpectedly changed, reconfiguring the device');
            this.initialized = false;
        }

        try {
            this.debug(`Setting initial output value to ${toHexString(this.writeValue, this.pinCount / 4)}`);
            await this.writeRegister(Register.OLAT, this.writeValue);
            this.debug(`Setting polarities to ${toHexString(this.polarities, this.pinCount / 4)}`);
            await this.writeRegister(Register.IPOL, this.polarities);
            this.debug(`Setting pull-ups to ${toHexString(this.pullUps, this.pinCount / 4)}`);
            await this.writeRegister(Register.GPPU, this.pullUps);
            this.debug(`Setting directions to ${toHexString(this.directions, this.pinCount / 4)}`);
            await this.writeRegister(Register.IODIR, this.directions);
            this.initialized = true;
        } catch (e: any) {
            this.error(`Couldn't initialize: ${e}`);
            return false;
        }

        await this.readCurrentValueAsync(true);
        return this.initialized;
    }

    private async sendCurrentValueAsync(): Promise<void> {
        if (!(await this.checkInitializedAsync())) {
            return;
        }

        this.debug(`Sending ${toHexString(this.writeValue, this.pinCount / 4)}`);
        try {
            await this.writeRegister(Register.OLAT, this.writeValue);
        } catch (e: any) {
            this.error(`Couldn't send current value: ${e}`);
            this.initialized = false;
        }
    }

    private async readCurrentValueAsync(force: boolean): Promise<void> {
        if (!this.hasInput) {
            return;
        }
        if (!(await this.checkInitializedAsync())) {
            return;
        }

        const oldValue = this.readValue;
        try {
            this.readValue = await this.readRegister(Register.GPIO);
        } catch (e: any) {
            this.error(`Couldn't read current value: ${e}`);
            this.initialized = false;
            return;
        }

        if (oldValue == this.readValue && !force) {
            return;
        }

        this.debug(`Read ${toHexString(this.readValue, this.pinCount / 4)}`);
        for (let i = 0; i < this.pinCount; i++) {
            const mask = 1 << i;
            if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].dir != 'out') {
                const value = (this.readValue & mask) > 0;
                await this.setStateAckAsync(this.indexToName(i), value);
            }
        }
    }

    private addOutputListener(pin: number): void {
        this.adapter.addStateChangeListener<boolean>(
            `${this.hexAddress}.${this.indexToName(pin)}`,
            async (_oldValue: boolean, newValue: boolean) => await this.changeOutputAsync(pin, newValue),
        );
    }

    private async changeOutputAsync(pin: number, value: boolean): Promise<void> {
        const mask = 1 << pin;
        const oldValue = this.writeValue;
        const realValue = this.config.pins[pin].inv ? !value : value;
        if (realValue) {
            this.writeValue &= ~mask;
        } else {
            this.writeValue |= mask;
        }
        if (this.writeValue != oldValue) {
            await this.sendCurrentValueAsync();
        }

        await this.setStateAckAsync(this.indexToName(pin), value);
    }
}

export function createPinConfig(
    type: 'MCP23008' | 'MCP23017',
    index: number,
    label: string,
): Record<string, ConfigItemAny> {
    return {
        [`_${type}_${index}`]: {
            type: 'staticText',
            xs: 2,
            md: 1,
            text: `Pin ${label}`,
            newLine: true,
        },
        [`${type}.pins.${index}.dir`]: {
            type: 'select',
            options: [
                { value: 'in-no', label: 'Input without internal pull-up resistor' },
                { value: 'in-pu', label: 'Input with internal pull-up resistor' },
                { value: 'out', label: 'Output' },
            ],
            default: 'out',
            format: 'dropdown',
            xs: 7,
            md: 6,
            label: 'Direction',
        },
        [`${type}.pins.${index}.inv`]: {
            type: 'checkbox',
            default: false,
            xs: 2,
            label: 'inverted',
        },
    };
}
