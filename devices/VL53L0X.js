"use strict";

/*
 * NOTICE:
 * A lot of this code is based on https://github.com/DexterInd/DI_Sensors/blob/master/NodeJS/src/sensors/VL53L0X.js
 * We need this to be use the i2c-bus library as for all other devices; thus the rewrite.
 * 
 * Copyright (c) 2017 Dexter Industries
 * Released under the MIT license (http://choosealicense.com/licenses/mit/).
 * For more information see https://github.com/DexterInd/GoPiGo3/blob/master/LICENSE.md
MIT License

Copyright (c) 2017 Dexter Industries

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

function create(deviceConfig, i2cAdapter) {
    return new VL53L0X(deviceConfig, i2cAdapter);
}

function VL53L0X(deviceConfig, i2cAdapter) {
    // consts:
    this.SYSRANGE_START                              = 0x00;

    this.SYSTEM_THRESH_HIGH                          = 0x0C;
    this.SYSTEM_THRESH_LOW                           = 0x0E;

    this.SYSTEM_SEQUENCE_CONFIG                      = 0x01;
    this.SYSTEM_RANGE_CONFIG                         = 0x09;
    this.SYSTEM_INTERMEASUREMENT_PERIOD              = 0x04;

    this.SYSTEM_INTERRUPT_CONFIG_GPIO                = 0x0A;

    this.GPIO_HV_MUX_ACTIVE_HIGH                     = 0x84;

    this.SYSTEM_INTERRUPT_CLEAR                      = 0x0B;

    this.RESULT_INTERRUPT_STATUS                     = 0x13;
    this.RESULT_RANGE_STATUS                         = 0x14;

    this.RESULT_CORE_AMBIENT_WINDOW_EVENTS_RTN       = 0xBC;
    this.RESULT_CORE_RANGING_TOTAL_EVENTS_RTN        = 0xC0;
    this.RESULT_CORE_AMBIENT_WINDOW_EVENTS_REF       = 0xD0;
    this.RESULT_CORE_RANGING_TOTAL_EVENTS_REF        = 0xD4;
    this.RESULT_PEAK_SIGNAL_RATE_REF                 = 0xB6;

    this.ALGO_PART_TO_PART_RANGE_OFFSET_MM           = 0x28;

    this.I2C_SLAVE_DEVICE_ADDRESS                    = 0x8A;

    this.MSRC_CONFIG_CONTROL                         = 0x60;

    this.PRE_RANGE_CONFIG_MIN_SNR                    = 0x27;
    this.PRE_RANGE_CONFIG_VALID_PHASE_LOW            = 0x56;
    this.PRE_RANGE_CONFIG_VALID_PHASE_HIGH           = 0x57;
    this.PRE_RANGE_MIN_COUNT_RATE_RTN_LIMIT          = 0x64;

    this.FINAL_RANGE_CONFIG_MIN_SNR                  = 0x67;
    this.FINAL_RANGE_CONFIG_VALID_PHASE_LOW          = 0x47;
    this.FINAL_RANGE_CONFIG_VALID_PHASE_HIGH         = 0x48;
    this.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT = 0x44;

    this.PRE_RANGE_CONFIG_SIGMA_THRESH_HI            = 0x61;
    this.PRE_RANGE_CONFIG_SIGMA_THRESH_LO            = 0x62;

    this.PRE_RANGE_CONFIG_VCSEL_PERIOD               = 0x50;
    this.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI          = 0x51;
    this.PRE_RANGE_CONFIG_TIMEOUT_MACROP_LO          = 0x52;

    this.SYSTEM_HISTOGRAM_BIN                        = 0x81;
    this.HISTOGRAM_CONFIG_INITIAL_PHASE_SELECT       = 0x33;
    this.HISTOGRAM_CONFIG_READOUT_CTRL               = 0x55;

    this.FINAL_RANGE_CONFIG_VCSEL_PERIOD             = 0x70;
    this.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI        = 0x71;
    this.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_LO        = 0x72;
    this.CROSSTALK_COMPENSATION_PEAK_RATE_MCPS       = 0x20;

    this.MSRC_CONFIG_TIMEOUT_MACROP                  = 0x46;

    this.SOFT_RESET_GO2_SOFT_RESET_N                 = 0xBF;
    this.IDENTIFICATION_MODEL_ID                     = 0xC0;
    this.IDENTIFICATION_REVISION_ID                  = 0xC2;

    this.OSC_CALIBRATE_VAL                           = 0xF8;

    this.GLOBAL_CONFIG_VCSEL_WIDTH                   = 0x32;
    this.GLOBAL_CONFIG_SPAD_ENABLES_REF_0            = 0xB0;
    this.GLOBAL_CONFIG_SPAD_ENABLES_REF_1            = 0xB1;
    this.GLOBAL_CONFIG_SPAD_ENABLES_REF_2            = 0xB2;
    this.GLOBAL_CONFIG_SPAD_ENABLES_REF_3            = 0xB3;
    this.GLOBAL_CONFIG_SPAD_ENABLES_REF_4            = 0xB4;
    this.GLOBAL_CONFIG_SPAD_ENABLES_REF_5            = 0xB5;

    this.GLOBAL_CONFIG_REF_EN_START_SELECT           = 0xB6;
    this.DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD         = 0x4E;
    this.DYNAMIC_SPAD_REF_EN_START_OFFSET            = 0x4F;
    this.POWER_MANAGEMENT_GO1_POWER_FORCE            = 0x80;

    this.VHV_CONFIG_PAD_SCL_SDA__EXTSUP_HV           = 0x89;

    this.ALGO_PHASECAL_LIM                           = 0x30;
    this.ALGO_PHASECAL_CONFIG_TIMEOUT                = 0x30;
    
    this.VcselPeriodPreRange = 0;
    this.VcselPeriodFinalRange = 1;

    // variables:
    this.address = deviceConfig.address;
    this.name = deviceConfig.name || 'VL53L0X';
    this.hexAddress = i2cAdapter.toHexString(this.address);

    this.config = deviceConfig.VL53L0X;

    this.i2cAdapter = i2cAdapter;
    this.adapter = this.i2cAdapter.adapter;
}

VL53L0X.prototype.start = function () {
    var that = this;
    that.debug('Starting');

    that.measurementTimingBudget = that.parseIntConfigValue('measurementTimingBudget', 20, 1000, 33);
    that.pollingInterval = that.parseIntConfigValue('pollingInterval', that.measurementTimingBudget * 1.2, 0x7FFFFFFF, 1000);
    that.signalRateLimit = that.parseFloatConfigValue('signalRateLimit', 0.01, 511.99, 0.25);
    that.preVcselPulsePeriod = that.parseIntConfigValue('preVcselPulsePeriod', 12, 18, 14);
    that.finalVcselPulsePeriod = that.parseIntConfigValue('finalVcselPulsePeriod', 8, 14, 10);

    // TODO: check if this is a good timeout value
    that.ioTimeout = that.measurementTimingBudget;

    if (!that.initChip()) {
       that.error('Chip initialization failed, will not report any values!');
       return;
    }

    that.adapter.extendObject(
        that.hexAddress,
        {
            type: 'device',
            common: {
                name: that.hexAddress + ' (' + that.name + ')',
                role: 'sensor'
            },
            native: that.config
        },
        function () {
            that.createStates(
                function() {
                    that.readCurrentValue();
                    if (that.config.pollingInterval && parseInt(that.config.pollingInterval) > 0) {
                        that.pollingTimer = setInterval(
                            function () { that.readCurrentValue(); },
                            that.pollingInterval);
                    }
                });
        });
};

VL53L0X.prototype.stop = function () {
    this.debug('Stopping');
    clearInterval(this.pollingTimer);
};

VL53L0X.prototype.parseIntConfigValue = function (name, minimum, maximum, defaultValue) {
    var value = this.config[name];
    var intValue = defaultValue;
    if (!!value) {
        intValue = parseInt(value);
    }

    intValue = Math.min(Math.max(intValue, minimum), maximum);
    this.info('Using ' + name + ': ' + intValue);
    return intValue;
};

VL53L0X.prototype.parseFloatConfigValue = function (name, minimum, maximum, defaultValue) {
    var value = this.config[name];
    var floatValue = defaultValue;
    if (!!value) {
        floatValue = parseFloat(value);
    }

    floatValue = Math.min(Math.max(floatValue, minimum), maximum);
    this.info('Using ' + name + ': ' + floatValue);
    return floatValue;
};

VL53L0X.prototype.createStates = function (callback) {
    var that = this;
    that.adapter.extendObject(
        that.hexAddress + '.distance',
        {
            type: 'state',
            common: {
                name: that.hexAddress + ' Distance',
                read: true,
                write: false,
                type: 'number',
                role: 'value.distance',
                unit: 'mm'
            }
        },
        function () {
            that.i2cAdapter.addStateChangeListener(
                that.hexAddress + '.measure',
                function () { that.readCurrentValue(); });
            callback();
        });
};

VL53L0X.prototype.initChip = function () {
    //  "Set I2C standard mode"
    this.writeReg8(0x88, 0x00);

    this.writeReg8(0x80, 0x01);
    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x00, 0x00);
    this.stopVariable = this.readReg8u(0x91);
    this.writeReg8(0x00, 0x01);
    this.writeReg8(0xFF, 0x00);
    this.writeReg8(0x80, 0x00);

    // added by UncleSam:
    if (!this.setVcselPulsePeriod(this.VcselPeriodPreRange, this.preVcselPulsePeriod)) {
        this.error('setVcselPulsePeriod(pre-range) error');
        return false;
    }
    if (!this.setVcselPulsePeriod(this.VcselPeriodFinalRange, this.finalVcselPulsePeriod)) {
        this.error('setVcselPulsePeriod(final range) error');
        return false;
    }

    //  disable SIGNAL_RATE_MSRC (bit 1) and SIGNAL_RATE_PRE_RANGE (bit 4) limit checks
    this.writeReg8(this.MSRC_CONFIG_CONTROL, (this.readReg8u(this.MSRC_CONFIG_CONTROL) | 0x12));

    //  set final range signal rate limit in MCPS (million counts per second)
    // Q9.7 fixed point format (9 integer bits, 7 fractional bits)
    this.writeReg16(this.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT, parseInt(this.signalRateLimit * (1 << 7), 0));

    this.writeReg8(this.SYSTEM_SEQUENCE_CONFIG, 0xFF);

    //  VL53L0X_DataInit() end

    //  VL53L0X_StaticInit() begin

    // spad_count, spad_type_is_aperture, success = this.getSpadInfo()
    var spadInfo = this.getSpadInfo();
    if (!spadInfo[2]) {
        this.error('GetSpadInfo timeout');
        return false;
    }

    //  The SPAD map (RefGoodSpadMap) is read by VL53L0X_get_info_from_device() in
    //  the API, but the same data seems to be more easily readable from
    //  GLOBAL_CONFIG_SPAD_ENABLES_REF_0 through _6, so read it from there
    var refSpadMap = this.readRegList(this.GLOBAL_CONFIG_SPAD_ENABLES_REF_0, 6);

    //  -- VL53L0X_set_reference_spads() begin (assume NVM values are valid)

    this.writeReg8(0xFF, 0x01);
    this.writeReg8(this.DYNAMIC_SPAD_REF_EN_START_OFFSET, 0x00);
    this.writeReg8(this.DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD, 0x2C);
    this.writeReg8(0xFF, 0x00);
    this.writeReg8(this.GLOBAL_CONFIG_REF_EN_START_SELECT, 0xB4);

    var firstSpadToEnable;
    if (spadInfo[1]) {
        firstSpadToEnable = 12; //  12 is the first aperture spad
    } else {
        firstSpadToEnable = 0;
    }

    var spadsEnabled = 0;

    for (var i = 0, len = 48; i < len; i++) {
        if (i < firstSpadToEnable || spadsEnabled === spadInfo[0]) {
            refSpadMap[parseInt(i / 8, 0)] &= ~(1 << (i % 8));
        } else if (refSpadMap[parseInt(i / 8, 0)] >> (i % 8) & 0x1) {
            spadsEnabled += 1;
        }
    }

    this.writeRegList(this.GLOBAL_CONFIG_SPAD_ENABLES_REF_0, refSpadMap);

    //  -- VL53L0X_set_reference_spads() end

    //  -- VL53L0X_load_tuning_settings() begin
    //  DefaultTuningSettings from vl53l0x_tuning.h

    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x00, 0x00);

    this.writeReg8(0xFF, 0x00);
    this.writeReg8(0x09, 0x00);
    this.writeReg8(0x10, 0x00);
    this.writeReg8(0x11, 0x00);

    this.writeReg8(0x24, 0x01);
    this.writeReg8(0x25, 0xFF);
    this.writeReg8(0x75, 0x00);

    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x4E, 0x2C);
    this.writeReg8(0x48, 0x00);
    this.writeReg8(0x30, 0x20);

    this.writeReg8(0xFF, 0x00);
    this.writeReg8(0x30, 0x09);
    this.writeReg8(0x54, 0x00);
    this.writeReg8(0x31, 0x04);
    this.writeReg8(0x32, 0x03);
    this.writeReg8(0x40, 0x83);
    this.writeReg8(0x46, 0x25);
    this.writeReg8(0x60, 0x00);
    this.writeReg8(0x27, 0x00);
    this.writeReg8(0x50, 0x06);
    this.writeReg8(0x51, 0x00);
    this.writeReg8(0x52, 0x96);
    this.writeReg8(0x56, 0x08);
    this.writeReg8(0x57, 0x30);
    this.writeReg8(0x61, 0x00);
    this.writeReg8(0x62, 0x00);
    this.writeReg8(0x64, 0x00);
    this.writeReg8(0x65, 0x00);
    this.writeReg8(0x66, 0xA0);

    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x22, 0x32);
    this.writeReg8(0x47, 0x14);
    this.writeReg8(0x49, 0xFF);
    this.writeReg8(0x4A, 0x00);

    this.writeReg8(0xFF, 0x00);
    this.writeReg8(0x7A, 0x0A);
    this.writeReg8(0x7B, 0x00);
    this.writeReg8(0x78, 0x21);

    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x23, 0x34);
    this.writeReg8(0x42, 0x00);
    this.writeReg8(0x44, 0xFF);
    this.writeReg8(0x45, 0x26);
    this.writeReg8(0x46, 0x05);
    this.writeReg8(0x40, 0x40);
    this.writeReg8(0x0E, 0x06);
    this.writeReg8(0x20, 0x1A);
    this.writeReg8(0x43, 0x40);

    this.writeReg8(0xFF, 0x00);
    this.writeReg8(0x34, 0x03);
    this.writeReg8(0x35, 0x44);

    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x31, 0x04);
    this.writeReg8(0x4B, 0x09);
    this.writeReg8(0x4C, 0x05);
    this.writeReg8(0x4D, 0x04);

    this.writeReg8(0xFF, 0x00);
    this.writeReg8(0x44, 0x00);
    this.writeReg8(0x45, 0x20);
    this.writeReg8(0x47, 0x08);
    this.writeReg8(0x48, 0x28);
    this.writeReg8(0x67, 0x00);
    this.writeReg8(0x70, 0x04);
    this.writeReg8(0x71, 0x01);
    this.writeReg8(0x72, 0xFE);
    this.writeReg8(0x76, 0x00);
    this.writeReg8(0x77, 0x00);

    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x0D, 0x01);

    this.writeReg8(0xFF, 0x00);
    this.writeReg8(0x80, 0x01);
    this.writeReg8(0x01, 0xF8);

    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x8E, 0x01);
    this.writeReg8(0x00, 0x01);
    this.writeReg8(0xFF, 0x00);
    this.writeReg8(0x80, 0x00);

    //  -- VL53L0X_load_tuning_settings() end

    //  "Set interrupt config to new sample ready"
    //  -- VL53L0X_SetGpioConfig() begin

    this.writeReg8(this.SYSTEM_INTERRUPT_CONFIG_GPIO, 0x04);
    this.writeReg8(this.GPIO_HV_MUX_ACTIVE_HIGH, this.readReg8u(this.GPIO_HV_MUX_ACTIVE_HIGH) & ~0x10); //  active low
    this.writeReg8(this.SYSTEM_INTERRUPT_CLEAR, 0x01);

    //  -- VL53L0X_SetGpioConfig() end

    //  "Disable MSRC and TCC by default"
    //  MSRC = Minimum Signal Rate Check
    //  TCC = Target CentreCheck
    //  -- VL53L0X_SetSequenceStepEnable() begin

    this.writeReg8(this.SYSTEM_SEQUENCE_CONFIG, 0xE8);

    //  -- VL53L0X_SetSequenceStepEnable() end

    //  "Recalculate timing budget" (in us)
    this.setMeasurementTimingBudget(this.measurementTimingBudget * 1000);

    // VL53L0X_StaticInit() end

    // VL53L0X_PerformRefCalibration() begin (VL53L0X_perform_ref_calibration())

    // -- VL53L0X_perform_vhv_calibration() begin

    this.writeReg8(this.SYSTEM_SEQUENCE_CONFIG, 0x01);
    if (!this.performSingleRefCalibration(0x40)) {
        this.error('PerformSingleRefCalibration(0x40) timeout');
        return false;
    }

    // -- VL53L0X_perform_vhv_calibration() end

    // -- VL53L0X_perform_phase_calibration() begin

    this.writeReg8(this.SYSTEM_SEQUENCE_CONFIG, 0x02);
    if (!this.performSingleRefCalibration(0x00)) {
        this.error('PerformSingleRefCalibration(0x00) timeout');
        return false;
    }

    // -- VL53L0X_perform_phase_calibration() end

    // "restore the previous Sequence Config"
    this.writeReg8(this.SYSTEM_SEQUENCE_CONFIG, 0xE8);

    // VL53L0X_PerformRefCalibration() end

    return true;
};

VL53L0X.prototype.setVcselPulsePeriod = function (type, periodPclks) {
    const vcselPeriodReg = this.encodeVcselPeriod(periodPclks);

    const enables = this.getSequenceStepEnables();
    const timeouts = this.getSequenceStepTimeout(enables.pre_range);

    if (type === this.VcselPeriodPreRange) {
        if (periodPclks === 12) {
            this.writeReg8(this.PRE_RANGE_CONFIG_VALID_PHASE_HIGH, 0x18);
        } else if (periodPclks === 14) {
            this.writeReg8(this.PRE_RANGE_CONFIG_VALID_PHASE_HIGH, 0x30);
        } else if (periodPclks === 16) {
            this.writeReg8(this.PRE_RANGE_CONFIG_VALID_PHASE_HIGH, 0x40);
        } else if (periodPclks === 18) {
            this.writeReg8(this.PRE_RANGE_CONFIG_VALID_PHASE_HIGH, 0x50);
        } else {
            return false;
        }

        this.writeReg8(this.PRE_RANGE_CONFIG_VALID_PHASE_LOW, 0x08);

        this.writeReg8(this.PRE_RANGE_CONFIG_VCSEL_PERIOD, vcselPeriodReg);

        const newPreRangeTimeoutMclks = this.timeoutMicrosecondsToMclks(timeouts.pre_range_us, periodPclks);

        this.writeReg16(this.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI, this.encodeTimeout(newPreRangeTimeoutMclks));

        const newMsrcTimeoutMclks = this.timeoutMicrosecondsToMclks(timeouts.msrc_dss_tcc_us, periodPclks);

        if (newMsrcTimeoutMclks > 256) {
            this.writeReg8(this.MSRC_CONFIG_TIMEOUT_MACROP, 255);
        } else {
            this.writeReg8(this.MSRC_CONFIG_TIMEOUT_MACROP, (newMsrcTimeoutMclks - 1));
        }
    } else if (type === this.VcselPeriodFinalRange) {
        if (periodPclks === 8) {
            this.writeReg8(this.FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, 0x10);
            this.writeReg8(this.FINAL_RANGE_CONFIG_VALID_PHASE_LOW,  0x08);
            this.writeReg8(this.GLOBAL_CONFIG_VCSEL_WIDTH, 0x02);
            this.writeReg8(this.ALGO_PHASECAL_CONFIG_TIMEOUT, 0x0C);
            this.writeReg8(0xFF, 0x01);
            this.writeReg8(this.ALGO_PHASECAL_LIM, 0x30);
            this.writeReg8(0xFF, 0x00);
        } else if (periodPclks === 10) {
            this.writeReg8(this.FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, 0x28);
            this.writeReg8(this.FINAL_RANGE_CONFIG_VALID_PHASE_LOW,  0x08);
            this.writeReg8(this.GLOBAL_CONFIG_VCSEL_WIDTH, 0x03);
            this.writeReg8(this.ALGO_PHASECAL_CONFIG_TIMEOUT, 0x09);
            this.writeReg8(0xFF, 0x01);
            this.writeReg8(this.ALGO_PHASECAL_LIM, 0x20);
            this.writeReg8(0xFF, 0x00);
        } else if (periodPclks === 12) {
            this.writeReg8(this.FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, 0x38);
            this.writeReg8(this.FINAL_RANGE_CONFIG_VALID_PHASE_LOW,  0x08);
            this.writeReg8(this.GLOBAL_CONFIG_VCSEL_WIDTH, 0x03);
            this.writeReg8(this.ALGO_PHASECAL_CONFIG_TIMEOUT, 0x08);
            this.writeReg8(0xFF, 0x01);
            this.writeReg8(this.ALGO_PHASECAL_LIM, 0x20);
            this.writeReg8(0xFF, 0x00);
        } else if (periodPclks === 14) {
            this.writeReg8(this.FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, 0x48);
            this.writeReg8(this.FINAL_RANGE_CONFIG_VALID_PHASE_LOW,  0x08);
            this.writeReg8(this.GLOBAL_CONFIG_VCSEL_WIDTH, 0x03);
            this.writeReg8(this.ALGO_PHASECAL_CONFIG_TIMEOUT, 0x07);
            this.writeReg8(0xFF, 0x01);
            this.writeReg8(this.ALGO_PHASECAL_LIM, 0x20);
            this.writeReg8(0xFF, 0x00);
        } else {
            return false;
        }

        this.writeReg8(this.FINAL_RANGE_CONFIG_VCSEL_PERIOD, vcselPeriodReg);
        let newFinalRangeTimeoutMclks = this.timeoutMicrosecondsToMclks(timeouts.final_range_us, periodPclks);

        if (enables.pre_range) {
            newFinalRangeTimeoutMclks += timeouts.pre_range_mclks;
        }

        this.writeReg16(this.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI, this.encodeTimeout(newFinalRangeTimeoutMclks));
    } else {
        return false;
    }

    this.setMeasurementTimingBudget(this.measurementTimingBudgetUs);

    const sequenceConfig = this.readReg8u(this.SYSTEM_SEQUENCE_CONFIG);
    this.writeReg8(this.SYSTEM_SEQUENCE_CONFIG, 0x02);
    this.performSingleRefCalibration(0x0);
    this.writeReg8(this.SYSTEM_SEQUENCE_CONFIG, sequenceConfig);

    return true;
};

VL53L0X.prototype.getSpadInfo = function () {
    this.writeReg8(0x80, 0x01);
    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x00, 0x00);

    this.writeReg8(0xFF, 0x06);
    this.writeReg8(0x83, this.readReg8u(0x83) | 0x04);
    this.writeReg8(0xFF, 0x07);
    this.writeReg8(0x81, 0x01);

    this.writeReg8(0x80, 0x01);

    this.writeReg8(0x94, 0x6b);
    this.writeReg8(0x83, 0x00);
    this.startTimeout();
    while (this.readReg8u(0x83) === 0x00) {
        if (this.checkTimeoutExpired()) {
            return [0, 0, false];
        }
    }

    this.writeReg8(0x83, 0x01);
    var tmp = this.readReg8u(0x92);

    var count = tmp & 0x7f;
    var typeIsAperture = (tmp >> 7) & 0x01;

    this.writeReg8(0x81, 0x00);
    this.writeReg8(0xFF, 0x06);
    this.writeReg8(0x83, this.readReg8u(0x83  & ~0x04));
    this.writeReg8(0xFF, 0x01);
    this.writeReg8(0x00, 0x01);

    this.writeReg8(0xFF, 0x00);
    this.writeReg8(0x80, 0x00);

    return [count, typeIsAperture, true];
};

VL53L0X.prototype.setMeasurementTimingBudget = function (budgetUs) {
    var StartOverhead      = 1320;
    var EndOverhead        = 960;
    var MsrcOverhead       = 660;
    var TccOverhead        = 590;
    var DssOverhead        = 690;
    var PreRangeOverhead   = 660;
    var FinalRangeOverhead = 550;

    var MinTimingBudget = 20000;

    if (budgetUs < MinTimingBudget) {
        return false;
    }

    var usedBudgetUs = StartOverhead + EndOverhead;

    var enables = this.getSequenceStepEnables();
    var timeouts = this.getSequenceStepTimeout(enables.pre_range);

    if (enables.tcc) {
        usedBudgetUs += (timeouts.msrc_dss_tcc_us + TccOverhead);
    }

    if (enables.dss) {
        usedBudgetUs += 2 * (timeouts.msrc_dss_tcc_us + DssOverhead);
    } else if (enables.msrc) {
        usedBudgetUs += (timeouts.msrc_dss_tcc_us + MsrcOverhead);
    }

    if (enables.pre_range) {
        usedBudgetUs += (timeouts.pre_range_us + PreRangeOverhead);
    }

    if (enables.final_range) {
        usedBudgetUs += FinalRangeOverhead;
    }

    if (usedBudgetUs > budgetUs) {
        return false;
    }

    var finalRangeTimeoutUs = budgetUs - usedBudgetUs;
    var finalRangeTimeoutMclks = this.timeoutMicrosecondsToMclks(finalRangeTimeoutUs, timeouts.final_range_vcsel_periodPclks);

    if (enables.pre_range) {
        finalRangeTimeoutMclks += timeouts.pre_range_mclks;
    }

    this.writeReg16(this.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI, this.encodeTimeout(finalRangeTimeoutMclks));

    this.measurementTimingBudgetUs = budgetUs;

    return true;
};


VL53L0X.prototype.getSequenceStepEnables = function () {
    const sequenceConfig = this.readReg8u(this.SYSTEM_SEQUENCE_CONFIG);
    return {
        'tcc': (sequenceConfig >> 4) & 0x1,
        'msrc': (sequenceConfig >> 2) & 0x1,
        'dss': (sequenceConfig >> 3) & 0x1,
        'pre_range': (sequenceConfig >> 6) & 0x1,
        'final_range': (sequenceConfig >> 7) & 0x1
    };
};

VL53L0X.prototype.getSequenceStepTimeout = function (preRange) {
    const SequenceStepTimeouts = { 'pre_range_vcsel_periodPclks': 0, 'final_range_vcsel_periodPclks': 0, 'msrc_dss_tcc_mclks': 0, 'pre_range_mclks': 0, 'final_range_mclks': 0, 'msrc_dss_tcc_us': 0, 'pre_range_us': 0, 'final_range_us': 0 };
    SequenceStepTimeouts.pre_range_vcsel_periodPclks = this.getVcselPulsePeriod(this.VcselPeriodPreRange);

    SequenceStepTimeouts.msrc_dss_tcc_mclks = this.readReg8u(this.MSRC_CONFIG_TIMEOUT_MACROP) + 1;
    SequenceStepTimeouts.msrc_dss_tcc_us = this.timeoutMclksToMicroseconds(SequenceStepTimeouts.msrc_dss_tcc_mclks, SequenceStepTimeouts.pre_range_vcsel_periodPclks);

    SequenceStepTimeouts.pre_range_mclks = this.decodeTimeout(this.readReg16u(this.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI));
    SequenceStepTimeouts.pre_range_us = this.timeoutMclksToMicroseconds(SequenceStepTimeouts.pre_range_mclks, SequenceStepTimeouts.pre_range_vcsel_periodPclks);

    SequenceStepTimeouts.final_range_vcsel_periodPclks = this.getVcselPulsePeriod(this.VcselPeriodFinalRange);

    SequenceStepTimeouts.final_range_mclks = this.decodeTimeout(this.this.readReg16u(this.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI));

    if (preRange) {
        SequenceStepTimeouts.final_range_mclks -= SequenceStepTimeouts.preRangeMclks;
    }

    SequenceStepTimeouts.final_range_us = this.timeoutMclksToMicroseconds(SequenceStepTimeouts.final_range_mclks, SequenceStepTimeouts.final_range_vcsel_periodPclks);

    return SequenceStepTimeouts;
};

VL53L0X.prototype.getVcselPulsePeriod = function (type) {
    if (type === this.VcselPeriodPreRange) {
        return this.decodeVcselPeriod(this.readReg8u(this.PRE_RANGE_CONFIG_VCSEL_PERIOD));
    } else if (type === this.VcselPeriodFinalRange) {
        return this.decodeVcselPeriod(this.readReg8u(this.FINAL_RANGE_CONFIG_VCSEL_PERIOD));
    }
    return 255;
};

VL53L0X.prototype.timeoutMclksToMicroseconds = function (timeoutPeriodMclks, vcselPeriodPclks) {
    const macroPeriodNs = this.calcMacroPeriod(vcselPeriodPclks);
    return ((timeoutPeriodMclks * macroPeriodNs) + (macroPeriodNs / 2)) / 1000;
};

VL53L0X.prototype.encodeVcselPeriod = function (periodPclks) {
    return ((periodPclks >> 1) - 1);
};

VL53L0X.prototype.decodeVcselPeriod = function (regVal) {
    return (((regVal) + 1) << 1);
};

VL53L0X.prototype.encodeTimeout = function (timeoutMclks) {
    let lsByte = 0;
    let msByte = 0;

    if (timeoutMclks > 0) {
        lsByte = timeoutMclks - 1;

        while ((parseInt(lsByte, 0) & 0xFFFFFF00) > 0) {
            lsByte /= 2; // >>=
            msByte += 1;
        }

        return ((msByte << 8) | (parseInt(lsByte, 0) & 0xFF));
    }

    return 0;
};

VL53L0X.prototype.decodeTimeout = function (regVal) {
    return ((regVal & 0x00FF) << ((regVal & 0xFF00) >> 8)) + 1;
};

VL53L0X.prototype.timeoutMicrosecondsToMclks = function (timeoutPeriodUs, vcselPeriodPclks) {
    const macroPeriodNs = this.calcMacroPeriod(vcselPeriodPclks);
    return (((timeoutPeriodUs * 1000) + (macroPeriodNs / 2)) / macroPeriodNs);
};

VL53L0X.prototype.calcMacroPeriod = function (vcselPeriodPclks) {
    return (((2304 * vcselPeriodPclks * 1655) + 500) / 1000);
}

VL53L0X.prototype.performSingleRefCalibration = function (vhvInitByte) {
    this.writeReg8(this.SYSRANGE_START, 0x01 | vhvInitByte);

    this.startTimeout();
    while ((this.readReg8u(this.RESULT_INTERRUPT_STATUS) & 0x07) === 0) {
        if (this.checkTimeoutExpired()) {
            return false;
        }
    }

    this.writeReg8(this.SYSTEM_INTERRUPT_CLEAR, 0x01);
    this.writeReg8(this.SYSRANGE_START, 0x00);

    return true;
};

VL53L0X.prototype.readCurrentValue = function () {
    this.debug('Reading current value');
    try {
        
        var distance = 0;
        this.writeReg8(0x80, 0x01);
        this.writeReg8(0xFF, 0x01);
        this.writeReg8(0x00, 0x00);
        this.writeReg8(0x91, this.stopVariable);
        this.writeReg8(0x00, 0x01);
        this.writeReg8(0xFF, 0x00);
        this.writeReg8(0x80, 0x00);

        this.writeReg8(this.SYSRANGE_START, 0x01);

        this.didTimeout = false;
        this.startTimeout();
        while (this.readReg8u(this.SYSRANGE_START) & 0x01) {
            if (this.checkTimeoutExpired()) {
                this.didTimeout = true;
                this.error('read_range_single_millimeters timeout');
            }
        }
        var distance = this.readRangeContinuousMillimeters();
        if (this.didTimeout) {
            throw 'Timeout!';
        }

        this.setStateAck('distance', this.round(distance));
    } catch (e) {
        this.error("Couldn't read current values: " + e);
    }
};

VL53L0X.prototype.readRangeContinuousMillimeters = function () {
    this.startTimeout();

    while ((this.readReg8u(this.RESULT_INTERRUPT_STATUS) & 0x07) === 0) {
        if (this.checkTimeoutExpired()) {
            this.didTimeout = true;
            this.error('readRangeContinuousMillimeters timeout');
        }
    }

    const range = this.readReg16u(this.RESULT_RANGE_STATUS + 10);
    this.writeReg8(this.SYSTEM_INTERRUPT_CLEAR, 0x01);
    return range;
};

VL53L0X.prototype.writeReg8 = function (register, value) {
    this.i2cAdapter.bus.writeByteSync(this.address, register, value);
};

VL53L0X.prototype.readReg8u = function (register) {
    return this.i2cAdapter.bus.readByteSync(this.address, register);
};

VL53L0X.prototype.writeReg16 = function (register, value) {
    this.i2cAdapter.bus.writeWordSync(this.address, register, value);
};

VL53L0X.prototype.readReg16u = function (register) {
    return this.i2cAdapter.bus.readWordSync(this.address, register);
};

VL53L0X.prototype.writeRegList = function (register, buffer, count) {
    this.i2cAdapter.bus.writeI2cBlockSync(this.address, register, count, buffer);
};

VL53L0X.prototype.readRegList = function (register, count) {
    var buffer = Buffer.alloc(count);
    this.i2cAdapter.bus.readI2cBlockSync(this.address, register, count, buffer);
    return buffer;
};

VL53L0X.prototype.debug = function (message) {
    this.adapter.log.debug('VL53L0X ' + this.address + ': ' + message);
};

VL53L0X.prototype.info = function (message) {
    this.adapter.log.info('VL53L0X ' + this.address + ': ' + message);
};

VL53L0X.prototype.error = function (message) {
    this.adapter.log.error('VL53L0X ' + this.address + ': ' + message);
};

VL53L0X.prototype.setStateAck = function (name, value) {
    return this.i2cAdapter.setStateAck(this.hexAddress + '.' + name, value);
};

VL53L0X.prototype.getStateValue = function (name) {
    return this.i2cAdapter.getStateValue(this.hexAddress + '.' + name);
};

VL53L0X.prototype.round = function (value, multiplicator) {
    multiplicator = multiplicator || 10;
    return Math.round(value * multiplicator) / multiplicator;
};


VL53L0X.prototype.checkTimeoutExpired = function () {
    var t1 = new Date().getTime();
    if (this.ioTimeout > 0 && (t1 - this.timeoutStart) > this.ioTimeout) {
        return true;
    }
    return false;
};

VL53L0X.prototype.startTimeout = function () {
    this.timeoutStart = new Date().getTime();
};

module.exports.create = create;