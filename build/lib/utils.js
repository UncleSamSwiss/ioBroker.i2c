"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uint20 = exports.uint16 = exports.int16 = exports.round = void 0;
function round(value, multiplicator) {
    multiplicator = multiplicator || 10;
    return Math.round(value * multiplicator) / multiplicator;
}
exports.round = round;
function int16(msb, lsb) {
    const val = uint16(msb, lsb);
    return val > 32767 ? val - 65536 : val;
}
exports.int16 = int16;
function uint16(msb, lsb) {
    return (msb << 8) | lsb;
}
exports.uint16 = uint16;
function uint20(msb, lsb, xlsb) {
    return ((((msb << 8) | lsb) << 8) | xlsb) >> 4;
}
exports.uint20 = uint20;
//# sourceMappingURL=utils.js.map