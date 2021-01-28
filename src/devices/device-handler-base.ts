import * as i2c from 'i2c-bus';
import { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { Polling, PollingCallback } from '../lib/async';
import { toHexString } from '../lib/shared';
import { I2cAdapter, StateValue } from '../main';

export abstract class DeviceHandlerBase<T extends ImplementationConfigBase> {
    public readonly type: string;
    public readonly name: string;
    public readonly hexAddress: string;

    protected readonly config: T;

    private polling?: Polling;

    constructor(private readonly deviceConfig: I2CDeviceConfig, protected readonly adapter: I2cAdapter) {
        if (!deviceConfig.type || !deviceConfig.name) {
            throw new Error('Type and name of device must be specified');
        }
        this.type = deviceConfig.type;
        this.name = deviceConfig.name;

        this.config = deviceConfig[deviceConfig.type] as T;

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
        const result = await this.adapter.i2cBus.i2cRead(this.deviceConfig.address, length, buffer);
        this.silly(`i2cRead(${length}): 0x${result.buffer.toString('hex')}`);
        return result;
    }

    protected async i2cWrite(length: number, buffer: Buffer): Promise<i2c.BytesWritten> {
        this.silly(`i2cWrite(${length}, 0x${buffer.toString('hex')})`);
        return await this.adapter.i2cBus.i2cWrite(this.deviceConfig.address, length, buffer);
    }

    protected async readByte(command: number): Promise<number> {
        const byte = await this.adapter.i2cBus.readByte(this.deviceConfig.address, command);
        this.silly(`readByte(${toHexString(command)}): ${toHexString(byte)}`);
        return byte;
    }

    protected async readI2cBlock(command: number, length: number, buffer: Buffer): Promise<i2c.BytesRead> {
        const result = await this.adapter.i2cBus.readI2cBlock(this.deviceConfig.address, command, length, buffer);
        this.silly(`readI2cBlock(${toHexString(command)}, ${length}): 0x${result.buffer.toString('hex')}`);
        return result;
    }

    protected async receiveByte(): Promise<number> {
        const byte = await this.adapter.i2cBus.receiveByte(this.deviceConfig.address);
        this.silly(`receiveByte(): ${toHexString(byte)}`);
        return byte;
    }

    protected async sendByte(byte: number): Promise<void> {
        this.silly(`sendByte(${toHexString(byte)})`);
        return await this.adapter.i2cBus.sendByte(this.deviceConfig.address, byte);
    }

    protected async writeByte(command: number, byte: number): Promise<void> {
        this.silly(`writeByte(${toHexString(command)}, ${toHexString(byte)})`);
        return await this.adapter.i2cBus.writeByte(this.deviceConfig.address, command, byte);
    }

    protected async writeQuick(command: number, bit: number): Promise<void> {
        this.silly(`writeQuick(${toHexString(command)}, ${bit})`);
        return await this.adapter.i2cBus.writeQuick(this.deviceConfig.address, command, bit);
    }

    protected async writeI2cBlock(command: number, length: number, buffer: Buffer): Promise<i2c.BytesWritten> {
        this.silly(`writeI2cBlock(${toHexString(command)}, ${length}, 0x${buffer.toString('hex')})`);
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
    protected silly(message: string): void {
        this.adapter.log.silly(`${this.type} ${this.hexAddress}: ${message}`);
    }

    protected debug(message: string): void {
        this.adapter.log.debug(`${this.type} ${this.hexAddress}: ${message}`);
    }

    protected info(message: string): void {
        this.adapter.log.info(`${this.type} ${this.hexAddress}: ${message}`);
    }

    protected warn(message: string): void {
        this.adapter.log.warn(`${this.type} ${this.hexAddress}: ${message}`);
    }

    protected error(message: string): void {
        this.adapter.log.error(`${this.type} ${this.hexAddress}: ${message}`);
    }
}
