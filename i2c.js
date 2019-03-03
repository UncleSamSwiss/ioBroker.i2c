/* jshint -W097 */ // no "use strict" warnings
/* jshint -W061 */ // no "eval" warnings
/* jslint node: true */
"use strict";

// always required: utils
var utils = require('@iobroker/adapter-core');

// other dependencies:
var i2c = require('i2c-bus');

function I2CAdapter()
{
    var that = this;
    
    // private fields
    that._deviceHandlers = {};
    that._stateChangeListeners = {};
    that._currentStateValues = {};
    that._deviceFactories = {};
    
    // public fields
    that.bus = null;
    that.adapter = utils.Adapter('i2c'); // create the adapter object
    
    // register event handlers
    that.adapter.on('ready', function () {
        that.onReady();
    });
    that.adapter.on('stateChange', function (id, state) {
        that.onStateChange(id, state);
    });
    that.adapter.on('message', function (obj) {
        that.onMessage(obj);
    });
    that.adapter.on('unload', function (callback) {
        that.onUnload(callback);
    });
}

I2CAdapter.prototype.main = function () {
    var that = this;
    that.bus = i2c.openSync(that.adapter.config.busNumber);
    
    if (!that.adapter.config.devices || that.adapter.config.devices.length === 0) {
        // no devices configured, nothing to do in this adapter
        return;
    }
    
    for (var i = 0; i < that.adapter.config.devices.length; i++) {
        var deviceConfig = that.adapter.config.devices[i];
        if (!deviceConfig.type || (!deviceConfig.address && deviceConfig.address !== 0)) {
            continue;
        }
        
        try {
            if (!that._deviceFactories[deviceConfig.type]) {
                that._deviceFactories[deviceConfig.type] = require(__dirname + '/devices/' + deviceConfig.type);
            }
            that._deviceHandlers[deviceConfig.address] = that._deviceFactories[deviceConfig.type].create(deviceConfig, that);
            that.adapter.log.info('Created ' + deviceConfig.type + ' for address ' + that.toHexString(deviceConfig.address));
        } catch (e) {
            that.adapter.log.warn("Couldn't create " + deviceConfig.type + ' for address ' + that.toHexString(deviceConfig.address) + ': ' + e);
        }
    }
    
    for (var address in that._deviceHandlers) {
        that._deviceHandlers[address].start();
    }
    
    that.adapter.subscribeStates('*');
};

I2CAdapter.prototype.searchDevices = function (busNumber, callback) {
    busNumber = parseInt(busNumber);
    
    if (busNumber == this.adapter.config.busNumber) {
        this.bus.scan(callback);
    } else {
        var searchBus = i2c.open(busNumber, function (err) {
            if (err) {
                callback(err);
            } else {
                searchBus.scan(function (err, result) {
                    searchBus.close(function () {
                        callback(err, result);
                    });
                });
            }
        });
    }
};

I2CAdapter.prototype.addStateChangeListener = function (id, listener) {
    this._stateChangeListeners[this.adapter.namespace + '.' + id] = listener;
};

I2CAdapter.prototype.setStateAck = function (id, value) {
    this._currentStateValues[this.adapter.namespace + '.' + id] = value;
    this.adapter.setState(id, {val: value, ack: true});
};

I2CAdapter.prototype.getStateValue = function (id) {
    return this._currentStateValues[this.adapter.namespace + '.' + id];
};

I2CAdapter.prototype.toHexString = function (value, length) {
    length = length || 2;
    var str = parseInt(value).toString(16).toUpperCase();
    while (str.length < length) {
        str = '0' + str;
    }
    return '0x' + str;
};

// startup
I2CAdapter.prototype.onReady = function () {
    var that = this;
    that.adapter.getStates('*', function (err, states) {
        for (var id in states) {
            if (states[id] && states[id].ack) {
                that._currentStateValues[id] = states[id].val;
            }
        }
        
        that.main();
    });
};

// is called if a subscribed state changes
I2CAdapter.prototype.onStateChange = function (id, state) {
    // Warning: state can be null if it was deleted!
    if (!id || !state || state.ack) {
        return;
    }
    
    this.adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
    if (!this._stateChangeListeners.hasOwnProperty(id)) {
        this.adapter.log.error('Unsupported state change: ' + id);
        return;
    }
    
    this._stateChangeListeners[id](this._currentStateValues[id], state.val);
};

// New message arrived. obj is array with current messages
I2CAdapter.prototype.onMessage = function (obj) {
    var that = this;
    var wait = false;
    if (obj) {
        switch (obj.command) {
            case 'search':
                that.searchDevices(obj.message, function (err, res) {
                    if (obj.callback) {
                        that.adapter.sendTo(obj.from, obj.command, JSON.stringify(res || []), obj.callback);
                    }
                });
                wait = true;
                break;
            default:
                that.adapter.log.warn("Unknown command: " + obj.command);
                break;
        }
    }
    if (!wait && obj.callback) {
        that.adapter.sendTo(obj.from, obj.command, obj.message, obj.callback);
    }
    return true;
};

// unloading
I2CAdapter.prototype.onUnload = function (callback) {
    for (var address in this._deviceHandlers) {
        this._deviceHandlers[address].stop();
    }

    if (this.bus) {
        this.bus.close(callback);
    } else {
        callback();
    }
};

new I2CAdapter();
