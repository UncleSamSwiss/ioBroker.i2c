"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("../lib/shared");
const utils_1 = require("../lib/utils");
const little_endian_device_handler_base_1 = require("./little-endian-device-handler-base");
var Register;
(function (Register) {
    Register[Register["DIG_T1"] = 136] = "DIG_T1";
    Register[Register["DIG_T2"] = 138] = "DIG_T2";
    Register[Register["DIG_T3"] = 140] = "DIG_T3";
    Register[Register["DIG_P1"] = 142] = "DIG_P1";
    Register[Register["DIG_P2"] = 144] = "DIG_P2";
    Register[Register["DIG_P3"] = 146] = "DIG_P3";
    Register[Register["DIG_P4"] = 148] = "DIG_P4";
    Register[Register["DIG_P5"] = 150] = "DIG_P5";
    Register[Register["DIG_P6"] = 152] = "DIG_P6";
    Register[Register["DIG_P7"] = 154] = "DIG_P7";
    Register[Register["DIG_P8"] = 156] = "DIG_P8";
    Register[Register["DIG_P9"] = 158] = "DIG_P9";
    Register[Register["DIG_H1"] = 161] = "DIG_H1";
    Register[Register["DIG_H2"] = 225] = "DIG_H2";
    Register[Register["DIG_H3"] = 227] = "DIG_H3";
    Register[Register["DIG_H4"] = 228] = "DIG_H4";
    Register[Register["DIG_H5"] = 229] = "DIG_H5";
    Register[Register["DIG_H5_1"] = 230] = "DIG_H5_1";
    Register[Register["DIG_H6"] = 231] = "DIG_H6";
    Register[Register["CHIPID"] = 208] = "CHIPID";
    Register[Register["RESET"] = 224] = "RESET";
    Register[Register["CONTROL_HUM"] = 242] = "CONTROL_HUM";
    Register[Register["CONTROL"] = 244] = "CONTROL";
    Register[Register["PRESSURE_DATA"] = 247] = "PRESSURE_DATA";
    Register[Register["TEMP_DATA"] = 250] = "TEMP_DATA";
    Register[Register["HUMIDITY_DATA"] = 253] = "HUMIDITY_DATA";
})(Register || (Register = {}));
class BME280 extends little_endian_device_handler_base_1.LittleEndianDeviceHandlerBase {
    startAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Starting');
            yield this.adapter.extendObjectAsync(this.hexAddress, {
                type: 'device',
                common: {
                    name: this.hexAddress + ' (' + this.name + ')',
                    role: 'thermo',
                },
                native: this.config,
            });
            const systemConfig = yield this.adapter.getForeignObjectAsync('system.config');
            this.useAmericanUnits = !!(systemConfig && systemConfig.common && systemConfig.common.tempUnit == '°F');
            this.info(`Using ${this.useAmericanUnits ? 'American' : 'metric'} units`);
            yield this.adapter.extendObjectAsync(this.hexAddress + '.temperature', {
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
            yield this.adapter.extendObjectAsync(this.hexAddress + '.humidity', {
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
            yield this.adapter.extendObjectAsync(this.hexAddress + '.pressure', {
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
            yield this.adapter.extendObjectAsync(this.hexAddress + '.measure', {
                type: 'state',
                common: {
                    name: this.hexAddress + ' Measure',
                    read: false,
                    write: true,
                    type: 'boolean',
                    role: 'button',
                },
            });
            this.adapter.addStateChangeListener(this.hexAddress + '.measure', () => __awaiter(this, void 0, void 0, function* () { return yield this.readCurrentValuesAsync(); }));
            yield this.checkChipIdAsync();
            yield this.loadCalibrationAsync();
            yield this.configureChipAsync();
            yield this.readCurrentValuesAsync();
            if (this.config.pollingInterval > 0) {
                this.startPolling(() => __awaiter(this, void 0, void 0, function* () { return yield this.readCurrentValuesAsync(); }), this.config.pollingInterval * 1000, 1000);
            }
        });
    }
    stopAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Stopping');
            this.stopPolling();
        });
    }
    checkChipIdAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.writeByte(Register.CHIPID, 0);
            const chipId = yield this.readByte(Register.CHIPID);
            this.info('Chip ID: ' + shared_1.toHexString(chipId));
            if (chipId < 0x56 || chipId > 0x60 || chipId == 0x59) {
                throw `Unsupported chip ID ${shared_1.toHexString(chipId)}; are you sure this is a BME280?`;
            }
        });
    }
    loadCalibrationAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = new Buffer(24);
            yield this.readI2cBlock(Register.DIG_T1, 24, buffer);
            const h1 = yield this.readByte(Register.DIG_H1);
            const h2 = yield this.readWord(Register.DIG_H2);
            const h3 = yield this.readByte(Register.DIG_H3);
            const h4 = yield this.readByte(Register.DIG_H4);
            const h5 = yield this.readByte(Register.DIG_H5);
            const h5_1 = yield this.readByte(Register.DIG_H5 + 1);
            const h6 = yield this.readByte(Register.DIG_H6);
            this.cal = {
                dig_T1: utils_1.uint16(buffer[1], buffer[0]),
                dig_T2: utils_1.int16(buffer[3], buffer[2]),
                dig_T3: utils_1.int16(buffer[5], buffer[4]),
                dig_P1: utils_1.uint16(buffer[7], buffer[6]),
                dig_P2: utils_1.int16(buffer[9], buffer[8]),
                dig_P3: utils_1.int16(buffer[11], buffer[10]),
                dig_P4: utils_1.int16(buffer[13], buffer[12]),
                dig_P5: utils_1.int16(buffer[15], buffer[14]),
                dig_P6: utils_1.int16(buffer[17], buffer[16]),
                dig_P7: utils_1.int16(buffer[19], buffer[18]),
                dig_P8: utils_1.int16(buffer[21], buffer[20]),
                dig_P9: utils_1.int16(buffer[23], buffer[22]),
                dig_H1: h1,
                dig_H2: h2,
                dig_H3: h3,
                dig_H4: (h4 << 4) | (h5 & 0xf),
                dig_H5: (h5_1 << 4) | (h5 >> 4),
                dig_H6: h6,
            };
            this.debug('cal = ' + JSON.stringify(this.cal));
        });
    }
    configureChipAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            // Humidity 16x oversampling
            yield this.writeByte(Register.CONTROL_HUM, 0b00000101);
            // Temperture/pressure 16x oversampling, normal mode
            yield this.writeByte(Register.CONTROL, 0b10110111);
        });
    }
    readCurrentValuesAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Reading current values');
            try {
                // Grab temperature, humidity, and pressure in a single read
                const buffer = new Buffer(8);
                yield this.readI2cBlock(Register.PRESSURE_DATA, 8, buffer);
                // Temperature (temperature first since we need t_fine for pressure and humidity)
                const adc_T = utils_1.uint20(buffer[3], buffer[4], buffer[5]);
                const tvar1 = (((adc_T >> 3) - (this.cal.dig_T1 << 1)) * this.cal.dig_T2) >> 11;
                const tvar2 = (((((adc_T >> 4) - this.cal.dig_T1) * ((adc_T >> 4) - this.cal.dig_T1)) >> 12) * this.cal.dig_T3) >> 14;
                const t_fine = tvar1 + tvar2;
                const temperature_C = ((t_fine * 5 + 128) >> 8) / 100;
                // Pressure
                const adc_P = utils_1.uint20(buffer[0], buffer[1], buffer[2]);
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
                const adc_H = utils_1.uint16(buffer[6], buffer[7]);
                let h = t_fine - 76800;
                h =
                    (adc_H - (this.cal.dig_H4 * 64 + (this.cal.dig_H5 / 16384) * h)) *
                        ((this.cal.dig_H2 / 65536) *
                            (1 + (this.cal.dig_H6 / 67108864) * h * (1 + (this.cal.dig_H3 / 67108864) * h)));
                h = h * (1 - (this.cal.dig_H1 * h) / 524288);
                const humidity = h > 100 ? 100 : h < 0 ? 0 : h;
                this.debug('Read: ' +
                    JSON.stringify({
                        temp: temperature_C,
                        hum: humidity,
                        press: pressure_hPa,
                    }));
                yield this.setStateAckAsync('humidity', utils_1.round(humidity));
                if (this.useAmericanUnits) {
                    yield this.setStateAckAsync('temperature', utils_1.round((temperature_C * 9) / 5 + 32));
                    yield this.setStateAckAsync('pressure', utils_1.round(pressure_hPa * 0.02952998751, 1000));
                }
                else {
                    yield this.setStateAckAsync('temperature', utils_1.round(temperature_C));
                    yield this.setStateAckAsync('pressure', utils_1.round(pressure_hPa)); // hPa == mbar :-)
                }
            }
            catch (e) {
                this.error("Couldn't read current values: " + e);
            }
        });
    }
}
exports.default = BME280;
//# sourceMappingURL=bme280.js.map