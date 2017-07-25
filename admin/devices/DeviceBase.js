var deviceTypes = {};

function DeviceBase(name) {
    this.name = name;
    this.type = this.constructor.name;
    this.addresses = [];
    this.template = 'No template defined!';
}

DeviceBase.prototype.supportsAddress = function (address) {
    return this.addresses.indexOf(address) !== -1;
};

DeviceBase.prototype.prepareViewModel = function (device) {
    alert(JSON.stringify(device));
    return device;
};
