import * as React from 'react';

import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';
import { Label } from 'iobroker-react-components';

import { PCF8574Config } from '../../../src/devices/pcf8574';
import { boundMethod } from 'autobind-decorator';
import { CheckboxLabel } from '../components/checkbox-label';

class PCF8574 extends DeviceBase<PCF8574Config> {
    constructor(props: DeviceProps<PCF8574Config>) {
        super(props);

        // TODO: add support for interrupt (as was available in JS version of this adapter)

        let config: PCF8574Config;
        if (!props.config) {
            config = {
                pollingInterval: 200,
                pins: [],
            };

            for (let i = 0; i < 8; i++) {
                config.pins[i] = { dir: 'out' };
            }

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        console.log('new PCF8574()', props, config);
        this.state = config;
    }

    static getAllAddresses(baseAddress: number): number[] {
        const addresses: number[] = [];
        for (let i = 0; i < 8; i++) {
            addresses.push(baseAddress + i);
        }

        return addresses;
    }

    @boundMethod
    protected onDirChange(event: React.FormEvent<HTMLElement>): boolean {
        this.handleCheckboxChange(event, 'in', 'out');
        return false;
    }

    @boundMethod
    protected onInvChange(event: React.FormEvent<HTMLElement>): boolean {
        this.handleCheckboxChange(event, true);
        return false;
    }

    protected handleCheckboxChange(
        event: React.FormEvent<HTMLElement>,
        onValue: string | boolean,
        offValue?: string | boolean,
    ): void {
        const target = event.target as HTMLInputElement;
        const parts = target.id.split('-');
        const index = parseInt(parts[2]);

        const pins = [...this.state.pins];
        const wasChecked = pins[index][parts[1]] === onValue;
        const value = wasChecked ? offValue : onValue;
        pins[index][parts[1]] = value;

        this.doHandleChange('pins', pins);
    }

    public render(): React.ReactNode {
        return (
            <>
                <div className="row">
                    <div className="col s6 input-field">
                        <input
                            type="number"
                            className="value"
                            id={`${this.address}-pollingInterval`}
                            value={this.state.pollingInterval}
                            onChange={this.handleChange}
                        />
                        <Label for={`${this.address}-pollingInterval`} text="Polling Interval (ms)" />
                    </div>
                </div>
                {this.state.pins.map((pin, i) => (
                    <div key={i} className="row">
                        <div className="col s2 input-field">{`${_('Pin')} ${i + 1}`}</div>
                        <div className="col s4 input-field">
                            <div className="switch">
                                <label>
                                    {_('Output')}
                                    <input
                                        type="checkbox"
                                        id={`${this.address}-dir-${i}`}
                                        checked={pin.dir === 'in'}
                                        onChange={this.onDirChange}
                                    />
                                    <span className="lever"></span>
                                    {_('Input')}
                                </label>
                            </div>
                        </div>
                        <div className="col s3">
                            <p>
                                <label htmlFor={`${this.address}-inv-${i}`}>
                                    <input
                                        type="checkbox"
                                        className="value"
                                        id={`${this.address}-inv-${i}`}
                                        checked={!!pin.inv}
                                        onChange={this.onInvChange}
                                    />
                                    <CheckboxLabel text="inverted" />
                                </label>
                            </p>
                        </div>
                    </div>
                ))}
            </>
        );
    }
}

export const Infos: DeviceInfo[] = [
    { name: 'PCF8574', addresses: PCF8574.getAllAddresses(0x20), type: 'PCF8574', react: PCF8574 },
    { name: 'PCF8574A', addresses: PCF8574.getAllAddresses(0x38), type: 'PCF8574', react: PCF8574 },
];
