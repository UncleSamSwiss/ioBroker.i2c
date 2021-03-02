import I18n from '@iobroker/adapter-react/i18n';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import { boundMethod } from 'autobind-decorator';
import React from 'react';
import { Channel, Gain, MCP342xConfig, Resolution } from '../../../src/devices/mcp342x';
import Dropdown, { DropdownOption } from '../components/dropdown';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

interface ChannelEditorProps {
    index: number;
    config: Channel;
    has18Bit: boolean;
    onChange: (index: number, config: Channel) => void;
}

class ChannelEditor extends React.Component<ChannelEditorProps, Channel> {
    private readonly resolutionOptions: DropdownOption[] = [
        { value: '0', title: `12 ${I18n.t('bits')}` },
        { value: '1', title: `14 ${I18n.t('bits')}` },
        { value: '2', title: `16 ${I18n.t('bits')}` },
    ];
    private readonly gainOptions: DropdownOption[] = [
        { value: '0', title: 'x1' },
        { value: '1', title: 'x2' },
        { value: '2', title: 'x4' },
        { value: '3', title: 'x8' },
    ];

    constructor(props: ChannelEditorProps) {
        super(props);

        if (props.has18Bit) {
            this.resolutionOptions.push({ value: '3', title: `18 ${I18n.t('bits')}` });
        }

        this.state = { ...props.config };
    }

    @boundMethod
    private onEnabledChange(_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) {
        this.setState({ enabled: checked }, () => this.props.onChange(this.props.index, this.state));
    }

    @boundMethod
    private onResolutionChange(value: string) {
        this.setState({ resolution: parseInt(value) }, () => this.props.onChange(this.props.index, this.state));
    }

    @boundMethod
    private onGainChange(value: string) {
        this.setState({ gain: parseInt(value) }, () => this.props.onChange(this.props.index, this.state));
    }

    public render(): React.ReactNode {
        const { index } = this.props;
        return (
            <Grid container spacing={3}>
                <Grid item xs={3} md={2} xl={1} style={{ paddingTop: '24px' }}>
                    <FormControlLabel
                        control={
                            <Checkbox checked={this.state.enabled} onChange={this.onEnabledChange} name="enabled" />
                        }
                        label={`${I18n.t('Channel')} ${index + 1}`}
                    />
                </Grid>
                <Grid item xs={4} md={3} lg={2}>
                    <Dropdown
                        attr={`resolution-${index}`}
                        title="adcResolution"
                        disabled={!this.state.enabled}
                        options={this.resolutionOptions}
                        value={this.state.resolution.toString()}
                        onChange={this.onResolutionChange}
                    />
                </Grid>
                <Grid item xs={4} md={3} lg={2}>
                    <Dropdown
                        attr={`gain-${index}`}
                        title="Gain"
                        disabled={!this.state.enabled}
                        options={this.gainOptions}
                        value={this.state.gain.toString()}
                        onChange={this.onGainChange}
                    />
                </Grid>
            </Grid>
        );
    }
}

class MCP342x extends DeviceBase<MCP342xConfig> {
    private channelCount: 4 | 2;
    private has18Bit: boolean;

    constructor(props: DeviceProps<MCP342xConfig>) {
        super(props);

        const kind = parseInt(props.baseConfig.name?.substring(3) || '3424'); // 3422, 3423, 3424, 3426, 3427 or 3428
        this.channelCount = kind === 3424 || kind === 3428 ? 4 : 2;
        this.has18Bit = kind < 3426;

        let config: MCP342xConfig;
        if (!props.config) {
            config = {
                pollingInterval: 60000,
                channels: [],
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }

        for (let i = 0; i < this.channelCount; i++) {
            if (!config.channels[i]) {
                config.channels[i] = { enabled: false, resolution: Resolution.Bits12, gain: Gain.X1 };
            }
        }

        console.log('new MCP342x()', props, config);
        this.state = { config: config };
    }

    @boundMethod
    protected onChannelChange(index: number, config: Channel): void {
        const channels = [...this.state.config.channels];
        channels[index] = config;
        this.doHandleChange('channels', channels);
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
                </Grid>
                {this.state.config.channels.map((channel, i) => (
                    <ChannelEditor
                        key={`channel-${i}`}
                        index={i}
                        config={channel}
                        has18Bit={this.has18Bit}
                        onChange={this.onChannelChange}
                    ></ChannelEditor>
                ))}
            </>
        );
    }
}

export const Infos: DeviceInfo[] = [
    { name: 'MCP3422', addresses: [0x68], type: 'MCP342x', react: MCP342x },
    { name: 'MCP3423', addresses: DeviceBase.getAllAddresses(0x68, 8), type: 'MCP342x', react: MCP342x },
    { name: 'MCP3424', addresses: DeviceBase.getAllAddresses(0x68, 8), type: 'MCP342x', react: MCP342x },
    { name: 'MCP3426', addresses: [0x68], type: 'MCP342x', react: MCP342x },
    { name: 'MCP3427', addresses: DeviceBase.getAllAddresses(0x68, 8), type: 'MCP342x', react: MCP342x },
    { name: 'MCP3428', addresses: DeviceBase.getAllAddresses(0x68, 8), type: 'MCP342x', react: MCP342x },
];
