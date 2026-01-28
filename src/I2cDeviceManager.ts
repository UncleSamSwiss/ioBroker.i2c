import type {
    ActionContext,
    DeviceInfo,
    DeviceRefresh,
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

export class I2cDeviceManagement extends DeviceManagement<I2cAdapter> {
    protected override async getInstanceInfo(): Promise<InstanceDetails> {
        const info = await super.getInstanceInfo();
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

    protected override async listDevices(): Promise<DeviceInfo[]> {
        const devices: DeviceInfo[] = [];
        try {
            const deviceObjects = await this.adapter.getDevicesAsync();
            const existingDevices = deviceObjects.map(d => ({ ...d, native: d.native as I2CDeviceConfig }));
            const foundAddresses = await this.adapter.searchDevicesAsync(this.adapter.config.busNumber);
            const allAddresses = new Set<number>(foundAddresses);
            existingDevices.forEach(d => allAddresses.add(d.native.address));

            // Comment in this code for debugging to show all possible addresses:
            /*for (let i = 0x07; i <= 0x77; i++) {
                allAddresses.add(i);
            }*/

            const sortedAddresses = Array.from(allAddresses).sort((a, b) => a - b);
            for (const address of sortedAddresses) {
                const deviceObject = existingDevices.find(d => d.native.address === address);
                const connected = foundAddresses.includes(address);
                const hex = toHexString(address);
                devices.push({
                    id: hex,
                    name: deviceObject ? deviceObject.common.name : `${hex} (Unused)`,
                    icon: DefaultIcon,
                    enabled: !!deviceObject,
                    status: connected ? 'connected' : 'disconnected',
                    model: deviceObject?.native.name,
                    actions: [
                        {
                            id: 'settings',
                            icon: 'settings',
                            handler: deviceObject
                                ? (deviceId, context) => this.showDeviceSettings(deviceId, context)
                                : undefined,
                        },
                        {
                            id: ACTIONS.ENABLE_DISABLE,
                            handler: (deviceId, context) =>
                                deviceObject
                                    ? this.disableDevice(deviceId, context)
                                    : this.showDeviceSettings(deviceId, context),
                        },
                    ],
                });
            }
        } catch (error: any) {
            this.log.error(`Error listing I2C devices: ${error}`);
        }
        return devices;
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
        deviceId: string,
        context: ActionContext,
    ): Promise<{
        refresh: DeviceRefresh;
    }> {
        const address = parseInt(deviceId.substring(2), 16);
        const names = AllDevices.flatMap(d => d.names)
            .filter(n => n.name !== 'Generic' && n.addresses.includes(address))
            .map(n => n.name)
            .sort();
        const form: JsonFormSchema = {
            type: 'panel',
            items: {
                name: {
                    type: 'select',
                    label: 'Device Type',
                    options: [
                        {
                            value: '',
                            label: 'Unused',
                        },
                        ...names.map(n => ({
                            value: n,
                            label: n,
                        })),
                        {
                            value: 'generic',
                            label: 'Generic',
                        },
                    ],
                    xs: 12,
                    sm: 6,
                    md: 4,
                },
                ...AllDevices.flatMap(d =>
                    d.names.map(n => ({ ...n, type: d.type, config: { ...d.config, ...n.config } })),
                )
                    .filter(n => n.addresses.includes(address))
                    .reduce(
                        (acc, n) => ({
                            ...acc,
                            [`_${n.name}`]: {
                                type: 'panel',
                                hidden: `data.name !== '${n.name}'`,
                                items: n.config,
                                xs: 12,
                            },
                        }),
                        {},
                    ),
            },
        };
        console.log('FORM', JSON.stringify(form, null, 2));
        const existingHandler = this.adapter.handlers.find(d => d.address === address);
        let data: JsonFormData | undefined = existingHandler?.deviceConfig ?? { name: '' };
        data = await context.showForm(form, {
            data,
            title: `Settings for device at address ${deviceId}`,
            buttons: ['apply', 'cancel'],
        });

        if (!data) {
            return { refresh: false };
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

        return { refresh: true };
    }

    private async disableDevice(
        deviceId: string,
        context: ActionContext,
    ): Promise<{
        refresh: DeviceRefresh;
    }> {
        const confirmed = await context.showConfirmation(
            `Are you sure you want to disable and remove the device at address ${deviceId}?`,
        );
        if (!confirmed) {
            return { refresh: false };
        }
        await this.adapter.deleteHandler(deviceId);
        return { refresh: true };
    }
}
