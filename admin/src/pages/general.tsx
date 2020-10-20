import * as React from 'react';

import { Button, Grid, TextField } from '@material-ui/core';
import I18n from '@iobroker/adapter-react/i18n';
import { boundMethod } from 'autobind-decorator';
import Connection from '@iobroker/adapter-react/Connection';

interface GeneralProps {
    onChange: (attr: string, value: any) => void;
    settings: ioBroker.AdapterConfig;
    socket: Connection;
    instanceId: string;
}

interface GeneralState {
    busNumber: number;
    alive: boolean;
    busy: boolean;
}

export class General extends React.Component<GeneralProps, GeneralState> {
    private active = false;

    constructor(props: GeneralProps) {
        super(props);
        // settings are our state
        this.state = {
            ...props.settings,
            alive: false,
            busy: false,
        };
    }

    @boundMethod
    private handleChange(event: React.FormEvent<HTMLElement>): boolean {
        const target = event.target as HTMLInputElement;
        const newState = {};
        let value: any;
        if (target.type === 'number') {
            value = parseInt(target.value);
        } else {
            value = target.value;
        }
        newState[target.name] = value;
        this.setState(newState, () => this.props.onChange(target.name, value));
        return false;
    }

    @boundMethod
    private searchDevices(_event: React.FormEvent<HTMLElement>): boolean {
        this.sendSearch(this.state.busNumber).catch((error) => console.log(error));
        //socket.
        /*if (!this.active) {
            showMessage(_('Enable adapter first'), _('Warning'), 'warning');
            return false;
        }

        sendTo(null, 'search', this.state.busNumber, (result) => {
            if (typeof result === 'string') {
                const addresses = JSON.parse(result) as number[];
                const oldCount = this.props.settings.devices.length;
                addresses.forEach((address) => {
                    if (!this.props.settings.devices.find((d) => d.address === address)) {
                        this.props.settings.devices.push({ address: address });
                        this.props.settings.devices.sort((a, b) => a.address - b.address);
                    }
                });

                if (oldCount != this.props.settings.devices.length) {
                    this.props.onChange(this.props.settings);
                    console.log(this.props.settings);
                }
            }
        });*/

        return false;
    }

    private async sendSearch(busNumber: number): Promise<void> {
        const { socket, instanceId } = this.props;
        this.setState({ busy: true });
        try {
            const result = await socket.sendTo(instanceId, 'search', busNumber.toString());
            if (typeof result === 'string') {
                const addresses = JSON.parse(result) as number[];
                const devices = [...this.props.settings.devices];
                addresses.forEach((address) => {
                    if (!devices.find((d) => d.address === address)) {
                        devices.push({ address: address });
                        devices.sort((a, b) => a.address - b.address);
                    }
                });

                if (this.props.settings.devices.length != devices.length) {
                    this.props.onChange('devices', devices);
                }
            }
        } finally {
            this.setState({ busy: false });
        }
    }

    @boundMethod
    private handleAliveChange(id: string, obj?: ioBroker.State | null) {
        this.setState({ alive: !!(obj && obj.val) });
    }

    public componentDidMount(): void {
        const { socket, instanceId } = this.props;
        socket.subscribeState(instanceId + '.alive', false, this.handleAliveChange);
    }

    public componentWillUnmount(): void {
        const { socket, instanceId } = this.props;
        socket.unsubscribeState(instanceId + '.alive', this.handleAliveChange);
    }

    public render(): React.ReactNode {
        return (
            <Grid container direction="column" justify="flex-start" alignItems="flex-start">
                <TextField
                    name="busNumber"
                    label={I18n.t('Bus number')}
                    value={this.state.busNumber}
                    type={'number'}
                    onChange={this.handleChange}
                    margin="normal"
                />
                <Button
                    variant="contained"
                    disabled={!this.state.alive || this.state.busy}
                    onClick={this.searchDevices}
                >
                    {I18n.t('Search Devices')}
                </Button>
            </Grid>
        );
    }
}
