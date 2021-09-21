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
exports.BigEndianDeviceHandlerBase = void 0;
const shared_1 = require("../lib/shared");
const device_handler_base_1 = require("./device-handler-base");
function swapWord(value) {
    return ((value >> 8) & 0xff) | ((value << 8) & 0xff00);
}
class BigEndianDeviceHandlerBase extends device_handler_base_1.DeviceHandlerBase {
    constructor(deviceConfig, adapter) {
        super(deviceConfig, adapter);
        this.address = deviceConfig.address;
    }
    readWord(command) {
        return __awaiter(this, void 0, void 0, function* () {
            let word = yield this.adapter.i2cBus.readWord(this.address, command);
            word = swapWord(word);
            this.silly(`readWord(${(0, shared_1.toHexString)(command)}): ${(0, shared_1.toHexString)(word, 4)}`);
            return word;
        });
    }
    writeWord(command, word) {
        return __awaiter(this, void 0, void 0, function* () {
            this.silly(`writeWord(${(0, shared_1.toHexString)(command)}, ${(0, shared_1.toHexString)(word, 4)})`);
            word = swapWord(word);
            return yield this.adapter.i2cBus.writeWord(this.address, command, word);
        });
    }
}
exports.BigEndianDeviceHandlerBase = BigEndianDeviceHandlerBase;
//# sourceMappingURL=big-endian-device-handler-base.js.map