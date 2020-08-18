function PCA9685(name, baseAddress) {
    DeviceBase.call(this, name);

    for (var i = 0; i < 64; i++) {
        this.addresses.push(baseAddress + i);
    }
    
    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-frequency">{{t:"PWM frequency (24-1526Hz)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-frequency" data-link="PCA9685.frequency" /></td></tr>';

}

PCA9685.prototype = Object.create(DeviceBase.prototype);
PCA9685.prototype.constructor = PCA9685;

PCA9685.prototype.prepareViewModel = function (device) {
    device.PCA9685 = device.PCA9685 || {};
    device.PCA9685.frequency = device.PCA9685.frequency || 100;

    return device;
};

PCA9685.prototype.prepareModel = function (device) {
    device.name = this.name;
    return device;
};

deviceTypes.PCA9685 = new PCA9685('PCA9685', 0x40);

// translations
systemDictionary['PWM frequency (24-1526Hz)'] = {
    "en": "PWM frequency (24-1526Hz)",
    "de": "PWM Frequenz (24-1526Hz)"
};