// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** The I2C bus number to use */
            busNumber: number;

            /**
             * List of I2C devices to manage
             * @deprecated Use Device Management instead (no longer used by adapter versions >=2.0.0)
             */
            devices?: I2CDeviceConfig[];

            // for debugging purposes only
            serverPort?: number;
            clientAddress?: string;
        }
    }
}

/**
 * I2C device configuration
 */
export interface I2CDeviceConfig {
    /** The I2C address of the device */
    address: number;
    /** The name of the device */
    name?: string;
    /** The type of the device */
    type?: string;

    // this can't be described properly with TypeScript as a key of type string wouldn't allow other properties,
    // thus we allow "any" even thought when indexing with a string, we always want an ImplementationConfigBase
    [key: string]: ImplementationConfigBase | any;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ImplementationConfigBase {}
