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
exports.SeesawHandlerBase = exports.SEESAW_HW_ID_CODE = exports.SeesawTouch = exports.SeesawStatus = exports.SeesawBase = void 0;
const async_1 = require("../lib/async");
const device_handler_base_1 = require("./device-handler-base");
var SeesawBase;
(function (SeesawBase) {
    SeesawBase[SeesawBase["STATUS"] = 0] = "STATUS";
    SeesawBase[SeesawBase["GPIO"] = 1] = "GPIO";
    SeesawBase[SeesawBase["SERCOM0"] = 2] = "SERCOM0";
    SeesawBase[SeesawBase["TIMER"] = 8] = "TIMER";
    SeesawBase[SeesawBase["ADC"] = 9] = "ADC";
    SeesawBase[SeesawBase["DAC"] = 10] = "DAC";
    SeesawBase[SeesawBase["INTERRUPT"] = 11] = "INTERRUPT";
    SeesawBase[SeesawBase["DAP"] = 12] = "DAP";
    SeesawBase[SeesawBase["EEPROM"] = 13] = "EEPROM";
    SeesawBase[SeesawBase["NEOPIXEL"] = 14] = "NEOPIXEL";
    SeesawBase[SeesawBase["TOUCH"] = 15] = "TOUCH";
    SeesawBase[SeesawBase["KEYPAD"] = 16] = "KEYPAD";
    SeesawBase[SeesawBase["ENCODER"] = 17] = "ENCODER";
})(SeesawBase = exports.SeesawBase || (exports.SeesawBase = {}));
var SeesawStatus;
(function (SeesawStatus) {
    SeesawStatus[SeesawStatus["HW_ID"] = 1] = "HW_ID";
    SeesawStatus[SeesawStatus["VERSION"] = 2] = "VERSION";
    SeesawStatus[SeesawStatus["OPTIONS"] = 3] = "OPTIONS";
    SeesawStatus[SeesawStatus["TEMP"] = 4] = "TEMP";
    SeesawStatus[SeesawStatus["SWRST"] = 127] = "SWRST";
})(SeesawStatus = exports.SeesawStatus || (exports.SeesawStatus = {}));
var SeesawTouch;
(function (SeesawTouch) {
    SeesawTouch[SeesawTouch["CHANNEL_OFFSET"] = 16] = "CHANNEL_OFFSET";
})(SeesawTouch = exports.SeesawTouch || (exports.SeesawTouch = {}));
exports.SEESAW_HW_ID_CODE = 0x55;
/**
 * Naming in this class is as close as possible to
 * https://github.com/adafruit/Adafruit_Seesaw/blob/master/Adafruit_seesaw.cpp
 */
class SeesawHandlerBase extends device_handler_base_1.DeviceHandlerBase {
    /**
     * Start the seesaw.
     * This should be called when your sketch is connecting to the seesaw.
     * @param reset pass true to reset the seesaw on startup. Defaults to true.
     */
    begin(reset) {
        return __awaiter(this, void 0, void 0, function* () {
            if (reset !== false) {
                yield this.SWReset();
                yield this.delay(500);
            }
            const c = yield this.read8(SeesawBase.STATUS, SeesawStatus.HW_ID);
            if (c != exports.SEESAW_HW_ID_CODE) {
                return false;
            }
            return true;
        });
    }
    /**
     * Perform a software reset.
     * This resets all seesaw registers to their default values.
     */
    SWReset() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.write8(SeesawBase.STATUS, SeesawStatus.SWRST, 0xff);
        });
    }
    /**
     * Read the temperature of the seesaw board in degrees Celsius.
     * @return Temperature in degrees Celsius as a floating point value.
     */
    getTemp() {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = Buffer.alloc(4);
            yield this.read(SeesawBase.STATUS, SeesawStatus.TEMP, buffer, 1000);
            const ret = buffer.readUInt32BE();
            return (1.0 / (1 << 16)) * ret;
        });
    }
    /**
     * Read the analog value on an capacitive touch-enabled pin.
     * @param pin the number of the pin to read.
     * @returns the analog value. This is an integer between 0 and 1023.
     */
    touchRead(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = Buffer.alloc(2);
            let ret;
            do {
                yield this.delay(1);
                yield this.read(SeesawBase.TOUCH, SeesawTouch.CHANNEL_OFFSET + pin, buffer, 1000);
                ret = buffer.readUInt16BE();
            } while (ret == 65535);
            return ret;
        });
    }
    /**
     * Write 1 byte to the specified seesaw register.
     * @param regHigh the module address register
     * @param regLow the function address register
     * @param value value the value between 0 and 255 to write
     */
    write8(regHigh, regLow, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = Buffer.alloc(1);
            buffer[0] = value;
            yield this.write(regHigh, regLow, buffer);
        });
    }
    /**
     * Read 1 byte from the specified seesaw register.
     * @param regHigh the module address register
     * @param regLow the function address register
     * @param delay a number of microseconds to delay before reading
     * out the data. Different delay values may be necessary to ensure the seesaw
     * chip has time to process the requested data. Defaults to 125.
     */
    read8(regHigh, regLow, delay) {
        return __awaiter(this, void 0, void 0, function* () {
            const ret = Buffer.alloc(1);
            yield this.read(regHigh, regLow, ret, delay);
            return ret[0];
        });
    }
    read(regHigh, regLow, buffer, delay) {
        return __awaiter(this, void 0, void 0, function* () {
            const header = Buffer.alloc(2);
            header[0] = regHigh;
            header[1] = regLow;
            yield this.i2cWrite(header.length, header);
            yield this.delayMicroseconds(delay || 125);
            yield this.i2cRead(buffer.length, buffer);
        });
    }
    write(regHigh, regLow, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const header = Buffer.alloc(2);
            header[0] = regHigh;
            header[1] = regLow;
            const all = Buffer.concat([header, buffer]);
            yield this.i2cWrite(all.length, all);
        });
    }
    /**
     * Delays execution.
     * @param delay The delay in microseconds.
     */
    delayMicroseconds(delay) {
        return __awaiter(this, void 0, void 0, function* () {
            // not a beauty, but that's the easiest way to get microsecond delays
            yield this.delay(delay / 1000);
        });
    }
    /**
     * Delays execution.
     * @param delay The delay in milliseconds.
     */
    delay(delay) {
        return __awaiter(this, void 0, void 0, function* () {
            yield new async_1.Delay(Math.max(1, delay)).runAsnyc();
        });
    }
}
exports.SeesawHandlerBase = SeesawHandlerBase;
//# sourceMappingURL=seesaw-handler-base.js.map