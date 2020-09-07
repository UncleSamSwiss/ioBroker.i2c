import { ImplementationConfigBase, toHexString } from '../lib/shared';
import { DeviceHandlerBase } from './device-handler-base';

export interface MCP23008Config extends ImplementationConfigBase {
    pollingInterval: number;
    interrupt?: string;
    pins: PinConfig[];
}

export interface PinConfig {
    dir: 'in-no' | 'in-pu' | 'out';
    inv?: boolean;
}

// register addresses (always for register "A" in IOCON.BANK = 0)
enum Register {
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

export default class MCP23008 extends DeviceHandlerBase<MCP23008Config> {
    private initialized = false;
    private hasInput = false;
    private directions = 0;
    private polarities = 0;
    private pullUps = 0;
    private readValue = 0;
    private writeValue = 0;

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

        for (let i = 0; i < 8; i++) {
            const pinConfig = this.config.pins[i] || { dir: 'out' };
            const isInput = pinConfig.dir !== 'out';
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
            this.adapter.extendObject(`${this.hexAddress}.${i}`, {
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

        await this.checkInitializedAsync();

        if (this.hasInput && this.config.pollingInterval > 0) {
            this.startPolling(async () => await this.readCurrentValueAsync(false), this.config.pollingInterval, 50);
        }

        if (this.hasInput && this.config.interrupt) {
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

    private async checkInitializedAsync(): Promise<boolean> {
        if (this.initialized) {
            // checking if the directions are still the same, if not, the chip might have reset itself
            const readDirections = await this.readByte(Register.IODIR);
            if (readDirections === this.directions) {
                return true;
            }

            this.error('GPIO directions unexpectedly changed, reconfiguring the device');
            this.initialized = false;
        }

        try {
            this.debug('Setting initial output value to ' + toHexString(this.writeValue));
            await this.writeByte(Register.OLAT, this.writeValue);
            this.debug('Setting polarities to ' + toHexString(this.polarities));
            await this.writeByte(Register.IPOL, this.polarities);
            this.debug('Setting pull-ups to ' + toHexString(this.pullUps));
            await this.writeByte(Register.GPPU, this.pullUps);
            this.debug('Setting directions to ' + toHexString(this.directions));
            await this.writeByte(Register.IODIR, this.directions);
            this.initialized = true;
        } catch (e) {
            this.error("Couldn't initialize: " + e);
            return false;
        }

        await this.readCurrentValueAsync(true);
        return this.initialized;
    }

    private async sendCurrentValueAsync(): Promise<void> {
        if (!(await this.checkInitializedAsync())) {
            return;
        }

        this.debug('Sending ' + toHexString(this.writeValue));
        try {
            await this.writeByte(Register.OLAT, this.writeValue);
        } catch (e) {
            this.error("Couldn't send current value: " + e);
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
            this.readValue = await this.readByte(Register.GPIO);
        } catch (e) {
            this.error("Couldn't read current value: " + e);
            this.initialized = false;
            return;
        }

        if (oldValue == this.readValue && !force) {
            return;
        }

        this.debug('Read ' + toHexString(this.readValue));
        for (let i = 0; i < 8; i++) {
            const mask = 1 << i;
            if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].dir != 'out') {
                const value = (this.readValue & mask) > 0;
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

        await this.setStateAckAsync(pin, value);
    }

    private async setStateAckAsync(pin: number, value: boolean): Promise<void> {
        await this.adapter.setStateAckAsync(this.hexAddress + '.' + pin, value);
    }

    private getStateValue(pin: number): boolean | undefined {
        return this.adapter.getStateValue<boolean>(this.hexAddress + '.' + pin);
    }
}
