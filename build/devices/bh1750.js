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
class BH1750 extends device_handler_base_1.DeviceHandlerBase {
    startAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Starting');
            yield this.adapter.extendObjectAsync(this.hexAddress, {
                type: 'device',
                common: {
                    name: this.hexAddress + ' (' + this.name + ')',
                    role: 'illuminance',
                },
                native: this.config,
            });
            const systemConfig = yield this.adapter.getForeignObjectAsync('system.config');
            this.useAmericanUnits = !!(systemConfig && systemConfig.common && systemConfig.common.tempUnit == '°F');
            this.info(`Using ${this.useAmericanUnits ? 'American' : 'metric'} units`);
            yield this.adapter.extendObjectAsync(this.hexAddress + '.lux', {
                type: 'state',
                common: {
                    name: this.hexAddress + ' Lux',
                    read: true,
                    write: false,
                    type: 'number',
                    role: 'value.lux',
                    unit: 'lux',
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
    readCurrentValuesAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Reading current values');
            try {
                // Grab illuminance
                const buffer = new Buffer(2);
                yield this.readI2cBlock(0x20, 2, buffer);
                this.debug('Buffer' + buffer);
                const lux = (buffer[1] + 256 * buffer[0]) / 1.2;
                this.debug('Read: ' +
                    JSON.stringify({
                        lux: lux,
                    }));
                const rounded = Math.round(lux * 10) / 10;
                yield this.adapter.setStateAckAsync(this.hexAddress + '.' + 'lux', rounded);
            }
            catch (e) {
                this.error("Couldn't read current values: " + e);
            }
        });
    }
}
exports.default = BH1750;
//# sourceMappingURL=bh1750.js.map