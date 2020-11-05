import * as React from 'react';
import { Button, Grid, InputAdornment, TextField } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import I18n from '@iobroker/adapter-react/i18n';
import SelectID from '@iobroker/adapter-react/Dialogs/SelectID';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';
import { xMC5883Config } from '../../../src/devices/xmc5883';
import { boundMethod } from 'autobind-decorator';
import Dropdown, { DropdownOption } from '../components/dropdown';

class xMC5883 extends DeviceBase<xMC5883Config, { showIdDialog: boolean }> {
    private readonly rangeOptions: DropdownOption[];
    private readonly oversamplingOptions: DropdownOption[];

    constructor(props: DeviceProps<xMC5883Config>) {
        super(props);

        let config: xMC5883Config;
        if (!props.config) {
            if (props.baseConfig.name == 'QMC5883L') {
                config = {
                    refreshInterval: 5000, // 5 sec
                    range: 0, // +/- 2 Gs
                    oversampling: 2, // 128
                };
            } else {
                config = {
                    refreshInterval: 5000, // 5 sec
                    range: 2, // +/- 1.9 Gs
                    oversampling: 0, // 1
                };
            }

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        console.log('new xMC5883()', props, config);

        if (props.baseConfig.name == 'QMC5883L') {
            this.rangeOptions = [
                { value: '0', title: '± 2 Gs' },
                { value: '1', title: '± 8 Gs' },
            ];
            this.oversamplingOptions = [
                { value: '3', title: '64' },
                { value: '2', title: '128' },
                { value: '1', title: '256' },
                { value: '0', title: '512' },
            ];
        } else {
            this.rangeOptions = [
                { value: '0', title: '± 0.88 Gs' },
                { value: '1', title: '± 1.3 Gs' },
                { value: '2', title: '± 1.9 Gs' },
                { value: '3', title: '± 2.5 Gs' },
                { value: '4', title: '± 4.0 Gs' },
                { value: '5', title: '± 4.7 Gs' },
                { value: '6', title: '± 5.6 Gs' },
                { value: '7', title: '± 8.1 Gs' },
            ];
            this.oversamplingOptions = [
                { value: '0', title: '1' },
                { value: '1', title: '2' },
                { value: '2', title: '4' },
                { value: '3', title: '8' },
            ];
        }
        this.state = { config: config, extra: { showIdDialog: false } };
    }

    @boundMethod
    protected selectInterruptId(): void {
        this.setExtraState({ showIdDialog: true });
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
                        onOk={(selected) => this.onInterruptSelected(selected as string)}
                    ></SelectID>
                )}
                <Grid container spacing={3}>
                    <Grid item xs={7} sm={5} md={3}>
                        <TextField
                            name="refreshInterval"
                            label={I18n.t('Refresh Interval')}
                            value={this.state.config.refreshInterval}
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
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={4} lg={3} xl={2}>
                        <Dropdown
                            title="Range"
                            attr="range"
                            options={this.rangeOptions}
                            value={this.state.config.range.toString()}
                            onChange={(value) => this.doHandleChange('range', parseInt(value))}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4} lg={3} xl={2}>
                        <Dropdown
                            title="Oversampling"
                            attr="oversampling"
                            options={this.oversamplingOptions}
                            value={this.state.config.oversampling.toString()}
                            onChange={(value) => this.doHandleChange('oversampling', parseInt(value))}
                        />
                    </Grid>
                </Grid>
            </>
        );
    }
}

export const HMC5883L: DeviceInfo = { name: 'HMC5883L', addresses: [0x1e], type: 'xMC5883', react: xMC5883 };
export const QMC5883L: DeviceInfo = { name: 'QMC5883L', addresses: [0x0d], type: 'xMC5883', react: xMC5883 };
