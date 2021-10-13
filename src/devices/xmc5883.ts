import { I2CDeviceConfig } from '../lib/adapter-config';
import { I2cAdapter } from '../main';
import { DeviceHandlerBase } from './device-handler-base';

export interface xMC5883Config {
    /** in ms */
    refreshInterval: number;

    /** object ID */
    interrupt?: string;

    /** register value */
    range: number;

    /** register value */
    oversampling: number;
}

interface Measurement {
    x: number;
    y: number;
    z: number;
}

interface ReadConfig {
    useInterrupt: boolean;
    pollingInterval: number;
    gainFactor: number;
}

export default class xMC5883 extends DeviceHandlerBase<xMC5883Config> {
    private readonly configureDeviceAsync: () => Promise<ReadConfig>;
    private readonly readValuesAsync: () => Promise<Measurement>;

    private gainFactor = 0;

    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(deviceConfig, adapter);

        if (this.name == 'QMC5883L') {
            this.configureDeviceAsync = this.configureQMC5883Async;
            this.readValuesAsync = this.readQMC5883Async;
        } else {
            this.configureDeviceAsync = this.configureHMC5883Async;
            this.readValuesAsync = this.readHMC5883Async;
        }
    }

    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObjectAsync(this.hexAddress, {
            type: 'device',
            common: {
                name: this.hexAddress + ' (' + this.name + ')',
            },
            native: this.config as any,
        });

        await Promise.all(
            ['X', 'Y', 'Z'].map(async (coord) => {
                await this.adapter.extendObjectAsync(`${this.hexAddress}.${coord.toLowerCase()}`, {
                    type: 'state',
                    common: {
                        name: `${this.hexAddress} ${coord}`,
                        read: true,
                        write: false,
                        type: 'number',
                        role: 'value.direction',
                        unit: 'Gs',
                    },
                });
            }),
        );

        const { useInterrupt, gainFactor, pollingInterval } = await this.configureDeviceAsync();
        if (useInterrupt && this.config.interrupt) {
            try {
                // check if interrupt object exists
                await this.adapter.getObjectAsync(this.config.interrupt);

                // subscribe to the object and add change listener
                this.adapter.addForeignStateChangeListener(this.config.interrupt, async (_value) => {
                    this.debug('Interrupt detected');
                    await this.updateValuesAsync(gainFactor);
                });

                this.debug('Interrupt enabled');
            } catch (error) {
                this.error(`Interrupt object ${this.config.interrupt} not found!`);
            }
        } else {
            this.startPolling(() => this.updateValuesAsync(gainFactor), pollingInterval - 3);
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
    }

    private async configureQMC5883Async(): Promise<ReadConfig> {
        let useInterrupt: boolean;
        let pollingInterval: number;
        let ctrl1 = this.config.oversampling << 6;
        ctrl1 |= this.config.range << 4;
        if (this.config.refreshInterval >= 100) {
            ctrl1 |= 0 << 2;
            pollingInterval = this.config.refreshInterval;
            useInterrupt = false;
        } else if (this.config.refreshInterval >= 20) {
            ctrl1 |= 1 << 2;
            pollingInterval = 50;
            useInterrupt = true;
        } else if (this.config.refreshInterval >= 10) {
            ctrl1 |= 2 << 2;
            pollingInterval = 100;
            useInterrupt = true;
        } else {
            ctrl1 |= 3 << 2;
            pollingInterval = 200;
            useInterrupt = true;
        }
        ctrl1 |= 1;

        await this.writeByte(0x09, ctrl1);

        // enable interrupt if needed
        const ctrl2 = this.config.interrupt ? 1 : 0;
        await this.writeByte(0x0a, ctrl2);

        return { useInterrupt, pollingInterval, gainFactor: (this.config.range === 0 ? 2 : 8) / 32768 };
    }

    private async configureHMC5883Async(): Promise<ReadConfig> {
        let useInterrupt = true;
        let pollingInterval: number;
        let cra = this.config.oversampling << 5;
        if (this.config.refreshInterval >= 1333) {
            cra |= 0 << 2;
            pollingInterval = 1333;
        } else if (this.config.refreshInterval >= 666) {
            cra |= 1 << 2;
            pollingInterval = 666;
        } else if (this.config.refreshInterval >= 333) {
            cra |= 2 << 2;
            pollingInterval = 333;
        } else if (this.config.refreshInterval >= 133) {
            cra |= 3 << 2;
            pollingInterval = 133;
        } else if (this.config.refreshInterval >= 66) {
            cra |= 4 << 2;
            pollingInterval = 66;
        } else if (this.config.refreshInterval >= 33) {
            cra |= 5 << 2;
            pollingInterval = 33;
        } else {
            cra |= 6 << 2;
            pollingInterval = 13;
        }

        await this.writeByte(0x00, cra);

        const crb = this.config.range << 5;
        await this.writeByte(0x01, crb);

        let mode = 0;
        if (this.config.refreshInterval >= 2000) {
            // single measurement mode
            mode = 1;
            useInterrupt = false;
            pollingInterval = this.config.refreshInterval;
        }
        await this.writeByte(0x02, mode);

        let range: number;
        switch (this.config.range) {
            case 0:
                range = 0.88;
                break;
            case 1:
                range = 1.3;
                break;
            case 2:
                range = 1.9;
                break;
            case 3:
                range = 2.5;
                break;
            case 4:
                range = 4.0;
                break;
            case 5:
                range = 4.7;
                break;
            case 6:
                range = 5.6;
                break;
            default:
                range = 8.1;
                break;
        }

        return { useInterrupt, pollingInterval, gainFactor: range / 32768 };
    }

    private async readQMC5883Async(): Promise<Measurement> {
        let ready = false;
        let status = 0;
        for (let i = 0; i < 10 && !ready; i++) {
            status = await this.readByte(0x06);
            ready = !!(status & 0x01);
        }
        if (!ready) {
            throw new Error(`Didn't get ready bit set after 10 tries`);
        }
        if (status & 0x02) {
            throw new Error(`Measurement overflow`);
        }

        const buffer = Buffer.alloc(6);
        await this.readI2cBlock(0x00, buffer.length, buffer);
        return {
            x: buffer.readInt16LE(0),
            y: buffer.readInt16LE(2),
            z: buffer.readInt16LE(4),
        };
    }

    private async readHMC5883Async(): Promise<Measurement> {
        if (this.config.refreshInterval >= 2000) {
            // set single measurement mode again
            await this.configureHMC5883Async();
        }

        let ready = false;
        for (let i = 0; i < 20 && !ready; i++) {
            const status = await this.readByte(0x09);
            ready = !!(status & 0x01);
        }
        if (!ready) {
            throw new Error(`Didn't get ready bit set after 20 tries`);
        }

        const buffer = Buffer.alloc(6);
        await this.readI2cBlock(0x03, buffer.length, buffer);
        return {
            x: buffer.readInt16BE(0),
            y: buffer.readInt16BE(4),
            z: buffer.readInt16BE(2),
        };
    }

    private async updateValuesAsync(gainFactor: number): Promise<void> {
        let measurement: Measurement;
        try {
            this.debug('Reading values');
            measurement = await this.readValuesAsync();
            this.debug(`Read ${JSON.stringify(measurement)}`);
        } catch (e) {
            this.error(`Couldn't read values: ${e}`);
            return;
        }
        this.setStateAck('x', measurement.x * gainFactor);
        this.setStateAck('y', measurement.y * gainFactor);
        this.setStateAck('z', measurement.z * gainFactor);
    }
}
