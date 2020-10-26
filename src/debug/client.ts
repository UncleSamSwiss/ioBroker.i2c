import { request } from 'http';
import * as i2c from 'i2c-bus';

export class I2CClient implements i2c.PromisifiedBus {
    constructor(private readonly address: string, private readonly log: ioBroker.Logger) {}

    public async close(): Promise<void> {
        // close does nothing
    }

    public async i2cFuncs(): Promise<i2c.I2CFuncs> {
        throw new Error('Method not supported.');
    }

    scan(address?: number | undefined): Promise<number[]>;
    scan(startAddr: number, endAddr: number): Promise<number[]>;
    async scan(startAddr?: number, endAddr?: number): Promise<number[]> {
        const args: any = {};
        if (startAddr) {
            if (endAddr) {
                args.startAddr = startAddr;
                args.endAddr = endAddr;
            } else {
                args.address = startAddr;
            }
        }

        return await this.sendRequest('scan', args);
    }

    public async deviceId(address: number): Promise<i2c.I2CDeviceId> {
        return await this.sendRequest('deviceId', { address });
    }

    i2cRead(_address: number, _length: number, _buffer: Buffer): Promise<i2c.BytesRead> {
        throw new Error('Method not implemented.');
    }

    i2cWrite(_address: number, _length: number, _buffer: Buffer): Promise<i2c.BytesWritten> {
        throw new Error('Method not implemented.');
    }

    public async readByte(address: number, command: number): Promise<number> {
        return await this.sendRequest('readByte', { address, command });
    }

    public async readWord(address: number, command: number): Promise<number> {
        return await this.sendRequest('readWord', { address, command });
    }

    readI2cBlock(_address: number, _command: number, _length: number, _buffer: Buffer): Promise<i2c.BytesRead> {
        throw new Error('Method not implemented.');
    }

    public async receiveByte(address: number): Promise<number> {
        return await this.sendRequest('receiveByte', { address });
    }

    public async sendByte(address: number, byte: number): Promise<void> {
        return await this.sendRequest('sendByte', { address, byte });
    }

    public async writeByte(address: number, command: number, byte: number): Promise<void> {
        return await this.sendRequest('writeByte', { address, command, byte });
    }

    public async writeWord(address: number, command: number, word: number): Promise<void> {
        return await this.sendRequest('writeWord', { address, command, word });
    }

    public async writeQuick(address: number, command: number, bit: number): Promise<void> {
        return await this.sendRequest('writeQuick', { address, command, bit });
    }

    writeI2cBlock(_address: number, _command: number, _length: number, _buffer: Buffer): Promise<i2c.BytesWritten> {
        throw new Error('Method not implemented.');
    }

    bus(): i2c.I2CBus {
        throw new Error('Bus is not available.');
    }

    private async sendRequest(method: string, args?: any): Promise<any> {
        const postData = JSON.stringify({ method, args: args || {} });
        return new Promise<any>((resolve, reject) => {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
            };
            this.log.debug(`RPC Client: Sending ${this.address} ${JSON.stringify(options)}; ${postData}`);
            const req = request(this.address, options, (resp) => {
                let data = '';

                if (resp.statusCode !== 200) {
                    reject(new Error(`Got status code ${resp.statusCode}`));
                    return;
                }

                // A chunk of data has been recieved.
                resp.on('data', (chunk) => {
                    data += chunk;
                });

                // The whole response has been received. Print out the result.
                resp.on('end', () => {
                    this.log.debug('RPC Client: Received ' + data);
                    resolve(JSON.parse(data));
                });
            }).on('error', (err) => {
                reject(err);
            });
            req.write(postData, (err) => {
                if (err) {
                    reject(err);
                }
            });
            req.end();
        });
    }
}
