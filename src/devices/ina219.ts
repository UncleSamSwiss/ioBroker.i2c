/*
 * NOTICE:
 * A lot of this code is based on https://github.com/adafruit/Adafruit_INA219
 * License: BSD license, all text here must be included in any redistribution.
 */
import { ImplementationConfigBase } from '../lib/adapter-config';
import { BigEndianDeviceHandlerBase } from './big-endian-device-handler-base';

export interface INA219Config extends ImplementationConfigBase {
    /** unit: msec */
    pollingInterval: number;

    singleShot: boolean;

    /** register value: 0=16V, 1=32V */
    voltageRange: 0 | 1;

    /** register value: 0=+/-40mV, 1=+/-80mV, 2=+/-160mV, 3=+/-320mV */
    gain: number;

    /** register value: 0=9bit+1sample, ... 15=12bit+128samples */
    adcResolution: number;

    /** unit mOhm */
    shuntValue: number;

    /** unit: A */
    expectedCurrent: number;

    /** unit: mA per bit */
    currentLsb: number;
}

export default class INA219 extends BigEndianDeviceHandlerBase<INA219Config> {
    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObjectAsync(this.hexAddress, {
            type: 'device',
            common: {
                name: this.hexAddress + ' (' + this.name + ')',
            },
            native: this.config as any,
        });

        await this.adapter.extendObjectAsync(`${this.hexAddress}.shunt`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Shunt Voltage`,
                read: true,
                write: false,
                type: 'number',
                role: 'value.voltage',
                unit: 'mV',
            },
        });

        await this.adapter.extendObjectAsync(`${this.hexAddress}.bus`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Bus Voltage`,
                read: true,
                write: false,
                type: 'number',
                role: 'value.voltage',
                unit: 'V',
            },
        });

        await this.adapter.extendObjectAsync(`${this.hexAddress}.power`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Power`,
                read: true,
                write: false,
                type: 'number',
                role: 'value',
                unit: 'mW',
            },
        });

        await this.adapter.extendObjectAsync(`${this.hexAddress}.current`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Current`,
                read: true,
                write: false,
                type: 'number',
                role: 'value.current ',
                unit: 'mA',
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

        this.adapter.addStateChangeListener(this.hexAddress + '.measure', async () => await this.updateValuesAsync());

        await this.configureDeviceAsync();

        if (this.config.pollingInterval > 0) {
            this.startPolling(() => this.updateValuesAsync(), this.config.pollingInterval, 10);
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
    }

    private async configureDeviceAsync(): Promise<void> {
        const rshunt = this.config.shuntValue / 1000; // unit: ohms
        const currentLsb = this.config.currentLsb / 1000; // unit: A

        // Compute the calibration register
        const calibrationReg = Math.trunc(0.04096 / (currentLsb * rshunt));

        await this.writeWord(0x05, calibrationReg);

        let configReg = 0;
        configReg |= this.config.voltageRange << 13;
        configReg |= this.config.gain << 11;
        configReg |= this.config.adcResolution << 7;
        configReg |= this.config.adcResolution << 3;
        configReg |= this.config.singleShot ? 0x03 : 0x07;
        await this.writeWord(0x00, configReg);
    }

    private async updateValuesAsync(): Promise<void> {
        try {
            if (this.config.singleShot) {
                await this.configureDeviceAsync();
            }

            const busVoltageReg = await this.readWord(0x02);
            if ((busVoltageReg & 0x02) === 0) {
                throw new Error('CNVR is not set, not ready');
            }
            if ((busVoltageReg & 0x01) > 0) {
                throw new Error('OVF is set, overflow');
            }

            const shuntVoltageReg = await this.readWord(0x01);
            const powerReg = await this.readWord(0x03);
            const currentReg = await this.readWord(0x04);

            // Calculate the power LSB
            const powerLsb = 20 * this.config.currentLsb;

            // The least significant bit is 10uV which is 0.01 mV
            this.setStateAck('shunt', this.toInt16(shuntVoltageReg) * 0.01);

            // Shift to the right 3 to drop CNVR and OVF and multiply by LSB
            // Each least significant bit is 4mV
            this.setStateAck('bus', (busVoltageReg >> 3) * 0.004);

            this.setStateAck('power', powerReg * powerLsb);

            this.setStateAck('current', this.toInt16(currentReg) * this.config.currentLsb);
        } catch (e) {
            this.error(`Couldn't read values: ${e}`);
        }
    }

    private toInt16(value: number): number {
        return value > 0x7fff ? value - 0x10000 : value;
    }
}
