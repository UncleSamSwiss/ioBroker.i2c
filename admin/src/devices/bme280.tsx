import I18n from '@iobroker/adapter-react/i18n';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import React from 'react';
import { BME280Config } from '../../../src/devices/bme280';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

class BME280 extends DeviceBase<BME280Config> {
    constructor(props: DeviceProps<BME280Config>) {
        super(props);

        let config: BME280Config;
        if (!props.config) {
            config = {
                pollingInterval: 10,
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
            </Grid>
        );
    }
}

export const Info: DeviceInfo = {
    name: 'BME280',
    addresses: [0x76, 0x77],
    type: 'BME280',
    react: BME280,
};
