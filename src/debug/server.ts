import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import * as i2c from 'i2c-bus';
import { parse } from 'url';

export class I2CServer {
    private readonly server: Server;
    constructor(private port: number, private bus: i2c.PromisifiedBus) {
        this.server = createServer((req: IncomingMessage, res: ServerResponse) => this.handleRequest(req, res));
    }

    start(): void {
        console.log(`Debug RPC server listening on port ${this.port}`);
        this.server.listen(this.port);
    }

    stop(): void {
        this.server.close();
    }

    private handleRequest(request: IncomingMessage, response: ServerResponse): void {
        const reqUrl = `http://${request.headers.host}${request.url}`;
        const parseUrl = parse(reqUrl, true);
        const pathname = parseUrl.pathname;

        // we're doing everything json
        response.setHeader('Content-Type', 'application/json');

        // buffer for incoming data
        let buf: any = null;

        // listen for incoming data
        request.on('data', (data) => {
            if (buf === null) {
                buf = data;
            } else {
                buf = buf + data;
            }
        });

        // on end proceed with compute
        request.on('end', () => {
            const body = buf !== null ? buf.toString() : null;

            let compute: Promise<any>;

            console.log('Handling request', parseUrl, body);
            switch (pathname) {
                case '/rpc':
                    compute = this.rpc(body);
                    break;
                default:
                    response.statusCode = 404;
                    response.end(`oops! ${pathname} not found here`);
                    return;
            }

            compute
                .then((res) => {
                    console.log('Sending response', res);
                    response.end(JSON.stringify(res));
                })
                .catch((err) => {
                    console.error(err);
                    response.statusCode = 500;
                    response.end('oops! server error: ' + err);
                });
        });
    }

    private async rpc(body: string): Promise<any> {
        const json = JSON.parse(body);
        if (!json.method) {
            throw new Error(`Property 'method' is not defined`);
        }

        switch (json.method) {
            case 'scan':
                if (json.args && json.args.address) {
                    return await this.bus.scan(json.args.address);
                } else if (json.args && json.args.startAddr) {
                    return await this.bus.scan(json.args.startAddr, json.args.endAddr);
                } else {
                    return await this.bus.scan();
                }
            case 'deviceId':
                return await this.bus.deviceId(json.args.address);
            case 'readByte':
                return await this.bus.readByte(json.args.address, json.args.command);
            case 'readWord':
                return await this.bus.readWord(json.args.address, json.args.command);
            case 'receiveByte':
                return await this.bus.receiveByte(json.args.address);
            case 'sendByte':
                await this.bus.sendByte(json.args.address, json.args.byte);
                return {}; // prefer an empty object to void
            case 'writeByte':
                await this.bus.writeByte(json.args.address, json.args.command, json.args.byte);
                return {}; // prefer an empty object to void
            case 'writeWord':
                await this.bus.writeWord(json.args.address, json.args.command, json.args.word);
                return {}; // prefer an empty object to void
            case 'writeQuick':
                await this.bus.writeQuick(json.args.address, json.args.command, json.args.bit);
                return {}; // prefer an empty object to void
            default:
                throw new Error(`Property 'method' is unknown: ${json.method}`);
        }
    }
}
