import * as React from 'react';

import { ReactNode } from 'react';

import { I2CDeviceConfig, ImplementationConfigBase, toHexString } from '../../../src/lib/shared';
import { Label } from '../components/label';
import { Dropdown } from '../components/dropdown';
import { DeviceFactory, DeviceInfo } from '../devices/device-factory';
import { boundMethod } from 'autobind-decorator';

type OnConfigChangedCallback = (newConfig: I2CDeviceConfig) => void;

interface DeviceTabProps {
    onChange: OnConfigChangedCallback;
    config: I2CDeviceConfig;
}

interface DeviceTabState {
    config: I2CDeviceConfig;
}

export class DeviceTab extends React.Component<DeviceTabProps, DeviceTabState> {
    private oldConfig?: I2CDeviceConfig;
    private oldComponent?: ReactNode;

    constructor(props: DeviceTabProps) {
        super(props);
        this.state = {
            config: props.config,
        };
    }

    public get address(): number {
        return this.props.config.address;
    }

    private get deviceOptions(): Record<string, string> {
        const options = {
            '': _('Unused'),
        };
        const supportedDevices = DeviceFactory.getSupportedDevices(this.state.config.address);
        supportedDevices.forEach((device) => {
            options[JSON.stringify(device)] = device.name;
        });
        return options;
    }

    private get selectedDeviceOption(): string | undefined {
        const supportedDevices = DeviceFactory.getSupportedDevices(this.state.config.address);
        const device = supportedDevices.find(
            (device) => device.type === this.state.config.type && device.name === this.state.config.name,
        );
        return device ? JSON.stringify(device) : undefined;
    }

    private get component(): ReactNode {
        if (
            this.oldConfig &&
            this.oldConfig.name === this.state.config.name &&
            this.oldConfig.type === this.state.config.type
        ) {
            // ensure we reuse the component unless the type/name has changed
            return this.oldComponent;
        }

        this.oldConfig = { ...this.state.config };
        const DeviceComponent = DeviceFactory.createComponent(this.state.config);
        if (!DeviceComponent) {
            this.oldComponent = undefined;
        } else {
            const implConfig: ImplementationConfigBase = this.state.config[this.state.config.type ?? ''];
            this.oldComponent = (
                <DeviceComponent
                    onChange={this.onDeviceConfigChanged}
                    config={implConfig}
                    baseConfig={this.state.config}
                />
            );
        }
        return this.oldComponent;
    }

    @boundMethod
    private onDeviceTypeSelected(value: string): void {
        const newConfig = { ...this.state.config };
        if (value) {
            const device = JSON.parse(value) as DeviceInfo;
            newConfig.type = device.type;
            newConfig.name = device.name;
        } else {
            delete newConfig.type;
            delete newConfig.name;
        }
        this.setState({ config: newConfig }, () => this.props.onChange(this.state.config));
    }

    @boundMethod
    private onDeviceConfigChanged(newConfig: any): void {
        console.log('onDeviceConfigChanged', newConfig);
        const baseConfig = { ...this.state.config };
        baseConfig[this.state.config.type || ''] = newConfig;
        this.setState({ config: baseConfig }, () => this.props.onChange(this.state.config));
    }

    public render(): ReactNode {
        return (
            <>
                <div className="row">
                    <div className="col s2 input-field">
                        <input
                            type="text"
                            className="value"
                            id={`${this.address}-address`}
                            value={toHexString(this.address)}
                            disabled
                        />
                        <Label for={`${this.address}-address`} text="Address" />
                    </div>
                    <div className="col s4 input-field">
                        <Dropdown
                            id={`${this.address}-type`}
                            options={this.deviceOptions}
                            selectedOption={this.selectedDeviceOption}
                            selectedChanged={this.onDeviceTypeSelected}
                        />
                        <Label for={`${this.address}-type`} text={_('Device Type')} />
                    </div>
                </div>
                {this.component}
            </>
        );
    }
}
