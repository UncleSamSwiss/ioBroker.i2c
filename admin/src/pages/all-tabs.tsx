import * as React from 'react';

import { ReactNode } from 'react';

import { OnSettingsChangedCallback, toHexString } from '../lib/common';
import { I2CAdapterConfig, I2CDeviceConfig } from '../../../src/lib/shared';
import { General } from './general';
import { DeviceTab } from './device-tab';

import { boundMethod } from 'autobind-decorator';

interface AllTabsProps {
    onChange: OnSettingsChangedCallback;
    settings: I2CAdapterConfig;
}

export class AllTabs extends React.Component<AllTabsProps, I2CAdapterConfig> {
    constructor(props: AllTabsProps) {
        super(props);
        this.state = { ...props.settings };
    }

    @boundMethod
    private onChange(settings: I2CAdapterConfig): void {
        this.setState(settings, () => this.props.onChange(this.state));
    }

    @boundMethod
    private onDeviceChange(config: I2CDeviceConfig): void {
        console.log('onDeviceChange()', config);
        const index = this.state.devices.findIndex((device) => device.address === config.address);
        if (index >= 0) {
            const newState = { ...this.state };
            newState.devices[index] = config;
            this.onChange(newState);
        }
        //this.setState(settings);
        //this.props.onChange(settings);
    }

    private get labels(): string[] {
        const all = [_('General')];
        this.state.devices.forEach((device) => {
            all.push(toHexString(device.address));
        });
        return all;
    }

    public render(): ReactNode {
        return (
            <>
                <div className="row" id="devices">
                    <div className="tabs-header col s12">
                        <ul className="tabs">
                            {this.labels.map((k, i) => (
                                <li className="tab" key={i}>
                                    <a href={`#devices-${i}`}>{k}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="col s12" key="0" id="devices-0">
                        <General settings={this.props.settings} onChange={this.onChange} />
                    </div>
                    {this.props.settings.devices.map((device, i) => (
                        <div className="col s12" key={i + 1} id={`devices-${i + 1}`} style={{ display: 'none' }}>
                            <DeviceTab key={device.address} config={device} onChange={this.onDeviceChange} />
                        </div>
                    ))}
                </div>
            </>
        );
    }
}
