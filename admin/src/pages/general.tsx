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

        /*// Fix materialize checkboxes
        if (this.chkWriteLogFile != null) {
            $(this.chkWriteLogFile).on('click', this.handleChange as any);
        }

        // Try to retrieve a list of serial ports
        sendTo(null, 'getSerialPorts', null, ({ error, result }) => {
            if (error) {
                console.error(error);
            } else if (result && result.length) {
                this.setState({ _serialports: result });
            }
        });*/
    }

    public componentDidUpdate(): void {
        // update floating labels in materialize design
        M.updateTextFields();
    }

    public render(): ReactNode {
        return (
            <>
                <div className="row">
                    <div className="col s6">
                        <label htmlFor="busNumber">
                            <input
                                type="number"
                                className="value"
                                id="busNumber"
                                value={this.state.busNumber}
                                onChange={this.handleChange}
                            />
                            <Label for="busNumber" text="Bus Number" />
                        </label>
                    </div>
                </div>
            </>
        );
    }
}
