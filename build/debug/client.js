"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.I2CClient = void 0;
const http_1 = require("http");
class I2CClient {
    constructor(address, log) {
        this.address = address;
        this.log = log;
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            // close does nothing
        });
    }
    i2cFuncs() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('Method not supported.');
        });
    }
    scan(startAddr, endAddr) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = {};
            if (startAddr) {
                if (endAddr) {
                    args.startAddr = startAddr;
                    args.endAddr = endAddr;
                }
                else {
                    args.address = startAddr;
                }
            }
            return yield this.sendRequest('scan', args);
        });
    }
    deviceId(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendRequest('deviceId', { address });
        });
    }
    i2cRead(address, length, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.sendRequest('i2cRead', { address, length });
            const responseBuffer = Buffer.from(response.buffer, 'hex');
            responseBuffer.copy(buffer);
            return {
                bytesRead: response.bytesRead,
                buffer: responseBuffer,
            };
        });
    }
    i2cWrite(address, length, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.sendRequest('i2cWrite', { address, length, buffer: buffer.toString('hex') });
            return {
                bytesWritten: response.bytesWritten,
                buffer: buffer,
            };
        });
    }
    readByte(address, command) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendRequest('readByte', { address, command });
        });
    }
    readWord(address, command) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendRequest('readWord', { address, command });
        });
    }
    readI2cBlock(address, command, length, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.sendRequest('readI2cBlock', { address, command, length });
            const responseBuffer = Buffer.from(response.buffer, 'hex');
            responseBuffer.copy(buffer);
            return {
                bytesRead: response.bytesRead,
                buffer: responseBuffer,
            };
        });
    }
    receiveByte(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendRequest('receiveByte', { address });
        });
    }
    sendByte(address, byte) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendRequest('sendByte', { address, byte });
        });
    }
    writeByte(address, command, byte) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendRequest('writeByte', { address, command, byte });
        });
    }
    writeWord(address, command, word) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendRequest('writeWord', { address, command, word });
        });
    }
    writeQuick(address, command, bit) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendRequest('writeQuick', { address, command, bit });
        });
    }
    writeI2cBlock(address, command, length, buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.sendRequest('i2cWrite', {
                address,
                command,
                length,
                buffer: buffer.toString('hex'),
            });
            return {
                bytesWritten: response.bytesWritten,
                buffer: buffer,
            };
        });
    }
    bus() {
        throw new Error('Bus is not available.');
    }
    sendRequest(method, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const postData = JSON.stringify({ method, args: args || {} });
            return new Promise((resolve, reject) => {
                const options = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData),
                    },
                };
                this.log.debug(`RPC Client: Sending ${this.address} ${JSON.stringify(options)}; ${postData}`);
                const req = http_1.request(this.address, options, (resp) => {
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
        });
    }
}
exports.I2CClient = I2CClient;
//# sourceMappingURL=client.js.map