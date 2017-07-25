/* jshint -W097 */ // no "use strict" warnings
/* jshint -W061 */ // no "eval" warnings
/* jslint node: true */
"use strict";

// always required: utils
var utils = require(__dirname + '/lib/utils');

// other dependencies:
//var i2c = require('i2c-bus');

// create the adapter object
var adapter = utils.adapter('i2c');

var stateChangeListeners = {};
var stateEventHandlers = {};
var currentStateValues = {};
var bus;

// unloading
adapter.on('unload', function (callback) {
    if (bus) {
        bus.close(callback);
    }
    else {
        callback();
    }
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning: state can be null if it was deleted!
    if (!id || !state || state.ack) {
        return;
    }
    
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
    if (!stateChangeListeners.hasOwnProperty(id)) {
        adapter.log.error('Unsupported state change: ' + id);
        return;
    }

    stateChangeListeners[id](currentStateValues[id], state.val);
});

// startup
adapter.on('ready', function () {
    adapter.getStates('*', function (err, states) {
        for (var id in states) {
            if (states[id] && states[id].ack) {
                currentStateValues[id] = states[id].val;
            }
        }
        
        main();
    });
});

// New message arrived. obj is array with current messages
adapter.on('message', function (obj) {
    var wait = false;
    if (obj) {
        switch (obj.command) {
            case 'search':
                searchDevices(obj.message, function (err, res) {
                    if (obj.callback) {
                        adapter.sendTo(obj.from, obj.command, JSON.stringify(res || []), obj.callback);
                    }
                });
                wait = true;
                break;
            default:
                adapter.log.warn("Unknown command: " + obj.command);
                break;
        }
    }
    if (!wait && obj.callback) {
        adapter.sendTo(obj.from, obj.command, obj.message, obj.callback);
    }
    return true;
});

function main() {
    //bus = i2c.openSync(adapter.config.busNumber);
    //var found = bus.scanSync();
    //adapter.log.debug('Found ' + found.length + ' devices: ' + JSON.stringify(found));
    // TODO: implement
    adapter.subscribeStates('*');
}

function searchDevices(busNumber, callback) {
    busNumber = parseInt(busNumber);
    
    /*if (busNumber == adapter.config.busNumber) {
        bus.scan(callback);
    } else {
        var searchBus = bus.open(busNumber, function (err) {
            if (err) {
                callback(err);
            } else {
                searchBus.scan(function (err, result) {
                    searchBus.close(function () {
                        callback(err, result);
                    })
                });
            }
        });
    }*/
    // TODO: remove debugging:
    setTimeout(function () {
        callback(null, [busNumber, 4, 36, 52, 61]);
    }, 2000);
}

function addStateChangeListener(id, listener) {
    stateChangeListeners[adapter.namespace + '.' + id] = listener;
}

function setStateAck(id, value) {
    currentStateValues[adapter.namespace + '.' + id] = value;
    adapter.setState(id, {val: value, ack: true});
}
