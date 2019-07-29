function MCP23017() {
    DeviceBase.call(this, 'MCP23017');

    var baseAddress = 0x20;
    for (var i = 0; i < 8; i++) {
        this.addresses.push(baseAddress + i);
    }

    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-pollingInterval">{{t:"Polling Interval (ms)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-pollingInterval" data-link="MCP23017.pollingInterval" /></td></tr>';
    this.template += '<tr><td><label for="{{:#parent.parent.data.address}}-interrupt">{{t:"Interrupt object"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-interrupt" data-link="MCP23017.interrupt" /><button class="select-id" data-select-for="{{:#parent.parent.data.address}}-interrupt"><i class="material-icons">add_circle_outline</i><span></span></button></td></tr>';
    this.template += '{^{for MCP23017.pins}}';
    this.template += '<tr><td><label for="{{:#parent.parent.data.address}}-pin-{{:#index}}">{{t:"Pin"}} {{:name}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><select data-link="dir" id="{{:#parent.parent.data.address}}-pin-{{:#index}}">';
    this.template += '<option value="in-no">{{t:"Input without pull-up resistor"}}</option>';
    this.template += '<option value="in-pu">{{t:"Input with pull-up resistor"}}</option>';
    this.template += '<option value="out">{{t:"Output"}}</option>';
    this.template += '</select> ';
    this.template += '<input type="checkbox" data-link="inv" id="{{:#parent.parent.data.address}}-inv-{{:#index}}" /> ';
    this.template += '<label for="{{:#parent.parent.data.address}}-inv-{{:#index}}">{{t:"inverted"}}</label></td></tr>';
    this.template += '{{/for}}';
}

MCP23017.prototype = Object.create(DeviceBase.prototype);
MCP23017.prototype.constructor = MCP23017;

MCP23017.prototype.prepareViewModel = function (device) {
    device.MCP23017 = device.MCP23017 || {};
    device.MCP23017.pollingInterval = device.MCP23017.pollingInterval || 200;
    device.MCP23017.interrupt = device.MCP23017.interrupt || '';
    device.MCP23017.pins = device.MCP23017.pins || [];
    for (var i = 0; i < 16; i++) {
        if (!device.MCP23017.pins[i]) {
            device.MCP23017.pins[i] = {
                dir: 'out',
                name: (i < 8 ? 'A' : 'B') + (i % 8)
            };
        }
    }

    return device;
};

MCP23017.prototype.prepareModel = function (device) {
    device.MCP23017.interrupt = $('#' + device.address + '-interrupt').val(); // needed to fix (sometimes) invalid value
    device.name = this.name;
    return device;
};

// "exports" of all device types supported by this class
deviceTypes.MCP23017 = new MCP23017();

// translations
systemDictionary['Polling Interval (ms)'] = {
    "en": "Polling Interval (ms)",
    "de": "Abfrage-Intervall (ms)"
};
systemDictionary['Pin'] = {
    "en": "Pin",
    "de": "Anschluss"
};
systemDictionary['Input without pull-up resistor'] = {
    "en": "Input without pull-up resistor",
    "de": "Eingang ohne Pull-Up-Widerstand"
};
systemDictionary['Input with pull-up resistor'] = {
    "en": "Input with pull-up resistor",
    "de": "Eingang mit Pull-Up-Widerstand"
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
