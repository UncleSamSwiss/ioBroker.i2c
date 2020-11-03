import * as React from 'react';
import { boundMethod } from 'autobind-decorator';
import { Grid, Switch, Typography } from '@material-ui/core';
import I18n from '@iobroker/adapter-react/i18n';

interface ToggleSwitchProps {
    attr: string;
    offLabel: string;
    onLabel: string;
    value?: boolean;
    onChange: (value: boolean) => void;
    style?: React.CSSProperties;
}

interface ToggleSwitchState {
    value: boolean;
}

export default class ToggleSwitch extends React.Component<ToggleSwitchProps, ToggleSwitchState> {
    constructor(props: ToggleSwitchProps) {
        super(props);
        this.state = { value: !!props.value };
    }

    @boundMethod
    private handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.setState({ value: event.target.checked }, () => this.props.onChange(this.state.value));
    }

    render(): React.ReactNode {
        const { offLabel, onLabel, attr, style } = this.props;
        return (
            <Typography component="div" style={style}>
                <Grid component="label" container alignItems="center" spacing={1} style={{ flexWrap: 'nowrap' }}>
                    <Grid component="span" item>
                        {I18n.t(offLabel)}
                    </Grid>
                    <Grid component="span" item>
                        <Switch checked={this.state.value} onChange={this.handleChange} name={attr} />
                    </Grid>
                    <Grid component="span" item>
                        {I18n.t(onLabel)}
                    </Grid>
                </Grid>
            </Typography>
        );
    }
}
