"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHexString = void 0;
function toHexString(value) {
    // Convert a number to a hex string "0xXX"
    const str = value.toString(16);
    return '0x' + (str.length == 1 ? '0' + str : str).toUpperCase();
}
exports.toHexString = toHexString;
//# sourceMappingURL=shared.js.map