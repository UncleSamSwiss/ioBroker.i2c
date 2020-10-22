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
        const id = target.id || target.name;
        const key = id.replace(/^\d+-/, '') as keyof T; // id is usually "<address>-<key>"
        return this.doHandleChange(key, value);
    }

    protected doHandleChange(key: keyof T, value: any): boolean {
        // store the setting
        this.setState({ config: { ...this.state.config, [key]: value } } as any, () => {
            // and notify the admin UI about changes
            this.props.onChange({ ...this.props.config, ...this.state.config });
        });
        return false;
    }
}
