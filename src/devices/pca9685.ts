// Code in this file is in parts based on:

// https://github.com/adafruit/Adafruit_Python_PCA9685/blob/master/Adafruit_PCA9685/PCA9685.py
// Copyright (c) 2016 Adafruit Industries
// Author: Tony DiCola
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// https://github.com/tessel/servo-pca9685/blob/master/index.js
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import { Delay } from '../lib/async';
import { ImplementationConfigBase } from '../lib/shared';
import { DeviceHandlerBase } from './device-handler-base';

export interface PCA9685Config extends ImplementationConfigBase {
    frequency: number;
}

enum Register {
    MODE1 = 0x00,
    MODE2 = 0x01,
    SUBADR1 = 0x02,
    SUBADR2 = 0x03,
    SUBADR3 = 0x04,
    PRESCALE = 0xfe,
    LED0_ON_L = 0x06,
    LED0_ON_H = 0x07,
    LED0_OFF_L = 0x08,
    LED0_OFF_H = 0x09,
    ALL_LED_ON_L = 0xfa,
    ALL_LED_ON_H = 0xfb,
    ALL_LED_OFF_L = 0xfc,
    ALL_LED_OFF_H = 0xfd,
}

enum Mode {
    RESTART = 0x80,
    SLEEP = 0x10,
    ALLCALL = 0x01,
    INVRT = 0x10,
    OUTDRV = 0x04,
    EXTCLK = 0x40,
}

export default class PCA9685 extends DeviceHandlerBase<PCA9685Config> {
    private currentDelay?: Delay;

    async startAsync(): Promise<void> {
        this.debug('Starting');
        await this.adapter.extendObjectAsync(this.hexAddress, {
            type: 'device',
            common: {
                name: this.hexAddress + ' (' + this.name + ')',
                role: 'value',
            },
            native: this.config as any,
        });

        for (let i = 0; i < 16; i++) {
            let value = this.getStateValue(i);
            if (value === undefined) {
                value = 0;
                await this.setStateAckAsync(i, value);
            }

            await this.adapter.extendObjectAsync(this.hexAddress + '.' + i, {
                type: 'state',
                common: {
                    name: this.hexAddress + ' Channel ' + i,
                    read: true,
                    write: true,
                    type: 'number',
                    role: 'level.dimmer',
                    min: 0,
                    max: 4095,
                },
            });
        }

        await this.initializeDeviceAsync();

        for (let i = 0; i < 16; i++) {
            this.addOutputListener(i);
        }
    }

    async stopAsync(): Promise<void> {
        this.debug('Stopping');
        if (this.currentDelay) {
            this.currentDelay.cancel();
        }
    }

    private async initializeDeviceAsync(): Promise<void> {
        this.debug('Initializing PCA9865');
        await this.restartDeviceAsync();
        await this.setPwmFrequencyAsync(this.config.frequency);
        for (let i = 0; i < 16; i++) {
            await this.setPwmValueAsync(i, this.getStateValue(i) || 0);
        }
    }

    private async restartDeviceAsync(): Promise<void> {
        this.debug('Initializing PCA9865');
        await this.writeByte(Register.MODE2, Mode.OUTDRV);
        await this.writeByte(Register.MODE1, Mode.ALLCALL);
        await this.delay(2);

        let mode1 = await this.readByte(Register.MODE1);
        mode1 = mode1 & ~Mode.SLEEP;

        await this.writeByte(Register.MODE1, mode1);
        await this.delay(2);
    }

    private async setPwmFrequencyAsync(frequencyHz: number): Promise<void> {
        if (isNaN(frequencyHz)) {
            this.error('Cannot set PWM frequency to ' + frequencyHz);
            return;
        }

        if (frequencyHz > 1526) frequencyHz = 1526;
        else if (frequencyHz < 24) frequencyHz = 24;

        let prescaleValue = 25000000.0; // 25MHz
        prescaleValue /= 4096.0; // 12-bit
        prescaleValue /= frequencyHz;
        prescaleValue -= 1.0;
        this.debug('Setting PWM frequency to ' + frequencyHz + ' Hz');
        this.debug('Estimated pre-scale: ' + prescaleValue + ' Hz');
        const prescale = Math.floor(prescaleValue + 0.5);
        this.debug('Final pre-scale: ' + prescale);

        const oldMode = await this.readByte(Register.MODE1);
        const newMode = (oldMode & 0x7f) | Mode.SLEEP;

        this.debug('Old mode: ' + oldMode);
        this.debug('New mode: ' + newMode);

        await this.writeByte(Register.MODE1, newMode); // go to sleep
        await this.delay(2);
        await this.writeByte(Register.PRESCALE, prescale);
        await this.writeByte(Register.MODE1, oldMode);
        await this.delay(2);
        await this.writeByte(Register.MODE1, oldMode | 0x80);
        await this.delay(2);
    }

    private async setPwmValueAsync(channel: number, pwmValue: number): Promise<void> {
        this.debug('Received new PWM value ' + pwmValue + ' for channel ' + channel);

        if (isNaN(channel) || isNaN(pwmValue)) {
            this.error('Cannot set PWM value ' + pwmValue + ' for channel ' + channel);
            return;
        }

        if (channel < 0) channel = 0;
        else if (channel > 15) channel = 15;

        let ledOn = 0;
        let ledOff = pwmValue;

        if (pwmValue >= 4095) {
            ledOn = 4096;
            ledOff = 0;
            pwmValue = 4095;
        } else if (pwmValue == undefined || pwmValue <= 0) {
            ledOn = 0;
            ledOff = 4096;
            pwmValue = 0;
        }

        if (await this.deviceNotInitializedAsync()) {
            await this.initializeDeviceAsync();
        }

        await this.writeByte(Register.LED0_ON_L + 4 * channel, ledOn & 0xff);
        await this.writeByte(Register.LED0_ON_H + 4 * channel, ledOn >> 8);
        await this.writeByte(Register.LED0_OFF_L + 4 * channel, ledOff & 0xff);
        await this.writeByte(Register.LED0_OFF_H + 4 * channel, ledOff >> 8);

        this.debug(`Writing values for channel ${channel}: on=${ledOn} | off=${ledOff} (PWM ${pwmValue})`);

        await this.setStateAckAsync(channel, pwmValue);
    }

    private async deviceNotInitializedAsync(): Promise<boolean> {
        return (await this.readByte(Register.MODE1)) != Mode.ALLCALL;
    }

    private addOutputListener(channel: number): void {
        this.adapter.addStateChangeListener<number>(
            this.hexAddress + '.' + channel,
            async (_oldValue: number, newValue: number) => await this.setPwmValueAsync(channel, newValue),
        );
    }

    private async delay(milliseconds: number): Promise<void> {
        const delay = new Delay(milliseconds);
        this.currentDelay = delay;
        await delay.runAsnyc();
    }
}
