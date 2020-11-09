import I18n from '@iobroker/adapter-react/i18n';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';
import { boundMethod } from 'autobind-decorator';
import React from 'react';
import { GenericConfig, RegisterConfig } from '../../../src/devices/generic';
import { toHexString } from '../../../src/lib/shared';
import Dropdown, { DropdownOption } from '../components/dropdown';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

class Generic extends DeviceBase<GenericConfig> {
    private readonly registerOptions: DropdownOption[] = [];
    private readonly dataTypeOptions: DropdownOption[] = [
        { value: 'int8', title: 'int8' },
        { value: 'uint8', title: 'uint8' },
        { value: 'int16_be', title: 'int16_be' },
        { value: 'int16_le', title: 'int16_le' },
        { value: 'uint16_be', title: 'uint16_be' },
        { value: 'uint16_le', title: 'uint16_le' },
        { value: 'int32_be', title: 'int32_be' },
        { value: 'int32_le', title: 'int32_le' },
        { value: 'uint32_be', title: 'uint32_be' },
        { value: 'uint32_le', title: 'uint32_le' },
        { value: 'float_be', title: 'float_be' },
        { value: 'float_le', title: 'float_le' },
        { value: 'double_be', title: 'double_be' },
        { value: 'double_le', title: 'double_le' },
    ];

    constructor(props: DeviceProps<GenericConfig>) {
        super(props);

        this.registerOptions.push({ value: '-1', title: '---' });
        for (let i = 0; i <= 255; i++) {
            this.registerOptions.push({ value: i.toString(), title: toHexString(i) });
        }

        let config: GenericConfig;
        if (!props.config) {
            config = {
                registers: [],
            };

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        console.log('new Generic()', props, config);
        this.state = { config: config };
    }

    @boundMethod
    protected addRegister(): void {
        const newRegister: RegisterConfig = {
            register: -1,
            name: '',
            type: 'uint8',
            read: true,
            write: false,
            pollingInterval: 1000,
        };
        this.doHandleChange('registers', [...this.state.config.registers, newRegister]);
    }

    @boundMethod
    protected deleteRegister(index: number): void {
        const newRegisters = [...this.state.config.registers];
        newRegisters.splice(index, 1);
        this.doHandleChange('registers', newRegisters);
    }

    @boundMethod
    protected onRegisterChange(event: React.FormEvent<HTMLElement>, checked?: boolean): boolean {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        const value = this.parseChangedSetting(target, checked);
        const parts = target.name.split('-');
        const index = parseInt(parts[0]);
        const key = parts[1] as keyof RegisterConfig;

        return this.doHandleRegisterChange(index, key, value);
    }

    @boundMethod
    protected onRegisterSelectChange(index: number, value: string): void {
        this.doHandleRegisterChange(index, 'register', parseInt(value));
    }

    @boundMethod
    protected onRegisterTypeChange(index: number, value: string): void {
        this.doHandleRegisterChange(index, 'type', value);
    }

    private doHandleRegisterChange<K extends keyof RegisterConfig>(index: number, key: K, value: any): boolean {
        const register: RegisterConfig = { ...this.state.config.registers[index] };
        register[key] = value;
        const newRegsiters = [...this.state.config.registers];
        newRegsiters[index] = register;

        return this.doHandleChange('registers', newRegsiters);
    }

    protected renderRegisters(): React.ReactNode {
        return this.state.config.registers.map((register, i) => (
            <Grid key={`register-${i}`} container spacing={3}>
                <Grid item xs={2}>
                    <Dropdown
                        attr={`${i}-register`}
                        options={this.registerOptions}
                        value={register.register.toString()}
                        onChange={(value: string) => this.onRegisterSelectChange(i, value)}
                        style={{ paddingTop: '6px' }}
                    />
                </Grid>
                <Grid item xs={3}>
                    <TextField
                        name={`${i}-name`}
                        value={register.name || ''}
                        type="text"
                        fullWidth
                        onChange={this.onRegisterChange}
                    />
                </Grid>
                <Grid item xs={2}>
                    <Dropdown
                        attr={`${i}-type`}
                        options={this.dataTypeOptions}
                        value={register.type}
                        onChange={(value: string) => this.onRegisterTypeChange(i, value)}
                        style={{ paddingTop: '6px' }}
                    />
                </Grid>
                <Grid item xs={1}>
                    <Checkbox
                        checked={register.read}
                        onChange={this.onRegisterChange}
                        name={`${i}-read`}
                        style={{ paddingTop: '4px' }}
                    />
                </Grid>
                <Grid item xs={1}>
                    <Checkbox
                        checked={register.write}
                        onChange={this.onRegisterChange}
                        name={`${i}-write`}
                        style={{ paddingTop: '4px' }}
                    />
                </Grid>
                <Grid item xs={2}>
                    <TextField
                        name={`${i}-pollingInterval`}
                        value={register.pollingInterval}
                        type="number"
                        fullWidth
                        disabled={!register.read}
                        onChange={this.onRegisterChange}
                    />
                </Grid>
                <Grid item xs={1}>
                    <Button variant="contained" onClick={() => this.deleteRegister(i)} style={{ marginTop: '0px' }}>
                        <DeleteForeverIcon />
                    </Button>
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
                            name="name"
                            label={I18n.t('Name')}
                            value={this.state.config.name || ''}
                            type="text"
                            fullWidth
                            onChange={this.handleChange}
                        />
                    </Grid>
                </Grid>
                <Grid container spacing={3}>
                    <Grid item xs={2}>
                        <strong>{I18n.t('Register')}</strong>
                    </Grid>
                    <Grid item xs={3}>
                        <strong>{I18n.t('Name')}</strong>
                    </Grid>
                    <Grid item xs={2}>
                        <strong>{I18n.t('Data type')}</strong>
                    </Grid>
                    <Grid item xs={1}>
                        <strong>{I18n.t('Read')}</strong>
                    </Grid>
                    <Grid item xs={1}>
                        <strong>{I18n.t('Write')}</strong>
                    </Grid>
                    <Grid item xs={2}>
                        <strong>{I18n.t('Polling Interval')}</strong>
                    </Grid>
                </Grid>
                {this.renderRegisters()}
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Button variant="contained" onClick={this.addRegister}>
                            <AddCircleOutlineIcon />
                        </Button>
                    </Grid>
                </Grid>
            </>
        );
    }
}

export const Info: DeviceInfo = {
    name: 'Generic',
    addresses: DeviceBase.getAllAddresses(0x03, 117),
    type: 'Generic',
    react: Generic,
};
