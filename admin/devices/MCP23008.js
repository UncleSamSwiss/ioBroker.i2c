function MCP23008() {
    DeviceBase.call(this, 'MCP23008');
    
    var baseAddress = 0x20;
    for (var i = 0; i < 8; i++) {
        this.addresses.push(baseAddress + i);
    }
    
    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-pollingInterval">{{t:"Polling Interval (ms)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-pollingInterval" data-link="MCP23008.pollingInterval" /></td></tr>';
    this.template += '{^{for MCP23008.pins}}';
    this.template += '<tr><td><label for="{{:#parent.parent.data.address}}-pin-{{:#index}}">{{t:"Pin"}} {{:#index}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><select data-link="dir" id="{{:#parent.parent.data.address}}-pin-{{:#index}}">';
    this.template += '<option value="in-no">{{t:"Input without pull-up resistor"}}</option>';
    this.template += '<option value="in-pu">{{t:"Input with pull-up resistor"}}</option>';
    this.template += '<option value="out">{{t:"Output"}}</option>';
    this.template += '</select> ';
    this.template += '<input type="checkbox" data-link="inv" id="{{:#parent.parent.data.address}}-inv-{{:#index}}" /> ';
    this.template += '<label for="{{:#parent.parent.data.address}}-inv-{{:#index}}">{{t:"inverted"}}</label></td></tr>';
    this.template += '{{/for}}';
}

MCP23008.prototype = Object.create(DeviceBase.prototype);
MCP23008.prototype.constructor = MCP23008;

MCP23008.prototype.prepareViewModel = function (device) {
    device.MCP23008 = device.MCP23008 || {};
    device.MCP23008.pollingInterval = device.MCP23008.pollingInterval || 200;
    device.MCP23008.pins = device.MCP23008.pins || [];
    for (var i = 0; i < 8; i++) {
        if (!device.MCP23008.pins[i]) {
            device.MCP23008.pins[i] = {
                dir: 'out'
            };
        }
    }

    return device;
};

MCP23008.prototype.prepareModel = function (device) {
    device.name = this.name;
    return device;
};

// "exports" of all device types supported by this class
deviceTypes.MCP23008 = new MCP23008();

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
