/*
 * NOTICE:
 * A lot of this code is based on https://github.com/adafruit/Adafruit_INA219
 * License: BSD license, all text here must be included in any redistribution.
 */
import type { ImplementationConfigBase } from '../lib/adapter-config';
import { getAllAddresses } from '../lib/i2c';
import { BigEndianDeviceHandlerBase } from './big-endian-device-handler-base';
import type { DeviceHandlerInfo } from './device-handler-base';

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

export class INA219Handler extends BigEndianDeviceHandlerBase<INA219Config> {
    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObject(this.hexAddress, {
            type: 'device',
            common: {
                name: `${this.hexAddress} (${this.name})`,
            },
            native: this.deviceConfig,
        });

        await this.adapter.extendObject(`${this.hexAddress}.shunt`, {
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

        await this.adapter.extendObject(`${this.hexAddress}.bus`, {
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

        await this.adapter.extendObject(`${this.hexAddress}.power`, {
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

        await this.adapter.extendObject(`${this.hexAddress}.current`, {
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

        this.adapter.addStateChangeListener(`${this.hexAddress}.measure`, async () => await this.updateValuesAsync());

        await this.configureDeviceAsync();

        if (this.config.pollingInterval > 0) {
            this.startPolling(() => this.updateValuesAsync(), this.config.pollingInterval, 10);
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
        return Promise.resolve();
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
        } catch (e: any) {
            this.error(`Couldn't read values: ${e}`);
        }
    }

    private toInt16(value: number): number {
        return value > 0x7fff ? value - 0x10000 : value;
    }
}

export const INA219: DeviceHandlerInfo = {
    type: 'INA219',
    createHandler: (deviceConfig, adapter) => new INA219Handler(deviceConfig, adapter),
    names: [{ name: 'INA219', addresses: getAllAddresses(0x40, 16) }],
    config: {
        'INA219.pollingInterval': {
            type: 'number',
            label: 'Polling Interval',
            default: 1000,
            unit: 'ms',
            xs: 7,
            sm: 5,
            md: 3,
            help: 'Set to 0 to disable polling',
        },
        'INA219.singleShot': {
            type: 'checkbox',
            label: 'Single Shot Mode',
            default: false,
            xs: 5,
        },
        'INA219.voltageRange': {
            type: 'select',
            label: 'Voltage Range',
            options: [
                { value: 0, label: '16V' },
                { value: 1, label: '32V' },
            ],
            default: 0,
            xs: 4,
            md: 3,
            newLine: true,
        },
        'INA219.gain': {
            type: 'select',
            label: 'Gain',
            options: [
                { value: 0, label: '+/-40mV' },
                { value: 1, label: '+/-80mV' },
                { value: 2, label: '+/-160mV' },
                { value: 3, label: '+/-320mV' },
            ],
            default: 3,
            xs: 4,
            md: 3,
        },
        'INA219.adcResolution': {
            type: 'select',
            label: 'ADC Resolution',
            options: [
                { value: 0, label: '9bit, 1 sample' },
                { value: 1, label: '10bit, 1 sample' },
                { value: 2, label: '11bit, 1 sample' },
                { value: 3, label: '12bit, 1 sample' },
                { value: 9, label: '12bit, 2 samples' },
                { value: 10, label: '12bit, 4 samples' },
                { value: 11, label: '12bit, 8 samples' },
                { value: 12, label: '12bit, 16 samples' },
                { value: 13, label: '12bit, 32 samples' },
                { value: 14, label: '12bit, 64 samples' },
                { value: 15, label: '12bit, 128 samples' },
            ],
            default: 3,
            xs: 4,
            md: 3,
        },
        'INA219.shuntValue': {
            type: 'number',
            label: 'Shunt Resistor Value',
            default: 100,
            unit: 'mOhm',
            min: 1,
            xs: 4,
            md: 3,
            newLine: true,
        },
        'INA219.expectedCurrent': {
            type: 'number',
            label: 'Expected Maximum Current',
            default: 2,
            unit: 'A',
            xs: 4,
            md: 3,
        },
        'INA219.currentLsb': {
            type: 'number',
            label: 'Current LSB',
            default: 1000,
            unit: 'mA/bit',
            xs: 4,
            md: 3,
        },
    },
};
