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

    public async i2cRead(address: number, length: number, buffer: Buffer): Promise<i2c.BytesRead> {
        const response = await this.sendRequest('i2cRead', { address, length });
        const responseBuffer = Buffer.from(response.buffer, 'hex');
        responseBuffer.copy(buffer);
        return {
            bytesRead: response.bytesRead,
            buffer: responseBuffer,
        };
    }

    public async i2cWrite(address: number, length: number, buffer: Buffer): Promise<i2c.BytesWritten> {
        const response = await this.sendRequest('i2cWrite', { address, length, buffer: buffer.toString('hex') });
        return {
            bytesWritten: response.bytesWritten,
            buffer: buffer,
        };
    }

    public async readByte(address: number, command: number): Promise<number> {
        return await this.sendRequest('readByte', { address, command });
    }

    public async readWord(address: number, command: number): Promise<number> {
        return await this.sendRequest('readWord', { address, command });
    }

    public async readI2cBlock(
        address: number,
        command: number,
        length: number,
        buffer: Buffer,
    ): Promise<i2c.BytesRead> {
        const response = await this.sendRequest('readI2cBlock', { address, command, length });
        const responseBuffer = Buffer.from(response.buffer, 'hex');
        responseBuffer.copy(buffer);
        return {
            bytesRead: response.bytesRead,
            buffer: responseBuffer,
        };
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

    public async writeI2cBlock(
        address: number,
        command: number,
        length: number,
        buffer: Buffer,
    ): Promise<i2c.BytesWritten> {
        const response = await this.sendRequest('i2cWrite', {
            address,
            command,
            length,
            buffer: buffer.toString('hex'),
        });
        return {
            bytesWritten: response.bytesWritten,
            buffer: buffer,
        };
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
