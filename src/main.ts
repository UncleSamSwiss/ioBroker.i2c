/*
 * Created with @iobroker/create-adapter v1.29.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import * as i2c from 'i2c-bus';
import { I2CClient } from './debug/client';
import { I2CServer } from './debug/server';
import { DeviceHandlerBase } from './devices/device-handler-base';
import { toHexString } from './lib/shared';

export type StateValue = string | number | boolean | null;

export type StateChangeListener<T extends StateValue> = (oldValue: T, newValue: T) => Promise<void>;

export type ForeignStateChangeListener<T extends StateValue> = (value: T) => Promise<void>;

export class I2cAdapter extends utils.Adapter {
    private bus!: i2c.PromisifiedBus;
    private server?: I2CServer;

    private stateChangeListeners: Record<string, StateChangeListener<any>[]> = {};
    private foreignStateChangeListeners: Record<string, ForeignStateChangeListener<any>[]> = {};
    private currentStateValues: Record<string, StateValue> = {};

    private readonly deviceHandlers: DeviceHandlerBase<any>[] = [];

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            dirname: __dirname.indexOf('node_modules') !== -1 ? undefined : __dirname + '/../',
            ...options,
            name: 'i2c',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    public get i2cBus(): i2c.PromisifiedBus {
        return this.bus;
    }

    public addStateChangeListener<T extends StateValue>(id: string, listener: StateChangeListener<T>): void {
        const key = this.namespace + '.' + id;
        if (!this.stateChangeListeners[key]) {
            this.stateChangeListeners[key] = [];
        }
        this.stateChangeListeners[key].push(listener);
    }

    public addForeignStateChangeListener<T extends StateValue>(
        id: string,
        listener: ForeignStateChangeListener<T>,
    ): void {
        if (!this.foreignStateChangeListeners[id]) {
            this.foreignStateChangeListeners[id] = [];
            this.subscribeForeignStates(id);
        }
        this.foreignStateChangeListeners[id].push(listener);
    }

    public async setStateAckAsync<T extends StateValue>(id: string, value: T): Promise<void> {
        this.currentStateValues[this.namespace + '.' + id] = value;
        await this.setStateAsync(id, value, true);
    }

    public setStateAck<T extends StateValue>(id: string, value: T): void {
        this.currentStateValues[this.namespace + '.' + id] = value;
        this.setState(id, value, true);
    }

    public getStateValue<T extends StateValue>(id: string): T | undefined {
        return this.currentStateValues[this.namespace + '.' + id] as T | undefined;
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        const allStates = await this.getStatesAsync('*');
        for (const id in allStates) {
            if (allStates[id] && allStates[id].ack) {
                this.currentStateValues[id] = allStates[id].val as StateValue;
            }
        }

        this.log.info('Using bus number: ' + this.config.busNumber);

        this.bus = await this.openBusAsync(this.config.busNumber);

        if (this.config.serverPort) {
            this.server = new I2CServer(this.bus, this.log);
            this.server.start(this.config.serverPort);
        }

        if (!this.config.devices || this.config.devices.length === 0) {
            // no devices configured, nothing to do in this adapter
            return;
        }

        for (let i = 0; i < this.config.devices.length; i++) {
            const deviceConfig = this.config.devices[i];
            if (!deviceConfig.name || !deviceConfig.type) {
                continue;
            }

            try {
                const module = await import(__dirname + '/devices/' + deviceConfig.type.toLowerCase());
                const handler: DeviceHandlerBase<any> = new module.default(deviceConfig, this);
                this.deviceHandlers.push(handler);
            } catch (error) {
                this.log.error(`Couldn't create ${deviceConfig.type} ${toHexString(deviceConfig.address)}: ${error}`);
            }
        }

        await Promise.all(
            this.deviceHandlers.map(async (h) => {
                try {
                    await h.startAsync();
                } catch (error) {
                    this.log.error(`Couldn't start ${h.type} ${h.hexAddress}: ${error}`);
                }
            }),
        );

        this.subscribeStates('*');
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private async onUnload(callback: () => void): Promise<void> {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            if (this.server) {
                this.server.stop();
            }

            await Promise.all(this.deviceHandlers.map((h) => h.stopAsync()));

            await this.bus.close();

            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     */
    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state) {
            this.log.debug(`State ${id} deleted`);
            return;
        }

        this.log.debug(`stateChange ${id} ${JSON.stringify(state)}`);

        if (this.foreignStateChangeListeners[id]) {
            const listeners = this.foreignStateChangeListeners[id];
            await Promise.all(listeners.map((listener) => listener(state.val)));
            return;
        }

        if (state.ack) {
            return;
        }

        if (!this.stateChangeListeners[id]) {
            this.log.error('Unsupported state change: ' + id);
            return;
        }

        const listeners = this.stateChangeListeners[id];
        const oldValue = this.currentStateValues[id];
        await Promise.all(listeners.map((listener) => listener(oldValue, state.val)));
    }

    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     */
    private async onMessage(obj: ioBroker.Message): Promise<void> {
        this.log.silly('onMessage: ' + JSON.stringify(obj));
        let wait = false;
        if (typeof obj === 'object' && obj.message) {
            switch (obj.command) {
                case 'search':
                    const res = await this.searchDevicesAsync(parseInt(obj.message as string));
                    const result = JSON.stringify(res || []);
                    this.log.debug('Search found: ' + result);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, result, obj.callback);
                    }
                    wait = true;
                    break;

                case 'read':
                    if (typeof obj.message !== 'object' || typeof obj.message.address !== 'number') {
                        this.log.error('Invalid read message');
                        return;
                    }
                    const buf = Buffer.alloc(obj.message.bytes || 1);
                    try {
                        if (typeof obj.message.register === 'number') {
                            await this.bus.readI2cBlock(obj.message.address, obj.message.register, buf.length, buf);
                        } else {
                            await this.bus.i2cRead(obj.message.address, buf.length, buf);
                        }
                        if (obj.callback) {
                            this.sendTo(obj.from, obj.command, buf, obj.callback);
                        }
                        wait = true;
                    } catch (e) {
                        this.log.error('Error reading from ' + toHexString(obj.message.address));
                    }
                    break;

                case 'write':
                    if (
                        typeof obj.message !== 'object' ||
                        typeof obj.message.address !== 'number' ||
                        !Buffer.isBuffer(obj.message.data)
                    ) {
                        this.log.error('Invalid write message');
                        return;
                    }
                    try {
                        if (typeof obj.message.register === 'number') {
                            await this.bus.writeI2cBlock(
                                obj.message.address,
                                obj.message.register,
                                obj.message.data.length,
                                obj.message.data,
                            );
                        } else {
                            await this.bus.i2cWrite(obj.message.address, obj.message.data.length, obj.message.data);
                        }
                        if (obj.callback) {
                            this.sendTo(obj.from, obj.command, obj.message.data, obj.callback);
                        }
                        wait = true;
                    } catch (e) {
                        this.log.error('Error writing to ' + toHexString(obj.message.address));
                    }
                    break;
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
        if (busNumber === this.config.busNumber) {
            this.log.debug('Searching on current bus ' + busNumber);
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
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new I2cAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new I2cAdapter())();
}
