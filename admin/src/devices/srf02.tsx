import I18n from '@iobroker/adapter-react/i18n';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import React from 'react';
import { SRF02Config } from '../../../src/devices/srf02';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

class SRF02 extends DeviceBase<SRF02Config> {
    constructor(props: DeviceProps<SRF02Config>) {
        super(props);

        let config: SRF02Config;
        if (!props.config) {
            config = {
                pollingInterval: 10,
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        console.log('new SRF02()', props, config);
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

export const Infos: DeviceInfo[] = [
    { name: 'SRF02', addresses: [0x70], type: 'SRF02', react: SRF02 },
    { name: 'GY-US42', addresses: [0x70], type: 'SRF02', react: SRF02 },
];
