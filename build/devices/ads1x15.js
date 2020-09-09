"use strict";
// this class is based on https://github.com/alphacharlie/node-ads1x15/blob/master/index.js
// probably MIT license (not explicitely mentioned, but it is based on the Adafruit Python code which is MIT)
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
// chip
var IC;
(function (IC) {
    IC[IC["ADS1015"] = 0] = "ADS1015";
    IC[IC["ADS1115"] = 1] = "ADS1115";
})(IC || (IC = {}));
// Pointer Register
var ADS1x15_REG_POINTER;
(function (ADS1x15_REG_POINTER) {
    ADS1x15_REG_POINTER[ADS1x15_REG_POINTER["MASK"] = 3] = "MASK";
    ADS1x15_REG_POINTER[ADS1x15_REG_POINTER["CONVERT"] = 0] = "CONVERT";
    ADS1x15_REG_POINTER[ADS1x15_REG_POINTER["CONFIG"] = 1] = "CONFIG";
    ADS1x15_REG_POINTER[ADS1x15_REG_POINTER["LOWTHRESH"] = 2] = "LOWTHRESH";
    ADS1x15_REG_POINTER[ADS1x15_REG_POINTER["HITHRESH"] = 3] = "HITHRESH";
})(ADS1x15_REG_POINTER || (ADS1x15_REG_POINTER = {}));
// Config Register
var ADS1x15_REG_CONFIG_OS;
(function (ADS1x15_REG_CONFIG_OS) {
    ADS1x15_REG_CONFIG_OS[ADS1x15_REG_CONFIG_OS["MASK"] = 32768] = "MASK";
    ADS1x15_REG_CONFIG_OS[ADS1x15_REG_CONFIG_OS["SINGLE"] = 32768] = "SINGLE";
    ADS1x15_REG_CONFIG_OS[ADS1x15_REG_CONFIG_OS["BUSY"] = 0] = "BUSY";
    ADS1x15_REG_CONFIG_OS[ADS1x15_REG_CONFIG_OS["NOTBUSY"] = 32768] = "NOTBUSY";
})(ADS1x15_REG_CONFIG_OS || (ADS1x15_REG_CONFIG_OS = {}));
var ADS1x15_REG_CONFIG_MUX;
(function (ADS1x15_REG_CONFIG_MUX) {
    ADS1x15_REG_CONFIG_MUX[ADS1x15_REG_CONFIG_MUX["MASK"] = 28672] = "MASK";
    ADS1x15_REG_CONFIG_MUX[ADS1x15_REG_CONFIG_MUX["DIFF_0_1"] = 0] = "DIFF_0_1";
    ADS1x15_REG_CONFIG_MUX[ADS1x15_REG_CONFIG_MUX["DIFF_0_3"] = 4096] = "DIFF_0_3";
    ADS1x15_REG_CONFIG_MUX[ADS1x15_REG_CONFIG_MUX["DIFF_1_3"] = 8192] = "DIFF_1_3";
    ADS1x15_REG_CONFIG_MUX[ADS1x15_REG_CONFIG_MUX["DIFF_2_3"] = 12288] = "DIFF_2_3";
    ADS1x15_REG_CONFIG_MUX[ADS1x15_REG_CONFIG_MUX["SINGLE_0"] = 16384] = "SINGLE_0";
    ADS1x15_REG_CONFIG_MUX[ADS1x15_REG_CONFIG_MUX["SINGLE_1"] = 20480] = "SINGLE_1";
    ADS1x15_REG_CONFIG_MUX[ADS1x15_REG_CONFIG_MUX["SINGLE_2"] = 24576] = "SINGLE_2";
    ADS1x15_REG_CONFIG_MUX[ADS1x15_REG_CONFIG_MUX["SINGLE_3"] = 28672] = "SINGLE_3";
})(ADS1x15_REG_CONFIG_MUX || (ADS1x15_REG_CONFIG_MUX = {}));
var ADS1x15_REG_CONFIG_PGA;
(function (ADS1x15_REG_CONFIG_PGA) {
    ADS1x15_REG_CONFIG_PGA[ADS1x15_REG_CONFIG_PGA["MASK"] = 3584] = "MASK";
    ADS1x15_REG_CONFIG_PGA[ADS1x15_REG_CONFIG_PGA["VAL_6_144V"] = 0] = "VAL_6_144V";
    ADS1x15_REG_CONFIG_PGA[ADS1x15_REG_CONFIG_PGA["VAL_4_096V"] = 512] = "VAL_4_096V";
    ADS1x15_REG_CONFIG_PGA[ADS1x15_REG_CONFIG_PGA["VAL_2_048V"] = 1024] = "VAL_2_048V";
    ADS1x15_REG_CONFIG_PGA[ADS1x15_REG_CONFIG_PGA["VAL_1_024V"] = 1536] = "VAL_1_024V";
    ADS1x15_REG_CONFIG_PGA[ADS1x15_REG_CONFIG_PGA["VAL_0_512V"] = 2048] = "VAL_0_512V";
    ADS1x15_REG_CONFIG_PGA[ADS1x15_REG_CONFIG_PGA["VAL_0_256V"] = 2560] = "VAL_0_256V";
})(ADS1x15_REG_CONFIG_PGA || (ADS1x15_REG_CONFIG_PGA = {}));
var ADS1x15_REG_CONFIG_MODE;
(function (ADS1x15_REG_CONFIG_MODE) {
    ADS1x15_REG_CONFIG_MODE[ADS1x15_REG_CONFIG_MODE["MASK"] = 256] = "MASK";
    ADS1x15_REG_CONFIG_MODE[ADS1x15_REG_CONFIG_MODE["CONTIN"] = 0] = "CONTIN";
    ADS1x15_REG_CONFIG_MODE[ADS1x15_REG_CONFIG_MODE["SINGLE"] = 256] = "SINGLE";
})(ADS1x15_REG_CONFIG_MODE || (ADS1x15_REG_CONFIG_MODE = {}));
var ADS1x15_REG_CONFIG_DR;
(function (ADS1x15_REG_CONFIG_DR) {
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["MASK"] = 224] = "MASK";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1015_128SPS"] = 0] = "ADS1015_128SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1015_250SPS"] = 32] = "ADS1015_250SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1015_490SPS"] = 64] = "ADS1015_490SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1015_920SPS"] = 96] = "ADS1015_920SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1015_1600SPS"] = 128] = "ADS1015_1600SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1015_2400SPS"] = 160] = "ADS1015_2400SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1015_3300SPS"] = 192] = "ADS1015_3300SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1115_8SPS"] = 0] = "ADS1115_8SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1115_16SPS"] = 32] = "ADS1115_16SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1115_32SPS"] = 64] = "ADS1115_32SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1115_64SPS"] = 96] = "ADS1115_64SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1115_128SPS"] = 128] = "ADS1115_128SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1115_250SPS"] = 160] = "ADS1115_250SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1115_475SPS"] = 192] = "ADS1115_475SPS";
    ADS1x15_REG_CONFIG_DR[ADS1x15_REG_CONFIG_DR["ADS1115_860SPS"] = 224] = "ADS1115_860SPS";
})(ADS1x15_REG_CONFIG_DR || (ADS1x15_REG_CONFIG_DR = {}));
var ADS1x15_REG_CONFIG_CMODE;
(function (ADS1x15_REG_CONFIG_CMODE) {
    ADS1x15_REG_CONFIG_CMODE[ADS1x15_REG_CONFIG_CMODE["MASK"] = 16] = "MASK";
    ADS1x15_REG_CONFIG_CMODE[ADS1x15_REG_CONFIG_CMODE["TRAD"] = 0] = "TRAD";
    ADS1x15_REG_CONFIG_CMODE[ADS1x15_REG_CONFIG_CMODE["WINDOW"] = 16] = "WINDOW";
})(ADS1x15_REG_CONFIG_CMODE || (ADS1x15_REG_CONFIG_CMODE = {}));
var ADS1x15_REG_CONFIG_CPOL;
(function (ADS1x15_REG_CONFIG_CPOL) {
    ADS1x15_REG_CONFIG_CPOL[ADS1x15_REG_CONFIG_CPOL["MASK"] = 8] = "MASK";
    ADS1x15_REG_CONFIG_CPOL[ADS1x15_REG_CONFIG_CPOL["ACTVLOW"] = 0] = "ACTVLOW";
    ADS1x15_REG_CONFIG_CPOL[ADS1x15_REG_CONFIG_CPOL["ACTVHI"] = 8] = "ACTVHI";
})(ADS1x15_REG_CONFIG_CPOL || (ADS1x15_REG_CONFIG_CPOL = {}));
var ADS1x15_REG_CONFIG_CLAT;
(function (ADS1x15_REG_CONFIG_CLAT) {
    ADS1x15_REG_CONFIG_CLAT[ADS1x15_REG_CONFIG_CLAT["MASK"] = 4] = "MASK";
    ADS1x15_REG_CONFIG_CLAT[ADS1x15_REG_CONFIG_CLAT["NONLAT"] = 0] = "NONLAT";
    ADS1x15_REG_CONFIG_CLAT[ADS1x15_REG_CONFIG_CLAT["LATCH"] = 4] = "LATCH";
})(ADS1x15_REG_CONFIG_CLAT || (ADS1x15_REG_CONFIG_CLAT = {}));
var ADS1x15_REG_CONFIG_CQUE;
(function (ADS1x15_REG_CONFIG_CQUE) {
    ADS1x15_REG_CONFIG_CQUE[ADS1x15_REG_CONFIG_CQUE["MASK"] = 3] = "MASK";
    ADS1x15_REG_CONFIG_CQUE[ADS1x15_REG_CONFIG_CQUE["CONV1"] = 0] = "CONV1";
    ADS1x15_REG_CONFIG_CQUE[ADS1x15_REG_CONFIG_CQUE["CONV2"] = 1] = "CONV2";
    ADS1x15_REG_CONFIG_CQUE[ADS1x15_REG_CONFIG_CQUE["CONV4"] = 2] = "CONV4";
    ADS1x15_REG_CONFIG_CQUE[ADS1x15_REG_CONFIG_CQUE["NONE"] = 3] = "NONE";
})(ADS1x15_REG_CONFIG_CQUE || (ADS1x15_REG_CONFIG_CQUE = {}));
// This is a javascript port of python, so use objects instead of dictionaries here
// These simplify and clean the code (avoid the abuse of if/elif/else clauses)
const spsADS1115 = {
    8: ADS1x15_REG_CONFIG_DR.ADS1115_8SPS,
    16: ADS1x15_REG_CONFIG_DR.ADS1115_16SPS,
    32: ADS1x15_REG_CONFIG_DR.ADS1115_32SPS,
    64: ADS1x15_REG_CONFIG_DR.ADS1115_64SPS,
    128: ADS1x15_REG_CONFIG_DR.ADS1115_128SPS,
    250: ADS1x15_REG_CONFIG_DR.ADS1115_250SPS,
    475: ADS1x15_REG_CONFIG_DR.ADS1115_475SPS,
    860: ADS1x15_REG_CONFIG_DR.ADS1115_860SPS,
};
const spsADS1015 = {
    128: ADS1x15_REG_CONFIG_DR.ADS1015_128SPS,
    250: ADS1x15_REG_CONFIG_DR.ADS1015_250SPS,
    490: ADS1x15_REG_CONFIG_DR.ADS1015_490SPS,
    920: ADS1x15_REG_CONFIG_DR.ADS1015_920SPS,
    1600: ADS1x15_REG_CONFIG_DR.ADS1015_1600SPS,
    2400: ADS1x15_REG_CONFIG_DR.ADS1015_2400SPS,
    3300: ADS1x15_REG_CONFIG_DR.ADS1015_3300SPS,
};
const pgaADS1x15 = {
    6144: ADS1x15_REG_CONFIG_PGA.VAL_6_144V,
    4096: ADS1x15_REG_CONFIG_PGA.VAL_4_096V,
    2048: ADS1x15_REG_CONFIG_PGA.VAL_2_048V,
    1024: ADS1x15_REG_CONFIG_PGA.VAL_1_024V,
    512: ADS1x15_REG_CONFIG_PGA.VAL_0_512V,
    256: ADS1x15_REG_CONFIG_PGA.VAL_0_256V,
};
class ADS1x15 extends device_handler_base_1.DeviceHandlerBase {
    constructor() {
        super(...arguments);
        this.pga = 6144; // set this to a sane default...
        this.busy = false;
        this.readAgain = false;
        this.muxes = {};
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
            if (this.config.kind == 1015) {
                this.ic = IC.ADS1015;
            }
            else {
                this.ic = IC.ADS1115;
            }
            let hasEnabled = false;
            for (let i = 0; i < 4; i++) {
                const channelConfig = this.config.channels[i] || { channelType: 'off', available: true };
                switch (channelConfig.channelType) {
                    case 'single':
                        this.muxes[i] = ADS1x15_REG_CONFIG_MUX.SINGLE_0 + 0x1000 * i;
                        break;
                    case 'diffTo1':
                        this.muxes[i] = ADS1x15_REG_CONFIG_MUX.DIFF_0_1;
                        break;
                    case 'diffTo3':
                        this.muxes[i] = ADS1x15_REG_CONFIG_MUX.DIFF_0_3 + 0x1000 * i;
                        break;
                    default:
                        this.muxes[i] = 0;
                        break;
                }
                if (this.muxes[i] !== 0) {
                    hasEnabled = true;
                }
                this.adapter.extendObject(`${this.hexAddress}.${i}`, {
                    type: 'state',
                    common: {
                        name: `${this.hexAddress} Channel ${i}`,
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
            yield this.readCurrentValueAsync();
            if (this.config.pollingInterval > 0) {
                this.startPolling(() => __awaiter(this, void 0, void 0, function* () { return yield this.readCurrentValueAsync(); }), 1000 * this.config.pollingInterval, 1000);
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
    readCurrentValueAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.busy) {
                this.error("Busy reading values, can't read right now!");
                this.readAgain = true;
                return;
            }
            do {
                this.busy = true;
                this.readAgain = false;
                for (let i = 0; i < 4; i++) {
                    yield this.readAdcAsync(i);
                }
            } while (this.readAgain);
        });
    }
    readAdcAsync(index) {
        return __awaiter(this, void 0, void 0, function* () {
            const channelConfig = this.config.channels[index];
            if (!channelConfig || channelConfig.channelType === 'off') {
                this.adapter.log.debug('Channel ' + index + ' disabled');
                return;
            }
            // Disable comparator, Non-latching, Alert/Rdy active low
            // traditional comparator, single-shot mode
            let config = ADS1x15_REG_CONFIG_CQUE.NONE |
                ADS1x15_REG_CONFIG_CLAT.NONLAT |
                ADS1x15_REG_CONFIG_CPOL.ACTVLOW |
                ADS1x15_REG_CONFIG_CMODE.TRAD |
                ADS1x15_REG_CONFIG_MODE.SINGLE;
            config |= this.muxes[index];
            // Set samples per second
            const spsMap = this.ic == IC.ADS1015 ? spsADS1015 : spsADS1115;
            if (spsMap.hasOwnProperty(channelConfig.samples)) {
                config |= spsMap[channelConfig.samples];
            }
            else {
                this.debug('Using default 250 SPS');
                config |= ADS1x15_REG_CONFIG_DR.ADS1015_250SPS;
            }
            // Set PGA/voltage range
            if (pgaADS1x15.hasOwnProperty(channelConfig.gain)) {
                config |= pgaADS1x15[channelConfig.gain];
            }
            else {
                this.debug('Using default PGA 6.144 V');
                config |= ADS1x15_REG_CONFIG_PGA.VAL_6_144V;
            }
            // Set 'start single-conversion' bit
            config |= ADS1x15_REG_CONFIG_OS.SINGLE;
            yield this.writeRegister(ADS1x15_REG_POINTER.CONFIG, config);
            // Wait for the ADC conversion to complete
            // The minimum delay depends on the sps: delay >= 1s/sps
            // We add 1ms to be sure
            const delay = 1000 / channelConfig.samples + 1;
            this.currentDelay = new async_1.Delay(delay);
            yield this.currentDelay.runAsnyc();
            const result = yield this.readRegister(ADS1x15_REG_POINTER.CONVERT);
            let value;
            if (this.ic == IC.ADS1015) {
                // Shift right 4 bits for the 12-bit ADS1015 and convert to V
                value = ((result >> 4) * channelConfig.gain) / 2048.0 / 1000;
            }
            else {
                // Return a V value for the ADS1115
                // (Take signed values into account as well)
                if (result > 0x7fff) {
                    value = ((result - 0xffff) * channelConfig.gain) / 32768.0 / 1000;
                }
                else {
                    value = (result * channelConfig.gain) / 32768.0 / 1000;
                }
            }
            yield this.setStateAckAsync(index, value);
        });
    }
    swap(value) {
        return ((value >> 8) & 0xff) | ((value << 8) & 0xff00);
    }
    writeRegister(register, value) {
        return __awaiter(this, void 0, void 0, function* () {
            value = this.swap(value);
            this.debug('Writing ' + shared_1.toHexString(register) + ' = ' + shared_1.toHexString(value, 4));
            yield this.writeWord(register, value);
        });
    }
    readRegister(register) {
        return __awaiter(this, void 0, void 0, function* () {
            let value = yield this.readWord(register);
            value = this.swap(value);
            this.debug('Read ' + shared_1.toHexString(register) + ' = ' + shared_1.toHexString(value, 4));
            return value;
        });
    }
    setStateAckAsync(channel, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.adapter.setStateAckAsync(this.hexAddress + '.' + channel, value);
        });
    }
}
exports.default = ADS1x15;
//# sourceMappingURL=ads1x15.js.map