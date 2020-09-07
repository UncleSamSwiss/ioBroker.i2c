import * as React from 'react';

import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';
import { Label } from 'iobroker-react-components';

import { MCP23008Config } from '../../../src/devices/mcp23008';
import { boundMethod } from 'autobind-decorator';
import { CheckboxLabel } from '../components/checkbox-label';
import { Dropdown } from '../components/dropdown';

class MCP23008 extends DeviceBase<MCP23008Config> {
    private readonly dirOptions = {
        'in-no': _('Input without pull-up resistor'),
        'in-pu': _('Input with pull-up resistor'),
        out: _('Output'),
    };
    constructor(props: DeviceProps<MCP23008Config>) {
        super(props);

        // TODO: add support for interrupt (as was available in JS version of this adapter)

        let config: MCP23008Config;
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
        console.log('new MCP23008()', props, config);
        this.state = config;
    }

    static getAllAddresses(): number[] {
        const addresses: number[] = [];
        const baseAddress = 0x20;
        for (let i = 0; i < 8; i++) {
            addresses.push(baseAddress + i);
        }

        return addresses;
    }

    @boundMethod
    protected onDirSelected(index: number, value: string): void {
        const pins = [...this.state.pins];
        pins[index].dir = value as any;

        this.doHandleChange('pins', pins);
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
                        <div className="col s4">
                            <Dropdown
                                id={`${this.address}-dir-${i}`}
                                options={this.dirOptions}
                                selectedOption={this.state.pins[i].dir}
                                selectedChanged={(value) => this.onDirSelected(i, value)}
                            />
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

export const Info: DeviceInfo = {
    name: 'MCP23008',
    addresses: MCP23008.getAllAddresses(),
    type: 'MCP23008',
    react: MCP23008,
};
