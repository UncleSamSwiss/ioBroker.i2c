/*
 * NOTICE:
 * A lot of this code is based on https://github.com/adafruit/Adafruit_Seesaw
 * License: BSD license, all text here must be included in any redistribution.
 */
import { ImplementationConfigBase } from '../lib/adapter-config';
import { Delay } from '../lib/async';
import { DeviceHandlerBase } from './device-handler-base';

export enum SeesawBase {
    STATUS = 0x00,
    GPIO = 0x01,
    SERCOM0 = 0x02,

    TIMER = 0x08,
    ADC = 0x09,
    DAC = 0x0a,
    INTERRUPT = 0x0b,
    DAP = 0x0c,
    EEPROM = 0x0d,
    NEOPIXEL = 0x0e,
    TOUCH = 0x0f,
    KEYPAD = 0x10,
    ENCODER = 0x11,
}

export enum SeesawStatus {
    HW_ID = 0x01,
    VERSION = 0x02,
    OPTIONS = 0x03,
    TEMP = 0x04,
    SWRST = 0x7f,
}

export enum SeesawTouch {
    CHANNEL_OFFSET = 0x10,
}

export const SEESAW_HW_ID_CODE = 0x55;

/**
 * Naming in this class is as close as possible to
 * https://github.com/adafruit/Adafruit_Seesaw/blob/master/Adafruit_seesaw.cpp
 */
export abstract class SeesawHandlerBase<T extends ImplementationConfigBase> extends DeviceHandlerBase<T> {
    /**
     * Start the seesaw.
     * This should be called when your sketch is connecting to the seesaw.
     * @param reset pass true to reset the seesaw on startup. Defaults to true.
     */
    public async begin(reset?: boolean): Promise<boolean> {
        if (reset !== false) {
            await this.SWReset();

            await this.delay(500);
        }

        const c = await this.read8(SeesawBase.STATUS, SeesawStatus.HW_ID);
        if (c != SEESAW_HW_ID_CODE) {
            return false;
        }
        return true;
    }

    /**
     * Perform a software reset.
     * This resets all seesaw registers to their default values.
     */
    public async SWReset(): Promise<void> {
        await this.write8(SeesawBase.STATUS, SeesawStatus.SWRST, 0xff);
    }

    /**
     * Read the temperature of the seesaw board in degrees Celsius.
     * @return Temperature in degrees Celsius as a floating point value.
     */
    public async getTemp(): Promise<number> {
        const buffer = Buffer.alloc(4);
        await this.read(SeesawBase.STATUS, SeesawStatus.TEMP, buffer, 1000);
        const ret = buffer.readUInt32BE();
        return (1.0 / (1 << 16)) * ret;
    }

    /**
     * Read the analog value on an capacitive touch-enabled pin.
     * @param pin the number of the pin to read.
     * @returns the analog value. This is an integer between 0 and 1023.
     */
    public async touchRead(pin: number): Promise<number> {
        const buffer = Buffer.alloc(2);
        let ret: number;
        do {
            await this.delay(1);
            await this.read(SeesawBase.TOUCH, SeesawTouch.CHANNEL_OFFSET + pin, buffer, 1000);
            ret = buffer.readUInt16BE();
        } while (ret == 65535);
        return ret;
    }

    /**
     * Write 1 byte to the specified seesaw register.
     * @param regHigh the module address register
     * @param regLow the function address register
     * @param value value the value between 0 and 255 to write
     */
    public async write8(regHigh: SeesawBase, regLow: number, value: number): Promise<void> {
        const buffer = Buffer.alloc(1);
        buffer[0] = value;
        await this.write(regHigh, regLow, buffer);
    }

    /**
     * Read 1 byte from the specified seesaw register.
     * @param regHigh the module address register
     * @param regLow the function address register
     * @param delay a number of microseconds to delay before reading
     * out the data. Different delay values may be necessary to ensure the seesaw
     * chip has time to process the requested data. Defaults to 125.
     */
    public async read8(regHigh: SeesawBase, regLow: number, delay?: number): Promise<number> {
        const ret = Buffer.alloc(1);
        await this.read(regHigh, regLow, ret, delay);
        return ret[0];
    }

    private async read(regHigh: SeesawBase, regLow: number, buffer: Buffer, delay?: number): Promise<void> {
        const header = Buffer.alloc(2);
        header[0] = regHigh;
        header[1] = regLow;
        await this.i2cWrite(header.length, header);

        await this.delayMicroseconds(delay || 125);

        await this.i2cRead(buffer.length, buffer);
    }

    private async write(regHigh: SeesawBase, regLow: number, buffer: Buffer): Promise<void> {
        const header = Buffer.alloc(2);
        header[0] = regHigh;
        header[1] = regLow;
        const all = Buffer.concat([header, buffer]);
        await this.i2cWrite(all.length, all);
    }

    /**
     * Delays execution.
     * @param delay The delay in microseconds.
     */
    public async delayMicroseconds(delay: number): Promise<void> {
        // not a beauty, but that's the easiest way to get microsecond delays
        await this.delay(delay / 1000);
    }

    /**
     * Delays execution.
     * @param delay The delay in milliseconds.
     */
    public async delay(delay: number): Promise<void> {
        await new Delay(Math.max(1, delay)).runAsnyc();
    }
}
