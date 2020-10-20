import * as React from 'react';
import { boundMethod } from 'autobind-decorator';
import { Box, Tab, Tabs, Theme } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import { CreateCSSProperties } from '@material-ui/core/styles/withStyles';
import Connection from '@iobroker/adapter-react/Connection';
import I18n from '@iobroker/adapter-react/i18n';
import { I2CDeviceConfig } from '../../../src/lib/adapter-config';
import { toHexString } from '../../../src/lib/shared';
import { General } from '../pages/general';
import { DeviceTab } from '../pages/device-tab';

const styles = (theme: Theme): Record<string, CreateCSSProperties> => ({
    root: {
        flexGrow: 1,
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        height: '100%',
    },
    tabs: {
        borderRight: `1px solid ${theme.palette.divider}`,
    },
});

interface SettingsProps {
    classes: Record<string, string>;
    native: ioBroker.AdapterConfig;
    socket: Connection;
    instanceId: string;

    onChange: (attr: string, value: any) => void;
}

interface SettingsState {
    tabIndex: number;

    devices: I2CDeviceConfig[];
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: any;
    value: any;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`vertical-tabpanel-${index}`}
            aria-labelledby={`vertical-tab-${index}`}
            {...other}
        >
            {value === index && <Box p={3}>{children}</Box>}
        </div>
    );
}

class Settings extends React.Component<SettingsProps, SettingsState> {
    constructor(props: SettingsProps) {
        super(props);

        this.state = { tabIndex: 0, devices: this.props.native.devices };
    }

    @boundMethod
    private onGeneralChange(attr: string, value: any): void {
        this.props.onChange(attr, value);
        if (attr === 'devices') {
            this.setState({ devices: value });
        }
    }

    @boundMethod
    private onDeviceChange(config: I2CDeviceConfig): void {
        console.log('onDeviceChange()', config);
        const index = this.state.devices.findIndex((device) => device.address === config.address);
        if (index >= 0) {
            const devices = [...this.state.devices];
            devices[index] = config;
            this.onGeneralChange('devices', devices);
        }
    }

    @boundMethod
    private handleTabChange(_event: React.ChangeEvent<any>, newValue: number): void {
        this.setState({ tabIndex: newValue });
    }

    private get labels(): string[] {
        const all = [I18n.t('General')];
        this.state.devices.forEach((device) => {
            all.push(toHexString(device.address).replace('x', '𝗑')); // replace the regular x with a math symbol to show it in lowercase
        });
        return all;
    }

    render(): React.ReactNode {
        const { classes, native, socket, instanceId } = this.props;
        return (
            <div className={classes.root}>
                <Tabs
                    orientation="vertical"
                    variant="scrollable"
                    value={this.state.tabIndex}
                    onChange={this.handleTabChange}
                    className={classes.tabs}
                >
                    {this.labels.map((k, i) => (
                        <Tab key={`tab-${i}`} label={k} id={`tab-${i}`} />
                    ))}
                </Tabs>
                <TabPanel value={this.state.tabIndex} index={0}>
                    <General
                        settings={native}
                        socket={socket}
                        instanceId={instanceId}
                        onChange={this.onGeneralChange}
                    />
                </TabPanel>
                {this.state.devices.map((device, i) => (
                    <TabPanel key={`tabpanel-${i + 1}`} value={this.state.tabIndex} index={i + 1}>
                        <DeviceTab key={device.address} config={device} onChange={this.onDeviceChange} />
                    </TabPanel>
                ))}
            </div>
        );
    }
}

export default withStyles(styles)(Settings);
