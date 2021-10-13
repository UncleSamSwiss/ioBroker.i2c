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
class SRF02 extends big_endian_device_handler_base_1.BigEndianDeviceHandlerBase {
    constructor(deviceConfig, adapter) {
        super(deviceConfig, adapter);
        this.useRegisters = this.name == 'SRF02';
    }
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
            yield this.adapter.extendObjectAsync(this.hexAddress + '.distance', {
                type: 'state',
                common: {
                    name: this.hexAddress + ' Distance',
                    read: true,
                    write: false,
                    type: 'number',
                    role: 'value.distance',
                    unit: 'cm',
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
                // send the range command
                if (this.useRegisters) {
                    yield this.writeByte(0x00, 0x51);
                }
                else {
                    yield this.sendByte(0x51);
                }
                yield this.delay(100);
                // read the measurement data
                let value;
                if (this.useRegisters) {
                    value = yield this.readWord(0x02);
                }
                else {
                    const buffer = Buffer.alloc(2);
                    yield this.i2cRead(buffer.length, buffer);
                    // masking awai the highest bit (undocumented!)
                    value = buffer.readUInt16BE() & 0x7fff;
                }
                this.setStateAck('distance', value);
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
exports.default = SRF02;
//# sourceMappingURL=srf02.js.map