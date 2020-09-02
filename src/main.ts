/*
 * Created with @iobroker/create-adapter v1.26.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import * as i2c from 'i2c-bus';
import { I2CClient } from './debug/client';
import { I2CServer } from './debug/server';
// lint doesn't know it is being used inside the ioBroker namespace below
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    private bus!: i2c.PromisifiedBus;
    private server?: I2CServer;
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            dirname: __dirname.indexOf('node_modules') !== -1 ? undefined : __dirname + '/../',
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
        this.log.info('Using bus number: ' + this.config.busNumber);

        this.bus = await this.openBusAsync(this.config.busNumber);

        if (this.config.serverPort) {
            this.server = new I2CServer(this.bus, this.log);
            this.server.start(this.config.serverPort);
        }

        this.subscribeStates('*');
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
            if (this.server) {
                this.server.stop();
            }

            this.bus.close(); // ignore the returned promise (we can't do anything if close doesn't work)

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
            switch (obj.command) {
                case 'search':
                    const res = await this.searchDevicesAsync(parseInt(obj.message as string));
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

    private async searchDevicesAsync(busNumber: number): Promise<number[]> {
        if (busNumber == this.config.busNumber) {
            this.log.debug('Searching on current bus ' + busNumber);

            //return [20, 35, 63, 77];
            return await this.bus.scan();
        } else {
            this.log.debug('Searching on new bus ' + busNumber);
            const searchBus = await this.openBusAsync(busNumber);
            const result = await this.bus.scan();
            await searchBus.close();
            return result;
        }
    }

    private async openBusAsync(busNumber: number): Promise<i2c.PromisifiedBus> {
        if (this.config.clientAddress) {
            return new I2CClient(this.config.clientAddress, this.log);
        } else {
            return await i2c.openPromisified(busNumber);
        }
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new I2c(options);
} else {
    // otherwise start the instance directly
    (() => new I2c())();
}
