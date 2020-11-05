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
const async_1 = require("../lib/async");
const big_endian_device_handler_base_1 = require("./big-endian-device-handler-base");
class SHT3x extends big_endian_device_handler_base_1.BigEndianDeviceHandlerBase {
    startAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Starting');
            yield this.adapter.extendObjectAsync(this.hexAddress, {
                type: 'device',
                common: {
                    name: this.hexAddress + ' (' + this.name + ')',
                    role: 'sensor',
                },
                native: this.config,
            });
            yield this.adapter.extendObjectAsync(this.hexAddress + '.temperature', {
                type: 'state',
                common: {
                    name: this.hexAddress + ' Temperature',
                    read: true,
                    write: false,
                    type: 'number',
                    role: 'value.temperature',
                    unit: '°C',
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
            this.adapter.addStateChangeListener(this.hexAddress + '.measure', () => __awaiter(this, void 0, void 0, function* () { return yield this.readCurrentValueAsync(); }));
            if (this.config.pollingInterval > 0) {
                this.startPolling(() => __awaiter(this, void 0, void 0, function* () { return yield this.readCurrentValueAsync(); }), this.config.pollingInterval * 1000, 1000);
            }
        });
    }
    stopAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Stopping');
            this.stopPolling();
        });
    }
    readCurrentValueAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // send the single shot command
                let buffer = Buffer.alloc(2);
                buffer[0] = 0x24;
                switch (this.config.repeatability) {
                    case 'high':
                        buffer[1] = 0x00;
                        break;
                    case 'medium':
                        buffer[1] = 0x0b;
                        break;
                    case 'low':
                        buffer[1] = 0x16;
                        break;
                }
                yield this.i2cWrite(buffer.length, buffer);
                yield this.delay(15);
                // read the measurement data
                buffer = Buffer.alloc(6);
                const result = yield this.i2cRead(buffer.length, buffer);
                if (result.bytesRead != buffer.length) {
                    throw new Error(`Only ${result.bytesRead} instead of ${buffer.length} bytes read`);
                }
                const temperatureRaw = buffer.readUInt16BE(0);
                const humidityRaw = buffer.readUInt16BE(3);
                yield this.setStateAckAsync('temperature', temperatureRaw * 0.00267033 - 45);
                yield this.setStateAckAsync('humidity', humidityRaw * 0.0015259);
            }
            catch (e) {
                this.error("Couldn't read current value: " + e);
            }
        });
    }
    delay(ms) {
        return __awaiter(this, void 0, void 0, function* () {
            const delay = new async_1.Delay(ms);
            yield delay.runAsnyc();
        });
    }
}
exports.default = SHT3x;
//# sourceMappingURL=sht3x.js.map