import * as React from 'react';
import { boundMethod } from 'autobind-decorator';
import { Button, Checkbox, FormControlLabel, Grid, TextField } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import I18n from '@iobroker/adapter-react/i18n';
import SelectID from '@iobroker/adapter-react/Dialogs/SelectID';
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
                <Grid item xs={2} md={1} style={{ paddingTop: '23px' }}>
                    <strong>{`${I18n.t('Pin')} ${index + 1}`}</strong>
                </Grid>
                <Grid item xs={7} sm={6} md={4} lg={3}>
                    <Dropdown
                        attr={`dir-${index}`}
                        options={this.dirOptions}
                        value={this.state.dir}
                        onChange={this.onDirChange}
                        style={{ paddingTop: '3px' }}
                    />
                </Grid>
                <Grid item xs={2} style={{ paddingTop: '11px' }}>
                    <FormControlLabel
                        control={<Checkbox checked={this.state.inv} onChange={this.onInvChange} name="inv" />}
                        label={I18n.t('inverted')}
                    />
                </Grid>
            </Grid>
        );
    }
}

class MCP23008 extends DeviceBase<MCP230xxConfig, { showIdDialog: boolean }> {
    constructor(props: DeviceProps<MCP230xxConfig>) {
        super(props);

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
        config.interrupt = config.interrupt || '';
        console.log('new MCP23008()', props, config);
        this.state = { config: config, extra: { showIdDialog: false } };
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
    protected selectInterruptId(): void {
        this.setExtraState({ showIdDialog: true });
    }

    @boundMethod
    protected onPinChange(index: number, config: PinConfig): void {
        const pins = [...this.state.config.pins];
        pins[index] = config;
        this.doHandleChange('pins', pins);
    }

    private onInterruptSelected(selected?: string) {
        this.setExtraState({ showIdDialog: false });
        if (selected) {
            this.doHandleChange('interrupt', selected);
        }
    }

    public render(): React.ReactNode {
        return (
            <>
                {this.state.extra?.showIdDialog && (
                    <SelectID
                        socket={this.props.context.socket}
                        notEditable={false}
                        selected={this.state.config.interrupt}
                        onClose={() => this.onInterruptSelected()}
                        onOk={(selected) => this.onInterruptSelected(selected)}
                    ></SelectID>
                )}
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <TextField
                            name="pollingInterval"
                            label={I18n.t('Polling Interval (ms)')}
                            value={this.state.config.pollingInterval}
                            type="number"
                            margin="normal"
                            onChange={this.handleChange}
                        />
                    </Grid>
                </Grid>
                <Grid container spacing={3}>
                    <Grid item xs={9} md={6}>
                        <TextField
                            name="interrupt"
                            label={I18n.t('Interrupt object')}
                            value={this.state.config.interrupt}
                            type="text"
                            margin="normal"
                            onChange={this.handleChange}
                            style={{ width: '100%' }}
                        />
                    </Grid>
                    <Grid item xs={3} md={6}>
                        <Button variant="contained" onClick={this.selectInterruptId} style={{ marginTop: '22px' }}>
                            <AddCircleOutlineIcon />
                        </Button>
                    </Grid>
                </Grid>
                {this.state.config.pins.map((pin, i) => (
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
