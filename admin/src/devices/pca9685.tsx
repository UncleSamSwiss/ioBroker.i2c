import * as React from 'react';
import { Grid, InputAdornment, TextField } from '@material-ui/core';
import I18n from '@iobroker/adapter-react/i18n';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';
import { PCA9685Config } from '../../../src/devices/pca9685';

class PCA9685 extends DeviceBase<PCA9685Config> {
    constructor(props: DeviceProps<PCA9685Config>) {
        super(props);

        let config: PCA9685Config;
        if (!props.config) {
            config = {
                frequency: 100,
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        config.frequency = config.frequency || 100;
        console.log('new PCA9685()', props, config);
        this.state = { config: config };
    }

    public render(): React.ReactNode {
        return (
            <Grid container spacing={3}>
                <Grid item xs={7} sm={5} md={3}>
                    <TextField
                        name="frequency"
                        label={I18n.t('PWM frequency')}
                        value={this.state.config.frequency}
                        type="number"
                        inputProps={{ min: '24', max: '1526', step: '1' }}
                        InputProps={{
                            endAdornment: <InputAdornment position="end">Hz</InputAdornment>,
                        }}
                        fullWidth
                        helperText={I18n.t('Range: 24-1526Hz')}
                        onChange={this.handleChange}
                    />
                </Grid>
            </Grid>
        );
    }
}

export const Info: DeviceInfo = {
    name: 'PCA9685',
    addresses: DeviceBase.getAllAddresses(0x40, 64),
    type: 'PCA9685',
    react: PCA9685,
};
