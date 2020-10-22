import * as React from 'react';
import { boundMethod } from 'autobind-decorator';
import { Grid, TextField } from '@material-ui/core';
import I18n from '@iobroker/adapter-react/i18n';
import { I2CDeviceConfig, ImplementationConfigBase } from '../../../src/lib/adapter-config';
import { DeviceFactory, DeviceInfo } from '../devices/device-factory';
import Dropdown, { DropdownOption } from '../components/dropdown';
import { toHexString } from '../../../src/lib/shared';
import { AppContext } from '../common';

type OnConfigChangedCallback = (newConfig: I2CDeviceConfig) => void;

interface DeviceTabProps {
    onChange: OnConfigChangedCallback;
    context: AppContext;
    config: I2CDeviceConfig;
}

interface DeviceTabState {
    config: I2CDeviceConfig;
}

export class DeviceTab extends React.Component<DeviceTabProps, DeviceTabState> {
    private oldConfig?: I2CDeviceConfig;
    private oldComponent?: React.ReactNode;

    constructor(props: DeviceTabProps) {
        super(props);
        this.state = {
            config: props.config,
        };
    }

    public get address(): number {
        return this.props.config.address;
    }

    private get deviceOptions(): DropdownOption[] {
        const options = [{ title: I18n.t('Unused'), value: '' }];
        const supportedDevices = DeviceFactory.getSupportedDevices(this.address);
        supportedDevices.forEach((device) => {
            options.push({ title: device.name, value: JSON.stringify(device) });
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

    private renderDeviceComponent(): React.ReactNode {
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
                    context={this.props.context}
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

    public render(): React.ReactNode {
        return (
            <>
                <Grid container spacing={3}>
                    <Grid item xs={3} md={1}>
                        <TextField
                            name="address"
                            label={I18n.t('Address')}
                            value={toHexString(this.state.config.address)}
                            type="text"
                            fullWidth
                            disabled={true}
                        />
                    </Grid>
                    <Grid item xs={4} md={2}>
                        <Dropdown
                            title="Device Type"
                            attr="type"
                            options={this.deviceOptions}
                            value={this.selectedDeviceOption}
                            onChange={this.onDeviceTypeSelected}
                        ></Dropdown>
                    </Grid>
                </Grid>
                {this.renderDeviceComponent()}
            </>
        );
    }
}
