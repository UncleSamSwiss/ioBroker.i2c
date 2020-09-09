"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHexString = void 0;
function toHexString(value, length) {
    length = length || 2;
    // Convert a number to a hex string "0xXX"
    let str = value.toString(16).toUpperCase();
    while (str.length < length) {
        str = '0' + str;
    }
    return '0x' + str;
}
exports.toHexString = toHexString;
//# sourceMappingURL=shared.js.map