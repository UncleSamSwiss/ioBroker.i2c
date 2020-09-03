import { boundMethod } from 'autobind-decorator';
import * as React from 'react';
import { I2CDeviceConfig, ImplementationConfigBase } from '../../../src/lib/shared';

export interface DeviceProps<T extends ImplementationConfigBase> {
    onChange: (newConfig: T) => void;
    config?: T;
    baseConfig: I2CDeviceConfig;
}

export abstract class DeviceBase<T extends ImplementationConfigBase> extends React.Component<DeviceProps<T>, T> {
    public get address(): number {
        return this.props.baseConfig.address;
    }

    private parseChangedSetting(target: HTMLInputElement | HTMLSelectElement): any {
        // Checkboxes in MaterializeCSS are messed up, so we attach our own handler
        // However that one gets called before the underlying checkbox is actually updated,
        // so we need to invert the checked value here
        return target.type === 'checkbox'
            ? !(target as any).checked
            : target.type === 'number'
            ? parseInt(target.value, 10)
            : target.value;
    }

    // gets called when the form elements are changed by the user
    @boundMethod
    protected handleChange(event: React.FormEvent<HTMLElement>): boolean {
        const target = event.target as HTMLInputElement | HTMLSelectElement; // TODO: more types
        const value = this.parseChangedSetting(target);
        const key = target.id.replace(/^\d+-/, '') as keyof T; // id is usually "<address>-<key>"
        return this.doHandleChange(key, value);
    }

    protected doHandleChange(key: keyof T, value: any): boolean {
        // store the setting
        this.setState({ [key]: value } as any, () => {
            // and notify the admin UI about changes
            this.props.onChange({ ...this.props.config, ...this.state });
        });
        return false;
    }
}
