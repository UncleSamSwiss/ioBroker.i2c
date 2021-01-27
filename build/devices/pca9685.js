"use strict";
// Code in this file is in parts based on:
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
const device_handler_base_1 = require("./device-handler-base");
var Register;
(function (Register) {
    Register[Register["MODE1"] = 0] = "MODE1";
    Register[Register["MODE2"] = 1] = "MODE2";
    Register[Register["SUBADR1"] = 2] = "SUBADR1";
    Register[Register["SUBADR2"] = 3] = "SUBADR2";
    Register[Register["SUBADR3"] = 4] = "SUBADR3";
    Register[Register["PRESCALE"] = 254] = "PRESCALE";
    Register[Register["LED0_ON_L"] = 6] = "LED0_ON_L";
    Register[Register["LED0_ON_H"] = 7] = "LED0_ON_H";
    Register[Register["LED0_OFF_L"] = 8] = "LED0_OFF_L";
    Register[Register["LED0_OFF_H"] = 9] = "LED0_OFF_H";
    Register[Register["ALL_LED_ON_L"] = 250] = "ALL_LED_ON_L";
    Register[Register["ALL_LED_ON_H"] = 251] = "ALL_LED_ON_H";
    Register[Register["ALL_LED_OFF_L"] = 252] = "ALL_LED_OFF_L";
    Register[Register["ALL_LED_OFF_H"] = 253] = "ALL_LED_OFF_H";
})(Register || (Register = {}));
var Mode;
(function (Mode) {
    Mode[Mode["RESTART"] = 128] = "RESTART";
    Mode[Mode["SLEEP"] = 16] = "SLEEP";
    Mode[Mode["ALLCALL"] = 1] = "ALLCALL";
    Mode[Mode["INVRT"] = 16] = "INVRT";
    Mode[Mode["OUTDRV"] = 4] = "OUTDRV";
    Mode[Mode["EXTCLK"] = 64] = "EXTCLK";
})(Mode || (Mode = {}));
class PCA9685 extends device_handler_base_1.DeviceHandlerBase {
    startAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Starting');
            yield this.adapter.extendObjectAsync(this.hexAddress, {
                type: 'device',
                common: {
                    name: this.hexAddress + ' (' + this.name + ')',
                    role: 'value',
                },
                native: this.config,
            });
            for (let i = 0; i < 16; i++) {
                let value = this.getStateValue(i);
                if (value === undefined) {
                    value = 0;
                    yield this.setStateAckAsync(i, value);
                }
                yield this.adapter.extendObjectAsync(this.hexAddress + '.' + i, {
                    type: 'state',
                    common: {
                        name: this.hexAddress + ' Channel ' + i,
                        read: true,
                        write: true,
                        type: 'number',
                        role: 'level.dimmer',
                        min: 0,
                        max: 4095,
                    },
                });
            }
            yield this.initializeDeviceAsync();
            for (let i = 0; i < 16; i++) {
                this.addOutputListener(i);
            }
        });
    }
    stopAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Stopping');
            if (this.currentDelay) {
                this.currentDelay.cancel();
            }
        });
    }
    initializeDeviceAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Initializing PCA9865');
            yield this.restartDeviceAsync();
            yield this.setPwmFrequencyAsync(this.config.frequency);
            for (let i = 0; i < 16; i++) {
                yield this.setPwmValueAsync(i, this.getStateValue(i) || 0);
            }
        });
    }
    restartDeviceAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.writeByte(Register.MODE2, Mode.OUTDRV);
            yield this.writeByte(Register.MODE1, Mode.ALLCALL);
            yield this.delay(2);
            let mode1 = yield this.readByte(Register.MODE1);
            mode1 = mode1 & ~Mode.SLEEP;
            yield this.writeByte(Register.MODE1, mode1);
            yield this.delay(2);
        });
    }
    setPwmFrequencyAsync(frequencyHz) {
        return __awaiter(this, void 0, void 0, function* () {
            if (isNaN(frequencyHz)) {
                this.error('Cannot set PWM frequency to ' + frequencyHz);
                return;
            }
            if (frequencyHz > 1526)
                frequencyHz = 1526;
            else if (frequencyHz < 24)
                frequencyHz = 24;
            let prescaleValue = 25000000.0; // 25MHz
            prescaleValue /= 4096.0; // 12-bit
            prescaleValue /= frequencyHz;
            prescaleValue -= 1.0;
            this.debug('Setting PWM frequency to ' + frequencyHz + ' Hz');
            this.debug('Estimated pre-scale: ' + prescaleValue + ' Hz');
            const prescale = Math.floor(prescaleValue + 0.5);
            this.debug('Final pre-scale: ' + prescale);
            const oldMode = yield this.readByte(Register.MODE1);
            const newMode = (oldMode & 0x7f) | Mode.SLEEP;
            this.debug('Old mode: ' + oldMode);
            this.debug('New mode: ' + newMode);
            yield this.writeByte(Register.MODE1, newMode); // go to sleep
            yield this.delay(2);
            yield this.writeByte(Register.PRESCALE, prescale);
            yield this.writeByte(Register.MODE1, oldMode);
            yield this.delay(2);
            yield this.writeByte(Register.MODE1, oldMode | 0x80);
            yield this.delay(2);
        });
    }
    setPwmValueAsync(channel, pwmValue) {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Received new PWM value ' + pwmValue + ' for channel ' + channel);
            if (isNaN(channel) || isNaN(pwmValue)) {
                this.error('Cannot set PWM value ' + pwmValue + ' for channel ' + channel);
                return;
            }
            if (channel < 0)
                channel = 0;
            else if (channel > 15)
                channel = 15;
            let ledOn = 0;
            let ledOff = pwmValue;
            if (pwmValue >= 4095) {
                ledOn = 4096;
                ledOff = 0;
                pwmValue = 4095;
            }
            else if (pwmValue == undefined || pwmValue <= 0) {
                ledOn = 0;
                ledOff = 4096;
                pwmValue = 0;
            }
            try {
                if (yield this.deviceNotInitializedAsync()) {
                    yield this.initializeDeviceAsync();
                }
                yield this.writeByte(Register.LED0_ON_L + 4 * channel, ledOn & 0xff);
                yield this.writeByte(Register.LED0_ON_H + 4 * channel, ledOn >> 8);
                yield this.writeByte(Register.LED0_OFF_L + 4 * channel, ledOff & 0xff);
                yield this.writeByte(Register.LED0_OFF_H + 4 * channel, ledOff >> 8);
            }
            catch (e) {
                this.error("Couldn't send current PWM value: " + e);
            }
            this.debug(`Writing values for channel ${channel}: on=${ledOn} | off=${ledOff} (PWM ${pwmValue})`);
            yield this.setStateAckAsync(channel, pwmValue);
        });
    }
    deviceNotInitializedAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.readByte(Register.MODE1)) != Mode.ALLCALL;
        });
    }
    addOutputListener(channel) {
        this.adapter.addStateChangeListener(this.hexAddress + '.' + channel, (_oldValue, newValue) => __awaiter(this, void 0, void 0, function* () { return yield this.setPwmValueAsync(channel, newValue); }));
    }
    delay(milliseconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const delay = new async_1.Delay(milliseconds);
            this.currentDelay = delay;
            yield delay.runAsnyc();
        });
    }
}
exports.default = PCA9685;
//# sourceMappingURL=pca9685.js.map