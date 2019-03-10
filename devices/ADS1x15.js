"use strict";

// this class is based on https://github.com/alphacharlie/node-ads1x15/blob/master/index.js
// probably MIT license (not explicitely mentioned, but it is based on the Adafruit Python code which is MIT)

function create(deviceConfig, i2cAdapter) {
    return new ADS1x15(deviceConfig, i2cAdapter);
}

function ADS1x15(deviceConfig, i2cAdapter) {
    // constants

    // chip
    this.IC_ADS1015 = 0x00;
    this.IC_ADS1115 = 0x01;

    // Pointer Register
    this.ADS1015_REG_POINTER_MASK = 0x03;
    this.ADS1015_REG_POINTER_CONVERT = 0x00;
    this.ADS1015_REG_POINTER_CONFIG = 0x01;
    this.ADS1015_REG_POINTER_LOWTHRESH = 0x02;
    this.ADS1015_REG_POINTER_HITHRESH = 0x03;

    // Config Register
    this.ADS1015_REG_CONFIG_OS_MASK = 0x8000;
    this.ADS1015_REG_CONFIG_OS_SINGLE = 0x8000; // Write: Set to start a single-conversion
    this.ADS1015_REG_CONFIG_OS_BUSY = 0x0000; // Read: Bit = 0 when conversion is in progress
    this.ADS1015_REG_CONFIG_OS_NOTBUSY = 0x8000; // Read: Bit = 1 when device is not performing a conversion
    this.ADS1015_REG_CONFIG_MUX_MASK = 0x7000;
    this.ADS1015_REG_CONFIG_MUX_DIFF_0_1 = 0x0000; // Differential P = AIN0, N = AIN1 (default)
    this.ADS1015_REG_CONFIG_MUX_DIFF_0_3 = 0x1000; // Differential P = AIN0, N = AIN3
    this.ADS1015_REG_CONFIG_MUX_DIFF_1_3 = 0x2000; // Differential P = AIN1, N = AIN3
    this.ADS1015_REG_CONFIG_MUX_DIFF_2_3 = 0x3000; // Differential P = AIN2, N = AIN3
    this.ADS1015_REG_CONFIG_MUX_SINGLE_0 = 0x4000; // Single-ended AIN0
    this.ADS1015_REG_CONFIG_MUX_SINGLE_1 = 0x5000; // Single-ended AIN1
    this.ADS1015_REG_CONFIG_MUX_SINGLE_2 = 0x6000; // Single-ended AIN2
    this.ADS1015_REG_CONFIG_MUX_SINGLE_3 = 0x7000; // Single-ended AIN3
    this.ADS1015_REG_CONFIG_PGA_MASK = 0x0E00;
    this.ADS1015_REG_CONFIG_PGA_6_144V = 0x0000; // +/-6.144V range
    this.ADS1015_REG_CONFIG_PGA_4_096V = 0x0200; // +/-4.096V range
    this.ADS1015_REG_CONFIG_PGA_2_048V = 0x0400; // +/-2.048V range (default)
    this.ADS1015_REG_CONFIG_PGA_1_024V = 0x0600; // +/-1.024V range
    this.ADS1015_REG_CONFIG_PGA_0_512V = 0x0800; // +/-0.512V range
    this.ADS1015_REG_CONFIG_PGA_0_256V = 0x0A00; // +/-0.256V range
    this.ADS1015_REG_CONFIG_MODE_MASK = 0x0100;
    this.ADS1015_REG_CONFIG_MODE_CONTIN = 0x0000; // Continuous conversion mode
    this.ADS1015_REG_CONFIG_MODE_SINGLE = 0x0100; // Power-down single-shot mode (default)
    this.ADS1015_REG_CONFIG_DR_MASK = 0x00E0;
    this.ADS1015_REG_CONFIG_DR_128SPS = 0x0000; // 128 samples per second
    this.ADS1015_REG_CONFIG_DR_250SPS = 0x0020; // 250 samples per second
    this.ADS1015_REG_CONFIG_DR_490SPS = 0x0040; // 490 samples per second
    this.ADS1015_REG_CONFIG_DR_920SPS = 0x0060; // 920 samples per second
    this.ADS1015_REG_CONFIG_DR_1600SPS = 0x0080; // 1600 samples per second (default)
    this.ADS1015_REG_CONFIG_DR_2400SPS = 0x00A0; // 2400 samples per second
    this.ADS1015_REG_CONFIG_DR_3300SPS = 0x00C0; // 3300 samples per second (also 0x00E0)
    this.ADS1115_REG_CONFIG_DR_8SPS = 0x0000; // 8 samples per second
    this.ADS1115_REG_CONFIG_DR_16SPS = 0x0020; // 16 samples per second
    this.ADS1115_REG_CONFIG_DR_32SPS = 0x0040; // 32 samples per second
    this.ADS1115_REG_CONFIG_DR_64SPS = 0x0060; // 64 samples per second
    this.ADS1115_REG_CONFIG_DR_128SPS = 0x0080; // 128 samples per second
    this.ADS1115_REG_CONFIG_DR_250SPS = 0x00A0; // 250 samples per second (default)
    this.ADS1115_REG_CONFIG_DR_475SPS = 0x00C0; // 475 samples per second
    this.ADS1115_REG_CONFIG_DR_860SPS = 0x00E0; // 860 samples per second
    this.ADS1015_REG_CONFIG_CMODE_MASK = 0x0010;
    this.ADS1015_REG_CONFIG_CMODE_TRAD = 0x0000; // Traditional comparator with hysteresis (default)
    this.ADS1015_REG_CONFIG_CMODE_WINDOW = 0x0010; // Window comparator
    this.ADS1015_REG_CONFIG_CPOL_MASK = 0x0008;
    this.ADS1015_REG_CONFIG_CPOL_ACTVLOW = 0x0000; // ALERT/RDY pin is low when active (default)
    this.ADS1015_REG_CONFIG_CPOL_ACTVHI = 0x0008; // ALERT/RDY pin is high when active
    this.ADS1015_REG_CONFIG_CLAT_MASK = 0x0004; // Determines if ALERT/RDY pin latches once asserted
    this.ADS1015_REG_CONFIG_CLAT_NONLAT = 0x0000; // Non-latching comparator (default)
    this.ADS1015_REG_CONFIG_CLAT_LATCH = 0x0004; // Latching comparator
    this.ADS1015_REG_CONFIG_CQUE_MASK = 0x0003;
    this.ADS1015_REG_CONFIG_CQUE_1CONV = 0x0000; // Assert ALERT/RDY after one conversions
    this.ADS1015_REG_CONFIG_CQUE_2CONV = 0x0001; // Assert ALERT/RDY after two conversions
    this.ADS1015_REG_CONFIG_CQUE_4CONV = 0x0002; // Assert ALERT/RDY after four conversions
    this.ADS1015_REG_CONFIG_CQUE_NONE = 0x0003; // Disable the comparator and put ALERT/RDY in high state (default)

    // This is a javascript port of python, so use objects instead of dictionaries here 
    // These simplify and clean the code (avoid the abuse of if/elif/else clauses)
    this.spsADS1115 = {
        8:   this.ADS1115_REG_CONFIG_DR_8SPS,
        16:  this.ADS1115_REG_CONFIG_DR_16SPS,
        32:  this.ADS1115_REG_CONFIG_DR_32SPS,
        64:  this.ADS1115_REG_CONFIG_DR_64SPS,
        128: this.ADS1115_REG_CONFIG_DR_128SPS,
        250: this.ADS1115_REG_CONFIG_DR_250SPS,
        475: this.ADS1115_REG_CONFIG_DR_475SPS,
        860: this.ADS1115_REG_CONFIG_DR_860SPS
    };

    this.spsADS1015 = {
        128:  this.ADS1015_REG_CONFIG_DR_128SPS,
        250:  this.ADS1015_REG_CONFIG_DR_250SPS,
        490:  this.ADS1015_REG_CONFIG_DR_490SPS,
        920:  this.ADS1015_REG_CONFIG_DR_920SPS,
        1600: this.ADS1015_REG_CONFIG_DR_1600SPS,
        2400: this.ADS1015_REG_CONFIG_DR_2400SPS,
        3300: this.ADS1015_REG_CONFIG_DR_3300SPS
    };

    // Dictionary with the programable gains
    this.pgaADS1x15 = {
        6144: this.ADS1015_REG_CONFIG_PGA_6_144V,
        4096: this.ADS1015_REG_CONFIG_PGA_4_096V,
        2048: this.ADS1015_REG_CONFIG_PGA_2_048V,
        1024: this.ADS1015_REG_CONFIG_PGA_1_024V,
        512:  this.ADS1015_REG_CONFIG_PGA_0_512V,
        256:  this.ADS1015_REG_CONFIG_PGA_0_256V
    };

    // variables
    this.address = deviceConfig.address;
    this.name = deviceConfig.name || 'ADS1x15';
    this.hexAddress = i2cAdapter.toHexString(this.address);

    this.config = deviceConfig.ADS1x15;

    this.i2cAdapter = i2cAdapter;
    this.adapter = this.i2cAdapter.adapter;

    this.pga = 6144; // set this to a sane default...
    this.busy = false;
}

ADS1x15.prototype.start = function () {
    var that = this;
    that.debug('Starting');
    that.adapter.extendObject(that.hexAddress, {
        type: 'device',
        common: {
            name: that.hexAddress + ' (' + that.name + ')',
            role: 'sensor'
        },
        native: that.config
    });

    if (that.config.kind == 1015) {
        that.ic = that.IC_ADS1015;
    } else {
        that.ic = that.IC_ADS1115;
    }
    
    var hasEnabled = false;
    for (var i = 0; i < 4; i++) {
        var channelConfig = that.config.channels[i] || { channelType: 'off' };
        switch (channelConfig.channelType) {
            case 'single':
                channelConfig.mux = that.ADS1015_REG_CONFIG_MUX_SINGLE_0 + (0x1000 * i);
                break;
            case 'diffTo1':
                channelConfig.mux = that.ADS1015_REG_CONFIG_MUX_DIFF_0_1;
                break;
            case 'diffTo3':
                channelConfig.mux = that.ADS1015_REG_CONFIG_MUX_DIFF_0_3 + (0x1000 * i);
                break;
            default:
                channelConfig.mux = 0;
                break;
        }
        if (channelConfig.mux !== 0) {
            hasEnabled = true;
        }
        that.adapter.extendObject(that.hexAddress + '.' + i, {
            type: 'state',
            common: {
                name: that.hexAddress + ' Channel ' + i,
                read: true,
                write: false,
                type: 'number',
                role: 'value.voltage',
                unit: 'V'
            },
            native: channelConfig
        });
    }
    
    if (!hasEnabled) {
        return;
    }

    that.readCurrentValue();
    if (that.config.pollingInterval && parseInt(that.config.pollingInterval) > 0) {
        that.pollingTimer = setInterval(function () { that.readCurrentValue(); }, 1000 * parseInt(that.config.pollingInterval));
    }
};

ADS1x15.prototype.stop = function () {
    this.debug('Stopping');
    clearInterval(this.pollingTimer);
};

ADS1x15.prototype.readCurrentValue = function () {
    var that = this;
    if (that.busy) {
        that.error("Busy reading values, can't read right now!");
        that.readAgain = true;
        return;
    }

    that.busy = true;
    that.readAgain = false;
    that.readAdc(0, function () {
        that.readAdc(1, function () {
            that.readAdc(2, function () {
                that.readAdc(3, function () {
                    that.busy = false;
                    if (that.readAgain) {
                        that.readCurrentValue();
                    }
                });
            });
        });
    });
};

ADS1x15.prototype.readAdc = function (index, callback) {
    var that = this;
    var channelConfig = that.config.channels[index];
    if (!channelConfig || channelConfig.mux === 0) {
        that.adapter.log.debug('Channel ' + index + ' disabled');
        callback();
        return;
    }

    // Disable comparator, Non-latching, Alert/Rdy active low
    // traditional comparator, single-shot mode
    var config = that.ADS1015_REG_CONFIG_CQUE_NONE | that.ADS1015_REG_CONFIG_CLAT_NONLAT |
        that.ADS1015_REG_CONFIG_CPOL_ACTVLOW | that.ADS1015_REG_CONFIG_CMODE_TRAD |
        that.ADS1015_REG_CONFIG_MODE_SINGLE;
    config |= channelConfig.mux;

    // Set samples per second
    var spsMap = (that.ic == that.IC_ADS1015) ? that.spsADS1015 : that.spsADS1115;
    if (spsMap.hasOwnProperty(channelConfig.samples)) {
        config |= spsMap[channelConfig.samples];
    } else {
        that.debug('Using default 250 SPS');
        config |= that.ADS1015_REG_CONFIG_DR_250SPS;
    }

    // Set PGA/voltage range
    if (that.pgaADS1x15.hasOwnProperty(channelConfig.gain)) {
      config |= that.pgaADS1x15[channelConfig.gain];
    } else {
        that.debug('Using default PGA 6.144 V');
        config |= that.ADS1015_REG_CONFIG_PGA_6_144V;
    }

    // Set 'start single-conversion' bit
    config |= this.ADS1015_REG_CONFIG_OS_SINGLE;
    that.writeWord(that.ADS1015_REG_POINTER_CONFIG, config);
    
    // Wait for the ADC conversion to complete
    // The minimum delay depends on the sps: delay >= 1s/sps
    // We add 1ms to be sure
    var delay = (1000 / channelConfig.samples) + 1;
    setTimeout(function() {
        var result = that.readWord(that.ADS1015_REG_POINTER_CONVERT);
        var value;
        if (that.ic == that.IC_ADS1015) {
            // Shift right 4 bits for the 12-bit ADS1015 and convert to V
            value = (result >> 4) * channelConfig.gain / 2.048;
        } else {
            // Return a V value for the ADS1115
            // (Take signed values into account as well)
            if (result > 0x7FFF) {
                value = (result - 0xFFFF) * channelConfig.gain / 32.768;
            } else {
                value = result * channelConfig.gain / 32.768;
            }
        }
        that.setStateAck(index, value);
        callback();
    }, delay);
};

ADS1x15.prototype.writeWord = function (register, value) {
    this.debug('Writing ' + this.i2cAdapter.toHexString(register) + ' = ' + this.i2cAdapter.toHexString(value, 4));
    this.i2cAdapter.bus.writeWordSync(this.address, register, value);
};

ADS1x15.prototype.readWord = function (register) {
    var value = this.i2cAdapter.bus.readWordSync(this.address, register);
    this.debug('Read ' + this.i2cAdapter.toHexString(register) + ' = ' + this.i2cAdapter.toHexString(value, 4));
    return value;
};

ADS1x15.prototype.debug = function (message) {
    this.adapter.log.debug('ADS1x15 ' + this.address + ': ' + message);
};

ADS1x15.prototype.error = function (message) {
    this.adapter.log.error('ADS1x15 ' + this.address + ': ' + message);
};

ADS1x15.prototype.setStateAck = function (channel, value) {
    return this.i2cAdapter.setStateAck(this.hexAddress + '.' + channel, value);
};

module.exports.create = create;