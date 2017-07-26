"use strict";

function create(deviceConfig, i2cAdapter) {
    return new PCF8574(deviceConfig, i2cAdapter);
}

function PCF8574(deviceConfig, i2cAdapter) {
    this.address = deviceConfig.address;
    this.hexAddress = i2cAdapter.toHexString(this.address);

    this.config = deviceConfig.PCF8574;

    this.i2cAdapter = i2cAdapter;
    this.adapter = this.i2cAdapter.adapter;
    
    this.readValue = 0;
    this.writeValue = 0;
}

PCF8574.prototype.start = function () {
    var that = this;
    that.debug('Starting');
    that.adapter.setObject(that.hexAddress, {
        type: 'device',
        common: {
            name: this.hexAddress + ' (PCF8574)',
            role: 'sensor'
        },
        native: that.config
    });
    
    var hasInput = false;
    for (var i = 0; i < 8; i++) {
        var pinConfig = that.config.pins[i] || { dir: 'out' };
        var isInput = pinConfig.dir == 'in';
        if (isInput) {
            hasInput = true;
        } else {
            that.addOutputListener(i);
            var value = that.getStateValue(i);
            if (value === undefined) {
                value = false;
                that.setStateAck(i, value);
            }
            if (!value) {
                that.writeValue |= 1 << i;
            }
        }
        that.adapter.setObject(that.hexAddress + '.' + i, {
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
    
    that.debug('Setting initial value to ' + that.i2cAdapter.toHexString(that.writeValue));
    that.sendCurrentValue();
    
    that.readCurrentValue(true);
    if (hasInput && that.config.pollingInterval && parseInt(that.config.pollingInterval) > 0) {
        this.pollingTimer = setInterval(function () { that.readCurrentValue(false); }, Math.max(50, parseInt(that.config.pollingInterval)));
    }
};

PCF8574.prototype.stop = function () {
    this.debug('Stopping');
    clearInterval(this.pollingTimer);
};

PCF8574.prototype.sendCurrentValue = function () {
    this.debug('Sending ' + this.i2cAdapter.toHexString(this.writeValue));
    this.i2cAdapter.bus.sendByteSync(this.address, this.writeValue);
};

PCF8574.prototype.readCurrentValue = function (force) {
    var oldValue = this.readValue;
    this.readValue = this.i2cAdapter.bus.receiveByteSync(this.address);
    if (oldValue == this.readValue && !force) {
        return;
    }
    
    this.debug('Read ' + this.i2cAdapter.toHexString(this.readValue));
    for (var i = 0; i < 8; i++) {
        var mask = 1 << i;
        if (((oldValue & mask) !== (this.readValue & mask) || force) && this.config.pins[i].dir == 'in') {
            this.setStateAck(i, (this.readValue & mask) > 0);
        }
    }
};

PCF8574.prototype.addOutputListener = function (pin) {
    var that = this;
    that.i2cAdapter.addStateChangeListener(that.hexAddress + '.' + pin, function (oldValue, newValue) { that.changeOutput(pin, newValue); })
}

PCF8574.prototype.changeOutput = function (pin, value) {
    var mask = 1 << pin;
    var oldValue = this.writeValue;
    if (value) {
        this.writeValue &= ~mask;
    } else {
        this.writeValue |= mask;
    }
    if (this.writeValue == oldValue) {
        return;
    }

    this.sendCurrentValue();
    this.setStateAck(pin, value);
};

PCF8574.prototype.debug = function (message) {
    this.adapter.log.debug('PCF8574 ' + this.address + ': ' + message);
};

PCF8574.prototype.setStateAck = function (pin, value) {
    return this.i2cAdapter.setStateAck(this.hexAddress + '.' + pin, value);
};

PCF8574.prototype.getStateValue = function (pin) {
    return this.i2cAdapter.getStateValue(this.hexAddress + '.' + pin);
};

module.exports.create = create;