import I18n from '@iobroker/adapter-react/i18n';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import React from 'react';
import { MCP4725Config } from '../../../src/devices/mcp4725';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

class MCP4725 extends DeviceBase<MCP4725Config> {
    constructor(props: DeviceProps<MCP4725Config>) {
        super(props);

        let config: MCP4725Config;
        if (!props.config) {
            config = {
                referenceVoltage: 3300, // mV
                writeToEeprom: false,
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        console.log('new MCP4725()', props, config);
        this.state = { config: config };
    }

    public render(): React.ReactNode {
        return (
            <Grid container spacing={3}>
                <Grid item xs={7} sm={5} md={3}>
                    <TextField
                        name="referenceVoltage"
                        label={I18n.t('referenceVoltage')}
                        value={this.state.config.referenceVoltage}
                        type="number"
                        inputProps={{ min: '2700', max: '5500', step: '100' }}
                        InputProps={{
                            endAdornment: <InputAdornment position="end">mV</InputAdornment>,
                        }}
                        fullWidth
                        onChange={this.handleChange}
                    />
                </Grid>
                <Grid item xs={7} sm={5} md={3} style={{ paddingTop: '24px' }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={this.state.config.writeToEeprom}
                                onChange={this.handleChange}
                                name="writeToEeprom"
                            />
                        }
                        label={I18n.t('writeToEeprom')}
                    />
                </Grid>
            </Grid>
        );
    }
}

export const Info: DeviceInfo = {
    name: 'MCP4725',
    addresses: DeviceBase.getAllAddresses(0x60, 8),
    type: 'MCP4725',
    react: MCP4725,
};
