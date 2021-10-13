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
exports.Gain = exports.Resolution = void 0;
const async_1 = require("../lib/async");
const device_handler_base_1 = require("./device-handler-base");
var Resolution;
(function (Resolution) {
    Resolution[Resolution["Bits12"] = 0] = "Bits12";
    Resolution[Resolution["Bits14"] = 1] = "Bits14";
    Resolution[Resolution["Bits16"] = 2] = "Bits16";
    Resolution[Resolution["Bits18"] = 3] = "Bits18";
})(Resolution = exports.Resolution || (exports.Resolution = {}));
var Gain;
(function (Gain) {
    Gain[Gain["X1"] = 0] = "X1";
    Gain[Gain["X2"] = 1] = "X2";
    Gain[Gain["X4"] = 2] = "X4";
    Gain[Gain["X8"] = 3] = "X8";
})(Gain = exports.Gain || (exports.Gain = {}));
class MCP342x extends device_handler_base_1.DeviceHandlerBase {
    constructor(deviceConfig, adapter) {
        super(deviceConfig, adapter);
        const kind = parseInt(this.name.substring(3)); // 3422, 3423, 3424, 3426, 3427 or 3428
        this.channelCount = kind === 3424 || kind === 3428 ? 4 : 2;
        this.has18Bit = kind < 3426;
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
            let hasEnabled = false;
            for (let i = 0; i < this.channelCount; i++) {
                const channelConfig = this.config.channels[i] || { enabled: false };
                if (channelConfig.enabled) {
                    hasEnabled = true;
                }
                yield this.adapter.extendObjectAsync(`${this.hexAddress}.${i + 1}`, {
                    type: 'state',
                    common: {
                        name: `${this.hexAddress} Channel ${i + 1}`,
                        read: true,
                        write: false,
                        type: 'number',
                        role: 'value.voltage',
                        unit: 'V',
                    },
                    native: channelConfig,
                });
            }
            if (!hasEnabled) {
                return;
            }
            yield this.readCurrentValuesAsync();
            if (this.config.pollingInterval) {
                this.startPolling(() => __awaiter(this, void 0, void 0, function* () { return yield this.readCurrentValuesAsync(); }), this.config.pollingInterval, 100);
            }
        });
    }
    stopAsync() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Stopping');
            this.stopPolling();
            (_a = this.currentDelay) === null || _a === void 0 ? void 0 : _a.cancel();
        });
    }
    readCurrentValuesAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            for (let index = 0; index < this.channelCount; index++) {
                const config = this.config.channels[index];
                if (!(config === null || config === void 0 ? void 0 : config.enabled)) {
                    continue;
                }
                const writeVal = 0x80 | (index << 5) | (config.resolution << 2) | config.gain;
                yield this.sendByte(writeVal);
                this.currentDelay = new async_1.Delay(this.getDelay(config.resolution));
                yield this.currentDelay.runAsnyc();
                const buffer = Buffer.alloc(config.resolution === Resolution.Bits18 ? 4 : 3);
                yield this.i2cRead(buffer.length, buffer);
                const status = buffer[buffer.length - 1];
                if (status & 0x80) {
                    this.warn(`Couldn't read channel ${index}, not ready`);
                    continue;
                }
                let value;
                if (config.resolution === Resolution.Bits18) {
                    value = buffer.readInt32BE() >> 8; // kind of like readInt24BE()
                }
                else {
                    value = buffer.readInt16BE();
                }
                const lsb = this.getLsb(config.resolution);
                const pga = 1 << config.gain;
                this.setStateAck(index + 1, (value * lsb) / pga);
            }
        });
    }
    getDelay(resolution) {
        switch (resolution) {
            case Resolution.Bits18:
                return 267; // 3.75 SPS
            case Resolution.Bits16:
                return 67; // 15 SPS
            case Resolution.Bits14:
                return 17; // 60 SPS
            case Resolution.Bits12:
                return 5; // 240 SPS
            default:
                throw new Error(`Unsupported resolution: ${resolution} bits`);
        }
    }
    getLsb(resolution) {
        switch (resolution) {
            case Resolution.Bits18:
                return 15.625 / 1000000; // 15.625 μV
            case Resolution.Bits16:
                return 62.5 / 1000000; // 62.5 μV
            case Resolution.Bits14:
                return 250 / 1000000; // 250 μV
            case Resolution.Bits12:
                return 1 / 1000; // 1 mV
            default:
                throw new Error(`Unsupported resolution: ${resolution} bits`);
        }
    }
}
exports.default = MCP342x;
//# sourceMappingURL=mcp342x.js.map