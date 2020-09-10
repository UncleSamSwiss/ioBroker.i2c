import { ImplementationConfigBase } from '../lib/shared';
import { DeviceHandlerBase } from './device-handler-base';

export interface BH1750Config extends ImplementationConfigBase {
    pollingInterval: number;
}

export default class BH1750 extends DeviceHandlerBase<BH1750Config> {
    private useAmericanUnits!: boolean;

    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObjectAsync(this.hexAddress, {
            type: 'device',
            common: {
                name: this.hexAddress + ' (' + this.name + ')',
                role: 'illuminance',
            },
            native: this.config as any,
        });

        const systemConfig = await this.adapter.getForeignObjectAsync('system.config');
        this.useAmericanUnits = !!(systemConfig && systemConfig.common && systemConfig.common.tempUnit == '°F');
        this.info(`Using ${this.useAmericanUnits ? 'American' : 'metric'} units`);

        await this.adapter.extendObjectAsync(this.hexAddress + '.lux', {
            type: 'state',
            common: {
                name: this.hexAddress + ' Lux',
                read: true,
                write: false,
                type: 'number',
                role: 'value.lux',
                unit: 'lux',
            },
        });

        await this.adapter.extendObjectAsync(this.hexAddress + '.measure', {
            type: 'state',
            common: {
                name: this.hexAddress + ' Measure',
                read: false,
                write: true,
                type: 'boolean',
                role: 'button',
            },
        });

        this.adapter.addStateChangeListener(
            this.hexAddress + '.measure',
            async () => await this.readCurrentValuesAsync(),
        );

        await this.readCurrentValuesAsync();
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
    }

    private async readCurrentValuesAsync(): Promise<void> {
        this.debug('Reading current values');
        try {
            // Grab illuminance
            const buffer = new Buffer(2);
            await this.readI2cBlock(0x20, 2, buffer);
            this.debug('Buffer' + buffer);
            const lux = (buffer[1] + 256 * buffer[0]) / 1.2;

            this.debug(
                'Read: ' +
                    JSON.stringify({
                        lux: lux,
                    }),
            );

            const rounded = Math.round(lux * 10) / 10;
            await this.adapter.setStateAckAsync(this.hexAddress + '.' + 'lux', rounded);
        } catch (e) {
            this.error("Couldn't read current values: " + e);
        }
    }
}
