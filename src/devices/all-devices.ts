import { ADS1x15 } from './ads1x15';
import { BH1750 } from './bh1750';
import { BME280 } from './bme280';
import type { DeviceHandlerInfo } from './device-handler-base';
import { Generic } from './generic';
import { INA219 } from './ina219';
import { MCP23008 } from './mcp23008';
import { MCP23017 } from './mcp23017';
import { MCP342x } from './mcp342x';
import { MCP4725 } from './mcp4725';
import { PCA9685 } from './pca9685';
import { PCF8574 } from './pcf8574';
import { SeesawSoil } from './seesawsoil';
import { SHT3x } from './sht3x';
import { SRF02 } from './srf02';
import { SX150x } from './sx150x';
import { xMC5883 } from './xmc5883';

export const AllDevices: DeviceHandlerInfo[] = [
    ADS1x15,
    BH1750,
    BME280,
    Generic,
    INA219,
    MCP23008,
    MCP23017,
    MCP342x,
    MCP4725,
    PCA9685,
    PCF8574,
    SeesawSoil,
    SHT3x,
    SRF02,
    SX150x,
    xMC5883,
];
