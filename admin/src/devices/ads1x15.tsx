import I18n from '@iobroker/adapter-react/i18n';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import { boundMethod } from 'autobind-decorator';
import React from 'react';
import { ADS1x15Config, EnabledChannel } from '../../../src/devices/ads1x15';
import Dropdown, { DropdownOption } from '../components/dropdown';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

class ADS1x15 extends DeviceBase<ADS1x15Config> {
    private readonly samplesOptions: DropdownOption[];
    private readonly gainOptions: DropdownOption[];

    constructor(props: DeviceProps<ADS1x15Config>) {
        super(props);

        const allowedGains = [6144, 4096, 2048, 1024, 512, 256];
        let allowedSamples: number[];
        if (this.props.baseConfig.name === 'ADS1015') {
            allowedSamples = [128, 250, 490, 920, 1600, 2400, 3300];
        } else {
            allowedSamples = [8, 16, 32, 64, 128, 250, 475, 860];
        }

        this.samplesOptions = allowedSamples.map((s) => ({ title: s.toString(), value: s.toString() }));
        this.gainOptions = allowedGains.map((g) => ({ title: `${g / 1000.0} V`, value: g.toString() }));

        let config: ADS1x15Config;
        if (!props.config) {
            config = {
                pollingIntervalMs: 60000,
                channels: [],
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }

        // backwards compatibility:
        // - old pollingInterval was in seconds
        // - new pollingIntervalMs is in milliseconds
        if (config.pollingInterval !== undefined) {
            config.pollingIntervalMs = config.pollingInterval * 1000;
            config.pollingInterval = undefined;
        }

        for (let i = 0; i < 4; i++) {
            if (!config.channels[i]) {
                config.channels[i] = { channelType: 'off' };
            }
        }

        console.log('new ADS1x15()', props, config);
        this.state = { config: config };
    }

    private getChannelTypeOptions(index: number): DropdownOption[] {
        let disabled = false;
        let offTitle = I18n.t('Unused');
        if (index === 1 || index === 3) {
            const diffToMe = this.state.config.channels
                .map((channel, i) => ({ channel, i }))
                .filter((c) => c.channel.channelType === 'diffTo' + index);
            disabled = diffToMe.length > 0;
            if (disabled) {
                offTitle =
                    I18n.t(diffToMe.length > 1 ? 'Used by channels' : 'Used by channel') +
                    ' ' +
                    diffToMe.map((c) => c.i).join(' & ');
            }
        }
        const options = [
            { title: offTitle, value: 'off' },
            { title: I18n.t('Single-ended'), value: 'single', disabled },
        ];
        if (index < 1) {
            options.push({ title: I18n.t('Differential N=AIN1'), value: 'diffTo1', disabled });
        }
        if (index < 3) {
            options.push({ title: I18n.t('Differential N=AIN3'), value: 'diffTo3', disabled });
        }
        return options;
    }

    @boundMethod
    protected onChannelChange<K extends keyof EnabledChannel>(
        index: number,
        key: K,
        value: EnabledChannel[K],
    ): boolean {
        const channel = { ...this.state.config.channels[index] };
        channel[key as string] = value;
        if (channel.channelType !== 'off') {
            channel.gain = channel.gain || 6144;
            channel.samples = channel.samples || 250; // this is a value valid for both ADS1015 and ADS1115
        }
        const newChannels = [...this.state.config.channels];
        newChannels[index] = channel;

        if (channel.channelType === 'diffTo1') {
            newChannels[1] = { ...this.state.config.channels[1], channelType: 'off' };
        }

        if (channel.channelType === 'diffTo3') {
            newChannels[3] = { ...this.state.config.channels[3], channelType: 'off' };
        }

        return this.doHandleChange('channels', newChannels);
    }

    protected renderChannels(): React.ReactNode {
        return this.state.config.channels.map((channel, i) => (
            <Grid key={`channel-${i}`} container spacing={3}>
                <Grid item xs={2} md={1} style={{ marginTop: '30px' }}>
                    <strong>
                        {I18n.t('Channel')} {i}
                    </strong>
                </Grid>
                <Grid item xs={4} md={3}>
                    <Dropdown
                        title="Channel Mode"
                        attr={`${i}-channelType`}
                        options={this.getChannelTypeOptions(i)}
                        disabled={!!this.getChannelTypeOptions(i).find((o) => o.disabled)}
                        value={channel.channelType}
                        onChange={(value: string) => this.onChannelChange(i, 'channelType', value as any)}
                        style={{ paddingTop: '6px' }}
                    />
                </Grid>
                <Grid item xs={3} lg={2}>
                    {channel.channelType !== 'off' && (
                        <Dropdown
                            title="Samples per second"
                            attr={`${i}-samples`}
                            options={this.samplesOptions}
                            value={(channel as EnabledChannel).samples?.toString()}
                            onChange={(value: string) => this.onChannelChange(i, 'samples', parseInt(value))}
                            style={{ paddingTop: '6px' }}
                        />
                    )}
                </Grid>
                <Grid item xs={3} md={2}>
                    {channel.channelType !== 'off' && (
                        <Dropdown
                            title="Gain"
                            attr={`${i}-gain`}
                            options={this.gainOptions}
                            value={(channel as EnabledChannel).gain?.toString()}
                            onChange={(value: string) => this.onChannelChange(i, 'gain', parseInt(value))}
                            style={{ paddingTop: '6px' }}
                        />
                    )}
                </Grid>
            </Grid>
        ));
    }

    public render(): React.ReactNode {
        return (
            <>
                <Grid container spacing={3}>
                    <Grid item xs={7} sm={5} md={3}>
                        <TextField
                            name="pollingIntervalMs"
                            label={I18n.t('Polling Interval')}
                            value={this.state.config.pollingIntervalMs}
                            type="number"
                            InputProps={{
                                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                            }}
                            fullWidth
                            onChange={this.handleChange}
                        />
                    </Grid>
                </Grid>
                {this.renderChannels()}
            </>
        );
    }
}

export const Infos: DeviceInfo[] = [
    { name: 'ADS1015', addresses: DeviceBase.getAllAddresses(0x48, 4), type: 'ADS1x15', react: ADS1x15 },
    { name: 'ADS1115', addresses: DeviceBase.getAllAddresses(0x48, 4), type: 'ADS1x15', react: ADS1x15 },
];
