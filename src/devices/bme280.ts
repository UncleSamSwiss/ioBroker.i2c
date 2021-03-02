/*
 * NOTICE:
 * A lot of this code is based on https://github.com/skylarstein/bme280-sensor
 * We need this to use the same I2C instance as for all other devices; thus the rewrite.
MIT License

Copyright (c) 2016 Skylar Stein

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */
import { ImplementationConfigBase } from '../lib/adapter-config';
import { toHexString } from '../lib/shared';
import { int16, round, uint16, uint20 } from '../lib/utils';
import { LittleEndianDeviceHandlerBase } from './little-endian-device-handler-base';

export interface BME280Config extends ImplementationConfigBase {
    pollingInterval: number;
}

enum Register {
    DIG_T1 = 0x88,
    DIG_T2 = 0x8a,
    DIG_T3 = 0x8c,

    DIG_P1 = 0x8e,
    DIG_P2 = 0x90,
    DIG_P3 = 0x92,
    DIG_P4 = 0x94,
    DIG_P5 = 0x96,
    DIG_P6 = 0x98,
    DIG_P7 = 0x9a,
    DIG_P8 = 0x9c,
    DIG_P9 = 0x9e,

    DIG_H1 = 0xa1,
    DIG_H2 = 0xe1,
    DIG_H3 = 0xe3,
    DIG_H4 = 0xe4,
    DIG_H5 = 0xe5,
    DIG_H5_1 = 0xe6,
    DIG_H6 = 0xe7,

    CHIPID = 0xd0,
    RESET = 0xe0,

    CONTROL_HUM = 0xf2,
    CONTROL = 0xf4,
    PRESSURE_DATA = 0xf7,
    TEMP_DATA = 0xfa,
    HUMIDITY_DATA = 0xfd,
}

interface Calibration {
    dig_T1: number;
    dig_T2: number;
    dig_T3: number;

    dig_P1: number;
    dig_P2: number;
    dig_P3: number;
    dig_P4: number;
    dig_P5: number;
    dig_P6: number;
    dig_P7: number;
    dig_P8: number;
    dig_P9: number;

    dig_H1: number;
    dig_H2: number;
    dig_H3: number;
    dig_H4: number;
    dig_H5: number;
    dig_H6: number;
}

export default class BME280 extends LittleEndianDeviceHandlerBase<BME280Config> {
    private useAmericanUnits!: boolean;
    private cal!: Calibration;

    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObjectAsync(this.hexAddress, {
            type: 'device',
            common: {
                name: this.hexAddress + ' (' + this.name + ')',
                role: 'thermo',
            },
            native: this.config as any,
        });

        const systemConfig = await this.adapter.getForeignObjectAsync('system.config');
        this.useAmericanUnits = !!(systemConfig && systemConfig.common && systemConfig.common.tempUnit == '°F');
        this.info(`Using ${this.useAmericanUnits ? 'American' : 'metric'} units`);

        await this.adapter.extendObjectAsync(this.hexAddress + '.temperature', {
            type: 'state',
            common: {
                name: this.hexAddress + ' Temperature',
                read: true,
                write: false,
                type: 'number',
                role: 'value.temperature',
                unit: this.useAmericanUnits ? '°F' : '°C',
            },
        });

        await this.adapter.extendObjectAsync(this.hexAddress + '.humidity', {
            type: 'state',
            common: {
                name: this.hexAddress + ' Humidity',
                read: true,
                write: false,
                type: 'number',
                role: 'value.humidity',
                unit: '%',
            },
        });

        await this.adapter.extendObjectAsync(this.hexAddress + '.pressure', {
            type: 'state',
            common: {
                name: this.hexAddress + ' Pressure',
                read: true,
                write: false,
                type: 'number',
                role: 'value.pressure',
                unit: this.useAmericanUnits ? 'inHg' : 'mbar',
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

        this.adapter.addStateChangeListener(
            this.hexAddress + '.measure',
            async () => await this.readCurrentValuesAsync(),
        );

        await this.checkChipIdAsync();
        await this.loadCalibrationAsync();
        await this.configureChipAsync();
        await this.readCurrentValuesAsync();
        if (this.config.pollingInterval > 0) {
            this.startPolling(
                async () => await this.readCurrentValuesAsync(),
                this.config.pollingInterval * 1000,
                1000,
            );
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
    }

    private async checkChipIdAsync(): Promise<void> {
        await this.writeByte(Register.CHIPID, 0);
        const chipId = await this.readByte(Register.CHIPID);
        this.info('Chip ID: ' + toHexString(chipId));
        if (chipId < 0x56 || chipId > 0x60 || chipId == 0x59) {
            throw `Unsupported chip ID ${toHexString(chipId)}; are you sure this is a BME280?`;
        }
    }

    private async loadCalibrationAsync(): Promise<void> {
        const buffer = new Buffer(24);
        await this.readI2cBlock(Register.DIG_T1, 24, buffer);
        const h1 = await this.readByte(Register.DIG_H1);
        const h2 = await this.readWord(Register.DIG_H2);
        const h3 = await this.readByte(Register.DIG_H3);
        const h4 = await this.readByte(Register.DIG_H4);
        const h5 = await this.readByte(Register.DIG_H5);
        const h5_1 = await this.readByte(Register.DIG_H5 + 1);
        const h6 = await this.readByte(Register.DIG_H6);

        this.cal = {
            dig_T1: uint16(buffer[1], buffer[0]),
            dig_T2: int16(buffer[3], buffer[2]),
            dig_T3: int16(buffer[5], buffer[4]),
            dig_P1: uint16(buffer[7], buffer[6]),
            dig_P2: int16(buffer[9], buffer[8]),
            dig_P3: int16(buffer[11], buffer[10]),
            dig_P4: int16(buffer[13], buffer[12]),
            dig_P5: int16(buffer[15], buffer[14]),
            dig_P6: int16(buffer[17], buffer[16]),
            dig_P7: int16(buffer[19], buffer[18]),
            dig_P8: int16(buffer[21], buffer[20]),
            dig_P9: int16(buffer[23], buffer[22]),

            dig_H1: h1,
            dig_H2: h2,
            dig_H3: h3,
            dig_H4: (h4 << 4) | (h5 & 0xf),
            dig_H5: (h5_1 << 4) | (h5 >> 4),
            dig_H6: h6,
        };

        this.debug('cal = ' + JSON.stringify(this.cal));
    }

    private async configureChipAsync(): Promise<void> {
        // Humidity 16x oversampling
        await this.writeByte(Register.CONTROL_HUM, 0b00000101);

        // Temperture/pressure 16x oversampling, normal mode
        await this.writeByte(Register.CONTROL, 0b10110111);
    }

    private async readCurrentValuesAsync(): Promise<void> {
        this.debug('Reading current values');
        try {
            // Grab temperature, humidity, and pressure in a single read
            const buffer = Buffer.alloc(8);
            await this.readI2cBlock(Register.PRESSURE_DATA, 8, buffer);

            // Temperature (temperature first since we need t_fine for pressure and humidity)
            const adc_T = uint20(buffer[3], buffer[4], buffer[5]);
            const tvar1 = (((adc_T >> 3) - (this.cal.dig_T1 << 1)) * this.cal.dig_T2) >> 11;
            const tvar2 =
                (((((adc_T >> 4) - this.cal.dig_T1) * ((adc_T >> 4) - this.cal.dig_T1)) >> 12) * this.cal.dig_T3) >> 14;
            const t_fine = tvar1 + tvar2;

            const temperature_C = ((t_fine * 5 + 128) >> 8) / 100;

            // Pressure
            const adc_P = uint20(buffer[0], buffer[1], buffer[2]);
            let pvar1 = t_fine / 2 - 64000;
            let pvar2 = (pvar1 * pvar1 * this.cal.dig_P6) / 32768;
            pvar2 = pvar2 + pvar1 * this.cal.dig_P5 * 2;
            pvar2 = pvar2 / 4 + this.cal.dig_P4 * 65536;
            pvar1 = ((this.cal.dig_P3 * pvar1 * pvar1) / 524288 + this.cal.dig_P2 * pvar1) / 524288;
            pvar1 = (1 + pvar1 / 32768) * this.cal.dig_P1;

            let pressure_hPa = 0;

            if (pvar1 !== 0) {
                let p = 1048576 - adc_P;
                p = ((p - pvar2 / 4096) * 6250) / pvar1;
                pvar1 = (this.cal.dig_P9 * p * p) / 2147483648;
                pvar2 = (p * this.cal.dig_P8) / 32768;
                p = p + (pvar1 + pvar2 + this.cal.dig_P7) / 16;

                pressure_hPa = p / 100;
            }

            // Humidity (available on the BME280, will be zero on the BMP280 since it has no humidity sensor)
            const adc_H = uint16(buffer[6], buffer[7]);

            let h = t_fine - 76800;
            h =
                (adc_H - (this.cal.dig_H4 * 64 + (this.cal.dig_H5 / 16384) * h)) *
                ((this.cal.dig_H2 / 65536) *
                    (1 + (this.cal.dig_H6 / 67108864) * h * (1 + (this.cal.dig_H3 / 67108864) * h)));
            h = h * (1 - (this.cal.dig_H1 * h) / 524288);

            const humidity = h > 100 ? 100 : h < 0 ? 0 : h;

            this.debug(
                'Read: ' +
                    JSON.stringify({
                        temp: temperature_C,
                        hum: humidity,
                        press: pressure_hPa,
                    }),
            );

            await this.setStateAckAsync('humidity', round(humidity));
            if (this.useAmericanUnits) {
                await this.setStateAckAsync('temperature', round((temperature_C * 9) / 5 + 32));
                await this.setStateAckAsync('pressure', round(pressure_hPa * 0.02952998751, 1000));
            } else {
                await this.setStateAckAsync('temperature', round(temperature_C));
                await this.setStateAckAsync('pressure', round(pressure_hPa)); // hPa == mbar :-)
            }
        } catch (e) {
            this.error("Couldn't read current values: " + e);
        }
    }
}
