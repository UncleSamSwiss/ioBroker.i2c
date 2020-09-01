import * as React from 'react';

import { ReactNode } from 'react';

import { OnSettingsChangedCallback } from '../lib/common';
import { I2CAdapterConfig } from '../../../src/lib/shared';
import { Label } from '../components/label';

import { boundMethod } from 'autobind-decorator';

interface GeneralProps {
    onChange: OnSettingsChangedCallback;
    settings: I2CAdapterConfig;
}

interface GeneralState {
    busNumber: number;
}

export class General extends React.Component<GeneralProps, GeneralState> {
    private active = false;

    constructor(props: GeneralProps) {
        super(props);
        // settings are our state
        this.state = {
            ...props.settings,
        };
    }

    private parseChangedSetting(target: HTMLInputElement | HTMLSelectElement): any {
        // Checkboxes in MaterializeCSS are messed up, so we attach our own handler
        // However that one gets called before the underlying checkbox is actually updated,
        // so we need to invert the checked value here
        return target.type === 'checkbox'
            ? !(target as any).checked
            : target.type === 'number'
            ? parseInt(target.value, 10)
            : target.value;
    }

    // gets called when the form elements are changed by the user
    @boundMethod
    private handleChange(event: React.FormEvent<HTMLElement>): boolean {
        const target = event.target as HTMLInputElement | HTMLSelectElement; // TODO: more types
        const value = this.parseChangedSetting(target);
        return this.doHandleChange(target.id as keyof GeneralState, value);
    }

    @boundMethod
    private searchDevices(_event: React.FormEvent<HTMLElement>): boolean {
        if (!this.active) {
            showMessage(_('Enable adapter first'), _('Warning'), 'warning');
            return false;
        }

        sendTo(null, 'search', this.state.busNumber, (result) => {
            if (typeof result === 'string') {
                const addresses = JSON.parse(result) as number[];
                const oldCount = this.props.settings.devices.length;
                addresses.forEach((address) => {
                    if (!this.props.settings.devices.find((d) => d.address === address)) {
                        this.props.settings.devices.push({ address: address });
                        this.props.settings.devices.sort((a, b) => a.address - b.address);
                    }
                });

                if (oldCount != this.props.settings.devices.length) {
                    this.props.onChange(this.props.settings);
                    console.log(this.props.settings);
                }
            }
        });

        return false;
    }

    private doHandleChange(setting: keyof GeneralState, value: any): boolean {
        // store the setting
        this.putSetting(setting, value, () => {
            // and notify the admin UI about changes
            this.props.onChange({ ...this.props.settings, ...this.state });
        });
        return false;
    }

    /**
     * Reads a setting from the state object and transforms the value into the correct format
     * @param key The setting key to lookup
     */
    private getSetting<T>(key: string, defaultValue?: T): T {
        const ret = this.state[key];
        return ret != undefined ? ret : defaultValue;
    }
    /**
     * Saves a setting in the state object and transforms the value into the correct format
     * @param key The setting key to store at
     */
    private putSetting(key: keyof GeneralState, value: any, callback?: () => void): void {
        this.setState({ [key]: value }, callback);
    }

    public componentDidMount(): void {
        // update floating labels in materialize design
        M.updateTextFields();

        // read if instance is active or enabled
        getIsAdapterAlive((isAlive: boolean) => {
            if (isAlive) {
                this.active = true;
            }
        });
    }

    public componentDidUpdate(): void {
        // update floating labels in materialize design
        M.updateTextFields();
    }

    public render(): ReactNode {
        return (
            <>
                <div className="row">
                    <div className="col s3 input-field">
                        <input
                            type="number"
                            className="value"
                            id="busNumber"
                            value={this.state.busNumber}
                            onChange={this.handleChange}
                        />
                        <Label for="busNumber" text="Bus Number" />
                    </div>
                </div>
                <div className="row">
                    <div className="col s6 input-field">
                        <button onClick={this.searchDevices} className="btn">
                            <i className="material-icons left">youtube_searched_for</i>
                            {_('Search Devices')}
                        </button>
                    </div>
                </div>
            </>
        );
    }
}
