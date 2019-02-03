function BME280(name) {
    DeviceBase.call(this, name);

    this.addresses.push(0x76);
    this.addresses.push(0x77);
    
    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-pollingInterval">{{t:"Polling Interval (sec)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-pollingInterval" data-link="BME280.pollingInterval" /></td></tr>';
}

BME280.prototype = Object.create(DeviceBase.prototype);
BME280.prototype.constructor = BME280;

BME280.prototype.prepareViewModel = function (device) {
    device.BME280 = device.BME280 || {};
    device.BME280.pollingInterval = device.BME280.pollingInterval || 10;

    return device;
};

BME280.prototype.prepareModel = function (device) {
    device.name = this.name;
    return device;
};

// "exports" of all device types supported by this class
deviceTypes.BME280 = new BME280('BME280');

// translations
systemDictionary['Polling Interval (sec)'] = {
    "en": "Polling Interval (sec)",
    "de": "Abfrage-Intervall (sec)"
};
