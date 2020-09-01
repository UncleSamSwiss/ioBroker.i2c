/*
 * Created with @iobroker/create-adapter v1.26.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import { I2CAdapterConfig } from './lib/shared';

// Load your modules here, e.g.:
// import * as fs from "fs";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig extends I2CAdapterConfig {
            _dummy: undefined;
        }
    }
}

class I2c extends utils.Adapter {
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'i2c',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Initialize your adapter here

        this.log.info('Using bus number: ' + this.config.busNumber);
        /*

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info('config option1: ' + this.config.option1);
        this.log.info('config option2: ' + this.config.option2);

        /*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
        /*await this.setObjectNotExistsAsync('testVariable', {
            type: 'state',
            common: {
                name: 'testVariable',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: true,
            },
            native: {},
        });*/
        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        //this.subscribeStates('testVariable');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        this.subscribeStates('*');
        /*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		* /
        // the variable testVariable is set to true as command (ack=false)
        await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        let result = await this.checkPasswordAsync('admin', 'iobroker');
        this.log.info('check user admin pw iobroker: ' + result);

        result = await this.checkGroupAsync('admin', 'admin');
        this.log.info('check group user admin group admin: ' + result);*/
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
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
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     */
    private async onMessage(obj: ioBroker.Message): Promise<void> {
        this.log.info('onMessage: ' + JSON.stringify(obj));
        let wait = false;
        if (typeof obj === 'object' && obj.message) {
            /*if (obj.command === 'send') {
                // e.g. send email or pushover or whatever
                this.log.info('send command');

                // Send response in callback if required
                if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
            }*/
            switch (obj.command) {
                case 'search':
                    const res = await this.searchDevicesAsync(obj.message);
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
    }

    private async searchDevicesAsync(busNumber: any): Promise<any> {
        busNumber = parseInt(busNumber);

        if (busNumber == this.config.busNumber) {
            this.log.debug('Searching on current bus ' + busNumber);

            return [20, 35, 63, 77];
            //this.bus.scan(callback);
        } /* else {
            that.adapter.log.debug('Searching on new bus ' + busNumber);
            var searchBus = i2c.open(busNumber, function (err) {
                if (err) {
                    callback(err);
                } else {
                    searchBus.scan(function (err, result) {
                        searchBus.close(function () {
                            callback(err, result);
                        });
                    });
                }
            });
        }*/
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new I2c(options);
} else {
    // otherwise start the instance directly
    (() => new I2c())();
}
