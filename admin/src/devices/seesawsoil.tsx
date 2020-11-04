import * as React from 'react';
import { Grid, InputAdornment, TextField } from '@material-ui/core';
import I18n from '@iobroker/adapter-react/i18n';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';
import { SeesawSoilConfig } from '../../../src/devices/seesawsoil';

class SeesawSoil extends DeviceBase<SeesawSoilConfig> {
    constructor(props: DeviceProps<SeesawSoilConfig>) {
        super(props);

        let config: SeesawSoilConfig;
        if (!props.config) {
            config = {
                pollingInterval: 60,
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        console.log('new SeesawSoil()', props, config);
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
    name: 'Adafruit STEMMA Soil Sensor',
    addresses: [0x36],
    type: 'SeesawSoil',
    react: SeesawSoil,
};
