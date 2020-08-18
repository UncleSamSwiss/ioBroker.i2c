function Generic() {
    DeviceBase.call(this, 'Generic');

    for (var i = 3; i <= 119; i++) {
        this.addresses.push(i);
    }

    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-name">{{t:"Name"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-name" data-link="Generic.name" /></td></tr>';
    this.template += '<tr><th>{{t:"Register"}}</th><th class="admin-icon"></th>';
    this.template += '<th>{{t:"Name"}}</th>';
    this.template += '<th>{{t:"Data type"}}</th>';
    this.template += '<th>{{t:"Read"}}</th>';
    this.template += '<th>{{t:"Write"}}</th>';
    this.template += '<th>{{t:"Polling Interval (ms)"}}</th></tr>';

    this.template += '{^{for Generic.registers}}';
    this.template += '<tr><td><select data-link="{:register:strToInt}">';
    this.template += '<option value="-1">---</option>';
    for (var i = 0; i<= 255; i++) {
      this.template += '<option value="' + i + '">' + this.toHexString(i) + '</option>';
    }
    this.template += '</select></td><th class="admin-icon"></th>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-name-{{:#index}}" data-link="name" /></td>';
    this.template += '<td><select id="{{:#parent.parent.data.address}}-type-{{:#index}}" data-link="type">';
    this.template += '<option value="int8">int8</option>';
    this.template += '<option value="uint8">uint8</option>';
    this.template += '<option value="int16_be">int16_be</option>';
    this.template += '<option value="int16_le">int16_le</option>';
    this.template += '<option value="uint16_be">uint16_be</option>';
    this.template += '<option value="uint16_le">uint16_le</option>';
    this.template += '<option value="int32_be">int32_be</option>';
    this.template += '<option value="int32_le">int32_le</option>';
    this.template += '<option value="uint32_be">uint32_be</option>';
    this.template += '<option value="uint32_le">uint32_le</option>';
    this.template += '<option value="float_be">float_be</option>';
    this.template += '<option value="float_le">float_le</option>';
    this.template += '<option value="double_be">double_be</option>';
    this.template += '<option value="double_le">double_le</option>';
    this.template += '</select></td>';
    this.template += '<td><input type="checkbox" id="{{:#parent.parent.data.address}}-read-{{:#index}}" data-link="read" /></td>';
    this.template += '<td><input type="checkbox" id="{{:#parent.parent.data.address}}-write-{{:#index}}" data-link="write" /></td>';
    this.template += '<td>{^{if read}}<input type="text" id="{{:#parent.parent.data.address}}-pollingInterval-{{:#index}}" data-link="{:pollingInterval:strToInt}" />{{/if}}</td>';
    this.template += '<td><button data-link="{on #parent.parent.data.removeRegister #index}"><i class="material-icons">delete_forever</i></button></td></tr>';
    this.template += '{{/for}}';

    this.template += '<tr><td><button data-link="{on addRegister}"><i class="material-icons">add_circle_outline</i></button></td></tr>';
}

$.views.converters({
  strToInt: function(value) {
    return parseInt(value);
  }
});

Generic.prototype = Object.create(DeviceBase.prototype);
Generic.prototype.constructor = Generic;

Generic.prototype.toHexString = function (integer) {
  var str = parseInt(integer).toString(16);
  return '0x' + (str.length == 1 ? '0' + str : str);
}

Generic.prototype.prepareViewModel = function (device) {
    device.Generic = device.Generic || {};
    device.Generic.name = device.Generic.name || _('Generic device');
    device.Generic.registers = device.Generic.registers || [];

    device.addRegister = function() {
      $.observable(this.Generic.registers).insert({
        register: -1,
        name: '',
        type: 'uint8',
        read: true,
        write: false,
        pollingInterval: 1000
      });
    }

    device.removeRegister = function (index) {
      $.observable(this.Generic.registers).remove(index);
    }

    return device;
};

Generic.prototype.prepareModel = function (device) {
    device.name = this.name;

    console.log(device);
    return device;
};

// "exports" of all device types supported by this class
deviceTypes.Generic = new Generic();

// translations
systemDictionary['Name'] = {
  "en": "Name",
  "de": "Name"
};
systemDictionary['Register'] = {
  "en": "Register",
  "de": "Register"
};
systemDictionary['Data type'] = {
  "en": "Data type",
  "de": "Datentyp"
};
