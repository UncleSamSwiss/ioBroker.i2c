import { ImplementationConfigBase } from '../lib/adapter-config';
import { Polling } from '../lib/async';
import { toHexString } from '../lib/shared';
import { DeviceHandlerBase } from './device-handler-base';

export interface GenericConfig extends ImplementationConfigBase {
    name?: string;
    registers: RegisterConfig[];
}

export type RegisterType =
    | 'int8'
    | 'uint8'
    | 'int16_be'
    | 'int16_le'
    | 'uint16_be'
    | 'uint16_le'
    | 'int32_be'
    | 'int32_le'
    | 'uint32_be'
    | 'uint32_le'
    | 'float_be'
    | 'float_le'
    | 'double_be'
    | 'double_le';

export interface RegisterConfig {
    register: number;
    name?: string;
    type: RegisterType;
    read: boolean;
    write: boolean;
    pollingInterval?: number;
}

interface RegisterHandler {
    readonly hex: string;
    readonly config: RegisterConfig;
    polling?: Polling;
}

export default class Generic extends DeviceHandlerBase<GenericConfig> {
    private handlers: Record<number, RegisterHandler> = {};

    async startAsync(): Promise<void> {
        this.debug('Starting');
        const name = this.config.name || this.name;
        await this.adapter.extendObjectAsync(this.hexAddress, {
            type: 'device',
            common: {
                name: this.hexAddress + ' (' + name + ')',
                role: 'sensor',
            },
            native: this.config as any,
        });

        for (const registerConfig of this.config.registers) {
            const handler: RegisterHandler = {
                hex: toHexString(registerConfig.register),
                config: registerConfig,
            };
            this.handlers[registerConfig.register] = handler;

            this.debug('Register ' + handler.hex + ': ' + JSON.stringify(handler.config));

            await this.adapter.extendObjectAsync(this.hexAddress + '.' + handler.hex, {
                type: 'state',
                common: {
                    name: this.hexAddress + ' ' + (handler.config.name || 'Register'),
                    read: handler.config.read,
                    write: handler.config.write,
                    type: 'number',
                    role: 'value',
                },
                native: handler.config as any,
            });

            // init polling when read
            if (handler.config.read) {
                await this.readValueAsync(handler);

                if (!!handler.config.pollingInterval && handler.config.pollingInterval > 0) {
                    handler.polling = new Polling(async () => await this.readValueAsync(handler));
                    handler.polling
                        .runAsync(handler.config.pollingInterval, 50)
                        .catch((error) => this.error(`${handler.hex}: Polling error: ${error}`));
                }
            }

            // init listener when write
            if (handler.config.write) {
                // send current value on startup for write-only regsiters
                if (!handler.config.read) {
                    const value = this.getStateValue(handler.hex);
                    if (typeof value === 'number') {
                        await this.sendValueAsync(handler, value);
                    }
                }

                this.addOutputListener(handler);
            }
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        for (const register in this.handlers) {
            this.handlers[register].polling?.stop();
        }
    }

    private addOutputListener(handler: RegisterHandler): void {
        this.adapter.addStateChangeListener<number>(
            this.hexAddress + '.' + handler.hex,
            async (_oldValue: number, newValue: number) => await this.sendValueAsync(handler, newValue),
        );
    }

    private async sendValueAsync(handler: RegisterHandler, value: number): Promise<void> {
        const buf = this.createBuffer(handler);
        switch (handler.config.type) {
            case 'int8':
                buf.writeInt8(value);
                break;
            case 'uint8':
                buf.writeUInt8(value);
                break;
            case 'int16_be':
                buf.writeInt16BE(value);
                break;
            case 'int16_le':
                buf.writeInt16LE(value);
                break;
            case 'uint16_be':
                buf.writeUInt16BE(value);
                break;
            case 'uint16_le':
                buf.writeUInt16LE(value);
                break;
            case 'int32_be':
                buf.writeInt32BE(value);
                break;
            case 'int32_le':
                buf.writeInt32LE(value);
                break;
            case 'uint32_be':
                buf.writeUInt32BE(value);
                break;
            case 'uint32_le':
                buf.writeUInt32LE(value);
                break;
            case 'float_be':
                buf.writeFloatBE(value);
                break;
            case 'float_le':
                buf.writeFloatLE(value);
                break;
            case 'double_be':
                buf.writeDoubleBE(value);
                break;
            case 'double_le':
                buf.writeDoubleLE(value);
                break;
        }

        this.debug(`${handler.hex}: Sending ${buf.length} bytes: ${buf.toString('hex')}`);
        try {
            if (handler.config.register >= 0) {
                await this.writeI2cBlock(handler.config.register, buf.length, buf);
            } else {
                await this.i2cWrite(buf.length, buf);
            }
            await this.setStateAckAsync(handler.hex, value);
        } catch (e) {
            this.error(`${handler.hex}: Couldn't send value: ${e}`);
        }
    }
    private async readValueAsync(handler: RegisterHandler): Promise<void> {
        this.debug(`${handler.hex}: Reading from register`);

        const buf = this.createBuffer(handler);

        // read raw data from bus
        try {
            if (handler.config.register >= 0) {
                await this.readI2cBlock(handler.config.register, buf.length, buf);
            } else {
                await this.i2cRead(buf.length, buf);
            }
        } catch (e) {
            this.error(`${handler.hex}: Couldn't read value: ${e}`);
            return;
        }

        // parse data to data type
        let value;
        try {
            switch (handler.config.type) {
                case 'int8':
                    value = buf.readInt8();
                    break;
                case 'uint8':
                    value = buf.readUInt8();
                    break;
                case 'int16_be':
                    value = buf.readInt16BE();
                    break;
                case 'int16_le':
                    value = buf.readInt16LE();
                    break;
                case 'uint16_be':
                    value = buf.readUInt16BE();
                    break;
                case 'uint16_le':
                    value = buf.readUInt16LE();
                    break;
                case 'int32_be':
                    value = buf.readInt32BE();
                    break;
                case 'int32_le':
                    value = buf.readInt32LE();
                    break;
                case 'uint32_be':
                    value = buf.readUInt32BE();
                    break;
                case 'uint32_le':
                    value = buf.readUInt32LE();
                    break;
                case 'float_be':
                    value = buf.readFloatBE();
                    break;
                case 'float_le':
                    value = buf.readFloatLE();
                    break;
                case 'double_be':
                    value = buf.readDoubleBE();
                    break;
                case 'double_le':
                    value = buf.readDoubleLE();
                    break;
            }

            this.debug(`${handler.hex}: Read ${buf.toString('hex')} -> ${value}`);
        } catch (e) {
            this.error(
                `${handler.hex}: Couldn't read value as type ${handler.config.type} from buffer ${buf.toString(
                    'hex',
                )}: ${e}`,
            );
            return;
        }

        // save the value into the state
        this.setStateAck(handler.hex, value);
    }

    private createBuffer(handler: RegisterHandler): Buffer {
        switch (handler.config.type) {
            case 'int8':
                return Buffer.alloc(1);
            case 'uint8':
                return Buffer.alloc(1);
            case 'int16_be':
                return Buffer.alloc(2);
            case 'int16_le':
                return Buffer.alloc(2);
            case 'uint16_be':
                return Buffer.alloc(2);
            case 'uint16_le':
                return Buffer.alloc(2);
            case 'int32_be':
                return Buffer.alloc(4);
            case 'int32_le':
                return Buffer.alloc(4);
            case 'uint32_be':
                return Buffer.alloc(4);
            case 'uint32_le':
                return Buffer.alloc(4);
            case 'float_be':
                return Buffer.alloc(4);
            case 'float_le':
                return Buffer.alloc(4);
            case 'double_be':
                return Buffer.alloc(8);
            case 'double_le':
                return Buffer.alloc(8);
            default:
                throw new Error("Couldn't read value because of unknown type: " + handler.config.type);
        }
    }
}
