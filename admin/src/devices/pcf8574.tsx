import * as React from 'react';
import { boundMethod } from 'autobind-decorator';
import { Button, Checkbox, FormControlLabel, Grid, InputAdornment, TextField } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import I18n from '@iobroker/adapter-react/i18n';
import SelectID from '@iobroker/adapter-react/Dialogs/SelectID';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';
import ToggleSwitch from '../components/toggle-switch';
import { PCF8574Config, PinConfig } from '../../../src/devices/pcf8574';

interface PinEditorProps {
    index: number;
    config: PinConfig;
    onChange: (index: number, config: PinConfig) => void;
}

class PinEditor extends React.Component<PinEditorProps, PinConfig> {
    constructor(props: PinEditorProps) {
        super(props);

        this.state = { ...props.config };
    }

    @boundMethod
    private onDirChange(value: boolean) {
        this.setState({ dir: value ? 'in' : 'out' }, () => this.props.onChange(this.props.index, this.state));
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
                    <strong>{`${I18n.t('Pin')} ${index}`}</strong>
                </Grid>
                <Grid item xs={4} md={3} lg={2}>
                    <ToggleSwitch
                        attr="dir"
                        offLabel="Output"
                        onLabel="Input"
                        value={this.state.dir === 'in'}
                        onChange={this.onDirChange}
                    ></ToggleSwitch>
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

class PCF8574 extends DeviceBase<PCF8574Config, { showIdDialog: boolean }> {
    constructor(props: DeviceProps<PCF8574Config>) {
        super(props);

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
        config.interrupt = config.interrupt || '';
        console.log('new PCF8574()', props, config);
        this.state = { config: config, extra: { showIdDialog: false } };
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
                    <Grid item xs={7} sm={5} md={3}>
                        <TextField
                            name="pollingInterval"
                            label={I18n.t('Polling Interval')}
                            value={this.state.config.pollingInterval}
                            type="number"
                            InputProps={{
                                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                            }}
                            fullWidth
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
                            fullWidth
                            onChange={this.handleChange}
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

export const Infos: DeviceInfo[] = [
    { name: 'PCF8574', addresses: DeviceBase.getAllAddresses(0x20, 8), type: 'PCF8574', react: PCF8574 },
    { name: 'PCF8574A', addresses: DeviceBase.getAllAddresses(0x38, 8), type: 'PCF8574', react: PCF8574 },
];
