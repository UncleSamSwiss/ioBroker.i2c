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
const seesaw_handler_base_1 = require("./seesaw-handler-base");
/**
 * Based on https://github.com/adafruit/Adafruit_Seesaw/blob/master/examples/soil_sensor/soilsensor_example/soilsensor_example.ino
 */
class SeesawSoil extends seesaw_handler_base_1.SeesawHandlerBase {
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
            yield this.adapter.extendObjectAsync(`${this.hexAddress}.temperature`, {
                type: 'state',
                common: {
                    name: `${this.hexAddress} Temperature`,
                    read: true,
                    write: false,
                    type: 'number',
                    role: 'value.temperature',
                    unit: '°C',
                },
            });
            yield this.adapter.extendObjectAsync(`${this.hexAddress}.capacitive`, {
                type: 'state',
                common: {
                    name: `${this.hexAddress} Capacitive`,
                    read: true,
                    write: false,
                    type: 'number',
                    role: 'value',
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
            if (!(yield this.begin())) {
                throw new Error('Seesaw not found');
            }
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
            const tempC = yield this.getTemp();
            const capread = yield this.touchRead(0);
            yield this.setStateAckAsync('temperature', tempC);
            yield this.setStateAckAsync('capacitive', capread);
        });
    }
}
exports.default = SeesawSoil;
//# sourceMappingURL=seesawsoil.js.map