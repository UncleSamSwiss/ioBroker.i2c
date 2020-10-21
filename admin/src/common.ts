import Connection from '@iobroker/adapter-react/Connection';

export interface AppContext {
    socket: Connection;
    instanceId: string;
}
