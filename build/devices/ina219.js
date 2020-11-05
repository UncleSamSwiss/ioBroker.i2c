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
const big_endian_device_handler_base_1 = require("./big-endian-device-handler-base");
class INA219 extends big_endian_device_handler_base_1.BigEndianDeviceHandlerBase {
    startAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Starting');
            yield this.adapter.extendObjectAsync(this.hexAddress, {
                type: 'device',
                common: {
                    name: this.hexAddress + ' (' + this.name + ')',
                },
                native: this.config,
            });
            yield this.adapter.extendObjectAsync(`${this.hexAddress}.shunt`, {
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
            yield this.adapter.extendObjectAsync(`${this.hexAddress}.bus`, {
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
            yield this.adapter.extendObjectAsync(`${this.hexAddress}.power`, {
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
            yield this.adapter.extendObjectAsync(`${this.hexAddress}.current`, {
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
            yield this.configureDeviceAsync();
            this.startPolling(() => this.updateValuesAsync(), this.config.pollingInterval, 10);
        });
    }
    stopAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Stopping');
            this.stopPolling();
        });
    }
    configureDeviceAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            const rshunt = this.config.shuntValue / 1000; // unit: ohms
            const currentLsb = this.config.currentLsb / 1000; // unit: A
            // Compute the calibration register
            const calibrationReg = Math.trunc(0.04096 / (currentLsb * rshunt));
            yield this.writeWord(0x05, calibrationReg);
            let configReg = 0;
            configReg |= this.config.voltageRange << 13;
            configReg |= this.config.gain << 11;
            configReg |= this.config.adcResolution << 7;
            configReg |= this.config.adcResolution << 3;
            configReg |= this.config.singleShot ? 0x03 : 0x07;
            yield this.writeWord(0x00, configReg);
        });
    }
    updateValuesAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.config.singleShot) {
                    yield this.configureDeviceAsync();
                }
                const busVoltageReg = yield this.readWord(0x02);
                if ((busVoltageReg & 0x02) === 0) {
                    throw new Error('CNVR is not set, not ready');
                }
                if ((busVoltageReg & 0x01) > 0) {
                    throw new Error('OVF is set, overflow');
                }
                const shuntVoltageReg = yield this.readWord(0x01);
                const powerReg = yield this.readWord(0x03);
                const currentReg = yield this.readWord(0x04);
                // Calculate the power LSB
                const powerLsb = 20 * this.config.currentLsb;
                // The least signficant bit is 10uV which is 0.01 mV
                yield this.setStateAckAsync('shunt', this.toInt16(shuntVoltageReg) * 0.01);
                // Shift to the right 3 to drop CNVR and OVF and multiply by LSB
                // Each least signficant bit is 4mV
                yield this.setStateAckAsync('bus', (busVoltageReg >> 3) * 0.004);
                yield this.setStateAckAsync('power', powerReg * powerLsb);
                yield this.setStateAckAsync('current', this.toInt16(currentReg) * this.config.currentLsb);
            }
            catch (e) {
                this.error(`Couldn't read values: ${e}`);
            }
        });
    }
    toInt16(value) {
        return value > 0x7fff ? value - 0x10000 : value;
    }
}
exports.default = INA219;
//# sourceMappingURL=ina219.js.map