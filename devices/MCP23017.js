"use strict";

// register addresses (always for register "A" in IOCON.BANK = 0)
const REG_IODIR = 0x00;
const REG_IPOL = 0x02;
const REG_GPINTEN = 0x04;
const REG_DEFVAL = 0x06;
const REG_INTCON = 0x08;
const REG_IOCON = 0x0A;
const REG_GPPU = 0x0C
const REG_INTF = 0x0E
const REG_INTCAP = 0x10;
const REG_GPIO = 0x12;
const REG_OLAT = 0x14;

function create(deviceConfig, i2cAdapter) {
    return new MCP23017(deviceConfig, i2cAdapter);
}

function MCP23017(deviceConfig, i2cAdapter) {
    this.address = deviceConfig.address;
    this.name = deviceConfig.name || 'MCP23017';
    this.hexAddress = i2cAdapter.toHexString(this.address);

    this.config = deviceConfig.MCP23017;

    this.i2cAdapter = i2cAdapter;
    this.adapter = this.i2cAdapter.adapter;
    
    this.initialized = false;
    this.directions = 0;
    this.polarities = 0;
    this.pullUps = 0;
    this.readValue = 0;
    this.writeValue = 0;
}

MCP23017.prototype.start = function () {
    var that = this;
    that.debug('Starting');
    that.adapter.setObject(that.hexAddress, {
        type: 'device',
        common: {
            name: this.hexAddress + ' (' + this.name + ')',
            role: 'sensor'
        },
        native: that.config
    });
    
    var hasInput = false;
    for (var i = 0; i < 16; i++) {
        var pinConfig = that.config.pins[i] || { dir: 'out', name: that.indexToName(i) };
        var isInput = pinConfig.dir != 'out';
        if (isInput) {
            that.directions |= 1 << i;
            if (pinConfig.dir == 'in-pu') {
                that.pullUps |= 1 << i;
            }
            if (pinConfig.inv) {
                that.polarities |= 1 << i;
            }
            hasInput = true;
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
        that.adapter.setObject(that.hexAddress + '.' + pinConfig.name, {
            type: 'state',
            common: {
                name: that.hexAddress + (isInput ? ' Input ' : ' Output ') + pinConfig.name,
                read: isInput,
                write: !isInput,
                type: 'boolean',
                role: isInput ? 'indicator' : 'switch'
            },
            native: pinConfig
        });
    }
    
    that.checkInitialized();

    if (hasInput && that.config.pollingInterval && parseInt(that.config.pollingInterval) > 0) {
        this.pollingTimer = setInterval(
            function () { that.readCurrentValue(false); },
            Math.max(50, parseInt(that.config.pollingInterval)));
    }
};

MCP23017.prototype.stop = function () {
    this.debug('Stopping');
    clearInterval(this.pollingTimer);
};

MCP23017.prototype.checkInitialized = function () {
    if (this.initialized) {
        return true;
    }
    
    try {
        this.debug('Setting directions to ' + this.i2cAdapter.toHexString(this.directions, 4));
        this.sendWord(REG_IODIR, this.directions);
        this.debug('Setting polarities to ' + this.i2cAdapter.toHexString(this.polarities, 4));
        this.sendWord(REG_IPOL, this.polarities);
        this.debug('Setting pull-ups to ' + this.i2cAdapter.toHexString(this.pullUps, 4));
        this.sendWord(REG_GPPU, this.pullUps);
        this.debug('Setting initial value to ' + this.i2cAdapter.toHexString(this.writeValue, 4));
        this.sendCurrentValue();
    
        this.readCurrentValue(true);
        this.initialized = true;
        return true;
    } catch (e) {
        this.error("Couldn't initialize: " + e);
        return false;
    }
};

MCP23017.prototype.sendCurrentValue = function () {
    if (!this.checkInitialized()) {
        return;
    }

    try {
        this.sendWord(REG_OLAT, this.writeValue);
    } catch (e) {
        this.error("Couldn't send current value: " + e);
        this.initialized = false;
    }
};

MCP23017.prototype.readCurrentValue = function (force) {
    if (!this.checkInitialized()) {
        return;
    }

    var oldValue = this.readValue;
    try {
        this.readValue = this.i2cAdapter.bus.readWordSync(this.address, REG_GPIO);
    } catch (e) {
        this.error("Couldn't read current value: " + e);
        this.initialized = false;
        return;
    }

    if (oldValue == this.readValue && !force) {
        return;
    }
    
    this.debug('Read ' + this.i2cAdapter.toHexString(this.readValue, 4));
    for (var i = 0; i < 16; i++) {
        var mask = 1 << i;
        if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].dir != 'out') {
            var value = (this.readValue & mask) > 0;
            this.setStateAck(i, value);
        }
    }
};

MCP23017.prototype.addOutputListener = function (pinIndex) {
    var that = this;
    that.i2cAdapter.addStateChangeListener(
        that.hexAddress + '.' + this.indexToName(pinIndex),
        function (oldValue, newValue) { that.changeOutput(pinIndex, newValue); })
}

MCP23017.prototype.changeOutput = function (pinIndex, value) {
    var mask = 1 << pinIndex;
    var oldValue = this.writeValue;
    var realValue = this.config.pins[pinIndex].inv ? !value : value;
    if (realValue) {
        this.writeValue &= ~mask;
    } else {
        this.writeValue |= mask;
    }
    if (this.writeValue == oldValue) {
        return;
    }

    this.sendCurrentValue();
    this.setStateAck(pinIndex, value);
};

MCP23017.prototype.indexToName = function (index) {
    return (index < 8 ? 'A' : 'B') + (index % 8);
}

MCP23017.prototype.sendWord = function (register, value) {
    this.debug('Sending ' + this.i2cAdapter.toHexString(register) + ' = ' + this.i2cAdapter.toHexString(value, 4));
    this.i2cAdapter.bus.writeWordSync(this.address, register, value);
};

MCP23017.prototype.debug = function (message) {
    this.adapter.log.debug('MCP23017 ' + this.address + ': ' + message);
};

MCP23017.prototype.error = function (message) {
    this.adapter.log.error('MCP23017 ' + this.address + ': ' + message);
};

MCP23017.prototype.setStateAck = function (pinIndex, value) {
    return this.i2cAdapter.setStateAck(this.hexAddress + '.' + this.indexToName(pinIndex), value);
};

MCP23017.prototype.getStateValue = function (pinIndex) {
    return this.i2cAdapter.getStateValue(this.hexAddress + '.' + this.indexToName(pinIndex));
};

module.exports.create = create;