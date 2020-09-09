"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp230xx_base_1 = require("./mcp230xx-base");
class MCP23008 extends mcp230xx_base_1.MCP230xxBase {
    constructor(deviceConfig, adapter) {
        super(8, deviceConfig, adapter);
    }
    indexToName(index) {
        return index.toString();
    }
    readRegister(register) {
        return this.readByte(register);
    }
    writeRegister(register, value) {
        return this.writeByte(register, value);
    }
}
exports.default = MCP23008;
//# sourceMappingURL=mcp23008.js.map