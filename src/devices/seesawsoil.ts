import type { DeviceHandlerInfo } from './device-handler-base';
import { SeesawHandlerBase } from './seesaw-handler-base';

export interface SeesawSoilConfig {
    /** in seconds */
    pollingInterval: number;
}

/**
 * Based on https://github.com/adafruit/Adafruit_Seesaw/blob/master/examples/soil_sensor/soilsensor_example/soilsensor_example.ino
 */
export class SeesawSoilHandler extends SeesawHandlerBase<SeesawSoilConfig> {
    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObject(this.hexAddress, {
            type: 'device',
            common: {
                name: `${this.hexAddress} (${this.name})`,
                role: 'sensor',
            },
            native: this.deviceConfig,
        });

        await this.adapter.extendObject(`${this.hexAddress}.temperature`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Temperature`,
                read: true,
                write: false,
                type: 'number',
                role: 'value.temperature',
                unit: '°C',
            },
        });

        await this.adapter.extendObject(`${this.hexAddress}.capacitive`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Capacitive`,
                read: true,
                write: false,
                type: 'number',
                role: 'value',
            },
        });

        await this.adapter.extendObject(`${this.hexAddress}.measure`, {
            type: 'state',
            common: {
                name: `${this.hexAddress} Measure`,
                read: false,
                write: true,
                type: 'boolean',
                role: 'button',
            },
        });

        this.adapter.addStateChangeListener(
            `${this.hexAddress}.measure`,
            async () => await this.readCurrentValuesAsync(),
        );

        if (!(await this.begin())) {
            throw new Error('Seesaw not found');
        }

        if (this.config.pollingInterval > 0) {
            this.startPolling(
                async () => await this.readCurrentValuesAsync(),
                this.config.pollingInterval * 1000,
                1000,
            );
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
        return Promise.resolve();
    }

    async readCurrentValuesAsync(): Promise<void> {
        try {
            const tempC = await this.getTemp();
            const capread = await this.touchRead(0);

            await this.setStateAckAsync('temperature', tempC);
            await this.setStateAckAsync('capacitive', capread);
        } catch (e: any) {
            this.error(`Couldn't read current values: ${e}`);
        }
    }
}

export const SeesawSoil: DeviceHandlerInfo = {
    type: 'SeesawSoil',
    createHandler: (deviceConfig, adapter) => new SeesawSoilHandler(deviceConfig, adapter),
    names: [{ name: 'Seesaw', addresses: [0x36] }],
    config: {
        'SeesawSoil.pollingInterval': {
            type: 'number',
            label: 'Polling Interval',
            default: 60,
            unit: 'sec',
            min: 0,
            xs: 7,
            sm: 5,
            md: 3,
        },
    },
};
