import { I2CDeviceConfig, ImplementationConfigBase } from '../lib/adapter-config';
import { toHexString } from '../lib/shared';
import { I2cAdapter } from '../main';
import { BigEndianDeviceHandlerBase } from './big-endian-device-handler-base';

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

export default class SX150x extends BigEndianDeviceHandlerBase<SX150xConfig> {
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
        await this.adapter.extendObjectAsync(this.hexAddress, {
            type: 'device',
            common: {
                name: this.hexAddress + ' (' + this.name + ')',
                role: 'sensor',
            },
            native: this.config as any,
        });

        const keypadId = `${this.hexAddress}.key`;
        if (this.config.keypad.rowCount > 0 && this.registers.KeyData) {
            this.adapter.extendObject(keypadId, {
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
                    this.adapter.extendObject(id, {
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
                    this.adapter.extendObject(id, {
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
                    this.adapter.extendObject(id, {
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
                case 'led-channel':
                    this.adapter.extendObject(id, {
                        type: 'channel',
                        common: {
                            name: `${this.hexAddress} LED ${i}`,
                        },
                        native: pinConfig as any,
                    });
                    outputState = `${id}.on`;
                    this.addOutputListener(i, `${id}.on`);
                    this.adapter.extendObject(`${id}.on`, {
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
                        this.adapter.extendObject(`${id}.timeOn`, {
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
                    this.adapter.extendObject(`${id}.intensityOn`, {
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
                        this.adapter.extendObject(`${id}.timeOff`, {
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
                        this.adapter.extendObject(`${id}.intensityOff`, {
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
                        this.adapter.extendObject(`${id}.timeRaise`, {
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
                        this.adapter.extendObject(`${id}.timeFall`, {
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
                this.adapter.addForeignStateChangeListener(this.config.interrupt, async (_value) => {
                    this.debug('Interrupt detected');
                    await this.readCurrentValuesAsync(false);
                });

                this.debug('Interrupt enabled');
            } catch (error) {
                this.error(`Interrupt object ${this.config.interrupt} not found!`);
            }
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        this.stopPolling();
    }

    private async configureDeviceAsync(): Promise<void> {
        const bankSize = this.config.pins.length / 2;

        // reset the device
        await this.writeByte(this.registers.Reset, 0x12);
        await this.writeByte(this.registers.Reset, 0x34);

        // configure registers
        await this.writePinBitmapAsync(this.registers.InputDisable, (p) => p.mode != 'input' && p.mode != 'keypad');
        await this.writePinBitmapAsync(
            this.registers.PullUp,
            (p) => (p.mode == 'input' || p.mode == 'output') && p.resistor == 'up',
        );
        await this.writePinBitmapAsync(
            this.registers.PullDown,
            (p) => (p.mode == 'input' || p.mode == 'output') && p.resistor == 'down',
        );
        await this.writePinBitmapAsync(
            this.registers.OpenDrain,
            (p) => p.mode.startsWith('led-') || (p.mode == 'output' && p.openDrain),
        );
        await this.writePinBitmapAsync(this.registers.Polarity, (p) => p.invert);
        await this.writePinBitmapAsync(
            this.registers.Dir,
            (p, i) => p.mode == 'input' || (p.mode == 'keypad' && i >= bankSize),
        );
        await this.writePinBitmapAsync(
            this.registers.InterruptMask, // this is inverted: 0 : An event on this IO will trigger an interrupt
            (p) => p.mode != 'input' || p.interrupt == 'none',
        );
        await this.writeSenseAsync();
        await this.writeLevelShifterAsync();
        await this.writeClockAsync();
        await this.writeMiscAsync();
        await this.writePinBitmapAsync(this.registers.LEDDriverEnable, (p) => p.mode.startsWith('led-'));
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
            await this.writePinBitmapAsync(this.registers.HighInput, (p) => p.mode == 'input' && p.highInput);
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
        if (pins.find((p) => p.mode.startsWith('led-') || p.debounce) || this.config.keypad.rowCount > 0) {
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
        if (this.config.pins.find((p) => p.mode.startsWith('led-'))) {
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
        this.debug('Sending ' + toHexString(this.writeValue, this.config.pins.length / 4));
        try {
            await this.writeRegister(this.registers.Data, this.writeValue);
        } catch (e) {
            this.error("Couldn't send current value: " + e);
        }
    }

    private async readCurrentValuesAsync(force: boolean): Promise<void> {
        const oldValue = this.readValue;
        try {
            this.readValue = await this.readRegister(this.registers.Data);
        } catch (e) {
            this.error("Couldn't read current data: " + e);
            return;
        }

        if (oldValue != this.readValue || force) {
            this.debug('Read data ' + toHexString(this.readValue, this.config.pins.length / 4));
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
        } catch (e) {
            this.error("Couldn't read key data: " + e);
            return;
        }

        this.debug('Read key data ' + toHexString(keyData, this.config.pins.length / 4));
        const bankSize = this.config.pins.length / 2;
        let row = -1;
        let col = -1;
        for (let i = 0; i < this.config.pins.length; i++) {
            const mask = 1 << i;
            if (this.config.pins[i].mode == 'keypad' && (keyData & mask) === 0) {
                if (i < bankSize) {
                    row = i;
                } else {
                    col = i;
                }
            }
        }

        if (row < 0 || col < 0) {
            return;
        }

        const keyValue = this.config.keypad.keyValues[row][col];
        this.debug(`Decoded key [${row},${col}] = "${keyValue}"`);
        await this.setStateAckAsync(`${this.hexAddress}.key`, keyValue);
    }

    private addOutputListener(pin: number, id?: string): void {
        this.adapter.addStateChangeListener<boolean>(
            id || this.hexAddress + '.' + pin,
            async (_oldValue: boolean, newValue: boolean) => await this.changeOutputAsync(pin, newValue),
        );
    }

    private async changeOutputAsync(pin: number, value: boolean): Promise<void> {
        const mask = 1 << pin;
        const oldValue = this.writeValue;
        if (value) {
            this.writeValue &= ~mask;
        } else {
            this.writeValue |= mask;
        }
        if (this.writeValue == oldValue) {
            return;
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
        } catch (e) {
            this.error("Couldn't write LED config: " + e);
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
