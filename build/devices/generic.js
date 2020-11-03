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
const shared_1 = require("../lib/shared");
const device_handler_base_1 = require("./device-handler-base");
class Generic extends device_handler_base_1.DeviceHandlerBase {
    constructor() {
        super(...arguments);
        this.handlers = {};
    }
    startAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Starting');
            const name = this.config.name || this.name;
            yield this.adapter.extendObjectAsync(this.hexAddress, {
                type: 'device',
                common: {
                    name: this.hexAddress + ' (' + name + ')',
                    role: 'sensor',
                },
                native: this.config,
            });
            for (const registerConfig of this.config.registers) {
                const handler = {
                    hex: shared_1.toHexString(registerConfig.register),
                    config: registerConfig,
                };
                this.handlers[registerConfig.register] = handler;
                this.debug('Register ' + handler.hex + ': ' + JSON.stringify(handler.config));
                yield this.adapter.extendObjectAsync(this.hexAddress + '.' + handler.hex, {
                    type: 'state',
                    common: {
                        name: this.hexAddress + ' ' + (handler.config.name || 'Register'),
                        read: handler.config.read,
                        write: handler.config.write,
                        type: 'number',
                        role: 'value',
                    },
                    native: handler.config,
                });
                // init polling when read
                if (handler.config.read) {
                    yield this.readValueAsync(handler);
                    if (!!handler.config.pollingInterval && handler.config.pollingInterval > 0) {
                        handler.polling = new async_1.Polling(() => __awaiter(this, void 0, void 0, function* () { return yield this.readValueAsync(handler); }));
                        handler.polling
                            .runAsync(handler.config.pollingInterval, 50)
                            .catch((error) => this.error(`${handler.hex}: Polling error: ${error}`));
                    }
                }
                // init listener when write
                if (handler.config.write) {
                    // send current value on startup for write-only regsiters
                    if (!handler.config.read) {
                        const value = this.getStateValue(handler.hex);
                        if (typeof value === 'number') {
                            yield this.sendValueAsync(handler, value);
                        }
                    }
                    this.addOutputListener(handler);
                }
            }
        });
    }
    stopAsync() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Stopping');
            for (const register in this.handlers) {
                (_a = this.handlers[register].polling) === null || _a === void 0 ? void 0 : _a.stop();
            }
        });
    }
    addOutputListener(handler) {
        this.adapter.addStateChangeListener(this.hexAddress + '.' + handler.hex, (_oldValue, newValue) => __awaiter(this, void 0, void 0, function* () { return yield this.sendValueAsync(handler, newValue); }));
    }
    sendValueAsync(handler, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const buf = this.createBuffer(handler);
            switch (handler.config.type) {
                case 'int8':
                    buf.writeInt8(value);
                    break;
                case 'uint8':
                    buf.writeUInt8(value);
                    break;
                case 'int16_be':
                    buf.writeInt16BE(value);
                    break;
                case 'int16_le':
                    buf.writeInt16LE(value);
                    break;
                case 'uint16_be':
                    buf.writeUInt16BE(value);
                    break;
                case 'uint16_le':
                    buf.writeUInt16LE(value);
                    break;
                case 'int32_be':
                    buf.writeInt32BE(value);
                    break;
                case 'int32_le':
                    buf.writeInt32LE(value);
                    break;
                case 'uint32_be':
                    buf.writeUInt32BE(value);
                    break;
                case 'uint32_le':
                    buf.writeUInt32LE(value);
                    break;
                case 'float_be':
                    buf.writeFloatBE(value);
                    break;
                case 'float_le':
                    buf.writeFloatLE(value);
                    break;
                case 'double_be':
                    buf.writeDoubleBE(value);
                    break;
                case 'double_le':
                    buf.writeDoubleLE(value);
                    break;
            }
            this.debug(`${handler.hex}: Sending ${buf.length} bytes: ${buf.toString('hex')}`);
            try {
                if (handler.config.register >= 0) {
                    yield this.writeI2cBlock(handler.config.register, buf.length, buf);
                }
                else {
                    yield this.i2cWrite(buf.length, buf);
                }
                yield this.setStateAckAsync(handler.hex, value);
            }
            catch (e) {
                this.error(`${handler.hex}: Couldn't send value: ${e}`);
            }
        });
    }
    readValueAsync(handler) {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug(`${handler.hex}: Reading from register`);
            const buf = this.createBuffer(handler);
            // read raw data from bus
            try {
                if (handler.config.register >= 0) {
                    yield this.readI2cBlock(handler.config.register, buf.length, buf);
                }
                else {
                    yield this.i2cRead(buf.length, buf);
                }
            }
            catch (e) {
                this.error(`${handler.hex}: Couldn't read value: ${e}`);
                return;
            }
            // parse data to data type
            let value;
            try {
                switch (handler.config.type) {
                    case 'int8':
                        value = buf.readInt8();
                        break;
                    case 'uint8':
                        value = buf.readUInt8();
                        break;
                    case 'int16_be':
                        value = buf.readInt16BE();
                        break;
                    case 'int16_le':
                        value = buf.readInt16LE();
                        break;
                    case 'uint16_be':
                        value = buf.readUInt16BE();
                        break;
                    case 'uint16_le':
                        value = buf.readUInt16LE();
                        break;
                    case 'int32_be':
                        value = buf.readInt32BE();
                        break;
                    case 'int32_le':
                        value = buf.readInt32LE();
                        break;
                    case 'uint32_be':
                        value = buf.readUInt32BE();
                        break;
                    case 'uint32_le':
                        value = buf.readUInt32LE();
                        break;
                    case 'float_be':
                        value = buf.readFloatBE();
                        break;
                    case 'float_le':
                        value = buf.readFloatLE();
                        break;
                    case 'double_be':
                        value = buf.readDoubleBE();
                        break;
                    case 'double_le':
                        value = buf.readDoubleLE();
                        break;
                }
                this.debug(`${handler.hex}: Read ${buf.toString('hex')} -> ${value}`);
            }
            catch (e) {
                this.error(`${handler.hex}: Couldn't read value as type ${handler.config.type} from buffer ${buf.toString('hex')}: ${e}`);
                return;
            }
            // save the value into the state
            yield this.setStateAckAsync(handler.hex, value);
        });
    }
    createBuffer(handler) {
        switch (handler.config.type) {
            case 'int8':
                return Buffer.alloc(1);
            case 'uint8':
                return Buffer.alloc(1);
            case 'int16_be':
                return Buffer.alloc(2);
            case 'int16_le':
                return Buffer.alloc(2);
            case 'uint16_be':
                return Buffer.alloc(2);
            case 'uint16_le':
                return Buffer.alloc(2);
            case 'int32_be':
                return Buffer.alloc(4);
            case 'int32_le':
                return Buffer.alloc(4);
            case 'uint32_be':
                return Buffer.alloc(4);
            case 'uint32_le':
                return Buffer.alloc(4);
            case 'float_be':
                return Buffer.alloc(4);
            case 'float_le':
                return Buffer.alloc(4);
            case 'double_be':
                return Buffer.alloc(8);
            case 'double_le':
                return Buffer.alloc(8);
            default:
                throw new Error("Couldn't read value because of unknown type: " + handler.config.type);
        }
    }
}
exports.default = Generic;
//# sourceMappingURL=generic.js.map