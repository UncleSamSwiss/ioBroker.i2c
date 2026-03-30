/*
 * Created with @iobroker/create-adapter v3.1.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import * as i2c from 'i2c-bus';
import { I2CClient } from './debug/client';
import { I2CServer } from './debug/server';
import { AllDevices } from './devices/all-devices';
import type { DeviceHandlerBase } from './devices/device-handler-base';
import { I2cDeviceManagement } from './I2cDeviceManager';
import type { I2CDeviceConfig } from './lib/adapter-config';
import { toHexString } from './lib/shared';

export type StateValue = string | number | boolean | null;

export type StateChangeListener<T extends StateValue> = (oldValue: T, newValue: T) => Promise<void>;

export type ForeignStateChangeListener<T extends StateValue> = (value: T) => Promise<void>;

/**
 * Main adapter class for i2c adapter.
 */
export class I2cAdapter extends utils.Adapter {
    private readonly deviceManagement: I2cDeviceManagement;

    private bus!: i2c.PromisifiedBus;
    private server?: I2CServer;

    private stateChangeListeners: Record<string, StateChangeListener<any>[]> = {};
    private foreignStateChangeListeners: Record<string, ForeignStateChangeListener<any>[]> = {};
    private currentStateValues: Record<string, StateValue> = {};

    private readonly deviceHandlers: DeviceHandlerBase<any>[] = [];

    /**
     * Creates an instance of the i2c adapter.
     *
     * @param options The adapter options
     */
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'i2c',
        });
        this.deviceManagement = new I2cDeviceManagement(this);

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Gets the i2c bus instance.
     */
    public get i2cBus(): i2c.PromisifiedBus {
        return this.bus;
    }

    /**
     * Gets the list of currently running device handlers.
     */
    public get handlers(): ReadonlyArray<DeviceHandlerBase<any>> {
        return this.deviceHandlers;
    }

    /**
     * Adds a state change listener for own states.
     *
     * @param id The state ID to listen to (without adapter namespace)
     * @param listener The listener function
     */
    public addStateChangeListener<T extends StateValue>(id: string, listener: StateChangeListener<T>): void {
        const key = `${this.namespace}.${id}`;
        if (!this.stateChangeListeners[key]) {
            this.stateChangeListeners[key] = [];
        }
        this.stateChangeListeners[key].push(listener);
    }

    /**
     * Adds a state change listener for foreign states.
     *
     * @param id The state ID to listen to (with adapter namespace)
     * @param listener The listener function
     */
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

    /**
     * Sets the state value with the ack flag set to true.
     *
     * @param id The state ID (without adapter namespace)
     * @param value The state value
     */
    public async setStateAckAsync<T extends StateValue>(id: string, value: T): Promise<void> {
        this.currentStateValues[`${this.namespace}.${id}`] = value;
        await this.setState(id, value, true);
    }

    /**
     * Gets the state value.
     *
     * @param id The state ID (without adapter namespace)
     * @returns The state value
     */
    public getStateValue<T extends StateValue>(id: string): T | undefined {
        return this.currentStateValues[`${this.namespace}.${id}`] as T | undefined;
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        await this.migrateConfig();
        const allStates = await this.getStatesAsync('*');
        for (const id in allStates) {
            if (allStates[id] && allStates[id].ack) {
                this.currentStateValues[id] = allStates[id].val as StateValue;
            }
        }

        this.log.info(`Using bus number: ${this.config.busNumber}`);

        this.bus = await this.openBusAsync(this.config.busNumber);

        if (this.config.serverPort) {
            this.server = new I2CServer(this.bus, this.log);
            this.server.start(this.config.serverPort);
        }

        const devices = await this.getDevicesAsync();
        for (const device of devices) {
            const deviceConfig = device.native as I2CDeviceConfig;
            try {
                this.createHandler(deviceConfig);
            } catch (error: any) {
                this.log.error(`Couldn't create ${deviceConfig.type} ${toHexString(deviceConfig.address)}: ${error}`);
            }
        }

        await Promise.all(
            this.deviceHandlers.map(h =>
                h.startAsync().catch(error => {
                    this.log.error(`Couldn't start ${h.type} ${h.hexAddress}: ${error}`);
                }),
            ),
        );

        this.subscribeStates('*');
    }

    private createHandler(deviceConfig: I2CDeviceConfig): DeviceHandlerBase<any> {
        if (!deviceConfig.name || !deviceConfig.type) {
            throw new Error(`Skipping device at ${toHexString(deviceConfig.address)} without name or type`);
        }

        const info = AllDevices.find(d => d.type === deviceConfig.type);
        if (!info) {
            throw new Error(`Unsupported device type: ${deviceConfig.type}`);
        }

        const handler = info.createHandler(deviceConfig, this);
        this.deviceHandlers.push(handler);
        return handler;
    }

    /**
     * Recreates the device handler for the given device configuration.
     *
     * @param deviceConfig The device configuration
     */
    public async updateHandler(deviceConfig: I2CDeviceConfig): Promise<void> {
        let handler = this.deviceHandlers.find(h => h.address === deviceConfig.address);
        if (handler) {
            await handler.stopAsync();
            this.deviceHandlers.splice(this.deviceHandlers.indexOf(handler), 1);
        }

        handler = this.createHandler(deviceConfig);
        await handler.startAsync();
    }

    /**
     * Deletes the device handler for the given hex address.
     *
     * @param hexAddress The device hex address
     */
    public async deleteHandler(hexAddress: string): Promise<void> {
        const handler = this.deviceHandlers.find(h => h.hexAddress === hexAddress);
        if (handler) {
            await handler.stopAsync();
            this.deviceHandlers.splice(this.deviceHandlers.indexOf(handler), 1);
            await this.delObjectAsync(hexAddress, { recursive: true });
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback - Callback function
     */
    private async onUnload(callback: () => void): Promise<void> {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            if (this.server) {
                this.server.stop();
            }

            await Promise.all(this.deviceHandlers.map(h => h.stopAsync()));

            await this.bus.close();

            callback();
        } catch {
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
     *
     * @param id - State ID
     * @param state - State object
     */
    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state) {
            this.log.debug(`State ${id} deleted`);
            return;
        }

        this.log.debug(`stateChange ${id} ${JSON.stringify(state)}`);

        if (this.foreignStateChangeListeners[id]) {
            const listeners = this.foreignStateChangeListeners[id];
            await Promise.all(listeners.map(listener => listener(state.val)));
            return;
        }

        if (state.ack) {
            return;
        }

        if (!this.stateChangeListeners[id]) {
            this.log.error(`Unsupported state change: ${id}`);
            return;
        }

        const listeners = this.stateChangeListeners[id];
        const oldValue = this.currentStateValues[id];
        await Promise.all(listeners.map(listener => listener(oldValue, state.val)));
    }

    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     *
     * @param obj - The message object
     */
    private async onMessage(obj: ioBroker.Message): Promise<void> {
        this.log.silly(`onMessage: ${JSON.stringify(obj)}`);
        if (typeof obj === 'object' && obj.message) {
            switch (obj.command) {
                case 'search': {
                    const res = await this.searchDevicesAsync(parseInt(obj.message as string));
                    const result = JSON.stringify(res || []);
                    this.log.debug(`Search found: ${result}`);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, result, obj.callback);
                    }
                    break;
                }

                case 'read': {
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
                    } catch {
                        this.log.error(`Error reading from ${toHexString(obj.message.address)}`);
                    }
                    break;
                }

                case 'write': {
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
                    } catch {
                        this.log.error(`Error writing to ${toHexString(obj.message.address)}`);
                    }
                    break;
                }

                default:
                    if (!obj.command.startsWith('dm:')) {
                        this.log.warn(`Unknown command: ${obj.command}`);
                    }
                    break;
            }
        }
    }

    /**
     * Searches for i2c devices on the given I2C bus number.
     *
     * @param busNumber The I2C bus number
     * @returns A list of device addresses found on the bus
     */
    public async searchDevicesAsync(busNumber: number): Promise<number[]> {
        if (busNumber === this.config.busNumber) {
            this.log.debug(`Searching on current bus ${busNumber}`);
            return await this.bus.scan();
        }
        this.log.debug(`Searching on new bus ${busNumber}`);
        const searchBus = await this.openBusAsync(busNumber);
        const result = await searchBus.scan();
        await searchBus.close();
        return result;
    }

    private async openBusAsync(busNumber: number): Promise<i2c.PromisifiedBus> {
        if (this.config.clientAddress) {
            return new I2CClient(this.config.clientAddress, this.log);
        }
        return await i2c.openPromisified(busNumber);
    }

    private async migrateConfig(): Promise<void> {
        if (!this.config.devices || !Array.isArray(this.config.devices) || this.config.devices.length === 0) {
            return;
        }

        for (const device of this.config.devices) {
            // update device object in database
            const id = toHexString(device.address);
            try {
                await this.extendObject(id, {
                    native: device,
                });
            } catch (error: any) {
                this.log.error(`Error migrating device ${id}: ${error}`);
            }
        }

        this.log.info('Migrated device configuration to device objects');
        await this.updateConfig({ devices: [] });
    }
}
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new I2cAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new I2cAdapter())();
}
