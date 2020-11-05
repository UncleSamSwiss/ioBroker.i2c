import { boundMethod } from 'autobind-decorator';
import * as React from 'react';
import { I2CDeviceConfig, ImplementationConfigBase } from '../../../src/lib/adapter-config';
import { AppContext } from '../common';

export interface DeviceProps<T extends ImplementationConfigBase> {
    onChange: (newConfig: T) => void;
    context: AppContext;
    config?: T;
    baseConfig: I2CDeviceConfig;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export abstract class DeviceBase<T extends ImplementationConfigBase, S = {}> extends React.Component<
    DeviceProps<T>,
    { config: T; extra?: S }
> {
    public get address(): number {
        return this.props.baseConfig.address;
    }

    public static getAllAddresses(baseAddress: number, range: number): number[] {
        const addresses: number[] = [];
        for (let i = 0; i < range; i++) {
            addresses.push(baseAddress + i);
        }

        return addresses;
    }

    protected setExtraState(value: Partial<S>, callback?: () => void): void {
        this.setState({ extra: { ...this.state.extra, ...value } as S }, callback);
    }

    protected parseChangedSetting(target: HTMLInputElement | HTMLSelectElement, checked?: boolean): any {
        return target.type === 'checkbox'
            ? !!checked
            : target.type === 'number'
            ? parseFloat(target.value)
            : target.value;
    }

    // gets called when the form elements are changed by the user
    @boundMethod
    protected handleChange(event: React.FormEvent<HTMLElement>, checked?: boolean): boolean {
        const target = event.target as HTMLInputElement | HTMLSelectElement; // TODO: more types
        const value = this.parseChangedSetting(target, checked);
        const id = target.id || target.name;
        const key = id.replace(/^\d+-/, '') as keyof T; // id is usually "<address>-<key>"
        return this.doHandleChange(key, value);
    }

    protected doHandleChange<K extends keyof T>(key: K, value: T[K], callback?: () => void): boolean {
        // store the setting
        this.setState({ config: { ...this.state.config, [key]: value } } as any, () => {
            // and notify the admin UI about changes
            this.props.onChange({ ...this.props.config, ...this.state.config });
            if (callback) {
                callback();
            }
        });
        return false;
    }
}
