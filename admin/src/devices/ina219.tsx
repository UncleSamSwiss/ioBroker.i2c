import I18n from '@iobroker/adapter-react/i18n';
import Checkbox from '@material-ui/core/Checkbox';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import React from 'react';
import { INA219Config } from '../../../src/devices/ina219';
import Dropdown, { DropdownOption } from '../components/dropdown';
import ToggleSwitch from '../components/toggle-switch';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

interface INA219Extra {
    maxCurrent: number;
}

class INA219 extends DeviceBase<INA219Config, INA219Extra> {
    private readonly gainOptions: DropdownOption[] = [
        { value: '0', title: '±40 mV' },
        { value: '1', title: '±80 mV' },
        { value: '2', title: '±160 mV' },
        { value: '3', title: '±320 mV' },
    ];

    private readonly adcResolutionOptions: DropdownOption[] = [
        { value: '0', title: I18n.t('%s bit, 1 sample', '9') },
        { value: '1', title: I18n.t('%s bit, 1 sample', '10') },
        { value: '2', title: I18n.t('%s bit, 1 sample', '11') },
        { value: '3', title: I18n.t('%s bit, 1 sample', '12') },
        { value: '9', title: I18n.t('12 bit, %s samples', '2') },
        { value: '10', title: I18n.t('12 bit, %s samples', '4') },
        { value: '11', title: I18n.t('12 bit, %s samples', '8') },
        { value: '12', title: I18n.t('12 bit, %s samples', '16') },
        { value: '13', title: I18n.t('12 bit, %s samples', '32') },
        { value: '14', title: I18n.t('12 bit, %s samples', '64') },
        { value: '15', title: I18n.t('12 bit, %s samples', '128') },
    ];

    constructor(props: DeviceProps<INA219Config>) {
        super(props);

        let config: INA219Config;
        if (!props.config) {
            config = {
                pollingInterval: 1000, // msec
                singleShot: true,
                voltageRange: 1,
                gain: 3,
                adcResolution: 3,
                shuntValue: 100,
                expectedCurrent: 2,
                currentLsb: 0, // will be calculated below
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }

        const { currentLsb, maxCurrent } = this.calculateValues(config);
        config.currentLsb = currentLsb;

        console.log('new INA219()', props, config);
        this.state = { config: config, extra: { maxCurrent } };
    }

    private calculateValues(config: INA219Config): { currentLsb: number; maxCurrent: number } {
        const vshuntMax = (4 << config.gain) * 10; // unit: mV
        const maxCurrent = vshuntMax / config.shuntValue;

        // Calculate possible range of LSBs (Min = 15-bit, Max = 12-bit)
        const minimumLSB = config.expectedCurrent / 32767; // unit: A per bit
        //const maximumLSB = config.expectedCurrent / 4096; // unit: A per bit

        // Choose an LSB between the min and max values (Preferrably a roundish number close to MinLSB)
        let divider = 100000;
        let multiplier = 1;
        while (multiplier / divider < minimumLSB) {
            multiplier *= 2;
            if (multiplier > 10) {
                multiplier = 1;
                divider /= 10;
            }
        }
        const currentLsb = (multiplier / divider) * 1000;
        return { currentLsb, maxCurrent: Math.round(maxCurrent * 100) / 100 };
    }

    protected doHandleChange<K extends keyof INA219Config>(
        key: K,
        value: INA219Config[K],
        callback?: () => void,
    ): boolean {
        return super.doHandleChange(key, value, () => {
            if (key != 'currentLsb') {
                const { currentLsb, maxCurrent } = this.calculateValues(this.state.config);
                this.doHandleChange('currentLsb', currentLsb);
                this.setExtraState({ maxCurrent });
            }
            if (callback) {
                callback();
            }
        });
    }

    public render(): React.ReactNode {
        return (
            <>
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
                    <Grid item xs={5} style={{ paddingTop: '11px' }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={this.state.config.singleShot}
                                    name="singleShot"
                                    onChange={this.handleChange}
                                />
                            }
                            label={I18n.t('singleShot')}
                            style={{ marginTop: '12px' }}
                        />
                    </Grid>
                </Grid>
                <Grid container spacing={3}>
                    <Grid item xs={4} md={3} lg={2}>
                        <FormControl style={{ marginTop: -5 }} fullWidth>
                            <FormHelperText>{I18n.t('voltageRange')}</FormHelperText>
                            <ToggleSwitch
                                attr="voltageRange"
                                offLabel="16V"
                                onLabel="32V"
                                value={this.state.config.voltageRange === 1}
                                onChange={(value) => this.doHandleChange('voltageRange', value ? 1 : 0)}
                            ></ToggleSwitch>
                        </FormControl>
                    </Grid>
                    <Grid item xs={4} md={3} lg={2}>
                        <Dropdown
                            attr="gain"
                            title="Gain"
                            options={this.gainOptions}
                            value={this.state.config.gain.toString()}
                            onChange={(value) => this.doHandleChange('gain', parseInt(value))}
                            style={{ paddingTop: '3px' }}
                        />
                    </Grid>
                    <Grid item xs={4} md={3} lg={2}>
                        <Dropdown
                            attr="adcResolution"
                            title="adcResolution"
                            options={this.adcResolutionOptions}
                            value={this.state.config.adcResolution.toString()}
                            onChange={(value) => this.doHandleChange('adcResolution', parseInt(value))}
                            style={{ paddingTop: '3px' }}
                        />
                    </Grid>
                </Grid>
                <Grid container spacing={3}>
                    <Grid item xs={4} md={3} lg={2}>
                        <TextField
                            name="shuntValue"
                            label={I18n.t('shuntValue')}
                            value={this.state.config.shuntValue}
                            type="number"
                            InputProps={{
                                endAdornment: <InputAdornment position="end">mΩ</InputAdornment>,
                            }}
                            fullWidth
                            onChange={this.handleChange}
                        />
                    </Grid>
                    <Grid item xs={4} md={3} lg={2}>
                        <TextField
                            name="expectedCurrent"
                            label={I18n.t('expectedCurrent')}
                            value={this.state.config.expectedCurrent}
                            type="number"
                            InputProps={{
                                endAdornment: <InputAdornment position="end">A</InputAdornment>,
                            }}
                            fullWidth
                            helperText={`${I18n.t('Range:')} 0 - ${this.state.extra?.maxCurrent}A`}
                            onChange={this.handleChange}
                        />
                    </Grid>
                    <Grid item xs={4} md={3} lg={2}>
                        <TextField
                            name="currentLsb"
                            label={I18n.t('currentLsb')}
                            value={this.state.config.currentLsb}
                            type="number"
                            disabled
                            InputProps={{
                                endAdornment: <InputAdornment position="end">{I18n.t('mA per bit')}</InputAdornment>,
                            }}
                            fullWidth
                            onChange={this.handleChange}
                        />
                    </Grid>
                </Grid>
            </>
        );
    }
}

export const Info: DeviceInfo = {
    name: 'INA219',
    addresses: DeviceBase.getAllAddresses(0x40, 16),
    type: 'INA219',
    react: INA219,
};
