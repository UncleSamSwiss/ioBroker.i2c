"use strict";
/*
 * Created with @iobroker/create-adapter v1.26.1
 */
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
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const i2c = require("i2c-bus");
const client_1 = require("./debug/client");
const server_1 = require("./debug/server");
class I2c extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({ dirname: __dirname.indexOf('node_modules') !== -1 ? undefined : __dirname + '/../' }, options), { name: 'i2c' }));
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.info('Using bus number: ' + this.config.busNumber);
            this.bus = yield this.openBusAsync(this.config.busNumber);
            if (this.config.serverPort) {
                this.server = new server_1.I2CServer(this.bus, this.log);
                this.server.start(this.config.serverPort);
            }
            this.subscribeStates('*');
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            if (this.server) {
                this.server.stop();
            }
            this.bus.close(); // ignore the returned promise (we can't do anything if close doesn't work)
            callback();
        }
        catch (e) {
            callback();
        }
    }
    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  */
    // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }
    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     */
    onMessage(obj) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.info('onMessage: ' + JSON.stringify(obj));
            let wait = false;
            if (typeof obj === 'object' && obj.message) {
                switch (obj.command) {
                    case 'search':
                        const res = yield this.searchDevicesAsync(parseInt(obj.message));
                        const result = JSON.stringify(res || []);
                        this.log.info('Search found: ' + result);
                        if (obj.callback) {
                            this.sendTo(obj.from, obj.command, result, obj.callback);
                        }
                        wait = true;
                        break;
                    /*case 'read':
                        if (typeof obj.message !== 'object' || typeof obj.message.address !== 'number') {
                            that.adapter.log.error('Invalid read message');
                            return false;
                        }
                        var buf = Buffer.alloc(obj.message.bytes || 1);
                        try {
                            if (typeof obj.message.register === 'number') {
                                that.bus.readI2cBlockSync(obj.message.address, obj.message.register, buf.length, buf);
                            } else {
                                that.bus.i2cReadSync(obj.message.address, buf.length, buf);
                            }
                            if (obj.callback) {
                                that.adapter.sendTo(obj.from, obj.command, buf, obj.callback);
                            }
                            wait = true;
                        } catch (e) {
                            that.adapter.log.error('Error reading from ' + that.toHexString(obj.message.address));
                        }
                        break;
    
                    case 'write':
                        if (
                            typeof obj.message !== 'object' ||
                            typeof obj.message.address !== 'number' ||
                            !Buffer.isBuffer(obj.message.data)
                        ) {
                            that.adapter.log.error('Invalid write message');
                            return false;
                        }
                        try {
                            if (typeof obj.message.register === 'number') {
                                that.bus.writeI2cBlockSync(
                                    obj.message.address,
                                    obj.message.register,
                                    obj.message.data.length,
                                    obj.message.data,
                                );
                            } else {
                                that.bus.i2cWriteSync(obj.message.address, obj.message.data.length, obj.message.data);
                            }
                            if (obj.callback) {
                                that.adapter.sendTo(obj.from, obj.command, obj.message.data, obj.callback);
                            }
                            wait = true;
                        } catch (e) {
                            that.adapter.log.error('Error writing to ' + that.toHexString(obj.message.address));
                        }
                        break;*/
                    default:
                        this.log.warn('Unknown command: ' + obj.command);
                        break;
                }
            }
            if (!wait && obj.callback) {
                this.sendTo(obj.from, obj.command, obj.message, obj.callback);
            }
        });
    }
    searchDevicesAsync(busNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            if (busNumber == this.config.busNumber) {
                this.log.debug('Searching on current bus ' + busNumber);
                //return [20, 35, 63, 77];
                return yield this.bus.scan();
            }
            else {
                this.log.debug('Searching on new bus ' + busNumber);
                const searchBus = yield this.openBusAsync(busNumber);
                const result = yield this.bus.scan();
                yield searchBus.close();
                return result;
            }
        });
    }
    openBusAsync(busNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.config.clientAddress) {
                return new client_1.I2CClient(this.config.clientAddress, this.log);
            }
            else {
                return yield i2c.openPromisified(busNumber);
            }
        });
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new I2c(options);
}
else {
    // otherwise start the instance directly
    (() => new I2c())();
}
//# sourceMappingURL=main.js.map