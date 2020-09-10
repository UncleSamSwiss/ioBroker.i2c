/*
 * NOTICE:
 * A lot of this code is based on https://github.com/skylarstein/BH1750-sensor
 * We need this to use the same I2C instance as for all other devices; thus the rewrite.
MIT License

Copyright (c) 2016 Skylar Stein

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */
import { ImplementationConfigBase } from '../lib/shared';
import { round } from '../lib/utils';
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

            await this.setStateAckAsync('lux', round(lux));
        } catch (e) {
            this.error("Couldn't read current values: " + e);
        }
    }
}
