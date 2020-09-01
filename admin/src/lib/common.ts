import { I2CAdapterConfig } from '../../../src/lib/shared';

export type OnSettingsChangedCallback = (newSettings: I2CAdapterConfig) => void;

export function toHexString(value: number): string {
    // Convert a number to a hex string "0xXX"
    const str = value.toString(16);
    return '0𝗑' + (str.length == 1 ? '0' + str : str).toUpperCase();
}
