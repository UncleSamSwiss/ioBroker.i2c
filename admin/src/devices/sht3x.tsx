import I18n from '@iobroker/adapter-react/i18n';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import React from 'react';
import { SHT3xConfig } from '../../../src/devices/sht3x';
import Dropdown, { DropdownOption } from '../components/dropdown';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

class SHT3x extends DeviceBase<SHT3xConfig> {
    private readonly repeatabilityOptions: DropdownOption[] = [
        { value: 'low', title: I18n.t('repeatabilityLow') },
        { value: 'medium', title: I18n.t('repeatabilityMedium') },
        { value: 'high', title: I18n.t('repeatabilityHigh') },
    ];

    constructor(props: DeviceProps<SHT3xConfig>) {
        super(props);

        let config: SHT3xConfig;
        if (!props.config) {
            config = {
                pollingInterval: 10,
                repeatability: 'low',
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        console.log('new BME280()', props, config);
        this.state = { config: config };
    }

    public render(): React.ReactNode {
        return (
            <Grid container spacing={3}>
                <Grid item xs={7} sm={5} md={3}>
                    <TextField
                        name="pollingInterval"
                        label={I18n.t('Polling Interval')}
                        value={this.state.config.pollingInterval}
                        type="number"
                        InputProps={{
                            endAdornment: <InputAdornment position="end">sec</InputAdornment>,
                        }}
                        fullWidth
                        onChange={this.handleChange}
                    />
                </Grid>
                <Grid item xs={7} sm={5} md={3}>
                    <Dropdown
                        attr="repeatability"
                        title="Repeatability"
                        options={this.repeatabilityOptions}
                        value={this.state.config.repeatability}
                        onChange={(value) => this.doHandleChange('repeatability', value as any)}
                    />
                </Grid>
            </Grid>
        );
    }
}

export const Info: DeviceInfo = {
    name: 'SHT3x',
    addresses: [0x44, 0x45],
    type: 'SHT3x',
    react: SHT3x,
};
