import * as i2c from 'i2c-bus';
import { Polling, PollingCallback } from '../lib/async';
import { I2CDeviceConfig, ImplementationConfigBase, toHexString } from '../lib/shared';
import { I2cAdapter, StateValue } from '../main';

export abstract class DeviceHandlerBase<T extends ImplementationConfigBase> {
    protected readonly type: string;
    protected readonly name: string;
    protected readonly config: T;
    protected readonly hexAddress: string;

    private polling?: Polling;

    constructor(private readonly deviceConfig: I2CDeviceConfig, protected readonly adapter: I2cAdapter) {
        if (!deviceConfig.type || !deviceConfig.name) {
            throw new Error('Type and name of device must be specified');
        }
        this.type = deviceConfig.type;
        this.name = deviceConfig.name;

        this.config = deviceConfig[deviceConfig.name] as T;

        this.hexAddress = toHexString(deviceConfig.address);
    }

    // methods to override
    abstract startAsync(): Promise<void>;
    abstract stopAsync(): Promise<void>;

    // polling related methods
    protected startPolling(callback: PollingCallback, interval: number, minInterval?: number): void {
        this.stopPolling();
        this.polling = new Polling(callback);
        this.polling.runAsync(interval, minInterval).catch((error) => this.error('Polling error: ' + error));
    }

    protected stopPolling(): void {
        this.polling?.stop();
    }

    // I2C related methods
    protected async deviceId(): Promise<i2c.I2CDeviceId> {
        return await this.adapter.i2cBus.deviceId(this.deviceConfig.address);
    }

    protected async i2cRead(length: number, buffer: Buffer): Promise<i2c.BytesRead> {
        return await this.adapter.i2cBus.i2cRead(this.deviceConfig.address, length, buffer);
    }

    protected async i2cWrite(length: number, buffer: Buffer): Promise<i2c.BytesWritten> {
        return await this.adapter.i2cBus.i2cWrite(this.deviceConfig.address, length, buffer);
    }

    protected async readByte(command: number): Promise<number> {
        return await this.adapter.i2cBus.readByte(this.deviceConfig.address, command);
    }

    protected async readI2cBlock(command: number, length: number, buffer: Buffer): Promise<i2c.BytesRead> {
        return await this.adapter.i2cBus.readI2cBlock(this.deviceConfig.address, command, length, buffer);
    }

    protected async receiveByte(): Promise<number> {
        return await this.adapter.i2cBus.receiveByte(this.deviceConfig.address);
    }

    protected async sendByte(byte: number): Promise<void> {
        return await this.adapter.i2cBus.sendByte(this.deviceConfig.address, byte);
    }

    protected async writeByte(command: number, byte: number): Promise<void> {
        return await this.adapter.i2cBus.writeByte(this.deviceConfig.address, command, byte);
    }

    protected async writeQuick(command: number, bit: number): Promise<void> {
        return await this.adapter.i2cBus.writeQuick(this.deviceConfig.address, command, bit);
    }

    protected async writeI2cBlock(command: number, length: number, buffer: Buffer): Promise<i2c.BytesWritten> {
        return await this.adapter.i2cBus.writeI2cBlock(this.deviceConfig.address, command, length, buffer);
    }

    // adapter methods
    protected async setStateAckAsync<T extends StateValue>(state: string | number, value: T): Promise<void> {
        await this.adapter.setStateAckAsync(this.hexAddress + '.' + state, value);
    }

    protected getStateValue<T extends StateValue>(state: string | number): T | undefined {
        return this.adapter.getStateValue<T>(this.hexAddress + '.' + state);
    }

    // logging methods
    protected debug(message: string): void {
        this.adapter.log.debug(`${this.type} ${this.hexAddress}: ${message}`);
    }

    protected info(message: string): void {
        this.adapter.log.info(`${this.type} ${this.hexAddress}: ${message}`);
    }

    protected error(message: string): void {
        this.adapter.log.error(`${this.type} ${this.hexAddress}: ${message}`);
    }
}
