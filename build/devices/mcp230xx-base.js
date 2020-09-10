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
exports.MCP230xxBase = exports.Register = void 0;
const shared_1 = require("../lib/shared");
const little_endian_device_handler_base_1 = require("./little-endian-device-handler-base");
// register addresses (for MCP23008, for MCP23017 register "A" in IOCON.BANK = 0 you must multiply by 2)
var Register;
(function (Register) {
    Register[Register["IODIR"] = 0] = "IODIR";
    Register[Register["IPOL"] = 1] = "IPOL";
    Register[Register["GPINTEN"] = 2] = "GPINTEN";
    Register[Register["DEFVAL"] = 3] = "DEFVAL";
    Register[Register["INTCON"] = 4] = "INTCON";
    Register[Register["IOCON"] = 5] = "IOCON";
    Register[Register["GPPU"] = 6] = "GPPU";
    Register[Register["INTF"] = 7] = "INTF";
    Register[Register["INTCAP"] = 8] = "INTCAP";
    Register[Register["GPIO"] = 9] = "GPIO";
    Register[Register["OLAT"] = 10] = "OLAT";
})(Register = exports.Register || (exports.Register = {}));
class MCP230xxBase extends little_endian_device_handler_base_1.LittleEndianDeviceHandlerBase {
    constructor(pinCount, deviceConfig, adapter) {
        super(deviceConfig, adapter);
        this.pinCount = pinCount;
        this.initialized = false;
        this.hasInput = false;
        this.directions = 0;
        this.polarities = 0;
        this.pullUps = 0;
        this.readValue = 0;
        this.writeValue = 0;
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
            for (let i = 0; i < this.pinCount; i++) {
                const pinConfig = this.config.pins[i] || { dir: 'out' };
                const isInput = pinConfig.dir !== 'out';
                if (isInput) {
                    this.directions |= 1 << i;
                    if (pinConfig.dir == 'in-pu') {
                        this.pullUps |= 1 << i;
                    }
                    if (pinConfig.inv) {
                        this.polarities |= 1 << i;
                    }
                    this.hasInput = true;
                }
                else {
                    this.addOutputListener(i);
                    let value = this.getStateValue(i);
                    if (value === undefined) {
                        value = pinConfig.inv === true;
                        yield this.setStateAckAsync(i, value);
                    }
                    if (pinConfig.inv) {
                        value = !value;
                    }
                    if (!value) {
                        this.writeValue |= 1 << i;
                    }
                }
                this.adapter.extendObject(`${this.hexAddress}.${this.indexToName(i)}`, {
                    type: 'state',
                    common: {
                        name: `${this.hexAddress} ${isInput ? 'In' : 'Out'}put ${this.indexToName(i)}`,
                        read: isInput,
                        write: !isInput,
                        type: 'boolean',
                        role: isInput ? 'indicator' : 'switch',
                    },
                    native: pinConfig,
                });
            }
            yield this.checkInitializedAsync();
            if (this.hasInput && this.config.pollingInterval > 0) {
                this.startPolling(() => __awaiter(this, void 0, void 0, function* () { return yield this.readCurrentValueAsync(false); }), this.config.pollingInterval, 50);
            }
            if (this.hasInput && this.config.interrupt) {
                try {
                    // check if interrupt object exists
                    yield this.adapter.getObjectAsync(this.config.interrupt);
                    // subscribe to the object and add change listener
                    this.adapter.addForeignStateChangeListener(this.config.interrupt, (_value) => __awaiter(this, void 0, void 0, function* () {
                        this.debug('Interrupt detected');
                        yield this.readCurrentValueAsync(false);
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
    checkInitializedAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.initialized) {
                // checking if the directions are still the same, if not, the chip might have reset itself
                const readDirections = yield this.readRegister(Register.IODIR);
                if (readDirections === this.directions) {
                    return true;
                }
                this.error('GPIO directions unexpectedly changed, reconfiguring the device');
                this.initialized = false;
            }
            try {
                this.debug('Setting initial output value to ' + shared_1.toHexString(this.writeValue, this.pinCount / 4));
                yield this.writeRegister(Register.OLAT, this.writeValue);
                this.debug('Setting polarities to ' + shared_1.toHexString(this.polarities, this.pinCount / 4));
                yield this.writeRegister(Register.IPOL, this.polarities);
                this.debug('Setting pull-ups to ' + shared_1.toHexString(this.pullUps, this.pinCount / 4));
                yield this.writeRegister(Register.GPPU, this.pullUps);
                this.debug('Setting directions to ' + shared_1.toHexString(this.directions, this.pinCount / 4));
                yield this.writeRegister(Register.IODIR, this.directions);
                this.initialized = true;
            }
            catch (e) {
                this.error("Couldn't initialize: " + e);
                return false;
            }
            yield this.readCurrentValueAsync(true);
            return this.initialized;
        });
    }
    sendCurrentValueAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.checkInitializedAsync())) {
                return;
            }
            this.debug('Sending ' + shared_1.toHexString(this.writeValue, this.pinCount / 4));
            try {
                yield this.writeRegister(Register.OLAT, this.writeValue);
            }
            catch (e) {
                this.error("Couldn't send current value: " + e);
                this.initialized = false;
            }
        });
    }
    readCurrentValueAsync(force) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hasInput) {
                return;
            }
            if (!(yield this.checkInitializedAsync())) {
                return;
            }
            const oldValue = this.readValue;
            try {
                this.readValue = yield this.readRegister(Register.GPIO);
            }
            catch (e) {
                this.error("Couldn't read current value: " + e);
                this.initialized = false;
                return;
            }
            if (oldValue == this.readValue && !force) {
                return;
            }
            this.debug('Read ' + shared_1.toHexString(this.readValue, this.pinCount / 4));
            for (let i = 0; i < this.pinCount; i++) {
                const mask = 1 << i;
                if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].dir != 'out') {
                    const value = (this.readValue & mask) > 0;
                    yield this.setStateAckAsync(i, value);
                }
            }
        });
    }
    addOutputListener(pin) {
        this.adapter.addStateChangeListener(this.hexAddress + '.' + this.indexToName(pin), (_oldValue, newValue) => __awaiter(this, void 0, void 0, function* () { return yield this.changeOutputAsync(pin, newValue); }));
    }
    changeOutputAsync(pin, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const mask = 1 << pin;
            const oldValue = this.writeValue;
            const realValue = this.config.pins[pin].inv ? !value : value;
            if (realValue) {
                this.writeValue &= ~mask;
            }
            else {
                this.writeValue |= mask;
            }
            if (this.writeValue != oldValue) {
                yield this.sendCurrentValueAsync();
            }
            yield this.setStateAckAsync(pin, value);
        });
    }
    setStateAckAsync(pin, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.adapter.setStateAckAsync(`${this.hexAddress}.${this.indexToName(pin)}`, value);
        });
    }
    getStateValue(pin) {
        return this.adapter.getStateValue(`${this.hexAddress}.${this.indexToName(pin)}`);
    }
}
exports.MCP230xxBase = MCP230xxBase;
//# sourceMappingURL=mcp230xx-base.js.map