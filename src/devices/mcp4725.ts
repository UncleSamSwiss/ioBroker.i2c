import { DeviceHandlerBase } from './device-handler-base';

export interface MCP4725Config {
    referenceVoltage: number; // in mV
    writeToEeprom: boolean;
}

export default class MCP4725 extends DeviceHandlerBase<MCP4725Config> {
    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObjectAsync(this.hexAddress, {
            type: 'device',
            common: {
                name: this.hexAddress + ' (' + this.name + ')',
            },
            native: this.config as any,
        });

        const id = `${this.hexAddress}.voltage`;
        this.adapter.extendObject(id, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Voltage`,
                read: false,
                write: true,
                type: 'number',
                role: 'level.voltage',
                unit: 'mV',
            },
        });

        this.adapter.addStateChangeListener<number>(
            id,
            async (_oldValue: number, newValue: number) => await this.writeVoltageAsync(newValue),
        );

        const voltage = this.getStateValue<number>('voltage');
        await this.writeVoltageAsync(voltage || 0);
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
    }

    private async writeVoltageAsync(voltage: number): Promise<void> {
        if (voltage > this.config.referenceVoltage) {
            this.error(
                `Can't set voltage (${voltage} mV) higher than reference voltage  (${this.config.referenceVoltage} mV)`,
            );
            return;
        }
        if (voltage < 0) {
            this.error(`Can't set voltage (${voltage} mV) below zero`);
            return;
        }

        try {
            const value = Math.round((voltage * 4096) / this.config.referenceVoltage);

            let buffer: Buffer;
            if (!this.config.writeToEeprom) {
                // using fast mode
                buffer = Buffer.alloc(2);
                buffer[0] = (value >> 8) & 0x0f;
                buffer[1] = value & 0xff;
            } else {
                // C2=0, C1=1, C0=1
                buffer = Buffer.alloc(3);
                buffer[0] = 0x60;
                buffer[1] = (value >> 4) & 0xff;
                buffer[2] = (value << 4) & 0xf0;
            }
            await this.i2cWrite(buffer.length, buffer);
            await this.setStateAckAsync('voltage', voltage);
        } catch (e) {
            this.error("Couldn't write voltage: " + e);
        }
    }
}
