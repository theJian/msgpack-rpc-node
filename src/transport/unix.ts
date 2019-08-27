import * as net from 'net';
import { existsSync } from 'fs';
import { ServerTransport, ClientTransport, MsgId } from './base';
import { NoConnectionError, ServerError } from '../error';
import { Session } from '../session';
import { Server } from '../server';

export class UnixServer extends ServerTransport {
  private socket?: net.Socket;
  private socketServer: net.Server;

  constructor(private server: Server, path: string) {
    super();

    if (existsSync(path)) {
      throw new ServerError(`Path exists. path = ${path}`)
    }

    this.socketServer = net.createServer(socket => {
      this.socket = socket;
      socket.on('data', data => {
        this.onRead(data);
      })
    })
    .listen(path);
  }

  onRequest(msgId: MsgId, method: string, params: unknown[]) {
    this.server.dispatchMethod(
      msgId,
      method,
      params,
      (data: Uint8Array) => {
        this.sendData(data);
      }
    )
  }

  onNotify(method: string, params: unknown[]) {
    this.server.dispatchMethod(null, method, params);
  }

  sendData(data: Uint8Array) {
    if (!this.socket || this.socket.connecting || this.socket.destroyed) {
      throw new NoConnectionError('Server is not running.');
    }
    this.socket.write(data);
  }

  close() {
    this.socketServer.close();
  }
}

export class UnixClient extends ClientTransport {
  private client: net.Socket;

  constructor(private session: Session<UnixClient>, path: string) {
    super();
    this.client = net.createConnection(path)
    .on('data', data => {
      this.onRead(data);
    });
  }

  connect(): Promise<boolean> | boolean {
    if (!this.client.connecting) return true;
    return new Promise(resolve => {
      this.client.on('connect', () => resolve(true))
    });
  }

  onResponse(msgId: MsgId, error: Error | null, result: unknown) {
    this.session.onResponse(msgId, error, result);
  }

  sendData(data: Uint8Array) {
    if (this.client.destroyed || this.client.connecting) {
      throw new NoConnectionError('Client is not connected to server.');
    }
    this.client.write(data);
  }

  close() {
    this.client.end();
  }
}
