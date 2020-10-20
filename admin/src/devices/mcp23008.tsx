import * as React from 'react';
import { boundMethod } from 'autobind-decorator';
import { Checkbox, FormControlLabel, Grid, TextField } from '@material-ui/core';
import I18n from '@iobroker/adapter-react/i18n';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';
import { MCP230xxConfig, PinConfig, PinDirection } from '../../../src/devices/mcp230xx-base';
import Dropdown, { DropdownOption } from '../components/dropdown';

interface PinEditorProps {
    index: number;
    config: PinConfig;
    onChange: (index: number, config: PinConfig) => void;
}

class PinEditor extends React.Component<PinEditorProps, PinConfig> {
    private readonly dirOptions: DropdownOption[] = [
        { value: 'in-no', title: 'Input without pull-up resistor' },
        { value: 'in-pu', title: 'Input with pull-up resistor' },
        { value: 'out', title: 'Output' },
    ];

    constructor(props: PinEditorProps) {
        super(props);

        this.state = { ...props.config };
    }

    @boundMethod
    private onDirChange(value: string) {
        this.setState({ dir: value as PinDirection }, () => this.props.onChange(this.props.index, this.state));
    }

    @boundMethod
    private onInvChange(_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) {
        this.setState({ inv: checked ? true : undefined }, () => this.props.onChange(this.props.index, this.state));
    }

    public render(): React.ReactNode {
        const { index } = this.props;
        return (
            <Grid container spacing={3}>
                <Grid item xs style={{ paddingTop: '23px' }}>
                    {`${I18n.t('Pin')} ${index + 1}`}
                </Grid>
                <Grid item xs>
                    <Dropdown
                        attr="dir"
                        options={this.dirOptions}
                        value={this.state.dir}
                        onChange={this.onDirChange}
                        style={{ paddingTop: '3px' }}
                    />
                </Grid>
                <Grid item xs style={{ paddingTop: '11px' }}>
                    <FormControlLabel
                        control={<Checkbox checked={this.state.inv} onChange={this.onInvChange} name="inv" />}
                        label={I18n.t('inverted')}
                    />
                </Grid>
            </Grid>
        );
    }
}

class MCP23008 extends DeviceBase<MCP230xxConfig> {
    constructor(props: DeviceProps<MCP230xxConfig>) {
        super(props);

        // TODO: add support for interrupt (as was available in JS version of this adapter)

        let config: MCP230xxConfig;
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
    protected onPinChange(index: number, config: PinConfig): void {
        const pins = [...this.state.pins];
        pins[index] = config;
        this.doHandleChange('pins', pins);
    }

    public render(): React.ReactNode {
        return (
            <>
                <Grid container spacing={3}>
                    <Grid item xs>
                        <TextField
                            name="pollingInterval"
                            label={I18n.t('Polling Interval (ms)')}
                            value={this.state.pollingInterval}
                            type="number"
                            margin="normal"
                            onChange={this.handleChange}
                        />
                    </Grid>
                </Grid>
                {this.state.pins.map((pin, i) => (
                    <PinEditor key={`pin-${i}`} index={i} config={pin} onChange={this.onPinChange}></PinEditor>
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
