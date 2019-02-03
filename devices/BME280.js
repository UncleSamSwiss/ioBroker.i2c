"use strict";

function create(deviceConfig, i2cAdapter) {
    return new BME280(deviceConfig, i2cAdapter);
}

function BME280(deviceConfig, i2cAdapter) {
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
    that.adapter.extendObject(that.hexAddress, {
        type: 'device',
        common: {
            name: this.hexAddress + ' (' + this.name + ')',
            role: 'sensor'
        },
        native: that.config
    });
    
    if (that.config.pollingInterval && parseInt(that.config.pollingInterval) > 0) {
        this.pollingTimer = setInterval(function () { that.readCurrentValues(); }, parseInt(that.config.pollingInterval) * 1000);
    }
};

BME280.prototype.stop = function () {
    this.debug('Stopping');
    clearInterval(this.pollingTimer);
};

PCF8574.prototype.readCurrentValues = function () {
    this.debug('Reading current values');
    try {
        // TODO: implement
    } catch (e) {
        this.error("Couldn't read current values: " + e);
    }
};

BME280.prototype.debug = function (message) {
    this.adapter.log.debug('BME280 ' + this.address + ': ' + message);
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

module.exports.create = create;