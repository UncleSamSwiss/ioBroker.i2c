function VL53L0X() {
    DeviceBase.call(this, 'VL53L0X');

    this.addresses.push(0x29);
    
    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-pollingInterval">{{t:"Polling Interval (ms)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-pollingInterval" data-link="VL53L0X.pollingInterval" /></td></tr>';
    
    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-signalRateLimit">{{t:"Signal Rate Limit (MCPS)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-signalRateLimit" data-link="VL53L0X.signalRateLimit" /></td></tr>';
    
    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-measurementTimingBudget">{{t:"Measurement Timing Budget (ms)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-measurementTimingBudget" data-link="VL53L0X.measurementTimingBudget" /></td></tr>';
    
    this.template += '<tr><td><label for="{{:#parent.parent.data.address}}-preVcselPulsePeriod">{{t:"Pre-Range Pulse Period"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><select data-link="dir" id="{{:#parent.parent.data.address}}-preVcselPulsePeriod">';
    this.template += '<option value="12">12 PCLKs</option>';
    this.template += '<option value="14">14 PCLKs</option>';
    this.template += '<option value="16">16 PCLKs</option>';
    this.template += '<option value="18">18 PCLKs</option>';
    this.template += '</select></td></tr>';
    
    this.template += '<tr><td><label for="{{:#parent.parent.data.address}}-finalVcselPulsePeriod">{{t:"Final Range Pulse Period"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><select data-link="dir" id="{{:#parent.parent.data.address}}-finalVcselPulsePeriod">';
    this.template += '<option value="8">8 PCLKs</option>';
    this.template += '<option value="10">10 PCLKs</option>';
    this.template += '<option value="12">12 PCLKs</option>';
    this.template += '<option value="14">14 PCLKs</option>';
    this.template += '</select></td></tr>';
}

VL53L0X.prototype = Object.create(DeviceBase.prototype);
VL53L0X.prototype.constructor = VL53L0X;

VL53L0X.prototype.prepareViewModel = function (device) {
    device.VL53L0X = device.VL53L0X || {};
    device.VL53L0X.pollingInterval = device.VL53L0X.pollingInterval || 1000;
    device.VL53L0X.signalRateLimit = device.VL53L0X.signalRateLimit || 0.25;
    device.VL53L0X.measurementTimingBudget = device.VL53L0X.measurementTimingBudget || 33;
    device.VL53L0X.preVcselPulsePeriod = device.VL53L0X.preVcselPulsePeriod || 14;
    device.VL53L0X.finalVcselPulsePeriod = device.VL53L0X.finalVcselPulsePeriod || 10;

    return device;
};

VL53L0X.prototype.prepareModel = function (device) {
    device.name = this.name;
    return device;
};

// "exports" of all device types supported by this class
deviceTypes.VL53L0X = new VL53L0X();

// translations
systemDictionary['Polling Interval (ms)'] = {
    "en": "Polling Interval (ms)",
    "de": "Abfrage-Intervall (ms)"
};
systemDictionary['Signal Rate Limit (MCPS)'] = {
    "en": "Signal Rate Limit (MCPS)",
    "de": "Signal-Raten Begrenzung (MCPS)"
};
systemDictionary['Measurement Timing Budget (ms)'] = {
    "en": "Measurement Timing Budget (ms)",
    "de": "Messinteval (ms)"
};
systemDictionary['Pre-Range Pulse Period'] = {
    "en": "Pre-Range Pulse Period",
    "de": "Puls-Periode Vorabmessung"
};
systemDictionary['Final Range Pulse Period'] = {
    "en": "Final Range Pulse Period",
    "de": "Puls-Periode Finale Messung"
};
