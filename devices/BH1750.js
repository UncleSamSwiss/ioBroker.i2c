"use strict";

/*
 * NOTICE:
 * A lot of this code is based on https://github.com/skylarstein/BH1750-sensor
 * We need this to be synchronous and use the same I2C instance as for all other devices; thus the rewrite.
MIT License

Copyright (c) 2016 Skylar Stein

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

function create(deviceConfig, i2cAdapter) {
    return new BH1750(deviceConfig, i2cAdapter);
}

function BH1750(deviceConfig, i2cAdapter) {
    // consts:
 

    // variables:
    this.address = deviceConfig.address;
    this.name = deviceConfig.name || 'BH1750';
    this.hexAddress = i2cAdapter.toHexString(this.address);

    this.config = deviceConfig.BH1750;

    this.i2cAdapter = i2cAdapter;
    this.adapter = this.i2cAdapter.adapter;
}

BH1750.prototype.start = function () {
    var that = this;
    that.debug('Starting');
    that.adapter.extendObject(
        that.hexAddress,
        {
            type: 'device',
            common: {
                name: that.hexAddress + ' (' + that.name + ')',
                role: 'illuminance'
            },
            native: that.config
        },
        function () {
            that.loadSystemConfig(
                function() {
                    that.createStates(
                        function() {
                            that.readCurrentValues();
                            if (that.config.pollingInterval && parseInt(that.config.pollingInterval) > 0) {
                                that.pollingTimer = setInterval(
                                    function () { that.readCurrentValues(); },
                                    parseInt(that.config.pollingInterval) * 1000);
                            }
                        });
                });
        });
};

BH1750.prototype.stop = function () {
    this.debug('Stopping');
    clearInterval(this.pollingTimer);
};

BH1750.prototype.loadSystemConfig = function (callback) {
    var that = this;
    that.adapter.getForeignObject('system.config', function (err, obj) {
        that.useAmericanUnits = obj && obj.common && obj.common.tempUnit == '°F';
        that.info('Using ' + (that.useAmericanUnits ? 'American' : 'metric') + ' units');

        callback();
    });
};

BH1750.prototype.createStates = function (callback) {
    var that = this;
    that.adapter.extendObject(
        that.hexAddress + '.lux',
        {
            type: 'state',
            common: {
                name: that.hexAddress + ' Lux',
                read: true,
                write: false,
                type: 'number',
                role: 'value.lux',
                unit: 'lux'
            }
        },
        function() {
            that.adapter.extendObject(
                that.hexAddress + '.measure',
                {
                    type: 'state',
                    common: {
                        name: that.hexAddress + ' Measure',
                        read: false,
                        write: true,
                        type: 'boolean',
                        role: 'button'
                    }
                },
                function () {
                    that.i2cAdapter.addStateChangeListener(
                        that.hexAddress + '.measure',
                        function () { that.readCurrentValues(); });
                    callback();
                });
        });
};





BH1750.prototype.readCurrentValues = function () {
    this.debug('Reading current values');
    try {
        // Grab illuminance
        var buffer = new Buffer(8);
        this.i2cAdapter.bus.readI2cBlockSync(this.address, 0x20, 2, buffer);
        this.debug('Buffer'+buffer);
        var lux = ((buffer[1] + (256 * buffer[0])) / 1.2);
        
       
        this.debug('Read: ' + JSON.stringify({
            lux : lux
            
        }));

        this.setStateAck('lux', this.round(lux));
        
    } catch (e) {
        this.error("Couldn't read current values: " + e);
    }
};

BH1750.prototype.debug = function (message) {
    this.adapter.log.debug('BH1750 ' + this.address + ': ' + message);
};

BH1750.prototype.info = function (message) {
    this.adapter.log.info('BH1750 ' + this.address + ': ' + message);
};

BH1750.prototype.error = function (message) {
    this.adapter.log.error('BH1750 ' + this.address + ': ' + message);
};

BH1750.prototype.setStateAck = function (name, value) {
    return this.i2cAdapter.setStateAck(this.hexAddress + '.' + name, value);
};

BH1750.prototype.getStateValue = function (name) {
    return this.i2cAdapter.getStateValue(this.hexAddress + '.' + name);
};

BH1750.prototype.int16 = function (msb, lsb) {
    var val = this.uint16(msb, lsb);
    return val > 32767 ? (val - 65536) : val;
};

BH1750.prototype.uint16 = function (msb, lsb) {
    return msb << 8 | lsb;
};

BH1750.prototype.uint20 = function (msb, lsb, xlsb) {
    return ((msb << 8 | lsb) << 8 | xlsb) >> 4;
};

BH1750.prototype.round = function (value, multiplicator) {
    multiplicator = multiplicator || 10;
    return Math.round(value * multiplicator) / multiplicator;
};

module.exports.create = create;