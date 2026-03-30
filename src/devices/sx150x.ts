import type { ConfigItemAny, ConfigItemSelectOption } from '@iobroker/dm-utils';
import type { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { toHexString } from '../lib/shared';
import type { I2cAdapter } from '../main';
import { BigEndianDeviceHandlerBase } from './big-endian-device-handler-base';
import type { DeviceHandlerInfo } from './device-handler-base';

export interface SX150xConfig extends ImplementationConfigBase {
    pollingInterval: number;
    interrupt?: string;

    oscExternal: boolean;
    oscFrequency: number;
    ledLog: boolean[]; // 1 or 2 elements in array
    ledFrequency: number;
    debounceTime: number;
    keypad: KeypadConfig;

    pins: PinConfig[];
}

export interface KeypadConfig {
    rowCount: number; // 0 -> off, then off by one (1 -> 2)
    columnCount: number; // off by one (0 -> 1)
    autoSleep: number;
    scanTime: number;
    keyValues: string[][];
}

export interface PinConfig {
    mode: PinMode;
    resistor: 'none' | 'up' | 'down';
    openDrain: boolean;
    invert: boolean;
    debounce: boolean;
    interrupt: 'none' | 'raising' | 'falling' | 'both';
    highInput: boolean;
    levelShifterMode: 'AtoB' | 'BtoA';

    led: LedConfig;
}

export type PinMode =
    | 'none'
    | 'input'
    | 'output'
    | 'led-channel'
    | 'led-static'
    | 'led-single'
    | 'led-blink'
    | 'keypad'
    | 'level-shifter';

export interface LedConfig {
    timeOn: number;
    intensityOn: number;
    timeOff: number;
    intensityOff: number;
    timeRaise: number;
    timeFall: number;
}

interface Registers {
    InputDisable: number;
    LongSlew: number;
    LowDrive: number;
    PullUp: number;
    PullDown: number;
    OpenDrain: number;
    Polarity: number;
    Dir: number;
    Data: number;
    InterruptMask: number;
    Sense: number;
    InterruptSource: number;
    EventStatus: number;
    LevelShifter?: number;
    Clock: number;
    Misc: number;
    LEDDriverEnable: number;
    DebounceConfig: number;
    DebounceEnable: number;
    KeyConfig?: number;
    KeyData?: number;
    Pins: PinRegisters[];
    HighInput?: number;
    Reset: number;
}

interface PinRegisters {
    TOn?: number;
    IOn: number;
    Off?: number;
    TRise?: number;
    TFall?: number;
}

export class SX150xHandler extends BigEndianDeviceHandlerBase<SX150xConfig> {
    private readonly registers: Readonly<Registers>;

    private readonly writeRegister: (command: number, value: number) => Promise<void>;
    private readonly readRegister: (command: number) => Promise<number>;

    private writeValue = 0;
    private readValue = 0;

    constructor(deviceConfig: I2CDeviceConfig, adapter: I2cAdapter) {
        super(deviceConfig, adapter);

        this.registers = this.loadRegisters();

        if (this.name == 'SX1509') {
            this.writeRegister = this.writeWord;
            this.readRegister = this.readWord;
        } else {
            this.writeRegister = this.writeByte;
            this.readRegister = this.readByte;
        }
    }

    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObject(this.hexAddress, {
            type: 'device',
            common: {
                name: `${this.hexAddress} (${this.name})`,
                role: 'sensor',
            },
            native: this.deviceConfig,
        });

        const keypadId = `${this.hexAddress}.key`;
        if (this.config.keypad.rowCount > 0 && this.registers.KeyData) {
            await this.adapter.extendObject(keypadId, {
                type: 'state',
                common: {
                    name: `${this.hexAddress} Pressed Key`,
                    read: true,
                    write: false,
                    type: 'string',
                    role: 'text',
                },
            });
        } else {
            this.adapter.delObject(keypadId);
        }

        let hasInput = false;
        let hasOuput = false;
        for (let i = 0; i < this.config.pins.length; i++) {
            const pinConfig = this.config.pins[i];
            const id = `${this.hexAddress}.${i}`;
            let outputState: number | string | undefined = undefined;
            switch (pinConfig.mode) {
                case 'input':
                    hasInput = true;
                    await this.adapter.extendObject(id, {
                        type: 'state',
                        common: {
                            name: `${this.hexAddress} Input ${i}`,
                            read: true,
                            write: false,
                            type: 'boolean',
                            role: 'indicator',
                        },
                        native: pinConfig as any,
                    });
                    break;
                case 'output':
                    outputState = i;
                    this.addOutputListener(i);
                    await this.adapter.extendObject(id, {
                        type: 'state',
                        common: {
                            name: `${this.hexAddress} Output ${i}`,
                            read: false,
                            write: true,
                            type: 'boolean',
                            role: 'switch',
                        },
                        native: pinConfig as any,
                    });
                    break;
                case 'led-static':
                case 'led-single':
                case 'led-blink':
                    outputState = i;
                    this.addOutputListener(i);
                    await this.adapter.extendObject(id, {
                        type: 'state',
                        common: {
                            name: `${this.hexAddress} LED ${i}`,
                            read: false,
                            write: true,
                            type: 'boolean',
                            role: 'switch',
                        },
                        native: pinConfig as any,
                    });
                    break;
                case 'led-channel': {
                    await this.adapter.extendObject(id, {
                        type: 'channel',
                        common: {
                            name: `${this.hexAddress} LED ${i}`,
                        },
                        native: pinConfig as any,
                    });
                    outputState = `${id}.on`;
                    this.addOutputListener(i, `${id}.on`);
                    await this.adapter.extendObject(`${id}.on`, {
                        type: 'state',
                        common: {
                            name: `${this.hexAddress} LED ${i} ON`,
                            read: false,
                            write: true,
                            type: 'boolean',
                            role: 'switch',
                        },
                        native: pinConfig as any,
                    });
                    const pinRegister = this.registers.Pins[i];
                    if (pinRegister.TOn) {
                        this.addLedLevelListener(i, 'timeOn');
                        await this.adapter.extendObject(`${id}.timeOn`, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} LED ${i} ON Time`,
                                read: false,
                                write: true,
                                type: 'number',
                                role: 'level',
                                min: 0,
                                max: 31,
                            },
                        });
                    }
                    this.addLedLevelListener(i, 'intensityOn');
                    await this.adapter.extendObject(`${id}.intensityOn`, {
                        type: 'state',
                        common: {
                            name: `${this.hexAddress} LED ${i} ON Intensity`,
                            read: false,
                            write: true,
                            type: 'number',
                            role: 'level',
                            min: 0,
                            max: 255,
                        },
                    });
                    if (pinRegister.Off) {
                        this.addLedLevelListener(i, 'timeOff');
                        await this.adapter.extendObject(`${id}.timeOff`, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} LED ${i} OFF Time`,
                                read: false,
                                write: true,
                                type: 'number',
                                role: 'level',
                                min: 0,
                                max: 31,
                            },
                        });
                        this.addLedLevelListener(i, 'intensityOff');
                        await this.adapter.extendObject(`${id}.intensityOff`, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} LED ${i} OFF Intensity`,
                                read: false,
                                write: true,
                                type: 'number',
                                role: 'level',
                                min: 0,
                                max: 7,
                            },
                        });
                    }
                    if (pinRegister.TRise) {
                        this.addLedLevelListener(i, 'timeRaise');
                        await this.adapter.extendObject(`${id}.timeRaise`, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} LED ${i} Fade-in Time`,
                                read: false,
                                write: true,
                                type: 'number',
                                role: 'level',
                                min: 0,
                                max: 31,
                            },
                        });
                        this.addLedLevelListener(i, 'timeFall');
                        await this.adapter.extendObject(`${id}.timeFall`, {
                            type: 'state',
                            common: {
                                name: `${this.hexAddress} LED ${i} Fade-out Time`,
                                read: false,
                                write: true,
                                type: 'number',
                                role: 'level',
                                min: 0,
                                max: 31,
                            },
                        });
                    }
                    break;
                }
                case 'keypad':
                    hasInput = true;
                // fall through!
                default:
                    this.adapter.delObject(id);
                    break;
            }

            if (outputState !== undefined) {
                hasOuput = true;
                let value = this.getStateValue<boolean>(outputState);
                if (value === undefined) {
                    value = false;
                    await this.setStateAckAsync(outputState, value);
                }

                if (value) {
                    this.writeValue |= 1 << i;
                }
            }
        }

        await this.configureDeviceAsync();

        if (hasOuput) {
            await this.sendCurrentValuesAsync();
        }

        if (!hasInput) {
            return;
        }

        await this.readCurrentValuesAsync(true);
        if (this.config.pollingInterval > 0) {
            this.startPolling(async () => await this.readCurrentValuesAsync(false), this.config.pollingInterval, 50);
        }

        if (this.config.interrupt) {
            try {
                // check if interrupt object exists
                await this.adapter.getObjectAsync(this.config.interrupt);

                // subscribe to the object and add change listener
                this.adapter.addForeignStateChangeListener(this.config.interrupt, async _value => {
                    this.debug('Interrupt detected');
                    await this.readCurrentValuesAsync(false);
                });

                this.debug('Interrupt enabled');
            } catch {
                this.error(`Interrupt object ${this.config.interrupt} not found!`);
            }
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
        return Promise.resolve();
    }

    private async configureDeviceAsync(): Promise<void> {
        const bankSize = this.config.pins.length / 2;

        // reset the device
        await this.writeByte(this.registers.Reset, 0x12);
        await this.writeByte(this.registers.Reset, 0x34);

        // configure registers
        await this.writePinBitmapAsync(this.registers.InputDisable, p => p.mode != 'input' && p.mode != 'keypad');
        await this.writePinBitmapAsync(
            this.registers.PullUp,
            (p, i) =>
                ((p.mode == 'input' || p.mode == 'output') && p.resistor == 'up') ||
                (p.mode == 'keypad' && i >= bankSize),
        );
        await this.writePinBitmapAsync(
            this.registers.PullDown,
            p => (p.mode == 'input' || p.mode == 'output') && p.resistor == 'down',
        );
        await this.writePinBitmapAsync(
            this.registers.OpenDrain,
            (p, i) =>
                p.mode.startsWith('led-') ||
                (p.mode == 'output' && p.openDrain) ||
                (p.mode == 'keypad' && i < bankSize),
        );
        await this.writePinBitmapAsync(this.registers.Polarity, p => p.mode != 'keypad' && p.invert);
        await this.writePinBitmapAsync(
            this.registers.Dir,
            (p, i) => p.mode == 'input' || (p.mode == 'keypad' && i >= bankSize),
        );
        await this.writePinBitmapAsync(
            this.registers.InterruptMask, // this is inverted: 0 : An event on this IO will trigger an interrupt
            p => p.mode != 'input' || p.interrupt == 'none',
        );
        await this.writeSenseAsync();
        await this.writeLevelShifterAsync();
        await this.writeClockAsync();
        await this.writeMiscAsync();
        await this.writePinBitmapAsync(this.registers.LEDDriverEnable, p => p.mode.startsWith('led-'));
        await this.writeByte(this.registers.DebounceConfig, this.config.debounceTime);
        await this.writePinBitmapAsync(
            this.registers.DebounceEnable,
            (p, i) => (p.mode == 'input' && p.debounce) || (p.mode == 'keypad' && i >= bankSize),
        );
        await this.writeKeyConfigAsync();
        for (let i = 0; i < this.config.pins.length; i++) {
            const pin = this.config.pins[i];
            let led: LedConfig;
            if (pin.mode == 'led-channel') {
                led = this.getLedChannelValues(i);
            } else {
                led = { ...pin.led };
                if (pin.mode == 'led-static') {
                    led.timeOn = 0;
                }
                if (pin.mode != 'led-blink') {
                    led.timeOff = 0;
                }
            }

            await this.writeLedConfigAsync(i, led);
        }

        if (this.registers.HighInput) {
            await this.writePinBitmapAsync(this.registers.HighInput, p => p.mode == 'input' && p.highInput);
        }
    }

    private async writePinBitmapAsync(
        register: number,
        predicate: (pin: PinConfig, index: number) => boolean,
    ): Promise<void> {
        const bitmap = this.config.pins.map(predicate);
        let value = 0;
        for (let i = 0; i < bitmap.length; i++) {
            if (bitmap[i]) {
                value |= 1 << i;
            }
        }

        await this.writeRegister(register, value);
    }

    private async writeSenseAsync(): Promise<void> {
        const buffer = Buffer.alloc(this.config.pins.length / 4);
        for (let i = 0; i < this.config.pins.length; i++) {
            const pin = this.config.pins[i];
            if (pin.mode != 'input') {
                continue;
            }
            let value = 0;
            switch (pin.interrupt) {
                case 'raising':
                    value = 1;
                    break;
                case 'falling':
                    value = 2;
                    break;
                case 'both':
                    value = 3;
                    break;
            }
            const offset = buffer.length - (i >> 2);
            buffer[offset] = buffer[offset] | (value << ((i % 4) * 2));
        }

        await this.writeI2cBlock(this.registers.Sense, buffer.length, buffer);
    }

    private async writeLevelShifterAsync(): Promise<void> {
        if (!this.registers.LevelShifter) {
            return;
        }
        let value = 0;
        for (let i = 0; i < this.config.pins.length / 2; i++) {
            const pin = this.config.pins[i];
            if (pin.mode != 'level-shifter') {
                continue;
            }
            switch (this.config.pins[i].levelShifterMode) {
                case 'AtoB':
                    value |= 1 << (i * 2);
                    break;
                case 'BtoA':
                    value |= 2 << (i * 2);
                    break;
            }
        }

        await this.writeRegister(this.registers.LevelShifter, value);
    }

    private async writeClockAsync(): Promise<void> {
        let value = 0;
        const pins = this.config.pins;
        if (pins.find(p => p.mode.startsWith('led-') || p.debounce) || this.config.keypad.rowCount > 0) {
            // OSC is required
            if (this.config.oscExternal) {
                value |= 0x20;
            } else if (this.config.oscFrequency > 0) {
                value |= 0x50 | this.config.oscFrequency;
            } else {
                value |= 0x40;
            }
        }

        await this.writeByte(this.registers.Clock, value);
    }

    private async writeMiscAsync(): Promise<void> {
        let value = 0;
        if (this.config.ledLog.length > 1 && this.config.ledLog[1]) {
            value |= 0x80;
        }
        if (this.config.pins.find(p => p.mode.startsWith('led-'))) {
            value |= this.config.ledFrequency << 4;
        }
        if (this.config.ledLog[0]) {
            value |= 0x08;
        }
        await this.writeByte(this.registers.Misc, value);
    }

    private async writeKeyConfigAsync(): Promise<void> {
        if (!this.registers.KeyConfig) {
            return;
        }

        const keypad = this.config.keypad;

        let value = 0;
        if (keypad.rowCount > 0) {
            if (this.config.pins.length == 8) {
                // SX1508
                value |= keypad.rowCount << 5;
                value |= keypad.columnCount << 3;
                value |= keypad.scanTime;
            } else {
                // SX1509
                value |= keypad.autoSleep << 12;
                value |= keypad.scanTime << 8;
                value |= keypad.rowCount << 3;
                value |= keypad.columnCount;
            }
        }
        await this.writeRegister(this.registers.KeyConfig, value);
    }

    private async writeLedConfigAsync(index: number, led: LedConfig): Promise<void> {
        const pinRegisters = this.registers.Pins[index];
        if (pinRegisters.TOn) {
            await this.writeByte(pinRegisters.TOn, led.timeOn);
        }
        await this.writeByte(pinRegisters.IOn, led.intensityOn);
        if (pinRegisters.Off) {
            let value = 0;
            value |= led.timeOff << 3;
            value |= led.intensityOff;
            await this.writeByte(pinRegisters.Off, value);
        }
        if (pinRegisters.TRise && pinRegisters.TFall) {
            await this.writeByte(pinRegisters.TRise, led.timeRaise);
            await this.writeByte(pinRegisters.TFall, led.timeFall);
        }
    }

    private async sendCurrentValuesAsync(): Promise<void> {
        this.debug(`Sending ${toHexString(this.writeValue, this.config.pins.length / 4)}`);
        try {
            await this.writeRegister(this.registers.Data, this.writeValue);
        } catch (e: any) {
            this.error(`Couldn't send current value: ${e}`);
        }
    }

    private async readCurrentValuesAsync(force: boolean): Promise<void> {
        const oldValue = this.readValue;
        try {
            this.readValue = await this.readRegister(this.registers.Data);
        } catch (e: any) {
            this.error(`Couldn't read current data: ${e}`);
            return;
        }

        if (oldValue != this.readValue || force) {
            this.debug(`Read data ${toHexString(this.readValue, this.config.pins.length / 4)}`);
            for (let i = 0; i < this.config.pins.length; i++) {
                const mask = 1 << i;
                if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].mode == 'input') {
                    const value = (this.readValue & mask) > 0;
                    await this.setStateAckAsync(i, value);
                }
            }
        }

        if (!this.registers.KeyData || this.config.keypad.rowCount === 0) {
            return;
        }

        let keyData = 0;
        try {
            keyData = await this.readRegister(this.registers.KeyData);
        } catch (e: any) {
            this.error(`Couldn't read key data: ${e}`);
            return;
        }

        const keyDataStr = toHexString(keyData, this.config.pins.length / 4);
        this.debug(`Read key data ${keyDataStr}`);
        const bankSize = this.config.pins.length / 2;
        let row = -1;
        let col = -1;
        for (let i = 0; i < this.config.pins.length; i++) {
            const mask = 1 << i;
            if (this.config.pins[i].mode == 'keypad' && (keyData & mask) === 0) {
                if (i < bankSize) {
                    if (row >= 0) {
                        this.error(`Duplicate rows: ${row} and ${i} from ${keyDataStr}`);
                        return;
                    }
                    row = i;
                } else {
                    if (col >= 0) {
                        this.error(`Duplicate cols: ${col} and ${i - bankSize} from ${keyDataStr}`);
                        return;
                    }
                    col = i - bankSize;
                }
            }
        }

        if (row < 0 || col < 0) {
            return;
        }

        const keyValue = this.config.keypad.keyValues[row][col];
        this.debug(`Decoded key [${row},${col}] = "${keyValue}"`);
        await this.setStateAckAsync('key', keyValue);
    }

    private addOutputListener(pin: number, id?: string): void {
        this.adapter.addStateChangeListener<boolean>(
            id || `${this.hexAddress}.${pin}`,
            async (_oldValue: boolean, newValue: boolean) => await this.changeOutputAsync(pin, newValue),
        );
    }

    private async changeOutputAsync(pin: number, value: boolean): Promise<void> {
        const mask = 1 << pin;
        if (value) {
            this.writeValue &= ~mask;
        } else {
            this.writeValue |= mask;
        }

        await this.sendCurrentValuesAsync();
        await this.setStateAckAsync(pin, value);
    }

    private addLedLevelListener(pin: number, type: keyof LedConfig): void {
        this.adapter.addStateChangeListener<number>(
            `${this.hexAddress}.${pin}.${type}`,
            async (_oldValue: number, newValue: number) => await this.changeLedLevelAsync(pin, type, newValue),
        );
    }

    private async changeLedLevelAsync(pin: number, type: keyof LedConfig, value: number): Promise<void> {
        const led = this.getLedChannelValues(pin);
        led[type] = value;
        try {
            await this.writeLedConfigAsync(pin, led);
            await this.setStateAckAsync(`${pin}.${type}`, value);
        } catch (e: any) {
            this.error(`Couldn't write LED config: ${e}`);
        }
    }

    private getLedChannelValues(index: number): LedConfig {
        return {
            timeOn: this.getStateValue<number>(`${index}.timeOn`) || 0,
            intensityOn: this.getStateValue<number>(`${index}.intensityOn`) || 0,
            timeOff: this.getStateValue<number>(`${index}.timeOff`) || 0,
            intensityOff: this.getStateValue<number>(`${index}.intensityOff`) || 0,
            timeRaise: this.getStateValue<number>(`${index}.timeRaise`) || 0,
            timeFall: this.getStateValue<number>(`${index}.timeFall`) || 0,
        };
    }

    private loadRegisters(): Readonly<Registers> {
        let registers: Registers;
        let pinRegister: number;
        switch (this.name) {
            case 'SX1507':
                registers = {
                    InputDisable: 0x00,
                    LongSlew: 0x01,
                    LowDrive: 0x02,
                    PullUp: 0x03,
                    PullDown: 0x04,
                    OpenDrain: 0x05,
                    Polarity: 0x06,
                    Dir: 0x07,
                    Data: 0x08,
                    InterruptMask: 0x09,
                    Sense: 0x0a,
                    InterruptSource: 0x0b,
                    EventStatus: 0x0c,
                    Clock: 0x0d,
                    Misc: 0x0e,
                    LEDDriverEnable: 0x0f,
                    DebounceConfig: 0x10,
                    DebounceEnable: 0x11,
                    Pins: [],
                    Reset: 0x7d,
                };
                pinRegister = 0x12;
                for (let i = 0; i < 4; i++) {
                    registers.Pins[i] = {
                        TOn: pinRegister++,
                        IOn: pinRegister++,
                        Off: pinRegister++,
                        TRise: i > 0 ? pinRegister++ : undefined,
                        TFall: i > 0 ? pinRegister++ : undefined,
                    };
                }
                break;
            case 'SX1508':
                registers = {
                    InputDisable: 0x00,
                    LongSlew: 0x01,
                    LowDrive: 0x02,
                    PullUp: 0x03,
                    PullDown: 0x04,
                    OpenDrain: 0x05,
                    Polarity: 0x06,
                    Dir: 0x07,
                    Data: 0x08,
                    InterruptMask: 0x09,
                    Sense: 0x0a,
                    InterruptSource: 0x0c,
                    EventStatus: 0x0d,
                    LevelShifter: 0x0e,
                    Clock: 0x0f,
                    Misc: 0x10,
                    LEDDriverEnable: 0x11,
                    DebounceConfig: 0x12,
                    DebounceEnable: 0x13,
                    KeyConfig: 0x14,
                    KeyData: 0x15,
                    Pins: [],
                    HighInput: 0x2a,
                    Reset: 0x7d,
                };
                pinRegister = 0x16;
                for (let i = 0; i < 8; i++) {
                    registers.Pins[i] = {
                        TOn: (i >> 1) % 2 === 1 ? pinRegister++ : undefined,
                        IOn: pinRegister++,
                        Off: (i >> 1) % 2 === 1 ? pinRegister++ : undefined,
                        TRise: i % 4 === 3 ? pinRegister++ : undefined,
                        TFall: i % 4 === 3 ? pinRegister++ : undefined,
                    };
                }
                break;
            default:
                registers = {
                    InputDisable: 0x00,
                    LongSlew: 0x02,
                    LowDrive: 0x04,
                    PullUp: 0x06,
                    PullDown: 0x08,
                    OpenDrain: 0x0a,
                    Polarity: 0x0c,
                    Dir: 0x0e,
                    Data: 0x10,
                    InterruptMask: 0x12,
                    Sense: 0x14,
                    InterruptSource: 0x18,
                    EventStatus: 0x1a,
                    LevelShifter: 0x1c,
                    Clock: 0x1e,
                    Misc: 0x1f,
                    LEDDriverEnable: 0x20,
                    DebounceConfig: 0x22,
                    DebounceEnable: 0x23,
                    KeyConfig: 0x25,
                    KeyData: 0x27,
                    Pins: [],
                    HighInput: 0x69,
                    Reset: 0x7d,
                };
                pinRegister = 0x29;
                for (let i = 0; i < 16; i++) {
                    registers.Pins[i] = {
                        TOn: pinRegister++,
                        IOn: pinRegister++,
                        Off: pinRegister++,
                        TRise: (i >> 2) % 2 === 1 ? pinRegister++ : undefined,
                        TFall: (i >> 2) % 2 === 1 ? pinRegister++ : undefined,
                    };
                }
                break;
        }

        return registers;
    }
}

interface PinCapabilities {
    levelShift: boolean;
    blink: boolean;
    breath: boolean;
}

// Helper to create data path accessor
function d(path: string): string {
    return `data.SX150x.${path}`;
}

// Helper to check if any pin has a mode starting with 'led-'
function hasLedPins(pinCount: number): string {
    const checks: string[] = [];
    for (let i = 0; i < pinCount; i++) {
        checks.push(`${d(`pins?.["${i}"]?.mode`)}?.startsWith("led-")`);
    }
    return checks.join(' || ');
}

// Helper to check if any pin has input mode with debounce enabled
function hasDebouncedPins(pinCount: number): string {
    const checks: string[] = [];
    for (let i = 0; i < pinCount; i++) {
        checks.push(`(${d(`pins?.["${i}"]?.mode`)} === "input" && ${d(`pins?.["${i}"]?.debounce`)})`);
    }
    return `${hasKeypadPins()} || ${checks.join(' || ')}`;
}

// Helper to check if keypad is active
function hasKeypadPins(): string {
    return `(${d('keypad?.rowCount')} ?? 0) > 0`;
}

// Helper to get showLed condition (based on "features" checkboxes behavior)
function showLedCondition(pinCount: number): string {
    // showLed is true if any pin has led- mode OR user checked the showLed checkbox
    return `data._showLed || (${hasLedPins(pinCount)})`;
}

// Helper to get showDebounce condition
function showDebounceCondition(pinCount: number): string {
    // showDebounce is true if user checked it OR if keypad is active OR if any pin has debounce
    return `data._showDebounce || data._showKeypad || (${hasDebouncedPins(pinCount)})`;
}

// Helper to get showKeypad condition
function showKeypadCondition(): string {
    return `data._showKeypad || (${hasKeypadPins()})`;
}

function createConfig(name: `SX150${7 | 8 | 9}`): Record<string, ConfigItemAny> {
    const config: Record<string, ConfigItemAny> = {};
    const caps = [] as PinCapabilities[];
    let pinCount: number;
    switch (name) {
        case 'SX1507':
            pinCount = 4;
            for (let i = 0; i < 4; i++) {
                caps[i] = { levelShift: false, blink: true, breath: i > 0 };
            }
            break;
        case 'SX1508':
            pinCount = 8;
            for (let i = 0; i < 8; i++) {
                caps[i] = { levelShift: i < 4, blink: (i >> 1) % 2 === 1, breath: i % 4 === 3 };
            }
            break;
        default:
            pinCount = 16;
            for (let i = 0; i < 16; i++) {
                caps[i] = { levelShift: i < 8, blink: true, breath: (i >> 2) % 2 === 1 };
            }
            break;
    }

    const hasKeypad = pinCount > 4;
    const hasHighInput = pinCount > 4;
    const hasAutoSleep = pinCount === 16;
    const bankSize = pinCount / 2;

    // =====================================
    // Features checkboxes section
    // =====================================
    Object.assign(config, {
        _featuresHeader: {
            type: 'staticText',
            text: 'Features',
            xs: 12,
            newLine: true,
        },
        // showLed checkbox - disabled if there are already LED pins configured
        _showLed: {
            type: 'checkbox',
            label: 'LEDs',
            default: false,
            disabled: hasLedPins(pinCount),
            xs: 3,
        },
        // showDebounce checkbox - disabled if keypad is active or debounced pins exist
        _showDebounce: {
            type: 'checkbox',
            label: 'Debouncing',
            default: false,
            disabled: `data._showKeypad || (${hasDebouncedPins(pinCount)})`,
            xs: 3,
        },
    });

    // showKeypad checkbox - only for devices with keypad support (pinCount > 4)
    if (hasKeypad) {
        config._showKeypad = {
            type: 'checkbox',
            label: 'Keypad',
            default: false,
            disabled: hasKeypadPins(),
            xs: 3,
        };
    }

    // =====================================
    // Oscillator settings (shown when LED, debounce, or keypad is enabled)
    // =====================================
    const showOscillator = hasKeypad
        ? `(${showLedCondition(pinCount)}) || (${showDebounceCondition(pinCount)}) || (${showKeypadCondition()})`
        : `(${showLedCondition(pinCount)}) || (${showDebounceCondition(pinCount)})`;

    config._oscHeader = {
        type: 'staticText',
        text: 'Oscillator',
        hidden: `!(${showOscillator})`,
        xs: 12,
        newLine: true,
    };

    // Note: oscExternal is shown as a toggle switch - Internal/External
    // Using checkbox: unchecked = Internal (false), checked = External (true)
    config['SX150x.oscExternal'] = {
        type: 'checkbox',
        label: 'External Oscillator',
        default: false,
        hidden: `!(${showOscillator})`,
        xs: 7,
        md: 5,
        newLine: true,
    };

    // Oscillator frequency options (only shown when internal oscillator selected)
    const oscFrequencyOptions = [
        { value: 0, label: 'Off' },
        { value: 1, label: '2 MHz' },
        { value: 2, label: '1 MHz' },
        { value: 3, label: '500 kHz' },
        { value: 4, label: '250 kHz' },
        { value: 5, label: '125 kHz' },
        { value: 6, label: '62.5 kHz' },
        { value: 7, label: '~31.3 kHz' },
        { value: 8, label: '~15.6 kHz' },
        { value: 9, label: '~7.8 kHz' },
        { value: 10, label: '~3.9 kHz' },
        { value: 11, label: '~2 kHz' },
        { value: 12, label: '~977 Hz' },
        { value: 13, label: '~488 Hz' },
        { value: 14, label: '~244 Hz' },
    ];

    config['SX150x.oscFrequency'] = {
        type: 'select',
        label: 'OSCOUT frequency',
        options: oscFrequencyOptions,
        default: 0,
        hidden: `!(${showOscillator}) || ${d('oscExternal')}`,
        xs: 5,
        md: 4,
    };

    // =====================================
    // LED settings (shown when showLed is active)
    // =====================================
    const ledFrequencyOptions = [
        { value: 1, label: '2 MHz' },
        { value: 2, label: '1 MHz' },
        { value: 3, label: '500 kHz' },
        { value: 4, label: '250 kHz' },
        { value: 5, label: '125 kHz' },
        { value: 6, label: '62.5 kHz' },
        { value: 7, label: '31.25 kHz' },
    ];

    config['SX150x.ledFrequency'] = {
        type: 'select',
        label: 'LED driver frequency',
        options: ledFrequencyOptions,
        default: 1,
        hidden: `!(${showLedCondition(pinCount)})`,
        xs: 6,
        md: 3,
        newLine: true,
    };

    // LED Log (logarithmic) toggle for first bank
    // Using checkbox: unchecked = Linear (false), checked = Logarithmic (true)
    config['SX150x.ledLog.0'] = {
        type: 'checkbox',
        label: pinCount > 4 ? 'LED driver mode Bank A' : 'LED driver mode',
        default: false,
        hidden: `!(${showLedCondition(pinCount)})`,
        xs: 6,
        md: 4,
    };

    // LED Log for second bank (only for devices with more than 4 pins)
    if (pinCount > 4) {
        config['SX150x.ledLog.1'] = {
            type: 'checkbox',
            label: 'LED driver mode Bank B',
            default: false,
            hidden: `!(${showLedCondition(pinCount)})`,
            xs: 6,
            md: 4,
        };
    }

    // =====================================
    // Debounce settings (shown when showDebounce or showKeypad is active)
    // =====================================
    const debounceTimeOptions = [
        { value: 0, label: '0.5 ms' },
        { value: 1, label: '1 ms' },
        { value: 2, label: '2 ms' },
        { value: 3, label: '4 ms' },
        { value: 4, label: '8 ms' },
        { value: 5, label: '16 ms' },
        { value: 6, label: '32 ms' },
        { value: 7, label: '64 ms' },
    ];

    const showDebounceSettings = hasKeypad
        ? `(${showDebounceCondition(pinCount)}) || (${showKeypadCondition()})`
        : showDebounceCondition(pinCount);

    config['SX150x.debounceTime'] = {
        type: 'select',
        label: 'Debounce time',
        options: debounceTimeOptions,
        default: 0,
        hidden: `!(${showDebounceSettings})`,
        xs: 6,
        md: 4,
        newLine: true,
    };

    // =====================================
    // Keypad settings (only for devices with keypad support)
    // =====================================
    if (hasKeypad) {
        // Row count options
        const keyRowsOptions = [{ value: 0, label: 'Off' }];
        for (let i = 1; i < bankSize; i++) {
            keyRowsOptions.push({ value: i, label: (i + 1).toString() });
        }

        config['SX150x.keypad.rowCount'] = {
            type: 'select',
            label: 'Number of rows',
            options: keyRowsOptions,
            default: 0,
            hidden: `!(${showKeypadCondition()})`,
            xs: 6,
            md: 3,
            newLine: true,
        };

        // Column count options
        const keyColsOptions = [{ value: 0, label: '1' }];
        for (let i = 1; i < bankSize; i++) {
            keyColsOptions.push({ value: i, label: (i + 1).toString() });
        }

        config['SX150x.keypad.columnCount'] = {
            type: 'select',
            label: 'Number of columns',
            options: keyColsOptions,
            default: 0,
            hidden: `!(${showKeypadCondition()}) || !${d('keypad?.rowCount')}`,
            xs: 6,
            md: 3,
        };

        // Auto sleep (only for SX1509)
        if (hasAutoSleep) {
            const keyAutoSleepOptions = [
                { value: 0, label: 'Off' },
                { value: 1, label: '128 ms' },
                { value: 2, label: '256 ms' },
                { value: 3, label: '512 ms' },
                { value: 4, label: '1 sec' },
                { value: 5, label: '2 sec' },
                { value: 6, label: '4 sec' },
                { value: 7, label: '8 sec' },
            ];

            config['SX150x.keypad.autoSleep'] = {
                type: 'select',
                label: 'Auto sleep time',
                options: keyAutoSleepOptions,
                default: 0,
                hidden: `!(${showKeypadCondition()}) || !${d('keypad?.rowCount')}`,
                xs: 6,
                md: 3,
            };
        }

        // Scan time options - must be >= debounce time
        const keyScanTimeOptions: ConfigItemSelectOption[] = [];
        for (let i = 0; i < 8; i++) {
            keyScanTimeOptions.push({
                value: i,
                label: `${1 << i} ms`,
                hidden: `${i} < (${d('debounceTime')} ?? 0)`,
            });
        }

        config['SX150x.keypad.scanTime'] = {
            type: 'select',
            label: 'Scan time',
            options: keyScanTimeOptions,
            default: 0,
            hidden: `!(${showKeypadCondition()}) || !${d('keypad?.rowCount')}`,
            xs: 6,
            md: 3,
        };

        // Keypad values header
        config._keypadValuesHeader = {
            type: 'staticText',
            text: 'Keypad key values',
            hidden: `!(${showKeypadCondition()}) || !${d('keypad?.rowCount')}`,
            xs: 12,
            newLine: true,
        };

        // Create keypad value inputs as a grid
        // First, add empty space before column headers (matches original: <Grid item xs={2} md={1}></Grid>)
        config._keyColHeaderSpacer = {
            type: 'staticText',
            text: '',
            hidden: `!(${showKeypadCondition()}) || !${d('keypad?.rowCount')}`,
            xs: 2,
            md: 1,
            newLine: true,
        };

        // Create column headers
        for (let col = 0; col < bankSize; col++) {
            config[`_keyColHeader${col}`] = {
                type: 'staticText',
                text: { en: `Column ${col}`, de: `Spalte ${col}` },
                hidden: `!(${showKeypadCondition()}) || !${d('keypad?.rowCount')} || ${col} > (${d('keypad?.columnCount')} ?? 0)`,
                xs: 1,
            };
        }

        // Create rows with row header and value inputs
        for (let row = 0; row < bankSize; row++) {
            config[`_keyRowHeader${row}`] = {
                type: 'staticText',
                text: { en: `Row ${row}`, de: `Zeile ${row}` },
                hidden: `!(${showKeypadCondition()}) || !${d('keypad?.rowCount')} || ${row} > (${d('keypad?.rowCount')} ?? 0)`,
                xs: 2,
                md: 1,
                newLine: true,
            };

            for (let col = 0; col < bankSize; col++) {
                // Default value: letter (A,B,C...) + row number
                const defaultValue = String.fromCharCode(65 + col) + row;
                config[`SX150x.keypad.keyValues.${row}.${col}`] = {
                    type: 'text',
                    default: defaultValue,
                    hidden: `!(${showKeypadCondition()}) || !${d('keypad?.rowCount')} || ${row} > (${d('keypad?.rowCount')} ?? 0) || ${col} > (${d('keypad?.columnCount')} ?? 0)`,
                    xs: 1,
                };
            }
        }
    }

    // =====================================
    // Pin configurations
    // =====================================
    for (let i = 0; i < pinCount; i++) {
        const pinCaps = caps[i];
        const isInBankB = i >= bankSize;
        const correspondingBankAPin = i - bankSize;
        const correspondingBankBPin = i + bankSize;

        // Pin divider
        config[`_pinDivider${i}`] = {
            type: 'divider',
            xs: 12,
            newLine: true,
        };

        // Pin label
        config[`_pinLabel${i}`] = {
            type: 'staticText',
            text: { en: `Pin ${i}`, de: `Pin ${i}` },
            xs: 2,
            md: 1,
        };

        // Build mode options based on capabilities
        // Mode is disabled when pin is controlled by keypad or level-shifter from bank A
        const modeOptions: ConfigItemSelectOption[] = [];

        // Check if this pin is used for keypad
        const isKeypadPin = hasKeypad
            ? isInBankB
                ? `${correspondingBankAPin} <= (${d('keypad?.columnCount')} ?? 0) && (${d('keypad?.rowCount')} ?? 0) > 0` // Bank B: column pins
                : `${i} <= (${d('keypad?.rowCount')} ?? 0) && (${d('keypad?.rowCount')} ?? 0) > 0` // Bank A: row pins
            : 'false';

        // Check if this pin is level-shifter slave (bank B controlled by bank A)
        const isLevelShifterSlave =
            isInBankB && pinCaps.levelShift
                ? `${d(`pins?.["${correspondingBankAPin}"]?.mode`)} === "level-shifter"`
                : 'false';

        // Combined condition for pin being externally controlled
        const pinControlledExternally = hasKeypad
            ? `(${isKeypadPin}) || (${isLevelShifterSlave})`
            : isLevelShifterSlave;

        // Keypad mode (shown when keypad controls this pin)
        if (hasKeypad) {
            modeOptions.push({
                value: 'keypad',
                label: 'Keypad',
                hidden: `!(${isKeypadPin})`,
            });
        }

        // Level-shifter slave mode (shown when bank A controls this pin)
        if (isInBankB && pinCaps.levelShift) {
            modeOptions.push({
                value: 'level-shifter',
                label: 'Level Shifter',
                hidden: `!(${isLevelShifterSlave})`,
            });
        }

        // Standard modes (shown when not externally controlled)
        modeOptions.push({
            value: 'none',
            label: 'None',
            hidden: pinControlledExternally,
        });
        modeOptions.push({
            value: 'input',
            label: 'Input',
            hidden: pinControlledExternally,
        });
        modeOptions.push({
            value: 'output',
            label: 'Output',
            hidden: pinControlledExternally,
        });

        // Level-shifter option for bank A pins that support it
        if (pinCaps.levelShift && !isInBankB) {
            // Level shifter is disabled if the corresponding bank B pin is already in use (not 'none' or 'level-shifter')
            const bankBMode = d(`pins?.["${correspondingBankBPin}"]?.mode`);
            modeOptions.push({
                value: 'level-shifter',
                label: 'Level Shifter',
                hidden: `(${pinControlledExternally}) || (${bankBMode} !== "none" && ${bankBMode} !== "level-shifter")`,
            });
        }

        // LED modes (shown when showLed is enabled and not externally controlled)
        const showLedCond = showLedCondition(pinCount);
        modeOptions.push({
            value: 'led-channel',
            label: 'LED as channel',
            hidden: `!(${showLedCond}) || (${pinControlledExternally})`,
        });
        modeOptions.push({
            value: 'led-static',
            label: 'LED static value',
            hidden: `!(${showLedCond}) || (${pinControlledExternally})`,
        });

        if (pinCaps.blink) {
            modeOptions.push({
                value: 'led-single',
                label: 'LED single shot',
                hidden: `!(${showLedCond}) || (${pinControlledExternally})`,
            });
            modeOptions.push({
                value: 'led-blink',
                label: 'LED blinking',
                hidden: `!(${showLedCond}) || (${pinControlledExternally})`,
            });
        }

        config[`SX150x.pins.${i}.mode`] = {
            type: 'select',
            label: 'Mode',
            options: modeOptions,
            default: 'none',
            xs: 3,
            md: 2,
            xl: 1,
        };

        // Invert checkbox (for input, output, led-, and level-shifter modes)
        const pinMode = d(`pins?.["${i}"]?.mode`);
        config[`SX150x.pins.${i}.invert`] = {
            type: 'checkbox',
            label: 'inverted',
            default: false,
            hidden: `${pinMode} !== "input" && ${pinMode} !== "output" && !${pinMode}.startsWith("led-") && ${pinMode} !== "level-shifter"`,
            xs: 2,
        };

        // Resistor dropdown (for input and output modes)
        config[`SX150x.pins.${i}.resistor`] = {
            type: 'select',
            label: 'Resistor',
            options: [
                { value: 'none', label: 'None' },
                { value: 'up', label: 'Pull-up' },
                { value: 'down', label: 'Pull-down' },
            ],
            default: 'none',
            hidden: `${pinMode} !== "input" && ${pinMode} !== "output"`,
            xs: 3,
            md: 2,
            xl: 1,
        };

        // Open drain checkbox (for output mode)
        config[`SX150x.pins.${i}.openDrain`] = {
            type: 'checkbox',
            label: 'open drain',
            default: false,
            hidden: `${pinMode} !== "output"`,
            xs: 3,
            md: 2,
            xl: 1,
        };

        // Debounce checkbox (for input mode when showDebounce is enabled)
        config[`SX150x.pins.${i}.debounce`] = {
            type: 'checkbox',
            label: 'debounce',
            default: false,
            hidden: `${pinMode} !== "input" || !(${showDebounceSettings})`,
            xs: 2,
        };

        // Interrupt dropdown (for input mode)
        config[`SX150x.pins.${i}.interrupt`] = {
            type: 'select',
            label: 'Interrupt trigger',
            options: [
                { value: 'none', label: 'None' },
                { value: 'raising', label: 'Raising' },
                { value: 'falling', label: 'Falling' },
                { value: 'both', label: 'Both' },
            ],
            default: 'none',
            hidden: `${pinMode} !== "input"`,
            xs: 3,
            md: 2,
            xl: 1,
        };

        // High input checkbox (for input mode on devices that support it)
        if (hasHighInput) {
            config[`SX150x.pins.${i}.highInput`] = {
                type: 'checkbox',
                label: 'high input voltage',
                default: false,
                hidden: `${pinMode} !== "input"`,
                xs: 2,
            };
        }

        // Level shifter mode dropdown (for level-shifter mode)
        if (pinCaps.levelShift) {
            const pin1 = !isInBankB ? i : correspondingBankAPin;
            const pin2 = !isInBankB ? correspondingBankBPin : i;
            config[`SX150x.pins.${i}.levelShifterMode`] = {
                type: 'select',
                label: 'Level shifter mode',
                options: [
                    { value: 'AtoB', label: { en: `Pin ${pin1} → Pin ${pin2}` } },
                    { value: 'BtoA', label: { en: `Pin ${pin2} → Pin ${pin1}` } },
                ],
                default: 'AtoB',
                hidden: `${pinMode} !== "level-shifter"`,
                disabled: isInBankB, // Bank B pins are controlled by bank A
                xs: 3,
                md: 2,
                xl: 1,
            };
        }

        // LED intensity on (for led-static, led-single, led-blink modes)
        config[`SX150x.pins.${i}.led.intensityOn`] = {
            type: 'number',
            label: 'ON intensity',
            default: 255,
            min: 0,
            max: 255,
            hidden: `!${pinMode}?.startsWith("led-") || ${pinMode} === "led-channel"`,
            xs: 3,
            md: 2,
            xl: 1,
        };

        // LED time on (for led-single and led-blink modes)
        // Options are dynamically calculated based on led frequency
        const ledTimeOptions: ConfigItemSelectOption[] = [];
        for (let f = 1; f <= 7; f++) {
            const clockFrequency = 2000000 / (1 << (f - 1));
            for (let t = 1; t < 32; t++) {
                const factor = t < 16 ? 64 : 512;
                let value = (factor * t * 255) / clockFrequency;
                let unit = 'sec';
                if (value < 1) {
                    value *= 1000;
                    unit = 'ms';
                }

                ledTimeOptions.push({
                    value: t,
                    label: `${value.toFixed(2)} ${unit}`,
                    hidden: `${d('ledFrequency')} !== ${f}`,
                });
            }
        }

        config[`SX150x.pins.${i}.led.timeOn`] = {
            type: 'select',
            label: 'ON time',
            options: ledTimeOptions,
            default: 1,
            hidden: `${pinMode} !== "led-single" && ${pinMode} !== "led-blink"`,
            xs: 3,
            md: 2,
            xl: 1,
        };

        // LED intensity off (for led-blink mode)
        const ledIntensityOffOptions: ConfigItemSelectOption[] = [];
        for (let t = 0; t < 8; t++) {
            ledIntensityOffOptions.push({ value: t, label: (t * 4).toString() });
        }

        config[`SX150x.pins.${i}.led.intensityOff`] = {
            type: 'select',
            label: 'OFF intensity',
            options: ledIntensityOffOptions,
            default: 0,
            hidden: `${pinMode} !== "led-blink"`,
            xs: 3,
            md: 2,
            xl: 1,
        };

        // LED time off (for led-blink mode)
        config[`SX150x.pins.${i}.led.timeOff`] = {
            type: 'select',
            label: 'OFF time',
            options: ledTimeOptions,
            default: 1,
            hidden: `${pinMode} !== "led-blink"`,
            xs: 3,
            md: 2,
            xl: 1,
        };

        // LED fade options (for pins that support breath)
        if (pinCaps.breath) {
            const ledFadeOptions: ConfigItemSelectOption[] = [{ value: 0, label: 'Off' }];
            for (let t = 1; t < 32; t++) {
                ledFadeOptions.push({ value: t, label: `${t}` });
            }

            config[`SX150x.pins.${i}.led.timeRaise`] = {
                type: 'select',
                label: 'Fade in time',
                options: ledFadeOptions,
                default: 0,
                hidden: `!${pinMode}?.startsWith("led-") || ${pinMode} === "led-channel"`,
                xs: 3,
                md: 2,
                xl: 1,
            };

            config[`SX150x.pins.${i}.led.timeFall`] = {
                type: 'select',
                label: 'Fade out time',
                options: ledFadeOptions,
                default: 0,
                hidden: `!${pinMode}?.startsWith("led-") || ${pinMode} === "led-channel"`,
                xs: 3,
                md: 2,
                xl: 1,
            };
        }
    }

    return config;
}

export const SX150x: DeviceHandlerInfo = {
    type: 'SX150x',
    createHandler: (deviceConfig, adapter) => new SX150xHandler(deviceConfig, adapter),
    names: [
        { name: 'SX1507', addresses: [0x3e, 0x3f, 0x70, 0x71], config: createConfig('SX1507') },
        { name: 'SX1508', addresses: [0x20, 0x21, 0x22, 0x23], config: createConfig('SX1508') },
        { name: 'SX1509', addresses: [0x3e, 0x3f, 0x70, 0x71], config: createConfig('SX1509') },
    ],
    config: {
        pollingInterval: {
            type: 'number',
            label: 'Polling Interval',
            default: 200,
            unit: 'ms',
            xs: 7,
            sm: 5,
            md: 3,
        },
        interrupt: {
            type: 'objectId',
            label: 'Interrupt State Object ID',
            xs: 12,
            newLine: true,
        },
    },
};
