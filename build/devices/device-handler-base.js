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
exports.DeviceHandlerBase = void 0;
const async_1 = require("../lib/async");
const shared_1 = require("../lib/shared");
class DeviceHandlerBase {
    constructor(deviceConfig, adapter) {
        this.deviceConfig = deviceConfig;
        this.adapter = adapter;
        if (!deviceConfig.type || !deviceConfig.name) {
            throw new Error('Type and name of device must be specified');
        }
        this.type = deviceConfig.type;
        this.name = deviceConfig.name;
        this.config = deviceConfig[deviceConfig.type];
        this.hexAddress = shared_1.toHexString(deviceConfig.address);
    }
    // polling related methods
    startPolling(callback, interval, minInterval) {
        this.stopPolling();
        this.polling = new async_1.Polling(callback);
        this.polling.runAsync(interval, minInterval).catch((error) => this.error('Polling error: ' + error));
    }
    stopPolling() {
        var _a;
        (_a = this.polling) === null || _a === void 0 ? void 0 : _a.stop();
    }
    // I2C related methods
    deviceId() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.adapter.i2cBus.deviceId(this.deviceConfig.address);
        });
    }
    i2cRead(length, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.adapter.i2cBus.i2cRead(this.deviceConfig.address, length, buffer);
            this.silly(`i2cRead(${length}): 0x${result.buffer.toString('hex')}`);
            return result;
        });
    }
    i2cWrite(length, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            this.silly(`i2cWrite(${length}, 0x${buffer.toString('hex')})`);
            return yield this.adapter.i2cBus.i2cWrite(this.deviceConfig.address, length, buffer);
        });
    }
    readByte(command) {
        return __awaiter(this, void 0, void 0, function* () {
            const byte = yield this.adapter.i2cBus.readByte(this.deviceConfig.address, command);
            this.silly(`readByte(${shared_1.toHexString(command)}): ${shared_1.toHexString(byte)}`);
            return byte;
        });
    }
    readI2cBlock(command, length, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.adapter.i2cBus.readI2cBlock(this.deviceConfig.address, command, length, buffer);
            this.silly(`readI2cBlock(${shared_1.toHexString(command)}, ${length}): 0x${result.buffer.toString('hex')}`);
            return result;
        });
    }
    receiveByte() {
        return __awaiter(this, void 0, void 0, function* () {
            const byte = yield this.adapter.i2cBus.receiveByte(this.deviceConfig.address);
            this.silly(`receiveByte(): ${shared_1.toHexString(byte)}`);
            return byte;
        });
    }
    sendByte(byte) {
        return __awaiter(this, void 0, void 0, function* () {
            this.silly(`sendByte(${shared_1.toHexString(byte)})`);
            return yield this.adapter.i2cBus.sendByte(this.deviceConfig.address, byte);
        });
    }
    writeByte(command, byte) {
        return __awaiter(this, void 0, void 0, function* () {
            this.silly(`writeByte(${shared_1.toHexString(command)}, ${shared_1.toHexString(byte)})`);
            return yield this.adapter.i2cBus.writeByte(this.deviceConfig.address, command, byte);
        });
    }
    writeQuick(command, bit) {
        return __awaiter(this, void 0, void 0, function* () {
            this.silly(`writeQuick(${shared_1.toHexString(command)}, ${bit})`);
            return yield this.adapter.i2cBus.writeQuick(this.deviceConfig.address, command, bit);
        });
    }
    writeI2cBlock(command, length, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            this.silly(`writeI2cBlock(${shared_1.toHexString(command)}, ${length}, 0x${buffer.toString('hex')})`);
            return yield this.adapter.i2cBus.writeI2cBlock(this.deviceConfig.address, command, length, buffer);
        });
    }
    // adapter methods
    setStateAckAsync(state, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.adapter.setStateAckAsync(this.hexAddress + '.' + state, value);
        });
    }
    getStateValue(state) {
        return this.adapter.getStateValue(this.hexAddress + '.' + state);
    }
    // logging methods
    silly(message) {
        this.adapter.log.silly(`${this.type} ${this.hexAddress}: ${message}`);
    }
    debug(message) {
        this.adapter.log.debug(`${this.type} ${this.hexAddress}: ${message}`);
    }
    info(message) {
        this.adapter.log.info(`${this.type} ${this.hexAddress}: ${message}`);
    }
    error(message) {
        this.adapter.log.error(`${this.type} ${this.hexAddress}: ${message}`);
    }
}
exports.DeviceHandlerBase = DeviceHandlerBase;
//# sourceMappingURL=device-handler-base.js.map