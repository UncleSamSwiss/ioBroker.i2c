"use strict";

// register addresses (always for register "A" in IOCON.BANK = 0)
const REG_IODIR = 0x00;
const REG_IPOL = 0x01;
const REG_GPINTEN = 0x02;
const REG_DEFVAL = 0x03;
const REG_INTCON = 0x04;
const REG_IOCON = 0x05;
const REG_GPPU = 0x06
const REG_INTF = 0x07
const REG_INTCAP = 0x08;
const REG_GPIO = 0x09;
const REG_OLAT = 0x0A;

function create(deviceConfig, i2cAdapter) {
    return new MCP23008(deviceConfig, i2cAdapter);
}

function MCP23008(deviceConfig, i2cAdapter) {
    this.address = deviceConfig.address;
    this.name = deviceConfig.name || 'MCP23008';
    this.hexAddress = i2cAdapter.toHexString(this.address);

    this.config = deviceConfig.MCP23008;

    this.i2cAdapter = i2cAdapter;
    this.adapter = this.i2cAdapter.adapter;
    
    this.initialized = false;
    this.hasInput = false;
    this.directions = 0;
    this.polarities = 0;
    this.pullUps = 0;
    this.readValue = 0;
    this.writeValue = 0;
}

MCP23008.prototype.start = function () {
    var that = this;
    that.debug('Starting');
    that.adapter.extendObject(that.hexAddress, {
        type: 'device',
        common: {
            name: this.hexAddress + ' (' + this.name + ')',
            role: 'sensor'
        },
        native: that.config
    });
    
    for (var i = 0; i < 8; i++) {
        var pinConfig = that.config.pins[i] || { dir: 'out' };
        var isInput = pinConfig.dir != 'out';
        if (isInput) {
            that.directions |= 1 << i;
            if (pinConfig.dir == 'in-pu') {
                that.pullUps |= 1 << i;
            }
            if (pinConfig.inv) {
                that.polarities |= 1 << i;
            }
            that.hasInput = true;
        } else {
            that.addOutputListener(i);
            var value = that.getStateValue(i);
            if (value === undefined) {
                value = pinConfig.inv === true;
                that.setStateAck(i, value);
            }
            if (pinConfig.inv) {
                value = !value;
            }
            if (!value) {
                that.writeValue |= 1 << i;
            }
        }
        that.adapter.extendObject(that.hexAddress + '.' + i, {
            type: 'state',
            common: {
                name: that.hexAddress + (isInput ? ' Input ' : ' Output ') + i,
                read: isInput,
                write: !isInput,
                type: 'boolean',
                role: isInput ? 'indicator' : 'switch'
            },
            native: pinConfig
        });
    }
    
    that.checkInitialized();

    if (that.hasInput && that.config.pollingInterval && parseInt(that.config.pollingInterval) > 0) {
        this.pollingTimer = setInterval(
            function () { that.readCurrentValue(false); },
            Math.max(50, parseInt(that.config.pollingInterval)));
    }
};

MCP23008.prototype.stop = function () {
    this.debug('Stopping');
    clearInterval(this.pollingTimer);
};

MCP23008.prototype.checkInitialized = function () {
    if (this.initialized) {
        // checking if the directions are still the same, if not, the chip might have reset itself
        var readDirections = this.readByte(REG_IODIR);
        if (readDirections === this.directions) {
            return true;
        }

        this.error("GPIO directions unexpectedly changed, reconfiguring the device");
        this.initialized = false;
    }
    
    try {
        this.debug('Setting initial output value to ' + this.i2cAdapter.toHexString(this.writeValue));
        this.writeByte(REG_OLAT, this.writeValue);
        this.debug('Setting polarities to ' + this.i2cAdapter.toHexString(this.polarities));
        this.writeByte(REG_IPOL, this.polarities);
        this.debug('Setting pull-ups to ' + this.i2cAdapter.toHexString(this.pullUps));
        this.writeByte(REG_GPPU, this.pullUps);
        this.debug('Setting directions to ' + this.i2cAdapter.toHexString(this.directions));
        this.writeByte(REG_IODIR, this.directions);
        this.initialized = true;
    } catch (e) {
        this.error("Couldn't initialize: " + e);
        return false;
    }
    
    this.readCurrentValue(true);
    return this.initialized;
};

MCP23008.prototype.sendCurrentValue = function () {
    if (!this.checkInitialized()) {
        return;
    }

    try {
        this.writeByte(REG_OLAT, this.writeValue);
    } catch (e) {
        this.error("Couldn't send current value: " + e);
        this.initialized = false;
    }
};

MCP23008.prototype.readCurrentValue = function (force) {
    if (!this.hasInput) {
        return;
    }
    if (!this.checkInitialized()) {
        return;
    }

    var oldValue = this.readValue;
    try {
        this.readValue = this.readByte(REG_GPIO);
    } catch (e) {
        this.error("Couldn't read current value: " + e);
        this.initialized = false;
        return;
    }

    if (oldValue == this.readValue && !force) {
        return;
    }
    
    this.debug('Read ' + this.i2cAdapter.toHexString(this.readValue));
    for (var i = 0; i < 8; i++) {
        var mask = 1 << i;
        if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].dir != 'out') {
            var value = (this.readValue & mask) > 0;
            this.setStateAck(i, value);
        }
    }
};

MCP23008.prototype.addOutputListener = function (pinIndex) {
    var that = this;
    that.i2cAdapter.addStateChangeListener(
        that.hexAddress + '.' + pinIndex,
        function (oldValue, newValue) { that.changeOutput(pinIndex, newValue); })
};

MCP23008.prototype.changeOutput = function (pinIndex, value) {
    var mask = 1 << pinIndex;
    var oldValue = this.writeValue;
    var realValue = this.config.pins[pinIndex].inv ? !value : value;
    if (realValue) {
        this.writeValue &= ~mask;
    } else {
        this.writeValue |= mask;
    }
    if (this.writeValue != oldValue) {
        this.sendCurrentValue();
    }

    this.setStateAck(pinIndex, value);
};

MCP23008.prototype.writeByte = function (register, value) {
    this.debug('Writing ' + this.i2cAdapter.toHexString(register) + ' = ' + this.i2cAdapter.toHexString(value));
    this.i2cAdapter.bus.writeByteSync(this.address, register, value);
};

MCP23008.prototype.readByte = function (register) {
    var value = this.i2cAdapter.bus.readByteSync(this.address, register);
    this.debug('Read ' + this.i2cAdapter.toHexString(register) + ' = ' + this.i2cAdapter.toHexString(value));
    return value;
};

MCP23008.prototype.debug = function (message) {
    this.adapter.log.debug('MCP23008 ' + this.hexAddress + ': ' + message);
};

MCP23008.prototype.error = function (message) {
    this.adapter.log.error('MCP23008 ' + this.hexAddress + ': ' + message);
};

MCP23008.prototype.setStateAck = function (pinIndex, value) {
    return this.i2cAdapter.setStateAck(this.hexAddress + '.' + pinIndex, value);
};

MCP23008.prototype.getStateValue = function (pinIndex) {
    return this.i2cAdapter.getStateValue(this.hexAddress + '.' + pinIndex);
};

module.exports.create = create;