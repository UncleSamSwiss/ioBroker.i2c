import type {
    ActionContext,
    DeviceInfo,
    DeviceLoadContext,
    DeviceRefreshResponse,
    InstanceDetails,
    JsonFormData,
    JsonFormSchema,
} from '@iobroker/dm-utils';
import { ACTIONS, DeviceManagement } from '@iobroker/dm-utils';
import { AllDevices } from './devices/all-devices';
import type { I2CDeviceConfig } from './lib/adapter-config';
import { Delay } from './lib/async';
import { indexedToArray, toHexString } from './lib/shared';
import type { I2cAdapter } from './main';

const changeBusNumberForm: JsonFormSchema = {
    type: 'panel',
    items: {
        busNumber: {
            type: 'number',
            label: 'Bus number',
            xs: 12,
            min: 0,
            max: 255,
            help: 'Changing the bus number will restart the adapter',
        },
    },
};

const DefaultIcon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJNMTUgOUg5djZoNlY5em0tMiA0aC0ydi0yaDJ2MnptOC0yVjloLTJWN2MwLTEuMS0uOS0yLTItMmgtMlYzaC0ydjJoLTJWM0g5djJIN2MtMS4xIDAtMiAuOS0yIDJ2MkgzdjJoMnYySDN2MmgydjJjMCAxLjEuOSAyIDIgMmgydjJoMnYtMmgydjJoMnYtMmgyYzEuMSAwIDItLjkgMi0ydi0yaDJ2LTJoLTJ2LTJoMnptLTQgNkg3VjdoMTB2MTB6Ii8+PC9zdmc+';

type HexDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
type I2cDeviceId = `0x${HexDigit}${HexDigit}`;

/**
 * I2C device manager
 */
export class I2cDeviceManagement extends DeviceManagement<I2cAdapter, I2cDeviceId> {
    protected override async getInstanceInfo(): Promise<InstanceDetails> {
        const info = await super.getInstanceInfo();
        info.identifierLabel = 'Address';
        if (!info.actions) {
            info.actions = [];
        }
        info.actions.push({
            id: 'configureBus',
            title: `Bus number: ${this.adapter.config.busNumber}`,
            icon: 'settings',
            description: 'Configure the I2C bus number used by the adapter',
            handler: (context: ActionContext) => this.changeBusNumber(context),
        });
        return info;
    }

    protected override async loadDevices(context: DeviceLoadContext<I2cDeviceId>): Promise<void> {
        try {
            const [deviceObjects, foundAddresses] = await Promise.all([
                this.adapter.getDevicesAsync(),
                this.searchDevices(),
            ]);
            const existingDevices = deviceObjects.map(d => ({ ...d, native: d.native as I2CDeviceConfig }));
            const allAddresses = new Set<number>(foundAddresses);
            existingDevices.forEach(d => allAddresses.add(d.native.address));

            // Comment in this code for debugging to show all possible addresses:
            /*for (let i = 0x07; i <= 0x77; i++) {
                allAddresses.add(i);
            }*/

            context.setTotalDevices(allAddresses.size);

            const sortedAddresses = Array.from(allAddresses).sort((a, b) => a - b);
            for (const address of sortedAddresses) {
                const deviceObject = existingDevices.find(d => d.native.address === address);
                const connected = foundAddresses.includes(address);
                context.addDevice(this.createDeviceInfo(address, deviceObject, connected));
            }
        } catch (error: any) {
            this.log.error(`Error listing I2C devices: ${error}`);
        }
    }

    private createDeviceInfo(address: number, device?: ioBroker.Object, connected?: boolean): DeviceInfo<I2cDeviceId> {
        const hex = toHexString(address) as I2cDeviceId;
        return {
            id: hex,
            identifier: hex,
            name: device ? { objectId: device._id, property: 'common.name' } : `${hex} (Unused)`,
            icon: DefaultIcon,
            enabled: !!device,
            status: connected ? 'connected' : 'disconnected',
            model: device ? { objectId: device._id, property: 'native.name' } : undefined,
            actions: [
                {
                    id: 'settings',
                    icon: 'settings',
                    handler: device ? (deviceId, context) => this.showDeviceSettings(deviceId, context) : undefined,
                },
                {
                    id: ACTIONS.ENABLE_DISABLE,
                    handler: (deviceId, context) =>
                        device ? this.disableDevice(deviceId, context) : this.showDeviceSettings(deviceId, context),
                },
            ],
        };
    }

    private async changeBusNumber(context: ActionContext): Promise<{
        refresh: boolean;
    }> {
        let data: JsonFormData | undefined = { busNumber: this.adapter.config.busNumber };
        data = await context.showForm(changeBusNumberForm, {
            data,
            title: 'Change I2C Bus Number',
            buttons: ['apply', 'cancel'],
        });
        if (data && typeof data.busNumber === 'number' && data.busNumber !== this.adapter.config.busNumber) {
            // don't await, as adapter restart will happen
            new Delay(200)
                .runAsnyc()
                .then(() => this.adapter.updateConfig({ busNumber: data.busNumber }))
                .catch((e: any) => this.log.warn(`Error changing bus number: ${e}`));
        }

        return { refresh: false };
    }

    private async showDeviceSettings(
        deviceId: I2cDeviceId,
        context: ActionContext,
    ): Promise<DeviceRefreshResponse<I2cDeviceId>> {
        const address = parseInt(deviceId.substring(2), 16);
        const existingHandler = this.adapter.handlers.find(d => d.address === address);
        let name = existingHandler?.deviceConfig.name;

        const names = AllDevices.flatMap(d => d.names)
            .filter(n => n.name !== 'Generic' && n.addresses.includes(address))
            .map(n => n.name)
            .sort();

        if (!existingHandler) {
            this.log.debug(`Configuring new device at address ${deviceId}`);
            const typeData = await context.showForm(
                {
                    type: 'panel',
                    items: {
                        name: {
                            type: 'select',
                            label: 'Device Type',
                            options: [
                                ...names.map(n => ({
                                    value: n,
                                    label: n,
                                })),
                                {
                                    value: 'Generic',
                                    label: 'Generic',
                                },
                            ],
                            format: 'dropdown',
                            xs: 12,
                            sm: 6,
                            md: 4,
                        },
                    },
                },
                {
                    title: `Type of device at address ${deviceId}`,
                    buttons: ['apply', 'cancel'],
                },
            );
            if (typeof typeData?.name !== 'string') {
                return { refresh: 'none' };
            }

            name = typeData.name;
        }

        if (!name) {
            name = 'Generic';
        }

        const deviceInfo = AllDevices.find(d => d.names.some(n => n.name === name));
        const nameInfo = deviceInfo?.names.find(n => n.name === name);
        if (!deviceInfo || !nameInfo) {
            this.log.warn(`Device type ${name} not found for address ${deviceId}`);
            return { refresh: 'none' };
        }

        const form: JsonFormSchema = {
            type: 'panel',
            items: { ...deviceInfo.config, ...nameInfo.config },
        };
        console.log('FORM', JSON.stringify(form, null, 2));
        let data: JsonFormData | undefined = existingHandler?.deviceConfig ?? { name };
        data = await context.showForm(form, {
            data,
            title: `Settings for ${name} at address ${deviceId}`,
            buttons: ['apply', 'cancel'],
        });

        if (!data) {
            return { refresh: 'none' };
        }

        const config = indexedToArray(data) as I2CDeviceConfig;
        config.address = address;
        config.type = AllDevices.find(d => d.names.some(n => n.name === config.name))?.type;

        console.log(`New settings for device ${deviceId}:`, JSON.stringify(config, null, 2));
        try {
            await this.adapter.updateHandler(config);
        } catch (error: any) {
            this.log.error(`Error updating device at address ${deviceId}: ${error}`);
            console.error(error);
        }

        const [obj, foundAddresses] = await Promise.all([this.adapter.getObjectAsync(deviceId), this.searchDevices()]);
        const connected = foundAddresses.includes(address);
        return { update: this.createDeviceInfo(address, obj ?? undefined, connected) };
    }

    private async disableDevice(
        deviceId: I2cDeviceId,
        context: ActionContext,
    ): Promise<DeviceRefreshResponse<I2cDeviceId>> {
        const confirmed = await context.showConfirmation(
            `Are you sure you want to disable and remove the device at address ${deviceId}?`,
        );
        if (!confirmed) {
            return { refresh: 'none' };
        }

        await this.adapter.deleteHandler(deviceId);
        const address = parseInt(deviceId.substring(2), 16);
        const foundAddresses = await this.searchDevices();
        const connected = foundAddresses.includes(address);
        if (!connected) {
            return { delete: deviceId };
        }

        return { update: this.createDeviceInfo(address, undefined, connected) };
    }

    private searchDevices(): Promise<number[]> {
        return this.adapter.searchDevicesAsync(this.adapter.config.busNumber);
    }
}
