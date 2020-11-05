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
const device_handler_base_1 = require("./device-handler-base");
class PCF8574 extends device_handler_base_1.DeviceHandlerBase {
    constructor(deviceConfig, adapter) {
        super(deviceConfig, adapter);
        this.readValue = 0;
        this.writeValue = 0;
        this.isHorter = this.name.startsWith('Horter');
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
            let hasInput = false;
            for (let i = 0; i < 8; i++) {
                const pinConfig = this.config.pins[i] || { dir: this.isHorter ? 'in' : 'out' };
                const isInput = pinConfig.dir == 'in';
                if (isInput) {
                    hasInput = true;
                    if (!this.isHorter) {
                        this.writeValue |= 1 << i; // PCF input pins must be set to high level
                    }
                    // else do not set the write value (that's the difference between Horter and regular PCF)
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
                yield this.adapter.extendObjectAsync(`${this.hexAddress}.${i}`, {
                    type: 'state',
                    common: {
                        name: `${this.hexAddress} ${isInput ? 'In' : 'Out'}put ${i}`,
                        read: isInput,
                        write: !isInput,
                        type: 'boolean',
                        role: isInput ? 'indicator' : 'switch',
                    },
                    native: pinConfig,
                });
            }
            this.debug('Setting initial value to ' + shared_1.toHexString(this.writeValue));
            yield this.sendCurrentValueAsync();
            yield this.readCurrentValueAsync(true);
            if (hasInput && this.config.pollingInterval > 0) {
                this.startPolling(() => __awaiter(this, void 0, void 0, function* () { return yield this.readCurrentValueAsync(false); }), this.config.pollingInterval, 50);
            }
            if (hasInput && this.config.interrupt) {
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
    sendCurrentValueAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            this.debug('Sending ' + shared_1.toHexString(this.writeValue));
            try {
                yield this.sendByte(this.writeValue);
            }
            catch (e) {
                this.error("Couldn't send current value: " + e);
            }
        });
    }
    readCurrentValueAsync(force) {
        return __awaiter(this, void 0, void 0, function* () {
            const oldValue = this.readValue;
            try {
                let retries = 3;
                do {
                    // writing the current value before reading to make sure the "direction" of all pins is set correctly
                    yield this.sendByte(this.writeValue);
                    this.readValue = yield this.receiveByte();
                    // reading all 1's (0xFF) could be because of a reset, let's try 3x
                } while (!force && this.readValue == 0xff && --retries > 0);
            }
            catch (e) {
                this.error("Couldn't read current value: " + e);
                return;
            }
            if (oldValue == this.readValue && !force) {
                return;
            }
            this.debug('Read ' + shared_1.toHexString(this.readValue));
            for (let i = 0; i < 8; i++) {
                const mask = 1 << i;
                if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].dir == 'in') {
                    let value = (this.readValue & mask) > 0;
                    if (this.config.pins[i].inv) {
                        value = !value;
                    }
                    yield this.setStateAckAsync(i, value);
                }
            }
        });
    }
    addOutputListener(pin) {
        this.adapter.addStateChangeListener(this.hexAddress + '.' + pin, (_oldValue, newValue) => __awaiter(this, void 0, void 0, function* () { return yield this.changeOutputAsync(pin, newValue); }));
    }
    changeOutputAsync(pin, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const mask = 1 << pin;
            const realValue = this.config.pins[pin].inv ? !value : value;
            if (realValue) {
                this.writeValue &= ~mask;
            }
            else {
                this.writeValue |= mask;
            }
            yield this.sendCurrentValueAsync();
            yield this.setStateAckAsync(pin, value);
        });
    }
}
exports.default = PCF8574;
//# sourceMappingURL=pcf8574.js.map