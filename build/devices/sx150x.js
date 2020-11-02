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
const shared_1 = require("../lib/shared");
const big_endian_device_handler_base_1 = require("./big-endian-device-handler-base");
class SX150x extends big_endian_device_handler_base_1.BigEndianDeviceHandlerBase {
    constructor(deviceConfig, adapter) {
        super(deviceConfig, adapter);
        this.writeValue = 0;
        this.readValue = 0;
        this.registers = this.loadRegisters();
        if (this.name == 'SX1509') {
            this.writeRegister = this.writeWord;
            this.readRegister = this.readWord;
        }
        else {
            this.writeRegister = this.writeByte;
            this.readRegister = this.readByte;
        }
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
            const keypadId = `${this.hexAddress}.key`;
            if (this.config.keypad.rowCount > 0 && this.registers.KeyData) {
                this.adapter.extendObject(keypadId, {
                    type: 'state',
                    common: {
                        name: `${this.hexAddress} Pressed Key`,
                        read: true,
                        write: false,
                        type: 'string',
                        role: 'text',
                    },
                });
            }
            else {
                this.adapter.delObject(keypadId);
            }
            let hasInput = false;
            let hasOuput = false;
            for (let i = 0; i < this.config.pins.length; i++) {
                const pinConfig = this.config.pins[i];
                const id = `${this.hexAddress}.${i}`;
                let outputState = undefined;
                switch (pinConfig.mode) {
                    case 'input':
                        hasInput = true;
                        this.adapter.extendObject(id, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} Input ${i}`,
                                read: true,
                                write: false,
                                type: 'boolean',
                                role: 'indicator',
                            },
                            native: pinConfig,
                        });
                        break;
                    case 'output':
                        outputState = i;
                        this.addOutputListener(i);
                        this.adapter.extendObject(id, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} Output ${i}`,
                                read: false,
                                write: true,
                                type: 'boolean',
                                role: 'switch',
                            },
                            native: pinConfig,
                        });
                        break;
                    case 'led-static':
                    case 'led-single':
                    case 'led-blink':
                        outputState = i;
                        this.addOutputListener(i);
                        this.adapter.extendObject(id, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} LED ${i}`,
                                read: false,
                                write: true,
                                type: 'boolean',
                                role: 'switch',
                            },
                            native: pinConfig,
                        });
                        break;
                    case 'led-channel':
                        this.adapter.extendObject(id, {
                            type: 'channel',
                            common: {
                                name: `${this.hexAddress} LED ${i}`,
                            },
                            native: pinConfig,
                        });
                        outputState = `${id}.on`;
                        this.addOutputListener(i, `${id}.on`);
                        this.adapter.extendObject(`${id}.on`, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} LED ${i} ON`,
                                read: false,
                                write: true,
                                type: 'boolean',
                                role: 'switch',
                            },
                            native: pinConfig,
                        });
                        const pinRegister = this.registers.Pins[i];
                        if (pinRegister.TOn) {
                            this.addLedLevelListener(i, 'timeOn');
                            this.adapter.extendObject(`${id}.timeOn`, {
                                type: 'state',
                                common: {
                                    name: `${this.hexAddress} LED ${i} ON Time`,
                                    read: false,
                                    write: true,
                                    type: 'number',
                                    role: 'level',
                                    min: 0,
                                    max: 31,
                                },
                            });
                        }
                        this.addLedLevelListener(i, 'intensityOn');
                        this.adapter.extendObject(`${id}.intensityOn`, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} LED ${i} ON Intensity`,
                                read: false,
                                write: true,
                                type: 'number',
                                role: 'level',
                                min: 0,
                                max: 255,
                            },
                        });
                        if (pinRegister.Off) {
                            this.addLedLevelListener(i, 'timeOff');
                            this.adapter.extendObject(`${id}.timeOff`, {
                                type: 'state',
                                common: {
                                    name: `${this.hexAddress} LED ${i} OFF Time`,
                                    read: false,
                                    write: true,
                                    type: 'number',
                                    role: 'level',
                                    min: 0,
                                    max: 31,
                                },
                            });
                            this.addLedLevelListener(i, 'intensityOff');
                            this.adapter.extendObject(`${id}.intensityOff`, {
                                type: 'state',
                                common: {
                                    name: `${this.hexAddress} LED ${i} OFF Intensity`,
                                    read: false,
                                    write: true,
                                    type: 'number',
                                    role: 'level',
                                    min: 0,
                                    max: 7,
                                },
                            });
                        }
                        if (pinRegister.TRise) {
                            this.addLedLevelListener(i, 'timeRaise');
                            this.adapter.extendObject(`${id}.timeRaise`, {
                                type: 'state',
                                common: {
                                    name: `${this.hexAddress} LED ${i} Fade-in Time`,
                                    read: false,
                                    write: true,
                                    type: 'number',
                                    role: 'level',
                                    min: 0,
                                    max: 31,
                                },
                            });
                            this.addLedLevelListener(i, 'timeFall');
                            this.adapter.extendObject(`${id}.timeFall`, {
                                type: 'state',
                                common: {
                                    name: `${this.hexAddress} LED ${i} Fade-out Time`,
                                    read: false,
                                    write: true,
                                    type: 'number',
                                    role: 'level',
                                    min: 0,
                                    max: 31,
                                },
                            });
                        }
                        break;
                    case 'keypad':
                        hasInput = true;
                    // fall through!
                    default:
                        this.adapter.delObject(id);
                        break;
                }
                if (outputState !== undefined) {
                    hasOuput = true;
                    let value = this.getStateValue(outputState);
                    if (value === undefined) {
                        value = false;
                        yield this.setStateAckAsync(outputState, value);
                    }
                    if (value) {
                        this.writeValue |= 1 << i;
                    }
                }
            }
            yield this.configureDeviceAsync();
            if (hasOuput) {
                yield this.sendCurrentValuesAsync();
            }
            if (!hasInput) {
                return;
            }
            yield this.readCurrentValuesAsync(true);
            if (this.config.pollingInterval > 0) {
                this.startPolling(() => __awaiter(this, void 0, void 0, function* () { return yield this.readCurrentValuesAsync(false); }), this.config.pollingInterval, 50);
            }
            if (this.config.interrupt) {
                try {
                    // check if interrupt object exists
                    yield this.adapter.getObjectAsync(this.config.interrupt);
                    // subscribe to the object and add change listener
                    this.adapter.addForeignStateChangeListener(this.config.interrupt, (_value) => __awaiter(this, void 0, void 0, function* () {
                        this.debug('Interrupt detected');
                        yield this.readCurrentValuesAsync(false);
                    }));
                    this.debug('Interrupt enabled');
                }
                catch (error) {
                    this.error(`Interrupt object ${this.config.interrupt} not found!`);
                }
            }
        });
    }
    stopAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Stopping');
            this.stopPolling();
        });
    }
    configureDeviceAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            const bankSize = this.config.pins.length / 2;
            // reset the device
            yield this.writeByte(this.registers.Reset, 0x12);
            yield this.writeByte(this.registers.Reset, 0x34);
            // configure registers
            yield this.writePinBitmapAsync(this.registers.InputDisable, (p) => p.mode != 'input' && p.mode != 'keypad');
            yield this.writePinBitmapAsync(this.registers.PullUp, (p) => (p.mode == 'input' || p.mode == 'output') && p.resistor == 'up');
            yield this.writePinBitmapAsync(this.registers.PullDown, (p) => (p.mode == 'input' || p.mode == 'output') && p.resistor == 'down');
            yield this.writePinBitmapAsync(this.registers.OpenDrain, (p) => p.mode.startsWith('led-') || (p.mode == 'output' && p.openDrain));
            yield this.writePinBitmapAsync(this.registers.Polarity, (p) => p.invert);
            yield this.writePinBitmapAsync(this.registers.Dir, (p, i) => p.mode == 'input' || (p.mode == 'keypad' && i >= bankSize));
            yield this.writePinBitmapAsync(this.registers.InterruptMask, // this is inverted: 0 : An event on this IO will trigger an interrupt
            (p) => p.mode != 'input' || p.interrupt == 'none');
            yield this.writeSenseAsync();
            yield this.writeLevelShifterAsync();
            yield this.writeClockAsync();
            yield this.writeMiscAsync();
            yield this.writePinBitmapAsync(this.registers.LEDDriverEnable, (p) => p.mode.startsWith('led-'));
            yield this.writeByte(this.registers.DebounceConfig, this.config.debounceTime);
            yield this.writePinBitmapAsync(this.registers.DebounceEnable, (p, i) => (p.mode == 'input' && p.debounce) || (p.mode == 'keypad' && i >= bankSize));
            yield this.writeKeyConfigAsync();
            for (let i = 0; i < this.config.pins.length; i++) {
                const pin = this.config.pins[i];
                let led;
                if (pin.mode == 'led-channel') {
                    led = this.getLedChannelValues(i);
                }
                else {
                    led = Object.assign({}, pin.led);
                    if (pin.mode == 'led-static') {
                        led.timeOn = 0;
                    }
                    if (pin.mode != 'led-blink') {
                        led.timeOff = 0;
                    }
                }
                yield this.writeLedConfigAsync(i, led);
            }
            if (this.registers.HighInput) {
                yield this.writePinBitmapAsync(this.registers.HighInput, (p) => p.mode == 'input' && p.highInput);
            }
        });
    }
    writePinBitmapAsync(register, predicate) {
        return __awaiter(this, void 0, void 0, function* () {
            const bitmap = this.config.pins.map(predicate);
            let value = 0;
            for (let i = 0; i < bitmap.length; i++) {
                if (bitmap[i]) {
                    value |= 1 << i;
                }
            }
            yield this.writeRegister(register, value);
        });
    }
    writeSenseAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = Buffer.alloc(this.config.pins.length / 4);
            for (let i = 0; i < this.config.pins.length; i++) {
                const pin = this.config.pins[i];
                if (pin.mode != 'input') {
                    continue;
                }
                let value = 0;
                switch (pin.interrupt) {
                    case 'raising':
                        value = 1;
                        break;
                    case 'falling':
                        value = 2;
                        break;
                    case 'both':
                        value = 3;
                        break;
                }
                const offset = buffer.length - (i >> 2);
                buffer[offset] = buffer[offset] | (value << ((i % 4) * 2));
            }
            yield this.writeI2cBlock(this.registers.Sense, buffer.length, buffer);
        });
    }
    writeLevelShifterAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.registers.LevelShifter) {
                return;
            }
            let value = 0;
            for (let i = 0; i < this.config.pins.length / 2; i++) {
                const pin = this.config.pins[i];
                if (pin.mode != 'level-shifter') {
                    continue;
                }
                switch (this.config.pins[i].levelShifterMode) {
                    case 'AtoB':
                        value |= 1 << (i * 2);
                        break;
                    case 'BtoA':
                        value |= 2 << (i * 2);
                        break;
                }
            }
            yield this.writeRegister(this.registers.LevelShifter, value);
        });
    }
    writeClockAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            let value = 0;
            const pins = this.config.pins;
            if (pins.find((p) => p.mode.startsWith('led-') || p.debounce) || this.config.keypad.rowCount > 0) {
                // OSC is required
                if (this.config.oscExternal) {
                    value |= 0x20;
                }
                else if (this.config.oscFrequency > 0) {
                    value |= 0x50 | this.config.oscFrequency;
                }
                else {
                    value |= 0x40;
                }
            }
            yield this.writeByte(this.registers.Clock, value);
        });
    }
    writeMiscAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            let value = 0;
            if (this.config.ledLog.length > 1 && this.config.ledLog[1]) {
                value |= 0x80;
            }
            if (this.config.pins.find((p) => p.mode.startsWith('led-'))) {
                value |= this.config.ledFrequency << 4;
            }
            if (this.config.ledLog[0]) {
                value |= 0x08;
            }
            yield this.writeByte(this.registers.Misc, value);
        });
    }
    writeKeyConfigAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.registers.KeyConfig) {
                return;
            }
            const keypad = this.config.keypad;
            let value = 0;
            if (keypad.rowCount > 0) {
                if (this.config.pins.length == 8) {
                    // SX1508
                    value |= keypad.rowCount << 5;
                    value |= keypad.columnCount << 3;
                    value |= keypad.scanTime;
                }
                else {
                    // SX1509
                    value |= keypad.autoSleep << 12;
                    value |= keypad.scanTime << 8;
                    value |= keypad.rowCount << 3;
                    value |= keypad.columnCount;
                }
            }
            yield this.writeRegister(this.registers.KeyConfig, value);
        });
    }
    writeLedConfigAsync(index, led) {
        return __awaiter(this, void 0, void 0, function* () {
            const pinRegisters = this.registers.Pins[index];
            if (pinRegisters.TOn) {
                yield this.writeByte(pinRegisters.TOn, led.timeOn);
            }
            yield this.writeByte(pinRegisters.IOn, led.intensityOn);
            if (pinRegisters.Off) {
                let value = 0;
                value |= led.timeOff << 3;
                value |= led.intensityOff;
                yield this.writeByte(pinRegisters.Off, value);
            }
            if (pinRegisters.TRise && pinRegisters.TFall) {
                yield this.writeByte(pinRegisters.TRise, led.timeRaise);
                yield this.writeByte(pinRegisters.TFall, led.timeFall);
            }
        });
    }
    sendCurrentValuesAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Sending ' + shared_1.toHexString(this.writeValue, this.config.pins.length / 4));
            try {
                yield this.writeRegister(this.registers.Data, this.writeValue);
            }
            catch (e) {
                this.error("Couldn't send current value: " + e);
            }
        });
    }
    readCurrentValuesAsync(force) {
        return __awaiter(this, void 0, void 0, function* () {
            const oldValue = this.readValue;
            try {
                this.readValue = yield this.readRegister(this.registers.Data);
            }
            catch (e) {
                this.error("Couldn't read current data: " + e);
                return;
            }
            if (oldValue != this.readValue || force) {
                this.debug('Read data ' + shared_1.toHexString(this.readValue, this.config.pins.length / 4));
                for (let i = 0; i < this.config.pins.length; i++) {
                    const mask = 1 << i;
                    if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].mode == 'input') {
                        const value = (this.readValue & mask) > 0;
                        yield this.setStateAckAsync(i, value);
                    }
                }
            }
            if (!this.registers.KeyData || this.config.keypad.rowCount === 0) {
                return;
            }
            let keyData = 0;
            try {
                keyData = yield this.readRegister(this.registers.KeyData);
            }
            catch (e) {
                this.error("Couldn't read key data: " + e);
                return;
            }
            this.debug('Read key data ' + shared_1.toHexString(keyData, this.config.pins.length / 4));
            const bankSize = this.config.pins.length / 2;
            let row = -1;
            let col = -1;
            for (let i = 0; i < this.config.pins.length; i++) {
                const mask = 1 << i;
                if (this.config.pins[i].mode == 'keypad' && (keyData & mask) === 0) {
                    if (i < bankSize) {
                        row = i;
                    }
                    else {
                        col = i;
                    }
                }
            }
            if (row < 0 || col < 0) {
                return;
            }
            const keyValue = this.config.keypad.keyValues[row][col];
            this.debug(`Decoded key [${row},${col}] = "${keyValue}"`);
            yield this.setStateAckAsync(`${this.hexAddress}.key`, keyValue);
        });
    }
    addOutputListener(pin, id) {
        this.adapter.addStateChangeListener(id || this.hexAddress + '.' + pin, (_oldValue, newValue) => __awaiter(this, void 0, void 0, function* () { return yield this.changeOutputAsync(pin, newValue); }));
    }
    changeOutputAsync(pin, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const mask = 1 << pin;
            const oldValue = this.writeValue;
            if (value) {
                this.writeValue &= ~mask;
            }
            else {
                this.writeValue |= mask;
            }
            if (this.writeValue == oldValue) {
                return;
            }
            yield this.sendCurrentValuesAsync();
            yield this.setStateAckAsync(pin, value);
        });
    }
    addLedLevelListener(pin, type) {
        this.adapter.addStateChangeListener(`${this.hexAddress}.${pin}.${type}`, (_oldValue, newValue) => __awaiter(this, void 0, void 0, function* () { return yield this.changeLedLevelAsync(pin, type, newValue); }));
    }
    changeLedLevelAsync(pin, type, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const led = this.getLedChannelValues(pin);
            led[type] = value;
            try {
                yield this.writeLedConfigAsync(pin, led);
                yield this.setStateAckAsync(`${pin}.${type}`, value);
            }
            catch (e) {
                this.error("Couldn't write LED config: " + e);
            }
        });
    }
    getLedChannelValues(index) {
        return {
            timeOn: this.getStateValue(`${index}.timeOn`) || 0,
            intensityOn: this.getStateValue(`${index}.intensityOn`) || 0,
            timeOff: this.getStateValue(`${index}.timeOff`) || 0,
            intensityOff: this.getStateValue(`${index}.intensityOff`) || 0,
            timeRaise: this.getStateValue(`${index}.timeRaise`) || 0,
            timeFall: this.getStateValue(`${index}.timeFall`) || 0,
        };
    }
    loadRegisters() {
        let registers;
        let pinRegister;
        switch (this.name) {
            case 'SX1507':
                registers = {
                    InputDisable: 0x00,
                    LongSlew: 0x01,
                    LowDrive: 0x02,
                    PullUp: 0x03,
                    PullDown: 0x04,
                    OpenDrain: 0x05,
                    Polarity: 0x06,
                    Dir: 0x07,
                    Data: 0x08,
                    InterruptMask: 0x09,
                    Sense: 0x0a,
                    InterruptSource: 0x0b,
                    EventStatus: 0x0c,
                    Clock: 0x0d,
                    Misc: 0x0e,
                    LEDDriverEnable: 0x0f,
                    DebounceConfig: 0x10,
                    DebounceEnable: 0x11,
                    Pins: [],
                    Reset: 0x7d,
                };
                pinRegister = 0x12;
                for (let i = 0; i < 4; i++) {
                    registers.Pins[i] = {
                        TOn: pinRegister++,
                        IOn: pinRegister++,
                        Off: pinRegister++,
                        TRise: i > 0 ? pinRegister++ : undefined,
                        TFall: i > 0 ? pinRegister++ : undefined,
                    };
                }
                break;
            case 'SX1508':
                registers = {
                    InputDisable: 0x00,
                    LongSlew: 0x01,
                    LowDrive: 0x02,
                    PullUp: 0x03,
                    PullDown: 0x04,
                    OpenDrain: 0x05,
                    Polarity: 0x06,
                    Dir: 0x07,
                    Data: 0x08,
                    InterruptMask: 0x09,
                    Sense: 0x0a,
                    InterruptSource: 0x0c,
                    EventStatus: 0x0d,
                    LevelShifter: 0x0e,
                    Clock: 0x0f,
                    Misc: 0x10,
                    LEDDriverEnable: 0x11,
                    DebounceConfig: 0x12,
                    DebounceEnable: 0x13,
                    KeyConfig: 0x14,
                    KeyData: 0x15,
                    Pins: [],
                    HighInput: 0x2a,
                    Reset: 0x7d,
                };
                pinRegister = 0x16;
                for (let i = 0; i < 8; i++) {
                    registers.Pins[i] = {
                        TOn: (i >> 1) % 2 === 1 ? pinRegister++ : undefined,
                        IOn: pinRegister++,
                        Off: (i >> 1) % 2 === 1 ? pinRegister++ : undefined,
                        TRise: i % 4 === 3 ? pinRegister++ : undefined,
                        TFall: i % 4 === 3 ? pinRegister++ : undefined,
                    };
                }
                break;
            default:
                registers = {
                    InputDisable: 0x00,
                    LongSlew: 0x02,
                    LowDrive: 0x04,
                    PullUp: 0x06,
                    PullDown: 0x08,
                    OpenDrain: 0x0a,
                    Polarity: 0x0c,
                    Dir: 0x0e,
                    Data: 0x10,
                    InterruptMask: 0x12,
                    Sense: 0x14,
                    InterruptSource: 0x18,
                    EventStatus: 0x1a,
                    LevelShifter: 0x1c,
                    Clock: 0x1e,
                    Misc: 0x1f,
                    LEDDriverEnable: 0x20,
                    DebounceConfig: 0x22,
                    DebounceEnable: 0x23,
                    KeyConfig: 0x25,
                    KeyData: 0x27,
                    Pins: [],
                    HighInput: 0x69,
                    Reset: 0x7d,
                };
                pinRegister = 0x29;
                for (let i = 0; i < 16; i++) {
                    registers.Pins[i] = {
                        TOn: pinRegister++,
                        IOn: pinRegister++,
                        Off: pinRegister++,
                        TRise: (i >> 2) % 2 === 1 ? pinRegister++ : undefined,
                        TFall: (i >> 2) % 2 === 1 ? pinRegister++ : undefined,
                    };
                }
                break;
        }
        return registers;
    }
}
exports.default = SX150x;
//# sourceMappingURL=sx150x.js.map