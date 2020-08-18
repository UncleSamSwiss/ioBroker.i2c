function PCF8574(name, baseAddress) {
    DeviceBase.call(this, name);

    for (var i = 0; i < 8; i++) {
        this.addresses.push(baseAddress + i);
    }

    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-pollingInterval">{{t:"Polling Interval (ms)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-pollingInterval" data-link="PCF8574.pollingInterval" /></td></tr>';
    this.template += '<tr><td><label for="{{:#parent.parent.data.address}}-interrupt">{{t:"Interrupt object"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-interrupt" data-link="PCF8574.interrupt" /><button class="select-id" data-select-for="{{:#parent.parent.data.address}}-interrupt"><i class="material-icons">add_circle_outline</i><span></span></button></td></tr>';
    this.template += '{^{for PCF8574.pins}}';
    this.template += '<tr><td><label for="{{:#parent.parent.data.address}}-pin-{{:#index}}">{{t:"Pin"}} {{:#index}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><select data-link="dir" id="{{:#parent.parent.data.address}}-pin-{{:#index}}">';
    this.template += '<option value="in">{{t:"Input"}}</option>';
    this.template += '<option value="out">{{t:"Output"}}</option>';
    this.template += '</select> ';
    this.template += '<input type="checkbox" data-link="inv" id="{{:#parent.parent.data.address}}-inv-{{:#index}}" /> ';
    this.template += '<label for="{{:#parent.parent.data.address}}-inv-{{:#index}}">{{t:"inverted"}}</label></td></tr>';
    this.template += '{{/for}}';
}

PCF8574.prototype = Object.create(DeviceBase.prototype);
PCF8574.prototype.constructor = PCF8574;

PCF8574.prototype.prepareViewModel = function (device) {
    device.PCF8574 = device.PCF8574 || {};
    device.PCF8574.pollingInterval = device.PCF8574.pollingInterval || 200;
    device.PCF8574.interrupt = device.PCF8574.interrupt || '';
    device.PCF8574.pins = device.PCF8574.pins || [];
    for (var i = 0; i < 8; i++) {
        if (!device.PCF8574.pins[i]) {
            device.PCF8574.pins[i] = {
                dir: 'out'
            };
        }
    }

    return device;
};

PCF8574.prototype.prepareModel = function (device) {
    device.PCF8574.interrupt = $('#' + device.address + '-interrupt').val(); // needed to fix (sometimes) invalid value
    device.name = this.name;
    return device;
};

// "exports" of all device types supported by this class
deviceTypes.PCF8574 = new PCF8574('PCF8574', 0x20);
deviceTypes.PCF8574A = new PCF8574('PCF8574A', 0x38);

// translations
systemDictionary['Polling Interval (ms)'] = {
    "en": "Polling Interval (ms)",
    "de": "Abfrage-Intervall (ms)"
};
systemDictionary['Pin'] = {
    "en": "Pin",
    "de": "Anschluss"
};
systemDictionary['Input'] = {
    "en": "Input",
    "de": "Eingang"
};
systemDictionary['Output'] = {
    "en": "Output",
    "de": "Ausgang"
};
systemDictionary['inverted'] = {
    "en": "inverted",
    "de": "invertiert"
};
systemDictionary['Interrupt object'] = {
    "en": "Interrupt object",
    "de": "Interrupt-Objekt"
};
