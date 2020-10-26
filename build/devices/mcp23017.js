"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp230xx_base_1 = require("./mcp230xx-base");
class MCP23017 extends mcp230xx_base_1.MCP230xxBase {
    constructor(deviceConfig, adapter) {
        super(16, deviceConfig, adapter);
    }
    indexToName(index) {
        return `${index < 8 ? 'A' : 'B'}${index % 8}`;
    }
    readRegister(register) {
        return this.readWord(register * 2);
    }
    writeRegister(register, value) {
        return this.writeWord(register * 2, value);
    }
}
exports.default = MCP23017;
//# sourceMappingURL=mcp23017.js.map