import { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { toHexString } from '../lib/shared';
import { I2cAdapter } from '../main';
import { DeviceHandlerBase } from './device-handler-base';

export interface PCF8574Config extends ImplementationConfigBase {
    pollingInterval: number;
    interrupt?: string;
    pins: PinConfig[];
}

export interface PinConfig {
    dir: 'in' | 'out';
    inv?: boolean;
}

export default class PCF8574 extends DeviceHandlerBase<PCF8574Config> {
    private readonly isHorter: boolean;
    private readValue = 0;
    private writeValue = 0;

    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(deviceConfig, adapter);

        this.isHorter = this.name.startsWith('Horter');
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

        let hasInput = false;
        for (let i = 0; i < 8; i++) {
            const pinConfig = this.config.pins[i] || { dir: this.isHorter ? 'in' : 'out' };
            const isInput = pinConfig.dir == 'in';
            if (isInput) {
                hasInput = true;
                if (!this.isHorter) {
                    this.writeValue |= 1 << i; // PCF input pins must be set to high level
                }
                // else do not set the write value (that's the difference between Horter and regular PCF)
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
            await this.adapter.extendObjectAsync(`${this.hexAddress}.${i}`, {
                type: 'state',
                common: {
                    name: `${this.hexAddress} ${isInput ? 'In' : 'Out'}put ${i}`,
                    read: isInput,
                    write: !isInput,
                    type: 'boolean',
                    role: isInput ? 'indicator' : 'switch',
                },
                native: pinConfig as any,
            });
        }

        this.debug('Setting initial value to ' + toHexString(this.writeValue));
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
                this.adapter.addForeignStateChangeListener(this.config.interrupt, async (_value) => {
                    this.debug('Interrupt detected');
                    await this.readCurrentValueAsync(false);
                });

                this.debug('Interrupt enabled');
            } catch (error) {
                this.error(`Interrupt object ${this.config.interrupt} not found!`);
            }
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
    }

    private async sendCurrentValueAsync(): Promise<void> {
        this.debug('Sending ' + toHexString(this.writeValue));
        try {
            await this.sendByte(this.writeValue);
        } catch (e) {
            this.error("Couldn't send current value: " + e);
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
        } catch (e) {
            this.error("Couldn't read current value: " + e);
            return;
        }

        if (oldValue == this.readValue && !force) {
            return;
        }

        this.debug('Read ' + toHexString(this.readValue));
        for (let i = 0; i < 8; i++) {
            const mask = 1 << i;
            if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].dir == 'in') {
                let value = (this.readValue & mask) > 0;
                if (this.config.pins[i].inv) {
                    value = !value;
                }
                await this.setStateAckAsync(i, value);
            }
        }
    }

    private addOutputListener(pin: number): void {
        this.adapter.addStateChangeListener<boolean>(
            this.hexAddress + '.' + pin,
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
