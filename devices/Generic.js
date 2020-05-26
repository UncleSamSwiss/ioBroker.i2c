/*
 * Generic I2C device.
 *
 * Copyright (C) 2020 Peter Müller <peter@crycode.de> (https://crycode.de)
 */
"use strict";

function create(deviceConfig, i2cAdapter) {
  return new Generic(deviceConfig, i2cAdapter);
}

function Generic(deviceConfig, i2cAdapter) {
  this.address = deviceConfig.address;
  this.name = deviceConfig.Generic.name || deviceConfig.name || 'Generic';
  this.hexAddress = i2cAdapter.toHexString(this.address);

  this.config = deviceConfig.Generic;

  this.i2cAdapter = i2cAdapter;
  this.adapter = this.i2cAdapter.adapter;

  this.timers = [];
}

Generic.prototype.start = function () {
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

  for (var i = 0; i < that.config.registers.length; i++) {
    that.config.registers[i].registerHex = that.i2cAdapter.toHexString(that.config.registers[i].register);
    that.config.registers[i].read = !!that.config.registers[i].read; // make it definetly boolean
    that.config.registers[i].write = !!that.config.registers[i].write; // make it definetly boolean

    that.debug('Register ' + that.config.registers[i].registerHex + ' ' + JSON.stringify(that.config.registers[i]));

    that.adapter.extendObject(that.hexAddress + '.' + that.config.registers[i].registerHex, {
      type: 'state',
      common: {
        name: that.hexAddress + ' ' + (that.config.registers[i].name || 'Register'),
        read: that.config.registers[i].read,
        write: that.config.registers[i].write,
        type: 'number',
        role: 'value'
      },
      native: that.config.registers[i]
    });

    // init polling when read
    if (that.config.registers[i].read) {
      that.poll(that.config.registers[i]);

      if (that.config.registers[i].pollingInterval > 0) {
        that.initPolling(that.config.registers[i]);
      }
    }

    // init listener when write
    if (that.config.registers[i].write) {
      // send current value on startup for write only regsiters
      if (!that.config.registers[i].read) {
        var value = that.getStateValue(that.config.registers[i]);
        if (typeof value === 'number') {
          that.sendValue(that.config.registers[i], value);
        }
      }

      that.addOutputListener(that.config.registers[i]);
    }
  }
};

Generic.prototype.stop = function () {
  this.debug('Stopping');
  for (var i = 0; i < this.timers.length; i++) {
    clearInterval(this.timers[i]);
  }
};

Generic.prototype.addOutputListener = function (registerObj) {
  var that = this;
  that.i2cAdapter.addStateChangeListener(that.hexAddress + '.' + registerObj.registerHex, function (oldValue, newValue) {
    that.sendValue(registerObj, newValue);
  });
};

Generic.prototype.sendValue = function (registerObj, value) {
  var buf;
  try {
    switch (registerObj.type) {
      case 'int8':
        buf = Buffer.alloc(1);
        buf.writeInt8(value);
        break;
      case 'uint8':
        buf = Buffer.alloc(1);
        buf.writeUInt8(value);
        break;
      case 'int16_be':
        buf = Buffer.alloc(2);
        buf.writeInt16BE(value);
        break;
      case 'int16_le':
        buf = Buffer.alloc(2);
        buf.writeInt16LE(value);
        break;
      case 'uint16_be':
        buf = Buffer.alloc(2);
        buf.writeUInt16BE(value);
        break;
      case 'uint16_le':
        buf = Buffer.alloc(2);
        buf.writeUInt16LE(value);
        break;
      case 'int32_be':
        buf = Buffer.alloc(4);
        buf.writeInt32BE(value);
        break;
      case 'int32_le':
        buf = Buffer.alloc(4);
        buf.writeInt32LE(value);
        break;
      case 'uint32_be':
        buf = Buffer.alloc(4);
        buf.writeUInt32BE(value);
        break;
      case 'uint32_le':
        buf = Buffer.alloc(4);
        buf.writeUInt32LE(value);
        break;
      case 'float_be':
        buf = Buffer.alloc(4);
        buf.writeFloatBE(value);
        break;
      case 'float_le':
        buf = Buffer.alloc(4);
        buf.writeFloatLE(value);
        break;
      case 'double_be':
        buf = Buffer.alloc(8);
        buf.writeDoubleBE(value);
        break;
      case 'double_le':
        buf = Buffer.alloc(8);
        buf.writeDoubleLE(value);
        break;
      default:
        this.error('Couldn\'t send value because of unknown type: ' + registerObj.type);
        return;
    }
  } catch (e) {
    this.error('Couldn\'t send value because of new value doesn\'t fit into type ' + registerObj.type + ': ' + value);
  }

  this.debug('Sending ' + buf.length + ' bytes for register ' + registerObj.registerHex + ': ' + buf.toString('hex'));
  try {
    if (registerObj.register >= 0) {
      this.i2cAdapter.bus.writeI2cBlockSync(this.address, registerObj.register, buf.length, buf);
    } else {
      this.i2cAdapter.bus.i2cWriteSync(this.address, buf.length, buf);
    }
    this.setStateAck(registerObj, value);
  } catch (e) {
    this.error('Couldn\'t send value: ' + e);
  }
};

Generic.prototype.initPolling = function (registerObj) {
  var that = this;
  that.timers.push(setInterval(function () {
    that.poll(registerObj);
  }, Math.max(50, registerObj.pollingInterval)));
};

Generic.prototype.poll = function (registerObj) {
  this.debug('Reding from register ' + registerObj.registerHex);

  var buf;
  switch (registerObj.type) {
    case 'int8':
      buf = Buffer.alloc(1);
      break;
    case 'uint8':
      buf = Buffer.alloc(1);
      break;
    case 'int16_be':
      buf = Buffer.alloc(2);
      break;
    case 'int16_le':
      buf = Buffer.alloc(2);
      break;
    case 'uint16_be':
      buf = Buffer.alloc(2);
      break;
    case 'uint16_le':
      buf = Buffer.alloc(2);
      break;
    case 'int32_be':
      buf = Buffer.alloc(4);
      break;
    case 'int32_le':
      buf = Buffer.alloc(4);
      break;
    case 'uint32_be':
      buf = Buffer.alloc(4);
      break;
    case 'uint32_le':
      buf = Buffer.alloc(4);
      break;
    case 'float_be':
      buf = Buffer.alloc(4);
      break;
    case 'float_le':
      buf = Buffer.alloc(4);
      break;
    case 'double_be':
      buf = Buffer.alloc(8);
      break;
    case 'double_le':
      buf = Buffer.alloc(8);
      break;
    default:
      this.error('Couldn\'t read value because of unknown type: ' + registerObj.type);
      return;
  }

  // read raw data from bus
  try {
    if (registerObj.register >= 0) {
      this.i2cAdapter.bus.readI2cBlockSync(this.address, registerObj.register, buf.length, buf);
    } else {
      this.i2cAdapter.bus.i2cReadSync(this.address, buf.length, buf);
    }
  } catch (e) {
    this.error('Couldn\'t read value: ' + e);
    return;
  }

  // parse data to data type
  var value;
  try {
    switch (registerObj.type) {
      case 'int8':
        value = buf.readInt8();
        break;
      case 'uint8':
        value = buf.readUInt8();
        break;
      case 'int16_be':
        value = buf.readInt16BE();
        break;
      case 'int16_le':
        value = buf.readInt16LE();
        break;
      case 'uint16_be':
        value = buf.readUInt16BE();
        break;
      case 'uint16_le':
        value = buf.readUInt16LE();
        break;
      case 'int32_be':
        value = buf.readInt32BE();
        break;
      case 'int32_le':
        value = buf.readInt32LE();
        break;
      case 'uint32_be':
        value = buf.readUInt32BE();
        break;
      case 'uint32_le':
        value = buf.readUInt32LE();
        break;
      case 'float_be':
        value = buf.readFloatBE();
        break;
      case 'float_le':
        value = buf.readFloatLE();
        break;
      case 'double_be':
        value = buf.readDoubleBE();
        break;
      case 'double_le':
        value = buf.readDoubleLE();
        break;
    }

    this.debug('Read ' + buf.toString('hex') + ' -> ' + value);
  } catch (e) {
    this.error('Couldn\'t read value as type ' + registerObj.type + ' from buffer ' + buf.toString('hex') + ': ' + e);
    return;
  }

  // save the value into the state
  this.setStateAck(registerObj, value);
};

Generic.prototype.debug = function (message) {
  this.adapter.log.debug('Generic ' + this.address + ': ' + message);
};

Generic.prototype.error = function (message) {
  this.adapter.log.error('Generic ' + this.address + ': ' + message);
};

Generic.prototype.setStateAck = function (registerObj, value) {
  return this.i2cAdapter.setStateAck(this.hexAddress + '.' + registerObj.registerHex, value);
};

Generic.prototype.getStateValue = function (registerObj) {
  return this.i2cAdapter.getStateValue(this.hexAddress + '.' + registerObj.registerHex);
};

module.exports.create = create;
