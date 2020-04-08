function BH1750() {
    DeviceBase.call(this, 'BH1750');
    
    this.addresses.push(0x23);
    this.addresses.push(0x5c);
    
    
    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-pollingInterval">{{t:"Polling Interval (sec)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-pollingInterval" data-link="BH1750.pollingInterval" /></td></tr>';
}

BH1750.prototype = Object.create(DeviceBase.prototype);
BH1750.prototype.constructor = BH1750;

BH1750.prototype.prepareViewModel = function (device) {
    device.BH1750 = device.BH1750 || {};
    device.BH1750.pollingInterval = device.BH1750.pollingInterval || 10;

    return device;
};

BH1750.prototype.prepareModel = function (device) {
    device.name = this.name;
    return device;
};

// "exports" of all device types supported by this class
deviceTypes.BH1750 = new BH1750();

// translations
systemDictionary['Polling Interval (sec)'] = {
    "en": "Polling Interval (sec)",
    "de": "Abfrage-Intervall (sec)"
};
