"use strict";

/*
 * NOTICE:
 * A lot of this code is based on https://github.com/skylarstein/bme280-sensor
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
    return new BME280(deviceConfig, i2cAdapter);
}

function BME280(deviceConfig, i2cAdapter) {
    // consts:
    this.REGISTER_DIG_T1 = 0x88;
    this.REGISTER_DIG_T2 = 0x8A;
    this.REGISTER_DIG_T3 = 0x8C;

    this.REGISTER_DIG_P1 = 0x8E;
    this.REGISTER_DIG_P2 = 0x90;
    this.REGISTER_DIG_P3 = 0x92;
    this.REGISTER_DIG_P4 = 0x94;
    this.REGISTER_DIG_P5 = 0x96;
    this.REGISTER_DIG_P6 = 0x98;
    this.REGISTER_DIG_P7 = 0x9A;
    this.REGISTER_DIG_P8 = 0x9C;
    this.REGISTER_DIG_P9 = 0x9E;

    this.REGISTER_DIG_H1 = 0xA1;
    this.REGISTER_DIG_H2 = 0xE1;
    this.REGISTER_DIG_H3 = 0xE3;
    this.REGISTER_DIG_H4 = 0xE4;
    this.REGISTER_DIG_H5 = 0xE5;
    this.REGISTER_DIG_H6 = 0xE7;

    this.REGISTER_CHIPID = 0xD0;
    this.REGISTER_RESET  = 0xE0;

    this.REGISTER_CONTROL_HUM   = 0xF2;
    this.REGISTER_CONTROL       = 0xF4;
    this.REGISTER_PRESSURE_DATA = 0xF7;
    this.REGISTER_TEMP_DATA     = 0xFA;
    this.REGISTER_HUMIDITY_DATA = 0xFD;

    // variables:
    this.address = deviceConfig.address;
    this.name = deviceConfig.name || 'BME280';
    this.hexAddress = i2cAdapter.toHexString(this.address);

    this.config = deviceConfig.BME280;

    this.i2cAdapter = i2cAdapter;
    this.adapter = this.i2cAdapter.adapter;
}

BME280.prototype.start = function () {
    var that = this;
    that.debug('Starting');
    that.adapter.extendObject(
        that.hexAddress,
        {
            type: 'device',
            common: {
                name: that.hexAddress + ' (' + that.name + ')',
                role: 'thermo'
            },
            native: that.config
        },
        function () {
            that.loadSystemConfig(
                function() {
                    that.createStates(
                        function() {
                            that.checkChipId();
                            that.loadCalibration();
                            that.configureChip();
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

BME280.prototype.stop = function () {
    this.debug('Stopping');
    clearInterval(this.pollingTimer);
};

BME280.prototype.loadSystemConfig = function (callback) {
    var that = this;
    that.adapter.getForeignObject('system.config', function (err, obj) {
        that.useAmericanUnits = obj && obj.common && obj.common.tempUnit == '°F';
        that.info('Using ' + (that.useAmericanUnits ? 'American' : 'metric') + ' units');

        callback();
    });
};

BME280.prototype.createStates = function (callback) {
    var that = this;
    that.adapter.extendObject(
        that.hexAddress + '.temperature',
        {
            type: 'state',
            common: {
                name: that.hexAddress + ' Temperature',
                read: true,
                write: false,
                type: 'number',
                role: 'value.temperature',
                unit: that.useAmericanUnits ? '°F' : '°C'
            }
        },
        function() {
            that.adapter.extendObject(
                that.hexAddress + '.humidity',
                {
                    type: 'state',
                    common: {
                        name: that.hexAddress + ' Humidity',
                        read: true,
                        write: false,
                        type: 'number',
                        role: 'value.humidity',
                        unit: '%'
                    }
                },
                function() {
                    that.adapter.extendObject(
                        that.hexAddress + '.pressure',
                        {
                            type: 'state',
                            common: {
                                name: that.hexAddress + ' Pressure',
                                read: true,
                                write: false,
                                type: 'number',
                                role: 'value.pressure',
                                unit: that.useAmericanUnits ? 'inHg' : 'mbar'
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
                });
        });
};

BME280.prototype.checkChipId = function () {
    this.i2cAdapter.bus.writeByteSync(this.address, this.REGISTER_CHIPID, 0);
    var chipId = this.i2cAdapter.bus.readByteSync(this.address, this.REGISTER_CHIPID);
    this.info('Chip ID: 0x' + this.i2cAdapter.toHexString(chipId));
    if (chipId < 0x56 || chipId > 0x60 || chipId == 0x59) {
        throw 'Unsupported chip ID ' + this.i2cAdapter.toHexString(chipId) + '; are you sure this is a BME280?';
    }
};

BME280.prototype.loadCalibration = function () {
    var buffer = new Buffer(24);
    this.i2cAdapter.bus.readI2cBlockSync(this.address, this.REGISTER_DIG_T1, 24, buffer);
    var h1   = this.i2cAdapter.bus.readByteSync(this.address, this.REGISTER_DIG_H1);
    var h2   = this.i2cAdapter.bus.readWordSync(this.address, this.REGISTER_DIG_H2);
    var h3   = this.i2cAdapter.bus.readByteSync(this.address, this.REGISTER_DIG_H3);
    var h4   = this.i2cAdapter.bus.readByteSync(this.address, this.REGISTER_DIG_H4);
    var h5   = this.i2cAdapter.bus.readByteSync(this.address, this.REGISTER_DIG_H5);
    var h5_1 = this.i2cAdapter.bus.readByteSync(this.address, this.REGISTER_DIG_H5 + 1);
    var h6   = this.i2cAdapter.bus.readByteSync(this.address, this.REGISTER_DIG_H6);

    this.cal = {
        dig_T1: this.uint16(buffer[1], buffer[0]),
        dig_T2: this.int16(buffer[3], buffer[2]),
        dig_T3: this.int16(buffer[5], buffer[4]),

        dig_P1: this.uint16(buffer[7], buffer[6]),
        dig_P2: this.int16(buffer[9], buffer[8]),
        dig_P3: this.int16(buffer[11], buffer[10]),
        dig_P4: this.int16(buffer[13], buffer[12]),
        dig_P5: this.int16(buffer[15], buffer[14]),
        dig_P6: this.int16(buffer[17], buffer[16]),
        dig_P7: this.int16(buffer[19], buffer[18]),
        dig_P8: this.int16(buffer[21], buffer[20]),
        dig_P9: this.int16(buffer[23], buffer[22]),

        dig_H1: h1,
        dig_H2: h2,
        dig_H3: h3,
        dig_H4: (h4 << 4) | (h5 & 0xF),
        dig_H5: (h5_1 << 4) | (h5 >> 4),
        dig_H6: h6
    };
  
    this.debug('cal = ' + JSON.stringify(this.cal));
};

BME280.prototype.configureChip = function () {
    // Humidity 16x oversampling
    this.i2cAdapter.bus.writeByteSync(this.address, this.REGISTER_CONTROL_HUM, 0b00000101);

    // Temperture/pressure 16x oversampling, normal mode
    this.i2cAdapter.bus.writeByteSync(this.address, this.REGISTER_CONTROL, 0b10110111);
};

BME280.prototype.readCurrentValues = function () {
    this.debug('Reading current values');
    try {
        // Grab temperature, humidity, and pressure in a single read
        var buffer = new Buffer(8);
        this.i2cAdapter.bus.readI2cBlockSync(this.address, this.REGISTER_PRESSURE_DATA, 8, buffer);
  
        // Temperature (temperature first since we need t_fine for pressure and humidity)
        var adc_T = this.uint20(buffer[3], buffer[4], buffer[5]);
        var tvar1 = ((((adc_T >> 3) - (this.cal.dig_T1 << 1))) * this.cal.dig_T2) >> 11;
        var tvar2  = (((((adc_T >> 4) - this.cal.dig_T1) * ((adc_T >> 4) - this.cal.dig_T1)) >> 12) * this.cal.dig_T3) >> 14;
        var t_fine = tvar1 + tvar2;

        var temperature_C = ((t_fine * 5 + 128) >> 8) / 100;

        // Pressure
        var adc_P = this.uint20(buffer[0], buffer[1], buffer[2]);
        var pvar1 = t_fine / 2 - 64000;
        var pvar2 = pvar1 * pvar1 * this.cal.dig_P6 / 32768;
        pvar2 = pvar2 + pvar1 * this.cal.dig_P5 * 2;
        pvar2 = pvar2 / 4 + this.cal.dig_P4 * 65536;
        pvar1 = (this.cal.dig_P3 * pvar1 * pvar1 / 524288 + this.cal.dig_P2 * pvar1) / 524288;
        pvar1 = (1 + pvar1 / 32768) * this.cal.dig_P1;

        var pressure_hPa = 0;

        if(pvar1 !== 0) {
            var p = 1048576 - adc_P;
            p = ((p - pvar2 / 4096) * 6250) / pvar1;
            pvar1 = this.cal.dig_P9 * p * p / 2147483648;
            pvar2 = p * this.cal.dig_P8 / 32768;
            p = p + (pvar1 + pvar2 + this.cal.dig_P7) / 16;

            pressure_hPa = p / 100;
        }

        // Humidity (available on the BME280, will be zero on the BMP280 since it has no humidity sensor)
        var adc_H = this.uint16(buffer[6], buffer[7]);

        var h = t_fine - 76800;
        h = (adc_H - (this.cal.dig_H4 * 64 + this.cal.dig_H5 / 16384 * h)) *
            (this.cal.dig_H2 / 65536 * (1 + this.cal.dig_H6 / 67108864 * h * (1 + this.cal.dig_H3 / 67108864 * h)));
        h = h * (1 - this.cal.dig_H1 * h / 524288);

        var humidity = (h > 100) ? 100 : (h < 0 ? 0 : h);

        this.debug('Read: ' + JSON.stringify({
            temp : temperature_C,
            hum  : humidity,
            press: pressure_hPa
        }));

        this.setStateAck('humidity', this.round(humidity));
        if (this.useAmericanUnits) {
            this.setStateAck('temperature', this.round((temperature_C * 9 / 5) + 32));
            this.setStateAck('pressure', this.round(pressure_hPa * 0.02952998751, 1000));
        } else {
            this.setStateAck('temperature', this.round(temperature_C));
            this.setStateAck('pressure', this.round(pressure_hPa)); // hPa == mbar :-)
        }
    } catch (e) {
        this.error("Couldn't read current values: " + e);
    }
};

BME280.prototype.debug = function (message) {
    this.adapter.log.debug('BME280 ' + this.address + ': ' + message);
};

BME280.prototype.info = function (message) {
    this.adapter.log.info('BME280 ' + this.address + ': ' + message);
};

BME280.prototype.error = function (message) {
    this.adapter.log.error('BME280 ' + this.address + ': ' + message);
};

BME280.prototype.setStateAck = function (name, value) {
    return this.i2cAdapter.setStateAck(this.hexAddress + '.' + name, value);
};

BME280.prototype.getStateValue = function (name) {
    return this.i2cAdapter.getStateValue(this.hexAddress + '.' + name);
};

BME280.prototype.int16 = function (msb, lsb) {
    var val = this.uint16(msb, lsb);
    return val > 32767 ? (val - 65536) : val;
};

BME280.prototype.uint16 = function (msb, lsb) {
    return msb << 8 | lsb;
};

BME280.prototype.uint20 = function (msb, lsb, xlsb) {
    return ((msb << 8 | lsb) << 8 | xlsb) >> 4;
};

BME280.prototype.round = function (value, multiplicator) {
    multiplicator = multiplicator || 10;
    return Math.round(value * multiplicator) / multiplicator;
};

module.exports.create = create;