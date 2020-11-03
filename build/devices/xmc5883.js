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
class xMC5883 extends device_handler_base_1.DeviceHandlerBase {
    constructor(deviceConfig, adapter) {
        super(deviceConfig, adapter);
        this.gainFactor = 0;
        if (this.name == 'QMC5883L') {
            this.configureDeviceAsync = this.configureQMC5883Async;
            this.readValuesAsync = this.readQMC5883Async;
        }
        else {
            this.configureDeviceAsync = this.configureHMC5883Async;
            this.readValuesAsync = this.readHMC5883Async;
        }
    }
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
            yield Promise.all(['X', 'Y', 'Z'].map((coord) => __awaiter(this, void 0, void 0, function* () {
                yield this.adapter.extendObjectAsync(`${this.hexAddress}.${coord.toLowerCase()}`, {
                    type: 'state',
                    common: {
                        name: `${this.hexAddress} ${coord}`,
                        read: true,
                        write: false,
                        type: 'number',
                        role: 'value.direction',
                        unit: 'Gs',
                    },
                });
            })));
            const { useInterrupt, gainFactor, pollingInterval } = yield this.configureDeviceAsync();
            if (useInterrupt && this.config.interrupt) {
                try {
                    // check if interrupt object exists
                    yield this.adapter.getObjectAsync(this.config.interrupt);
                    // subscribe to the object and add change listener
                    this.adapter.addForeignStateChangeListener(this.config.interrupt, (_value) => __awaiter(this, void 0, void 0, function* () {
                        this.debug('Interrupt detected');
                        yield this.updateValuesAsync(gainFactor);
                    }));
                    this.debug('Interrupt enabled');
                }
                catch (error) {
                    this.error(`Interrupt object ${this.config.interrupt} not found!`);
                }
            }
            else {
                this.startPolling(() => this.updateValuesAsync(gainFactor), pollingInterval - 3);
            }
        });
    }
    stopAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Stopping');
            this.stopPolling();
        });
    }
    configureQMC5883Async() {
        return __awaiter(this, void 0, void 0, function* () {
            let useInterrupt;
            let pollingInterval;
            let ctrl1 = this.config.oversampling << 6;
            ctrl1 |= this.config.range << 4;
            if (this.config.refreshInterval >= 100) {
                ctrl1 |= 0 << 2;
                pollingInterval = this.config.refreshInterval;
                useInterrupt = false;
            }
            else if (this.config.refreshInterval >= 20) {
                ctrl1 |= 1 << 2;
                pollingInterval = 50;
                useInterrupt = true;
            }
            else if (this.config.refreshInterval >= 10) {
                ctrl1 |= 2 << 2;
                pollingInterval = 100;
                useInterrupt = true;
            }
            else {
                ctrl1 |= 3 << 2;
                pollingInterval = 200;
                useInterrupt = true;
            }
            ctrl1 |= 1;
            yield this.writeByte(0x09, ctrl1);
            // enable interrupt if needed
            const ctrl2 = this.config.interrupt ? 1 : 0;
            yield this.writeByte(0x0a, ctrl2);
            return { useInterrupt, pollingInterval, gainFactor: (this.config.range === 0 ? 2 : 8) / 32768 };
        });
    }
    configureHMC5883Async() {
        return __awaiter(this, void 0, void 0, function* () {
            let useInterrupt = true;
            let pollingInterval;
            let cra = this.config.oversampling << 5;
            if (this.config.refreshInterval >= 1333) {
                cra |= 0 << 2;
                pollingInterval = 1333;
            }
            else if (this.config.refreshInterval >= 666) {
                cra |= 1 << 2;
                pollingInterval = 666;
            }
            else if (this.config.refreshInterval >= 333) {
                cra |= 2 << 2;
                pollingInterval = 333;
            }
            else if (this.config.refreshInterval >= 133) {
                cra |= 3 << 2;
                pollingInterval = 133;
            }
            else if (this.config.refreshInterval >= 66) {
                cra |= 4 << 2;
                pollingInterval = 66;
            }
            else if (this.config.refreshInterval >= 33) {
                cra |= 5 << 2;
                pollingInterval = 33;
            }
            else {
                cra |= 6 << 2;
                pollingInterval = 13;
            }
            yield this.writeByte(0x00, cra);
            const crb = this.config.range << 5;
            yield this.writeByte(0x01, crb);
            let mode = 0;
            if (this.config.refreshInterval >= 2000) {
                // single measurement mode
                mode = 1;
                useInterrupt = false;
                pollingInterval = this.config.refreshInterval;
            }
            yield this.writeByte(0x02, mode);
            let range;
            switch (this.config.range) {
                case 0:
                    range = 0.88;
                    break;
                case 1:
                    range = 1.3;
                    break;
                case 2:
                    range = 1.9;
                    break;
                case 3:
                    range = 2.5;
                    break;
                case 4:
                    range = 4.0;
                    break;
                case 5:
                    range = 4.7;
                    break;
                case 6:
                    range = 5.6;
                    break;
                default:
                    range = 8.1;
                    break;
            }
            return { useInterrupt, pollingInterval, gainFactor: range / 32768 };
        });
    }
    readQMC5883Async() {
        return __awaiter(this, void 0, void 0, function* () {
            let ready = false;
            let status = 0;
            for (let i = 0; i < 10 && !ready; i++) {
                status = yield this.readByte(0x06);
                ready = !!(status & 0x01);
            }
            if (!ready) {
                throw new Error(`Didn't get ready bit set after 10 tries`);
            }
            if (status & 0x02) {
                throw new Error(`Measurement overflow`);
            }
            const buffer = Buffer.alloc(6);
            yield this.readI2cBlock(0x00, buffer.length, buffer);
            return {
                x: buffer.readInt16LE(0),
                y: buffer.readInt16LE(2),
                z: buffer.readInt16LE(4),
            };
        });
    }
    readHMC5883Async() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.config.refreshInterval >= 2000) {
                // set single measurement mode again
                yield this.configureHMC5883Async();
            }
            let ready = false;
            for (let i = 0; i < 20 && !ready; i++) {
                const status = yield this.readByte(0x09);
                ready = !!(status & 0x01);
            }
            if (!ready) {
                throw new Error(`Didn't get ready bit set after 20 tries`);
            }
            const buffer = Buffer.alloc(6);
            yield this.readI2cBlock(0x03, buffer.length, buffer);
            return {
                x: buffer.readInt16BE(0),
                y: buffer.readInt16BE(4),
                z: buffer.readInt16BE(2),
            };
        });
    }
    updateValuesAsync(gainFactor) {
        return __awaiter(this, void 0, void 0, function* () {
            let measurement;
            try {
                this.debug('Reading values');
                measurement = yield this.readValuesAsync();
                this.debug(`Read ${JSON.stringify(measurement)}`);
            }
            catch (e) {
                this.error(`Couldn't read values: ${e}`);
                return;
            }
            yield this.setStateAckAsync('x', measurement.x * gainFactor);
            yield this.setStateAckAsync('y', measurement.y * gainFactor);
            yield this.setStateAckAsync('z', measurement.z * gainFactor);
        });
    }
}
exports.default = xMC5883;
//# sourceMappingURL=xmc5883.js.map