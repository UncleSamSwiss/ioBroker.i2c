function ADS1x15(kind) {
    DeviceBase.call(this, 'ADS' + kind);
    this.kind = kind;

    for (var address = 0x48; address <= 0x4B; address++) {
        this.addresses.push(address);
    }
    
    this.template = '<tr><td><label for="{{:#parent.parent.data.address}}-pollingInterval">{{t:"Polling Interval (sec)"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><input type="text" id="{{:#parent.parent.data.address}}-pollingInterval" data-link="ADS1x15.pollingInterval" /></td></tr>';
    this.template += '{^{for ADS1x15.channels}}';
    // header
    this.template += '<tr><td colspan="3"><strong>{{t:"Channel"}} {{:#index}}</strong></td></tr>';
    // channel mode
    this.template += '<tr><td><label for="{{:#parent.parent.data.address}}-mode-{{:#index}}">{{t:"Channel Mode"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><select data-link="getChannelType()" id="{{:#parent.parent.data.address}}-mode-{{:#index}}">';
    this.template += '<option value="off">{{t:"Unused"}}</option>';
    this.template += '{{for channelTypes}}';
    this.template += '<option value="{{:#data}}" data-link="disabled{:(!#parent.parent.data.available)}">{{t:("channel-" + #data)}}</option>';
    this.template += '{{/for}}';
    this.template += '</select></td></tr>';
    this.template += '{^{if getChannelType() != \'off\'}}';
    // samples/sec
    this.template += '<tr><td><label for="{{:#parent.parent.parent.data.address}}-samples-{{:#index}}">{{t:"Samples per second"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><select data-link="samples" id="{{:#parent.parent.parent.data.address}}-samples-{{:#index}}"">';
    this.template += '{{for #parent.parent.parent.data.ADS1x15.allowedSamples}}';
    this.template += '<option value="{{:#data}}">{{:#data}} SPS</option>';
    this.template += '{{/for}}';
    this.template += '</select></td></tr>';
    // gain
    this.template += '<tr><td><label for="{{:#parent.parent.parent.data.address}}-gain-{{:#index}}">{{t:"Gain"}}</label></td><td class="admin-icon"></td>';
    this.template += '<td><select data-link="gain" id="{{:#parent.parent.parent.data.address}}-gain-{{:#index}}">';
    this.template += '{{for #parent.parent.parent.data.ADS1x15.allowedGains}}';
    this.template += '<option value="{{:#data}}">{{:(#data / 1000.0)}} V</option>';
    this.template += '{{/for}}';
    this.template += '</select></td></tr>';
    this.template += '{{/if}}';
    this.template += '{{/for}}';
}

ADS1x15.prototype = Object.create(DeviceBase.prototype);
ADS1x15.prototype.constructor = ADS1x15;

ADS1x15.prototype.prepareViewModel = function (device) {
    device.ADS1x15 = device.ADS1x15 || {};
    device.ADS1x15.pollingInterval = device.ADS1x15.pollingInterval || 60;
    device.ADS1x15.channels = device.ADS1x15.channels || [];
    for (var i = 0; i < 4; i++) {
        if (!device.ADS1x15.channels[i]) {
            device.ADS1x15.channels[i] = {
                available: true,
                channelType: 'off',
                gain: 6144,
                samples: 250 // this is a value valid for both ADS1015 and ADS1115
            };
        }

        device.ADS1x15.channels[i].getChannelType = function () {
            return this.channelType;
        };

        device.ADS1x15.channels[i].getChannelType.set = function (value) {
            if (this.channelType == 'diffTo1') {
                var obs = $.observable(device.ADS1x15.channels[1]);
                obs.setProperty('available', true);
            } else if (this.channelType == 'diffTo3') {
                var diffTo3Count = 0;
                for (var j = 0; j < 3; j++) {
                    if (device.ADS1x15.channels[j].channelType == 'diffTo3') {
                        diffTo3Count++;
                    }
                }
                if (diffTo3Count == 1) {
                    var obs = $.observable(device.ADS1x15.channels[3]);
                    obs.setProperty('available', true);
                }
            }
            this.channelType = value;
            if (value == 'diffTo1') {
                var obs = $.observable(device.ADS1x15.channels[1]);
                obs.setProperty('getChannelType', 'off');
                obs.setProperty('available', false);
            } else if (value == 'diffTo3') {
                var obs = $.observable(device.ADS1x15.channels[3]);
                obs.setProperty('getChannelType', 'off');
                obs.setProperty('available', false);
            }
        };
    }

    if (this.kind == 1015) {
        device.ADS1x15.allowedSamples = [ 128, 250, 490, 920, 1600, 2400, 3300 ];
    } else {
        device.ADS1x15.allowedSamples = [ 8, 16, 32, 64, 128, 250, 475, 860 ];
    }

    device.ADS1x15.allowedGains = [ 6144, 4096, 2048, 1024, 512, 256 ];

    device.ADS1x15.channels[0].channelTypes = [ 'single', 'diffTo1', 'diffTo3' ];
    device.ADS1x15.channels[1].channelTypes = [ 'single', 'diffTo3' ];
    device.ADS1x15.channels[2].channelTypes = [ 'single', 'diffTo3' ];
    device.ADS1x15.channels[3].channelTypes = [ 'single' ];

    return device;
};

ADS1x15.prototype.prepareModel = function (device) {
    device.name = this.name;
    device.ADS1x15.kind = this.kind;
    device.ADS1x15.allowedSamples = undefined;
    device.ADS1x15.allowedGains = undefined;
    for (var i = 0; i < 4; i++) {
        device.ADS1x15.channels[i].available = undefined;
        device.ADS1x15.channels[i].channelTypes = undefined;
        device.ADS1x15.channels[i].getChannelType = undefined;
    }
    return device;
};

// "exports" of all device types supported by this class
deviceTypes.ADS1015 = new ADS1x15(1015);
deviceTypes.ADS1115 = new ADS1x15(1115);

// translations
systemDictionary['Polling Interval (sec)'] = {
    "en": "Polling Interval (sec)",
    "de": "Abfrage-Intervall (sec)"
};
systemDictionary['Channel'] = {
    "en": "Channel",
    "de": "Kanal"
};
systemDictionary['Channel Mode'] = {
    "en": "Channel Mode",
    "de": "Kanalmodus"
};
systemDictionary['channel-single'] = {
    "en": "Single-ended",
    "de": "Einzel-Eingang"
};
systemDictionary['channel-diffTo1'] = {
    "en": "Differential N=AIN1",
    "de": "Differenziell N=AIN1"
};
systemDictionary['channel-diffTo3'] = {
    "en": "Differential N=AIN3",
    "de": "Differenziell N=AIN3"
};
systemDictionary['Samples per second'] = {
    "en": "Samples per second",
    "de": "Werte pro Sekunde"
};
systemDictionary['Gain'] = {
    "en": "Gain",
    "de": "Verstärkung"
};
