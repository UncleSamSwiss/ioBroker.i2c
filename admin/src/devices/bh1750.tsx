import I18n from '@iobroker/adapter-react/i18n';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import React from 'react';
import { BH1750Config } from '../../../src/devices/bh1750';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

class BH1750 extends DeviceBase<BH1750Config> {
    constructor(props: DeviceProps<BH1750Config>) {
        super(props);

        let config: BH1750Config;
        if (!props.config) {
            config = {
                pollingInterval: 10,
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        console.log('new BH1750()', props, config);
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
    name: 'BH1750',
    addresses: [0x23, 0x5c],
    type: 'BH1750',
    react: BH1750,
};
