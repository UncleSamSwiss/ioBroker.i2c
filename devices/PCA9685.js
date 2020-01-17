// Code in this file ist in parts based on the existing files in ioBroker.i2c by misc authors and:

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


"use strict";

function create(deviceConfig, i2cAdapter) {
    return new PCA9685(deviceConfig, i2cAdapter);
}

function PCA9685(deviceConfig, i2cAdapter) {
    this.address = deviceConfig.address;
    this.name = deviceConfig.name || 'PCA9685';
    this.hexAddress = i2cAdapter.toHexString(this.address);

    this.config = deviceConfig.PCA9685;

    this.i2cAdapter = i2cAdapter;
    this.adapter = this.i2cAdapter.adapter;

    this.readValue = 0;
    this.writeValue = 0;

    this.REGISTER_MODE1              = 0x00;
    this.REGISTER_MODE2              = 0x01;
    this.REGISTER_SUBADR1            = 0x02;
    this.REGISTER_SUBADR2            = 0x03;
    this.REGISTER_SUBADR3            = 0x04;
    this.REGISTER_PRESCALE           = 0xFE;
    this.REGISTER_LED0_ON_L          = 0x06;
    this.REGISTER_LED0_ON_H          = 0x07;
    this.REGISTER_LED0_OFF_L         = 0x08;
    this.REGISTER_LED0_OFF_H         = 0x09;
    this.REGISTER_ALL_LED_ON_L       = 0xFA;
    this.REGISTER_ALL_LED_ON_H       = 0xFB;
    this.REGISTER_ALL_LED_OFF_L      = 0xFC;
    this.REGISTER_ALL_LED_OFF_H      = 0xFD;

    this.BIT_RESTART            = 0x80;
    this.BIT_SLEEP              = 0x10;
    this.BIT_ALLCALL            = 0x01;
    this.BIT_INVRT              = 0x10;
    this.BIT_OUTDRV             = 0x04;
    this.BIT_EXTCLK             = 0x40;
}

// Synchronous/active waiting -> caution, 100% CPU!
PCA9685.prototype.syncDelay = function(ms) {
    var start = Date.now(),
        now = start;
    while (now - start < ms) {
      now = Date.now();
    }
}

PCA9685.prototype.start = function () {
    var that = this;
    that.debug('Starting');
    that.adapter.extendObject(that.hexAddress, {
        type: 'device',
        common: {
            name: this.hexAddress + ' (' + this.name + ')',
            role: 'value'
        },
        native: that.config
    });

    for (var i = 0; i < 16; i++) {
        var pinConfig = { val: '0' };
        var value = that.getStateValue(i);
        if (value === undefined) {
            value = 0;
            that.setStateAck(i, value);
        }

        that.adapter.extendObject(that.hexAddress + '.' + i, {
            type: 'state',
            common: {
                name: that.hexAddress + ' Channel ' + i,
                read: true,
                write: true,
                type: 'number',
                role: 'level.dimmer',
                min: 0,
                max: 4095
            },
            native: pinConfig
        });
    }

    that.initializeDevice();

    for (var i = 0; i < 16; i++)
        that.addOutputListener(i);
};

PCA9685.prototype.stop = function () {
    this.debug('Stopping');
};

PCA9685.prototype.initializeDevice = function () {
    this.debug('Initializing PCA9865');
    this.restartDevice();
    this.setPwmFrequency(this.config.frequency);
    for (var i = 0; i < 16; i++)
        this.setPwmValue(i, this.getStateValue(i));
};

PCA9685.prototype.restartDevice = function() {
    this.writeByte(this.REGISTER_MODE2, this.BIT_OUTDRV);
    this.writeByte(this.REGISTER_MODE1, this.BIT_ALLCALL);
    this.syncDelay(2);

    var mode1 = this.readByte(this.REGISTER_MODE1);
    mode1 = mode1 & ~this.BIT_SLEEP;

    this.writeByte(this.REGISTER_MODE1, mode1); 
    this.syncDelay(2);
}

PCA9685.prototype.setPwmFrequency = function(frequencyHz) {
    if (isNaN(frequencyHz)) {
        this.error('Cannot set PWM frequency to ' + frequencyHz);
        return;
    }

    if (frequencyHz > 1526) frequencyHz = 1526;
    else if (frequencyHz < 24) frequencyHz = 24;

    var prescaleValue = 25000000.0; // 25MHz
    prescaleValue /= 4096.0;        // 12-bit
    prescaleValue /= frequencyHz;
    prescaleValue -= 1.0;
    this.debug('Setting PWM frequency to ' + frequencyHz + ' Hz');
    this.debug('Estimated pre-scale: ' + prescaleValue + ' Hz');
    var prescale = Math.floor(prescaleValue + 0.5);
    this.debug('Final pre-scale: ' + prescale);

    var oldMode = this.readByte(this.REGISTER_MODE1);
    var newMode = (oldMode & 0x7F) | this.BIT_SLEEP;

    this.debug('Old mode: ' + oldMode);
    this.debug('New mode: ' + newMode);

    this.writeByte(this.REGISTER_MODE1, newMode); // go to sleep
    this.syncDelay(2);
    this.writeByte(this.REGISTER_PRESCALE, prescale);
    this.writeByte(this.REGISTER_MODE1, oldMode);
    this.syncDelay(2);
    this.writeByte(this.REGISTER_MODE1, oldMode | 0x80);
    this.syncDelay(2);
}

PCA9685.prototype.setPwmValue = function(channel, pwmValue) {
    this.debug('Received new PWM value ' + pwmValue + ' for channel ' + channel);

    if (isNaN(channel) || isNaN(pwmValue)) {
        this.error('Cannot set PWM value ' + pwmValue + ' for channel ' + channel);
        return;
    }

    if (channel < 0) channel = 0;
    else if (channel > 15) channel = 15;

    var ledOn = 0;
    var ledOff = pwmValue;

    if (pwmValue >= 4095) {
        ledOn = 4096;
        ledOff = 0;
        pwmValue = 4095;
    } else if (pwmValue == undefined || pwmValue <= 0) {
        ledOn = 0;
        ledOff = 4096;
        pwmValue = 0;
    }

    if (this.deviceNotInitialized())
        this.initializeDevice();

    this.writeByte(this.REGISTER_LED0_ON_L + 4*channel, ledOn & 0xFF);
    this.writeByte(this.REGISTER_LED0_ON_H + 4*channel, ledOn >> 8);
    this.writeByte(this.REGISTER_LED0_OFF_L + 4*channel, ledOff & 0xFF);
    this.writeByte(this.REGISTER_LED0_OFF_H + 4*channel, ledOff >> 8);

    this.debug('Writing values for channel ' + channel + ': on=' + ledOn + ' | off=' + ledOff + ' (PWM ' + pwmValue + ')');

    this.setStateAck(channel, pwmValue);
}

PCA9685.prototype.deviceNotInitialized = function () {
    return this.readByte(this.REGISTER_MODE1) != this.BIT_ALLCALL;
};

PCA9685.prototype.setStateAck = function (channel, value) {
    return this.i2cAdapter.setStateAck(this.hexAddress + '.' + channel, value);
};

PCA9685.prototype.getStateValue = function (channel) {
    return this.i2cAdapter.getStateValue(this.hexAddress + '.' + channel);
};

PCA9685.prototype.writeByte = function (register, value) {
    this.debug('Writing ' + this.i2cAdapter.toHexString(register) + ' = ' + this.i2cAdapter.toHexString(value));
    this.i2cAdapter.bus.writeByteSync(this.address, register, value);
};

PCA9685.prototype.readByte = function (register) {
    var value = this.i2cAdapter.bus.readByteSync(this.address, register);
    this.debug('Read ' + this.i2cAdapter.toHexString(register) + ' = ' + this.i2cAdapter.toHexString(value));
    return value;
};

PCA9685.prototype.addOutputListener = function (channel) {
    var that = this;
    that.i2cAdapter.addStateChangeListener(that.hexAddress + '.' + channel, function (oldValue, newValue) { that.setPwmValue(channel, newValue); })
}

PCA9685.prototype.debug = function (message) {
    this.adapter.log.debug('PCA9685 ' + this.address + ': ' + message);
};

PCA9685.prototype.error = function (message) {
    this.adapter.log.error('PCA9685 ' + this.address + ': ' + message);
};

module.exports.create = create;