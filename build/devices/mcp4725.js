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
const device_handler_base_1 = require("./device-handler-base");
class MCP4725 extends device_handler_base_1.DeviceHandlerBase {
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
            const id = `${this.hexAddress}.voltage`;
            yield this.adapter.extendObjectAsync(id, {
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
            this.adapter.addStateChangeListener(id, (_oldValue, newValue) => __awaiter(this, void 0, void 0, function* () { return yield this.writeVoltageAsync(newValue); }));
            const voltage = this.getStateValue('voltage');
            yield this.writeVoltageAsync(voltage || 0);
        });
    }
    stopAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Stopping');
        });
    }
    writeVoltageAsync(voltage) {
        return __awaiter(this, void 0, void 0, function* () {
            if (voltage > this.config.referenceVoltage) {
                this.error(`Can't set voltage (${voltage} mV) higher than reference voltage  (${this.config.referenceVoltage} mV)`);
                return;
            }
            if (voltage < 0) {
                this.error(`Can't set voltage (${voltage} mV) below zero`);
                return;
            }
            try {
                const value = Math.round((voltage * 4096) / this.config.referenceVoltage);
                let buffer;
                if (!this.config.writeToEeprom) {
                    // using fast mode
                    buffer = Buffer.alloc(2);
                    buffer[0] = (value >> 8) & 0x0f;
                    buffer[1] = value & 0xff;
                }
                else {
                    // C2=0, C1=1, C0=1
                    buffer = Buffer.alloc(3);
                    buffer[0] = 0x60;
                    buffer[1] = (value >> 4) & 0xff;
                    buffer[2] = (value << 4) & 0xf0;
                }
                yield this.i2cWrite(buffer.length, buffer);
                yield this.setStateAckAsync('voltage', voltage);
            }
            catch (e) {
                this.error("Couldn't write voltage: " + e);
            }
        });
    }
}
exports.default = MCP4725;
//# sourceMappingURL=mcp4725.js.map